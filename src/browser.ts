import { chromium, firefox, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from "playwright";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

type BrowserMode = "firefox" | "chromium" | "chrome";

export interface BrowserRuntime {
  mode: BrowserMode;
  headless: boolean;
  platform: NodeJS.Platform;
  hasDisplayServer: boolean;
  openClawExec: boolean;
  explicitBrowserSelection: boolean;
}

class BrowserLaunchError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "BrowserLaunchError";
  }
}

const SESSION_DIR = path.resolve(
  process.env.COUPANG_SESSION_DIR?.trim() || path.join(os.homedir(), ".coupang-session"),
);
const SCREENSHOT_DIR = path.join(SESSION_DIR, "screenshots");
const parsedCdpPort = Number.parseInt(process.env.COUPANG_CDP_PORT ?? "9222", 10);
const CDP_PORT = Number.isFinite(parsedCdpPort) ? parsedCdpPort : 9222;

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;

  return undefined;
}

function hasDisplayServer(): boolean {
  return Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY || process.env.MIR_SOCKET);
}

function isOpenClawExec(): boolean {
  return process.env.OPENCLAW_SHELL === "exec";
}

function normalizeBrowserMode(value: string | undefined): BrowserMode | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "auto") {
    return null;
  }

  if (normalized === "firefox" || normalized === "chromium" || normalized === "chrome") {
    return normalized;
  }

  console.warn(`[cpcli] 알 수 없는 COUPANG_BROWSER 값 "${value}". 자동 모드로 진행합니다.`);
  return null;
}

function resolveHeadless(preferredHeadless = false): boolean {
  const envHeadless = parseBooleanEnv(process.env.COUPANG_HEADLESS);
  if (envHeadless !== undefined) {
    return envHeadless;
  }

  if (preferredHeadless) {
    return true;
  }

  if (isOpenClawExec()) {
    return true;
  }

  return process.platform === "linux" && !hasDisplayServer();
}

export function getBrowserRuntime(preferredHeadless = false): BrowserRuntime {
  const explicitBrowser = normalizeBrowserMode(process.env.COUPANG_BROWSER);
  const openClawExec = isOpenClawExec();

  return {
    mode: explicitBrowser ?? (openClawExec || process.platform === "linux" ? "chromium" : "firefox"),
    headless: resolveHeadless(preferredHeadless),
    platform: process.platform,
    hasDisplayServer: hasDisplayServer(),
    openClawExec,
    explicitBrowserSelection: explicitBrowser !== null,
  };
}

export function getSessionDir(): string {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
  return SESSION_DIR;
}

function getScreenshotDir(): string {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  return SCREENSHOT_DIR;
}

function getStorageStatePath(): string {
  return path.join(getSessionDir(), "storage-state.json");
}

function getDefaultContextOptions(mode: BrowserMode): BrowserContextOptions {
  const options: BrowserContextOptions = {
    viewport: { width: 1440, height: 900 },
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  };

  const storageStatePath = getStorageStatePath();
  if (fs.existsSync(storageStatePath)) {
    options.storageState = storageStatePath;
  }

  if (mode === "firefox") {
    options.userAgent = buildFirefoxUserAgent();
  }

  return options;
}

function buildFirefoxUserAgent(): string {
  if (process.platform === "linux") {
    return "Mozilla/5.0 (X11; Linux x86_64; rv:146.0) Gecko/20100101 Firefox/146.0";
  }

  return "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0";
}

async function applyStealthInitScript(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });

    const chromeLike = { runtime: {}, loadTimes: () => ({}), csi: () => ({}) };
    if (!("chrome" in window)) {
      Object.defineProperty(window, "chrome", { get: () => chromeLike });
    }

    const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
    window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);

    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["ko-KR", "ko", "en-US", "en"],
    });
  });
}

function resolveExecutable(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return null;

  if (trimmed.includes(path.sep)) {
    return fs.existsSync(trimmed) ? trimmed : null;
  }

  try {
    const resolved = execFileSync("sh", ["-lc", `command -v ${trimmed}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return resolved || null;
  } catch {
    return null;
  }
}

function findChromePath(): string {
  const explicitPath = process.env.COUPANG_CHROME_PATH?.trim() || process.env.CHROME_PATH?.trim();
  if (explicitPath) {
    const resolvedExplicit = resolveExecutable(explicitPath);
    if (resolvedExplicit) {
      return resolvedExplicit;
    }
    throw new BrowserLaunchError(`COUPANG_CHROME_PATH/CHROME_PATH 경로를 찾을 수 없습니다: ${explicitPath}`);
  }

  const candidates = process.platform === "linux"
    ? [
        "/usr/bin/google-chrome-stable",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
        "/snap/bin/chromium",
        "google-chrome-stable",
        "google-chrome",
        "chromium-browser",
        "chromium",
        "chrome",
      ]
    : [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "google-chrome",
        "chromium",
      ];

  for (const candidate of candidates) {
    const resolved = resolveExecutable(candidate);
    if (resolved) {
      return resolved;
    }
  }

  throw new BrowserLaunchError(
    "Chrome/Chromium 실행 파일을 찾을 수 없습니다. COUPANG_BROWSER=chromium 을 사용하거나 COUPANG_CHROME_PATH 를 지정해주세요.",
  );
}

function shouldDisableChromiumSandbox(): boolean {
  const envValue = parseBooleanEnv(process.env.COUPANG_DISABLE_SANDBOX);
  if (envValue !== undefined) {
    return envValue;
  }

  return isOpenClawExec() || process.getuid?.() === 0;
}

function getChromiumArgs(options: { includeHeadlessFlag?: boolean } = {}): string[] {
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-site-isolation-trials",
    "--disable-infobars",
    "--window-size=1440,900",
    "--lang=ko-KR",
  ];

  if (process.platform === "linux") {
    args.push("--disable-dev-shm-usage");
  }

  if (shouldDisableChromiumSandbox()) {
    args.push("--no-sandbox");
  }

  if (options.includeHeadlessFlag) {
    args.push("--headless=new");
  }

  return args;
}

export async function saveSession(context: BrowserContext): Promise<void> {
  await context.storageState({ path: getStorageStatePath() });
}

export async function clearSession(): Promise<void> {
  const storageStatePath = getStorageStatePath();
  if (fs.existsSync(storageStatePath)) {
    fs.unlinkSync(storageStatePath);
  }
}

/** 랜덤 딜레이 (자연스러운 행동 모방) */
export function randomDelay(min = 500, max = 2000): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 스크린샷 저장 및 경로 반환 */
export async function takeScreenshot(page: Page, name: string): Promise<string> {
  const dir = getScreenshotDir();
  const filePath = path.join(dir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: false });
  return filePath;
}

/** 자연스러운 스크롤: PageDown 여러 번 + 마지막은 End 키 */
export async function naturalScroll(page: Page, times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press("PageDown");
    await randomDelay(800, 1500);
  }
  await page.keyboard.press("End");
  await randomDelay(500, 1000);
}

/** 이미 CDP 포트에 Chrome이 떠있는지 확인 */
async function isChromeRunning(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Chrome을 서브프로세스로 직접 실행 (Playwright가 아닌 실제 Chrome) */
async function launchChromeSubprocess(headless: boolean): Promise<ChildProcess | null> {
  if (await isChromeRunning()) {
    return null;
  }

  const chromePath = findChromePath();
  const userDataDir = path.join(getSessionDir(), "chrome-user-data");

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const chromeProcess = spawn(chromePath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...getChromiumArgs({ includeHeadlessFlag: headless }),
  ], {
    stdio: "ignore",
    detached: true,
  });

  chromeProcess.unref();

  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (await isChromeRunning()) {
      break;
    }
  }

  if (!(await isChromeRunning())) {
    throw new BrowserLaunchError("Chrome 실행 실패");
  }

  return chromeProcess;
}

async function withFirefox<T>(
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  headless: boolean,
): Promise<T> {
  let browser: Browser | undefined;
  try {
    browser = await firefox.launch({
      headless,
      firefoxUserPrefs: {
        "general.useragent.override": "",
        "intl.accept_languages": "ko-KR,ko,en-US,en",
        "privacy.resistFingerprinting": false,
      },
    });
  } catch (error) {
    throw new BrowserLaunchError("Firefox 실행 실패", error);
  }

  if (!browser) {
    throw new BrowserLaunchError("Firefox 브라우저 인스턴스를 만들지 못했습니다.");
  }

  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    context = await browser.newContext(getDefaultContextOptions("firefox"));
    page = await context.newPage();
    return await fn(page, context);
  } catch (error) {
    if (!context || !page) {
      throw new BrowserLaunchError("Firefox 컨텍스트 초기화 실패", error);
    }
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function withChromium<T>(
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  headless: boolean,
): Promise<T> {
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({
      headless,
      args: getChromiumArgs(),
    });
  } catch (error) {
    throw new BrowserLaunchError("Chromium 실행 실패", error);
  }

  if (!browser) {
    throw new BrowserLaunchError("Chromium 브라우저 인스턴스를 만들지 못했습니다.");
  }

  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    context = await browser.newContext(getDefaultContextOptions("chromium"));
    await applyStealthInitScript(context);
    page = await context.newPage();
    return await fn(page, context);
  } catch (error) {
    if (!context || !page) {
      throw new BrowserLaunchError("Chromium 컨텍스트 초기화 실패", error);
    }
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function withChromeCdp<T>(
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  headless: boolean,
): Promise<T> {
  try {
    await launchChromeSubprocess(headless);
  } catch (error) {
    if (error instanceof BrowserLaunchError) {
      throw error;
    }
    throw new BrowserLaunchError("Chrome CDP 서브프로세스 실행 실패", error);
  }

  let browser: Browser | undefined;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  } catch (error) {
    throw new BrowserLaunchError("Chrome CDP 연결 실패", error);
  }

  if (!browser) {
    throw new BrowserLaunchError("Chrome CDP 브라우저 인스턴스를 만들지 못했습니다.");
  }

  let context: BrowserContext | undefined;
  let page: Page | undefined;

  try {
    context = browser.contexts()[0] ?? await browser.newContext(getDefaultContextOptions("chrome"));
    await applyStealthInitScript(context);
    page = await context.newPage();
    return await fn(page, context);
  } catch (error) {
    if (!context || !page) {
      throw new BrowserLaunchError("Chrome CDP 컨텍스트 초기화 실패", error);
    }
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function runWithMode<T>(
  mode: BrowserMode,
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  headless: boolean,
): Promise<T> {
  switch (mode) {
    case "firefox":
      return withFirefox(fn, headless);
    case "chromium":
      return withChromium(fn, headless);
    case "chrome":
      return withChromeCdp(fn, headless);
  }
}

/**
 * 브라우저 실행 (macOS 기본: Firefox, Linux/OpenClaw 기본: Chromium, 명시 시 Chrome CDP 지원)
 */
export async function withBrowser<T>(
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  preferredHeadless = false,
): Promise<T> {
  const runtime = getBrowserRuntime(preferredHeadless);
  const modes = runtime.explicitBrowserSelection
    ? [runtime.mode]
    : [runtime.mode, "chromium", "firefox", "chrome"].filter(
        (mode, index, list): mode is BrowserMode => list.indexOf(mode) === index,
      );

  let lastLaunchError: BrowserLaunchError | null = null;

  for (const mode of modes) {
    try {
      return await runWithMode(mode, fn, runtime.headless);
    } catch (error) {
      if (!(error instanceof BrowserLaunchError)) {
        throw error;
      }

      lastLaunchError = error;
      if (runtime.explicitBrowserSelection || mode === modes[modes.length - 1]) {
        break;
      }

      console.warn(`[cpcli] ${mode} 실행 실패: ${error.message}. 다음 브라우저를 시도합니다.`);
    }
  }

  throw lastLaunchError ?? new BrowserLaunchError("브라우저 실행 실패");
}
