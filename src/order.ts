import type { Page, BrowserContext } from "playwright";
import { withBrowser, saveSession } from "./browser.js";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

const COUPANG_BASE = "https://www.coupang.com";

async function navigateToProduct(page: Page, productUrl: string): Promise<void> {
  const url = productUrl.startsWith("http")
    ? productUrl
    : COUPANG_BASE + productUrl;

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".prod-buy-header, .prod-price-container", {
    timeout: 10_000,
  }).catch(() => {});
}

async function getProductInfo(page: Page): Promise<{ name: string; price: string }> {
  const name = await page
    .$eval("h1.prod-buy-header__title, .prod-buy-header__title", (el) =>
      el.textContent?.trim() ?? "(이름 없음)",
    )
    .catch(() => "(이름 없음)");

  const price = await page
    .$eval(".total-price strong, .prod-sale-price .total-price", (el) =>
      el.textContent?.trim() ?? "(가격 정보 없음)",
    )
    .catch(() => "(가격 정보 없음)");

  return { name, price };
}

export async function orderByUrl(productUrl: string): Promise<void> {
  console.log(chalk.blue("\n상품 페이지로 이동합니다..."));

  await withBrowser(async (page: Page, context: BrowserContext) => {
    await navigateToProduct(page, productUrl);
    const info = await getProductInfo(page);

    console.log(chalk.bold(`\n📦 ${info.name}`));
    console.log(chalk.green(`💰 ${info.price}\n`));

    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: "list",
        name: "action",
        message: "어떤 작업을 하시겠습니까?",
        choices: [
          { name: "🛒 장바구니에 담기", value: "cart" },
          { name: "⚡ 바로 구매하기", value: "buy" },
          { name: "❌ 취소", value: "cancel" },
        ],
      },
    ]);

    if (action === "cancel") {
      console.log(chalk.gray("취소되었습니다.\n"));
      return;
    }

    if (action === "cart") {
      await addToCart(page);
      await saveSession(context);
    } else if (action === "buy") {
      await buyNow(page, context);
    }
  }, true);
}

async function addToCart(page: Page): Promise<void> {
  const spinner = ora("장바구니에 담는 중...").start();

  try {
    const cartBtn = await page.$(
      'button.prod-btn-cart, button[class*="cart"], .prod-quantity-cart-button button',
    );
    if (cartBtn) {
      await cartBtn.click();
      await page.waitForTimeout(2000);
      spinner.succeed("장바구니에 담았습니다!");
    } else {
      spinner.fail("장바구니 버튼을 찾을 수 없습니다.");
    }
  } catch {
    spinner.fail("장바구니 담기 실패");
  }
}

async function buyNow(page: Page, context: BrowserContext): Promise<void> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      message: chalk.red("정말 구매하시겠습니까? 결제가 진행됩니다."),
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.gray("구매가 취소되었습니다.\n"));
    return;
  }

  const spinner = ora("구매 페이지로 이동 중...").start();

  try {
    const buyBtn = await page.$(
      'button.prod-btn-buy, button[class*="buy-now"], .prod-buy-btn button',
    );
    if (buyBtn) {
      await buyBtn.click();
      spinner.text = "결제 페이지 로딩 중...";

      // 결제 페이지로 이동 대기
      await page.waitForURL((url) => url.toString().includes("order") || url.toString().includes("checkout"), {
        timeout: 15_000,
      }).catch(() => {});

      await saveSession(context);
      spinner.succeed("결제 페이지로 이동했습니다.");
      console.log(
        chalk.yellow(
          "\n⚠️  결제는 브라우저에서 직접 완료해주세요.",
        ),
      );
      console.log(
        chalk.gray(
          "   보안을 위해 최종 결제는 자동화하지 않습니다.\n",
        ),
      );

      // 결제 완료 또는 사용자 종료까지 대기
      console.log(chalk.gray("   결제가 완료되면 Enter를 눌러주세요..."));
      await new Promise<void>((resolve) => {
        process.stdin.once("data", () => resolve());
      });
    } else {
      spinner.fail("구매 버튼을 찾을 수 없습니다.");
    }
  } catch {
    spinner.fail("구매 진행 중 오류가 발생했습니다.");
  }
}

export async function orderFromSearch(productUrl: string): Promise<void> {
  return orderByUrl(productUrl);
}
