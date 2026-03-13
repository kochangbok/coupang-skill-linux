import type { Page, BrowserContext } from "playwright";
import { withBrowser, saveSession } from "./browser.js";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

const CART_URL = "https://cart.coupang.com/cartView.pang";

export interface CartItem {
  name: string;
  price: string;
  quantity: string;
}

async function getCartItems(page: Page): Promise<CartItem[]> {
  await page.goto(CART_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".cart-deal-item, .cart-item", { timeout: 10_000 }).catch(() => {});

  return page.$$eval(
    ".cart-deal-item, .cart-item",
    (items) =>
      items.map((item) => {
        const nameEl = item.querySelector(".product-name, .cart-deal-name a");
        const priceEl = item.querySelector(
          ".unit-total-price, .cart-deal-price .total-price",
        );
        const qtyEl = item.querySelector(
          'input[type="number"], .quantity-value, .cart-deal-quantity input',
        );

        return {
          name: nameEl?.textContent?.trim() ?? "(이름 없음)",
          price: priceEl?.textContent?.trim() ?? "(가격 정보 없음)",
          quantity:
            (qtyEl as HTMLInputElement)?.value ??
            qtyEl?.textContent?.trim() ??
            "1",
        };
      }),
  );
}

function displayCart(items: CartItem[]): void {
  if (items.length === 0) {
    console.log(chalk.yellow("\n장바구니가 비어있습니다.\n"));
    return;
  }

  console.log(chalk.blue(`\n🛒 장바구니 (${items.length}개 상품):\n`));

  items.forEach((item, index) => {
    console.log(
      `  ${chalk.white(`${index + 1}.`)} ${chalk.bold(item.name)}`,
    );
    console.log(
      `     ${chalk.green(item.price)} × ${item.quantity}개`,
    );
    console.log();
  });
}

export async function viewCart(): Promise<void> {
  const spinner = ora("장바구니 조회 중...").start();

  await withBrowser(async (page: Page, context: BrowserContext) => {
    const items = await getCartItems(page);
    spinner.stop();
    displayCart(items);

    if (items.length === 0) return;

    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: "list",
        name: "action",
        message: "무엇을 하시겠습니까?",
        choices: [
          { name: "💳 전체 주문하기", value: "order" },
          { name: "🔄 새로고침", value: "refresh" },
          { name: "❌ 닫기", value: "close" },
        ],
      },
    ]);

    if (action === "order") {
      await orderCart(page, context);
    } else if (action === "refresh") {
      const refreshedItems = await getCartItems(page);
      displayCart(refreshedItems);
    }
  }, true);
}

async function orderCart(page: Page, context: BrowserContext): Promise<void> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      message: chalk.red("장바구니의 모든 상품을 주문하시겠습니까?"),
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.gray("주문이 취소되었습니다.\n"));
    return;
  }

  const spinner = ora("주문 페이지로 이동 중...").start();

  try {
    const orderBtn = await page.$(
      'button.order-btn, a[href*="order"], .cart-order-btn button',
    );

    if (orderBtn) {
      await orderBtn.click();
      await page.waitForURL((url) => url.toString().includes("order") || url.toString().includes("checkout"), {
        timeout: 15_000,
      }).catch(() => {});

      await saveSession(context);
      spinner.succeed("주문 페이지로 이동했습니다.");
      console.log(
        chalk.yellow("\n⚠️  결제는 브라우저에서 직접 완료해주세요.\n"),
      );
    } else {
      spinner.fail("주문 버튼을 찾을 수 없습니다.");
    }
  } catch {
    spinner.fail("주문 진행 중 오류가 발생했습니다.");
  }
}
