---
name: coupang-shopping
description: "쿠팡에서 상품 검색, 장바구니, 주문/결제를 CLI로 자동화. 사용 시점 - (1) 사용자가 쿠팡에서 물건 사달라고 할 때, (2) 쿠팡 검색, (3) 쿠팡 장바구니 확인, (4) 쿠팡 주문/결제, (5) 쿠팡, coupang, 물건 사줘, 주문해줘, 장바구니 키워드 언급 시."
metadata: {"openclaw":{"emoji":"🛒","homepage":"https://github.com/kochangbok/coupang-skill-linux","os":["darwin","linux"],"requires":{"bins":["node","npm"]}}}
---

# coupang-shopping

쿠팡에서 상품 검색, 장바구니 담기, 주문/결제를 자동화하는 스킬.

## Triggers

- 사용자가 쿠팡에서 물건 사달라고 할 때
- "쿠팡", "coupang", "물건 사줘", "주문해줘", "장바구니" 키워드 언급 시
- 쿠팡 검색, 장바구니 확인, 주문/결제 요청 시

## Runtime policy

- 이 스킬은 **대화형 bash 세션을 전제로 하지 않는다**
- OpenClaw에서는 `exec`/`system.run` 같은 **단발성 명령 실행 도구**를 우선 사용한다
- 가능하면 항상 아래 런처 명령을 사용한다:

```bash
node {baseDir}/../../scripts/cpcli-launcher.mjs <cpcli-args...>
```

이 런처는 다음 순서로 자동 시도한다:
1. 현재 저장소의 `dist/cli.js`
2. PATH에 있는 `cpcli`
3. 마지막 fallback으로 `npm exec --package <packed-tarball> cpcli ...`

즉, **git clone / npm ci / npm link / 전역 설치를 매번 다시 시도하지 않는다.**

## Prerequisites

이 스킬을 사용하려면 `node`와 `npm`이 있어야 합니다.
브라우저는 작업 중 필요할 때만 설치/확인합니다.

### 1. 런처 확인

```bash
node {baseDir}/../../scripts/cpcli-launcher.mjs --help
```

이 명령이 성공하면 이후 모든 쿠팡 작업은 동일한 런처를 통해 수행합니다.

### 2. 브라우저 확인 및 설치

기본 브라우저는 **macOS에서는 Firefox**, **Linux/OpenClaw에서는 Chromium** 입니다.

```bash
# Linux/OpenClaw 기본 브라우저용
npx playwright install chromium

# macOS에서 기본 Firefox 모드까지 함께 쓰려면 추가 설치
npx playwright install firefox
```

- 브라우저 강제 선택: `COUPANG_BROWSER=firefox|chromium|chrome`
- OpenClaw `exec` 환경에서는 Chromium + headless 모드가 기본 우선순위입니다
- macOS GUI 환경에서는 Firefox가 더 안정적일 수 있습니다

### 3. 계정 정보 확인 (자동 생성)

`${COUPANG_SESSION_DIR:-~/.coupang-session}/credentials.json` 파일이 있어야 합니다.

파일이 없으면 아래 템플릿으로 생성합니다:

```json
{
  "email": "여기에_쿠팡_이메일_입력",
  "password": "여기에_비밀번호_입력",
  "paymentPin": "000000"
}
```

## Important

- 모든 쿠팡 작업은 **런처 경유 CLI 명령**으로만 실행
- 에이전트가 직접 네이버/쿠팡 웹사이트를 브라우저 도구로 조작하지 않음
- 로그인, 네이버 경유 접근, PIN 처리 등은 CLI 내부에서 담당
- command 실행 도구 자체가 없는 환경이면, 설치/실행을 가장한 재시도 보고를 하지 말고 **환경 제약**으로 즉시 보고

## Command templates

### 검색

```bash
node {baseDir}/../../scripts/cpcli-launcher.mjs search "검색어"
```

### 가격 조회

```bash
node {baseDir}/../../scripts/cpcli-launcher.mjs price-check --json "검색어"
```

### 장바구니 담기

```bash
node {baseDir}/../../scripts/cpcli-launcher.mjs cart-add "상품명" -n 2
```

### 주문

```bash
node {baseDir}/../../scripts/cpcli-launcher.mjs order-now "상품명" -p card
```

### 장바구니 조회

```bash
node {baseDir}/../../scripts/cpcli-launcher.mjs cart
```

### 로그인

```bash
node {baseDir}/../../scripts/cpcli-launcher.mjs login
```

## 주문 시 키패드 처리 절차

1. `rm -f ~/.coupang-session/keypad-ready ~/.coupang-session/keypad-mapping.json`
2. 주문 명령 실행:
   `node {baseDir}/../../scripts/cpcli-launcher.mjs order-now "상품명" -p card`
3. 동시에 키패드 신호를 폴링:
   `node {baseDir}/../../scripts/wait-keypad-ready.mjs 180`
4. `KEYPAD_READY` 감지 시 스크린샷 파일 읽기:
   `~/.coupang-session/screenshots/pad-key-0.png ~ pad-key-9.png`
5. 각 이미지의 숫자를 판독해 `~/.coupang-session/keypad-mapping.json` 생성
6. 키패드가 여러 번 나오면 4~5를 반복

## Notes

- 키패드 매핑은 DOM 스크래핑 불가 — 이미지 판독 필요
- OpenClaw/Linux에서는 Chromium headless 조합이 기본
- macOS GUI 환경에서는 Firefox 쪽이 더 잘 통과할 수 있음
- `order-now`은 확인 없이 바로 결제를 진행하므로 주의
