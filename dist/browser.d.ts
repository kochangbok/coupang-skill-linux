import { type BrowserContext, type Page } from "playwright";
type BrowserMode = "firefox" | "chromium" | "chrome";
export interface BrowserRuntime {
    mode: BrowserMode;
    headless: boolean;
    platform: NodeJS.Platform;
    hasDisplayServer: boolean;
    openClawExec: boolean;
    explicitBrowserSelection: boolean;
}
export declare function getBrowserRuntime(preferredHeadless?: boolean): BrowserRuntime;
export declare function getSessionDir(): string;
export declare function saveSession(context: BrowserContext): Promise<void>;
export declare function clearSession(): Promise<void>;
/** 랜덤 딜레이 (자연스러운 행동 모방) */
export declare function randomDelay(min?: number, max?: number): Promise<void>;
/** 스크린샷 저장 및 경로 반환 */
export declare function takeScreenshot(page: Page, name: string): Promise<string>;
/** 자연스러운 스크롤: PageDown 여러 번 + 마지막은 End 키 */
export declare function naturalScroll(page: Page, times?: number): Promise<void>;
/**
 * 브라우저 실행 (macOS 기본: Firefox, Linux/OpenClaw 기본: Chromium, 명시 시 Chrome CDP 지원)
 */
export declare function withBrowser<T>(fn: (page: Page, context: BrowserContext) => Promise<T>, preferredHeadless?: boolean): Promise<T>;
export {};
