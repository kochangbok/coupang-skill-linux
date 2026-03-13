import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const SESSION_DIR = path.join(os.homedir(), ".coupang-session");

export function getSessionDir(): string {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
  return SESSION_DIR;
}

export async function launchBrowser(headless = false): Promise<Browser> {
  return chromium.launch({ headless });
}

export async function createContext(browser: Browser): Promise<BrowserContext> {
  const storageStatePath = path.join(getSessionDir(), "storage-state.json");

  if (fs.existsSync(storageStatePath)) {
    return browser.newContext({
      storageState: storageStatePath,
      locale: "ko-KR",
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
  }

  return browser.newContext({
    locale: "ko-KR",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
}

export async function saveSession(context: BrowserContext): Promise<void> {
  const storageStatePath = path.join(getSessionDir(), "storage-state.json");
  await context.storageState({ path: storageStatePath });
}

export async function clearSession(): Promise<void> {
  const storageStatePath = path.join(getSessionDir(), "storage-state.json");
  if (fs.existsSync(storageStatePath)) {
    fs.unlinkSync(storageStatePath);
  }
}

export async function withBrowser<T>(
  fn: (page: Page, context: BrowserContext) => Promise<T>,
  headless = false,
): Promise<T> {
  const browser = await launchBrowser(headless);
  const context = await createContext(browser);
  const page = await context.newPage();

  try {
    const result = await fn(page, context);
    await saveSession(context);
    return result;
  } finally {
    await context.close();
    await browser.close();
  }
}
