import type { Page } from "playwright";
export interface SearchResult {
    name: string;
    price: string;
    url: string;
    rating?: string;
    rocketDelivery: boolean;
}
export declare function navigateToCoupangViaSearch(page: Page): Promise<Page>;
export declare function search(query: string): Promise<SearchResult | undefined>;
/**
 * 검색 → 첫 번째 상품 선택 → 장바구니 담기까지 한 세션에서 처리
 * CLI 비인터랙티브 모드용
 */
export declare function searchAndAddToCart(query: string, pickIndex?: number): Promise<boolean>;
/**
 * 검색 → 상품 선택 → 바로구매 → 결제까지 한 세션에서 처리
 * paymentMethod: "coupay" | "card"
 */
export declare function searchAndOrder(query: string, pickIndex?: number, paymentMethod?: "coupay" | "card"): Promise<boolean>;
/**
 * 네이버 → 쿠팡 검색 → 쿠팡 링크 클릭 → 쿠팡 진입
 * CLI 명령용 wrapper
 */
export declare function navigateToCoupang(): Promise<void>;
