/**
 * 키패드 숫자 인식 모듈 (특징점 기반)
 *
 * 쿠팡 PIN 키패드 스크린샷에서 숫자를 알고리즘으로 판별.
 * R채널 이진화 → 구멍 수 + 무게중심 + 사분면 밀도 + 수평 세그먼트 패턴으로 분류.
 */
/**
 * PNG 파일에서 숫자를 인식
 */
export declare function recognizeDigit(pngPath: string): string | null;
/**
 * 10개의 pad-key 스크린샷에서 키패드 매핑을 생성
 */
export declare function recognizeKeypadMapping(screenshotDir: string): Record<string, string> | null;
