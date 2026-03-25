# cpcli — 쿠팡 쇼핑 CLI

Playwright 브라우저 자동화로 쿠팡에서 **검색, 장바구니, 주문/결제**를 터미널에서 처리하는 CLI 도구.

macOS에서는 **Firefox**, Linux/OpenClaw에서는 **Chromium** 을 기본 브라우저로 사용합니다. 필요하면 Chrome CDP 모드도 지원합니다.

## 사용 방법 1: AI Agent Skill (추천)

AI 코딩 에이전트에서 스킬로 설치하면 자연어로 쿠팡 쇼핑을 할 수 있습니다.

### 스킬 설치

```bash
npx skills add Zimins/coupang-skill
```

### 사용 예시

AI 에이전트에서 자연어로 요청하면 됩니다:

```
쿠팡에서 펩시 제로 500ml 24개 주문해줘
쿠팡에서 무선 키보드 검색해줘
장바구니에 두루마리 휴지 담아줘
```

또는 슬래시 커맨드로 직접 호출:

```
/coupang-shopping 생수 2L 12개 주문해줘
```

> 스킬이 내부적으로 cpcli CLI를 호출하므로, 아래 초기 설정(계정 정보 등록)은 동일하게 필요합니다.

---

## 사용 방법 2: CLI 직접 사용

### 설치

```bash
npm install -g coupang-cli
```

또는 설치 없이 바로 실행:

```bash
npx coupang-cli <command>
```

> **요구사항**: Node.js 18+, macOS 또는 Linux
>
> 기본 브라우저는 Playwright가 설치한 브라우저를 사용합니다. Linux/OpenClaw는 Chromium, macOS는 Firefox가 기본값이며, 시스템 Chrome/Chromium이 있으면 `COUPANG_BROWSER=chrome` 도 사용할 수 있습니다.

## 초기 설정

### 1. 계정 정보 등록

`~/.coupang-session/credentials.json` 파일을 생성합니다:

```json
{
  "email": "your@email.com",
  "password": "your-password",
  "paymentPin": "123456"
}
```

- `paymentPin`: 쿠페이 결제 비밀번호 (6자리) — **결제 시 필수**. 없으면 결제 단계에서 실패합니다.

### 2. 로그인

```bash
cpcli login
```

- 저장된 계정 정보가 있으면 자동 로그인 시도
- headless/OpenClaw 환경에서는 저장된 계정 정보가 반드시 필요함
- GUI 환경이면 브라우저가 열려 수동 로그인 가능
- 로그인 후 세션이 `~/.coupang-session/` 또는 `COUPANG_SESSION_DIR` 경로에 저장됨

## 명령어

### 상품 검색

```bash
cpcli search "검색어"
cpcli search "무선 키보드" -o  # 검색 후 바로 주문
```

### 검색 → 바로 주문 (비인터랙티브)

```bash
cpcli order-now "펩시 제로 500ml 24개"                  # 1번 상품, 쿠페이 머니
cpcli order-now "뿌셔뿌셔 1박스" -p card                # 신용/체크카드
cpcli order-now "생수 2L 12개" -n 3                     # 3번 상품 선택
cpcli order-now "휴지" -n 2 -p card                     # 2번 상품, 카드 결제
```

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-n, --pick <번호>` | 검색 결과에서 선택할 상품 번호 | 1 |
| `-p, --payment <방식>` | 결제 수단 (`coupay` 또는 `card`) | `coupay` |

### 장바구니 담기 (비인터랙티브)

```bash
cpcli cart-add "두루마리 휴지"
cpcli cart-add "코카콜라 제로" -n 2  # 2번 상품
```

### URL로 직접 주문

```bash
cpcli order "https://www.coupang.com/vp/products/..."
```

### 장바구니 조회

```bash
cpcli cart
```

### 로그인 상태 확인 / 로그아웃

```bash
cpcli status
cpcli logout
```

## 브라우저 설정

기본값은 환경에 따라 자동 선택됩니다.

```bash
# macOS 기본값: Firefox
cpcli order-now "상품명"

# Linux/OpenClaw 기본값: Chromium
COUPANG_BROWSER=chromium cpcli order-now "상품명"

# 시스템 Chrome/Chromium을 CDP로 재사용
COUPANG_BROWSER=chrome cpcli order-now "상품명"

# headless 강제 (OpenClaw exec는 자동 headless)
COUPANG_HEADLESS=1 cpcli search "상품명"
```

| 브라우저 | 기본 대상 | 장점 | 단점 |
|----------|-----------|------|------|
| Firefox | macOS 기본 | WAF 우회 안정적, CDP 감지 없음 | Playwright Firefox 설치 필요 |
| Chromium | Linux / OpenClaw 기본 | Playwright 기본 설치와 잘 맞고 headless에 강함 | Firefox보다 WAF 우회 여유가 적을 수 있음 |
| Chrome CDP | 명시 선택 | 기존 Chrome 세션 재사용 가능 | 시스템 Chrome 경로 필요, 차단 위험 |

### OpenClaw / Linux 팁

- OpenClaw `exec` 툴은 `OPENCLAW_SHELL=exec` 를 설정하므로, cpcli는 자동으로 **Chromium + headless** 조합을 사용합니다.
- `DISPLAY`/`WAYLAND_DISPLAY` 가 없는 Linux에서는 headless 로 자동 전환됩니다.
- headless 에서는 수동 로그인 창을 띄울 수 없으므로 `credentials.json` 을 먼저 채워두는 것이 안전합니다.
- 세션 경로를 분리하고 싶다면 `COUPANG_SESSION_DIR=/path/to/session` 을 사용할 수 있습니다.
- Chrome CDP 포트 충돌이 나면 `COUPANG_CDP_PORT=9333` 처럼 바꿔 실행하세요.

## 동작 방식

```
cpcli order-now "상품명"
  │
  ├─ 네이버 경유 쿠팡 진입 (referrer 생성)
  ├─ 쿠팡 로그인
  ├─ 쿠팡 검색 → 상품 선택
  ├─ 검색 결과에서 상품 링크 클릭
  ├─ 바로구매 → 주문서 페이지
  ├─ 결제 수단 선택 (쿠페이 머니 / 신용카드)
  ├─ 결제하기 클릭
  ├─ PIN 키패드 자동 인식 (알고리즘 OCR)
  └─ 주문 완료 확인
```

## 파일 구조

```
${COUPANG_SESSION_DIR:-~/.coupang-session}/
├── credentials.json          # 계정 정보
├── storage-state.json        # 브라우저 세션 (쿠키 등)
├── chrome-user-data/         # Chrome 사용자 데이터 (Chrome CDP 모드 시)
└── screenshots/              # 디버깅용 스크린샷
    ├── order-*.png           # 주문 과정 스크린샷
    └── pad-key-*.png         # PIN 키패드 스크린샷 (OCR용)
```

## 주의사항

- **macOS + Linux 지원**: Linux/OpenClaw는 Chromium이 기본값입니다
- **Firefox 권장 (macOS)**: Chrome CDP 모드는 Akamai WAF에 의해 차단될 수 있습니다
- **결제 주의**: `order-now` 명령은 확인 없이 바로 결제를 진행합니다
- **PIN 자동 인식**: 키패드 숫자를 알고리즘(특징점 OCR)으로 자동 판별합니다. 인식 실패 시 에이전트 fallback
- **정책 변경**: 쿠팡의 정책에 따라 동작이 변경될 수 있습니다

## 라이선스

MIT
