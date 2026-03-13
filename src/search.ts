import type { Page } from "playwright";
import { withBrowser } from "./browser.js";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";

export interface SearchResult {
  name: string;
  price: string;
  url: string;
  rating?: string;
  rocketDelivery: boolean;
}

async function searchProducts(page: Page, query: string): Promise<SearchResult[]> {
  const searchUrl = `https://www.coupang.com/np/search?component=&q=${encodeURIComponent(query)}&channel=user`;

  await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#productList, .search-product", { timeout: 10_000 }).catch(() => {});

  const results = await page.$$eval(
    "li.search-product",
    (items) =>
      items.slice(0, 20).map((item) => {
        const nameEl = item.querySelector(".name, .descriptions .name");
        const priceEl = item.querySelector(".price-value, .price .price-value");
        const linkEl = item.querySelector("a.search-product-link");
        const ratingEl = item.querySelector(".rating-star .rating");
        const rocketEl = item.querySelector(".rocket-icon, .badge-rocket");

        return {
          name: nameEl?.textContent?.trim() ?? "(이름 없음)",
          price: priceEl?.textContent?.trim() ?? "(가격 정보 없음)",
          url: linkEl?.getAttribute("href") ?? "",
          rating: ratingEl?.textContent?.trim(),
          rocketDelivery: rocketEl !== null,
        };
      }),
  );

  return results;
}

function displayResults(results: SearchResult[]): void {
  if (results.length === 0) {
    console.log(chalk.yellow("\n검색 결과가 없습니다.\n"));
    return;
  }

  console.log(chalk.blue(`\n검색 결과 (${results.length}개):\n`));

  results.forEach((item, index) => {
    const rocket = item.rocketDelivery ? chalk.magenta(" 🚀로켓배송") : "";
    const rating = item.rating ? chalk.yellow(` ★${item.rating}`) : "";
    console.log(
      `  ${chalk.white(`${index + 1}.`)} ${chalk.bold(item.name)}`,
    );
    console.log(
      `     ${chalk.green(item.price + "원")}${rocket}${rating}`,
    );
    console.log();
  });
}

export async function search(query: string): Promise<SearchResult | undefined> {
  const spinner = ora(`"${query}" 검색 중...`).start();

  const results = await withBrowser(async (page) => {
    return searchProducts(page, query);
  }, true);

  spinner.stop();
  displayResults(results);

  if (results.length === 0) return undefined;

  const { selectedIndex } = await inquirer.prompt<{ selectedIndex: number }>([
    {
      type: "number",
      name: "selectedIndex",
      message: "상품 번호를 선택하세요 (0: 취소):",
      default: 0,
      validate: (val: number) => {
        if (val >= 0 && val <= results.length) return true;
        return `1~${results.length} 사이의 번호를 입력하세요 (0: 취소)`;
      },
    },
  ]);

  if (selectedIndex === 0) {
    console.log(chalk.gray("취소되었습니다.\n"));
    return undefined;
  }

  return results[selectedIndex - 1];
}
