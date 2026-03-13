import type { Page, BrowserContext } from "playwright";
import { withBrowser, saveSession } from "./browser.js";
import chalk from "chalk";
import ora from "ora";

const COUPANG_LOGIN_URL = "https://login.coupang.com/login/login.pang";
const COUPANG_HOME_URL = "https://www.coupang.com/";

async function waitForLogin(page: Page): Promise<boolean> {
  console.log(
    chalk.yellow("\n🔐 브라우저에서 쿠팡에 로그인해주세요."),
  );
  console.log(chalk.gray("   로그인이 완료되면 자동으로 감지됩니다.\n"));

  try {
    // 로그인 성공 시 홈으로 리다이렉트되거나, 마이쿠팡 링크가 나타남
    await page.waitForURL((url) => !url.toString().includes("login.coupang.com"), {
      timeout: 300_000, // 5분 대기
    });
    return true;
  } catch {
    return false;
  }
}

export async function login(): Promise<void> {
  console.log(chalk.blue("\n쿠팡 로그인을 시작합니다..."));

  await withBrowser(async (page: Page, context: BrowserContext) => {
    await page.goto(COUPANG_LOGIN_URL, { waitUntil: "domcontentloaded" });

    const loggedIn = await waitForLogin(page);

    if (loggedIn) {
      await saveSession(context);
      console.log(chalk.green("\n✅ 로그인 성공! 세션이 저장되었습니다."));
      console.log(
        chalk.gray("   다음부터는 자동으로 로그인됩니다.\n"),
      );
    } else {
      console.log(chalk.red("\n❌ 로그인 시간이 초과되었습니다. 다시 시도해주세요.\n"));
    }
  }, false); // headless: false — 브라우저 UI 표시
}

export async function checkLoginStatus(): Promise<boolean> {
  const spinner = ora("로그인 상태 확인 중...").start();

  try {
    const result = await withBrowser(async (page: Page) => {
      await page.goto(COUPANG_HOME_URL, { waitUntil: "domcontentloaded" });

      // 로그인된 상태에서는 "마이쿠팡" 또는 사용자 이름이 표시됨
      const loginLink = await page.$('a[href*="login.coupang.com"]');
      const myLink = await page.$('a[href*="mc/main"]');

      return myLink !== null && loginLink === null;
    }, true);

    if (result) {
      spinner.succeed("로그인 상태: 로그인됨");
    } else {
      spinner.fail("로그인 상태: 로그인 필요");
    }
    return result;
  } catch {
    spinner.fail("로그인 상태 확인 실패");
    return false;
  }
}
