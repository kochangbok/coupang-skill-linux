import { withBrowser, saveSession } from "./browser.js";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
const CART_URL = "https://cart.coupang.com/cartView.pang";
async function getCartItems(page) {
    await page.goto(CART_URL, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".cart-deal-item, .cart-item", { timeout: 10_000 }).catch(() => { });
    return page.$$eval(".cart-deal-item, .cart-item", (items) => items.map((item) => {
        const nameEl = item.querySelector(".product-name, .cart-deal-name a");
        const priceEl = item.querySelector(".unit-total-price, .cart-deal-price .total-price");
        const qtyEl = item.querySelector('input[type="number"], .quantity-value, .cart-deal-quantity input');
        return {
            name: nameEl?.textContent?.trim() ?? "(이름 없음)",
            price: priceEl?.textContent?.trim() ?? "(가격 정보 없음)",
            quantity: qtyEl?.value ??
                qtyEl?.textContent?.trim() ??
                "1",
        };
    }));
}
function displayCart(items) {
    if (items.length === 0) {
        console.log(chalk.yellow("\n장바구니가 비어있습니다.\n"));
        return;
    }
    console.log(chalk.blue(`\n🛒 장바구니 (${items.length}개 상품):\n`));
    items.forEach((item, index) => {
        console.log(`  ${chalk.white(`${index + 1}.`)} ${chalk.bold(item.name)}`);
        console.log(`     ${chalk.green(item.price)} × ${item.quantity}개`);
        console.log();
    });
}
export async function viewCart() {
    const spinner = ora("장바구니 조회 중...").start();
    await withBrowser(async (page, context) => {
        const items = await getCartItems(page);
        spinner.stop();
        displayCart(items);
        if (items.length === 0)
            return;
        const { action } = await inquirer.prompt([
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
        }
        else if (action === "refresh") {
            const refreshedItems = await getCartItems(page);
            displayCart(refreshedItems);
        }
    }, true);
}
async function orderCart(page, context) {
    const { confirm } = await inquirer.prompt([
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
        const orderBtn = await page.$('button.order-btn, a[href*="order"], .cart-order-btn button');
        if (!orderBtn) {
            spinner.fail("주문 버튼을 찾을 수 없습니다.");
            return;
        }
        await orderBtn.click();
        await page
            .waitForURL((url) => url.toString().includes("order") ||
            url.toString().includes("checkout"), { timeout: 15_000 })
            .catch(() => { });
        await saveSession(context);
        spinner.succeed("주문 페이지로 이동했습니다.");
        // 주문 요약 정보 표시
        const summary = await page.evaluate(() => {
            const getText = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
            return {
                totalPrice: getText(".total-payment-price, .total_price, [class*='totalPrice'], [class*='total-price'] strong") ??
                    "(결제 금액 정보 없음)",
                itemCount: getText(".order-item-count, [class*='itemCount']") ?? null,
            };
        });
        console.log(chalk.blue("\n========== 주문 요약 =========="));
        console.log(`  결제금액: ${chalk.green.bold(summary.totalPrice)}`);
        if (summary.itemCount) {
            console.log(`  상품 수: ${chalk.white(summary.itemCount)}`);
        }
        console.log(chalk.blue("================================\n"));
        // 최종 결제 확인
        const { finalConfirm } = await inquirer.prompt([
            {
                type: "confirm",
                name: "finalConfirm",
                message: chalk.red.bold("위 내용으로 결제를 진행하시겠습니까?"),
                default: false,
            },
        ]);
        if (!finalConfirm) {
            console.log(chalk.gray("결제가 취소되었습니다.\n"));
            return;
        }
        const paySpinner = ora("결제 진행 중...").start();
        const payBtn = await page.$('button[class*="submit"], button[class*="payment"], .order-submit-btn, ' +
            'button:has-text("결제하기"), button:has-text("주문하기"), ' +
            'a[class*="submit"], .btn-payment');
        if (!payBtn) {
            paySpinner.fail("결제 버튼을 찾을 수 없습니다. 브라우저에서 직접 결제해주세요.");
            console.log(chalk.gray("  결제가 완료되면 Enter를 눌러주세요..."));
            await new Promise((resolve) => {
                process.stdin.once("data", () => resolve());
            });
            return;
        }
        await payBtn.click();
        paySpinner.text = "결제 처리 대기 중...";
        // 결제 완료 또는 인증 팝업 대기
        const result = await Promise.race([
            page
                .waitForURL((url) => {
                const u = url.toString();
                return u.includes("orderComplete") || u.includes("success") || u.includes("done");
            }, { timeout: 120_000 })
                .then(() => "completed"),
            page
                .waitForEvent("popup", { timeout: 30_000 })
                .then(() => "popup")
                .catch(() => "no_popup"),
        ]);
        if (result === "popup") {
            paySpinner.info("카드사 인증 팝업이 열렸습니다.");
            console.log(chalk.yellow("  인증을 완료해주세요.\n"));
            await page
                .waitForURL((url) => {
                const u = url.toString();
                return u.includes("orderComplete") || u.includes("success") || u.includes("done");
            }, { timeout: 120_000 })
                .catch(() => { });
        }
        await saveSession(context);
        const currentUrl = page.url();
        if (currentUrl.includes("Complete") || currentUrl.includes("success") || currentUrl.includes("done")) {
            paySpinner.succeed(chalk.green.bold("결제가 완료되었습니다!"));
            const orderNumber = await page
                .evaluate(() => {
                const el = document.querySelector('[class*="orderNumber"], [class*="order-number"], .order-id');
                return el?.textContent?.trim() ?? null;
            })
                .catch(() => null);
            if (orderNumber) {
                console.log(chalk.green(`  주문번호: ${orderNumber}\n`));
            }
        }
        else {
            paySpinner.warn("결제 결과를 확인할 수 없습니다.");
            console.log(chalk.yellow("  쿠팡에서 주문 상태를 확인해주세요.\n"));
        }
    }
    catch {
        console.error(chalk.red("주문 진행 중 오류가 발생했습니다."));
    }
}
