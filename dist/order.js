import { withBrowser, saveSession } from "./browser.js";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
const COUPANG_BASE = "https://www.coupang.com";
async function navigateToProduct(page, productUrl) {
    const url = productUrl.startsWith("http")
        ? productUrl
        : COUPANG_BASE + productUrl;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".prod-buy-header, .prod-price-container", {
        timeout: 10_000,
    }).catch(() => { });
}
async function getProductInfo(page) {
    const name = await page
        .$eval("h1.prod-buy-header__title, .prod-buy-header__title", (el) => el.textContent?.trim() ?? "(이름 없음)")
        .catch(() => "(이름 없음)");
    const price = await page
        .$eval(".total-price strong, .prod-sale-price .total-price", (el) => el.textContent?.trim() ?? "(가격 정보 없음)")
        .catch(() => "(가격 정보 없음)");
    return { name, price };
}
export async function orderByUrl(productUrl) {
    console.log(chalk.blue("\n상품 페이지로 이동합니다..."));
    await withBrowser(async (page, context) => {
        await navigateToProduct(page, productUrl);
        const info = await getProductInfo(page);
        console.log(chalk.bold(`\n📦 ${info.name}`));
        console.log(chalk.green(`💰 ${info.price}\n`));
        const { action } = await inquirer.prompt([
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
        }
        else if (action === "buy") {
            await buyNow(page, context);
        }
    }, true);
}
async function addToCart(page) {
    const spinner = ora("장바구니에 담는 중...").start();
    try {
        const cartBtn = await page.$('button.prod-btn-cart, button[class*="cart"], .prod-quantity-cart-button button');
        if (cartBtn) {
            await cartBtn.click();
            await page.waitForTimeout(2000);
            spinner.succeed("장바구니에 담았습니다!");
        }
        else {
            spinner.fail("장바구니 버튼을 찾을 수 없습니다.");
        }
    }
    catch {
        spinner.fail("장바구니 담기 실패");
    }
}
async function buyNow(page, context) {
    const { confirm } = await inquirer.prompt([
        {
            type: "confirm",
            name: "confirm",
            message: chalk.red("정말 구매하시겠습니까? 결제 페이지로 이동합니다."),
            default: false,
        },
    ]);
    if (!confirm) {
        console.log(chalk.gray("구매가 취소되었습니다.\n"));
        return;
    }
    const spinner = ora("구매 페이지로 이동 중...").start();
    try {
        const buyBtn = await page.$('button.prod-btn-buy, button[class*="buy-now"], .prod-buy-btn button');
        if (!buyBtn) {
            spinner.fail("구매 버튼을 찾을 수 없습니다.");
            return;
        }
        await buyBtn.click();
        spinner.text = "결제 페이지 로딩 중...";
        // 결제 페이지(주문서)로 이동 대기
        await page
            .waitForURL((url) => url.toString().includes("order") ||
            url.toString().includes("checkout"), { timeout: 15_000 })
            .catch(() => { });
        await saveSession(context);
        spinner.succeed("결제 페이지로 이동했습니다.");
        // 주문서 정보 표시
        await displayCheckoutSummary(page);
        // 최종 결제 확인
        await proceedPayment(page, context);
    }
    catch {
        spinner.fail("구매 진행 중 오류가 발생했습니다.");
    }
}
async function displayCheckoutSummary(page) {
    // 주문서에서 정보 추출
    const summary = await page.evaluate(() => {
        const getText = (sel) => document.querySelector(sel)?.textContent?.trim() ?? null;
        // 배송지
        const address = getText(".address-info, .shipping-address, [class*='address']") ?? "(배송지 정보 없음)";
        // 총 결제금액
        const totalPrice = getText(".total-payment-price, .total_price, [class*='totalPrice'], [class*='total-price'] strong") ??
            "(결제 금액 정보 없음)";
        // 상품명
        const productName = getText(".product-name, .order-item-name, [class*='productName']") ?? "(상품 정보 없음)";
        // 결제수단
        const paymentMethod = getText(".payment-method-selected, [class*='paymentMethod'] .selected, .pay-method .on") ?? null;
        return { address, totalPrice, productName, paymentMethod };
    });
    console.log(chalk.blue("\n========== 주문 요약 =========="));
    console.log(`  상품: ${chalk.bold(summary.productName)}`);
    console.log(`  배송지: ${chalk.white(summary.address)}`);
    console.log(`  결제금액: ${chalk.green.bold(summary.totalPrice)}`);
    if (summary.paymentMethod) {
        console.log(`  결제수단: ${chalk.white(summary.paymentMethod)}`);
    }
    console.log(chalk.blue("================================\n"));
}
async function proceedPayment(page, context) {
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
    const spinner = ora("결제 진행 중...").start();
    try {
        // 결제하기 버튼 클릭
        const payBtn = await page.$('button[class*="submit"], button[class*="payment"], .order-submit-btn, ' +
            'button:has-text("결제하기"), button:has-text("주문하기"), ' +
            'a[class*="submit"], .btn-payment');
        if (!payBtn) {
            spinner.fail("결제 버튼을 찾을 수 없습니다. 브라우저에서 직접 결제해주세요.");
            console.log(chalk.gray("  결제가 완료되면 Enter를 눌러주세요..."));
            await waitForEnter();
            return;
        }
        await payBtn.click();
        spinner.text = "결제 처리 대기 중...";
        // 결제 팝업/카드사 인증 등 처리 대기
        // 결제 완료 페이지 또는 인증 팝업 감지
        const result = await Promise.race([
            // 결제 완료 페이지 감지
            page
                .waitForURL((url) => {
                const u = url.toString();
                return u.includes("orderComplete") || u.includes("success") || u.includes("done");
            }, { timeout: 120_000 })
                .then(() => "completed"),
            // 결제 인증 팝업 대기 (카드사 등)
            page
                .waitForEvent("popup", { timeout: 30_000 })
                .then(() => "popup")
                .catch(() => "no_popup"),
        ]);
        if (result === "popup") {
            spinner.info("카드사 인증 팝업이 열렸습니다.");
            console.log(chalk.yellow("  인증을 완료해주세요. 완료 후 자동으로 진행됩니다.\n"));
            // 인증 완료 후 결제 완료 페이지 대기
            await page
                .waitForURL((url) => {
                const u = url.toString();
                return u.includes("orderComplete") || u.includes("success") || u.includes("done");
            }, { timeout: 120_000 })
                .catch(() => { });
        }
        await saveSession(context);
        // 결제 완료 확인
        const currentUrl = page.url();
        if (currentUrl.includes("Complete") || currentUrl.includes("success") || currentUrl.includes("done")) {
            spinner.succeed(chalk.green.bold("결제가 완료되었습니다!"));
            // 주문번호 추출 시도
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
            spinner.warn("결제 결과를 확인할 수 없습니다.");
            console.log(chalk.yellow("  쿠팡 앱이나 웹사이트에서 주문 내역을 확인해주세요.\n"));
        }
    }
    catch {
        spinner.fail("결제 진행 중 오류가 발생했습니다.");
        console.log(chalk.yellow("  쿠팡에서 주문 상태를 확인해주세요.\n"));
    }
}
function waitForEnter() {
    return new Promise((resolve) => {
        process.stdin.once("data", () => resolve());
    });
}
export async function orderFromSearch(productUrl) {
    return orderByUrl(productUrl);
}
