# cpcli — 쿠팡 쇼핑 CLI

쿠팡에서 **검색, 장바구니, 주문/결제**를 자동화하기 위한 개인용 CLI/워크스페이스 스킬 패키지입니다.

macOS에서는 **Firefox**, Linux/OpenClaw에서는 **Chromium** 을 기본 브라우저로 사용합니다. 필요하면 Chrome CDP 모드도 지원합니다.

## 구성

이 저장소에는 두 가지가 함께 들어 있습니다.

- `cpcli`: 터미널에서 직접 실행하는 CLI
- `skills/coupang-shopping`: 에이전트 워크스페이스에 넣어 쓰는 스킬

## 설치

### 방법 1: 저장소에서 직접 사용

```bash
git clone https://github.com/kochangbok/coupang-skill-linux.git
cd coupang-skill-linux
npm ci
npm run build
```

CLI를 전역 명령으로 연결하려면:

```bash
npm link
cpcli --help
```

전역 링크 없이 현재 저장소에서만 실행하려면:

```bash
npm run build
node dist/cli.js --help
```

### 방법 2: 워크스페이스 스킬로 사용

OpenClaw/Codex 계열 워크스페이스에서는 이 저장소의 `skills/coupang-shopping` 폴더를 그대로 사용할 수 있습니다.

- 워크스페이스 안에 이 저장소를 두고 사용하거나
- 필요한 경우 `skills/coupang-shopping` 을 별도 스킬 디렉터리로 복사해 사용하세요

스킬이 로드되면 `/coupang-shopping` 형태로 호출할 수 있습니다.

## 요구사항

- Node.js 18+
- macOS 또는 Linux
- Playwright 브라우저 설치 가능 환경

기본 브라우저는 Playwright가 설치한 브라우저를 사용합니다. Linux/OpenClaw는 Chromium, macOS는 Firefox가 기본값이며, 시스템 Chrome/Chromium이 있으면 `COUPANG_BROWSER=chrome` 도 사용할 수 있습니다.

## 초기 설정

### 1. 계정 정보 등록

`${COUPANG_SESSION_DIR:-~/.coupang-session}/credentials.json` 파일을 생성합니다:

```json
{
  "email": "your@email.com",
  "password": "your-password",
  "paymentPin": "123456"
}
```

- `paymentPin`: 쿠페이 결제 비밀번호 6자리
- 결제 자동화 시 필수입니다

### 2. 로그인

```bash
cpcli login
```

- 저장된 계정 정보가 있으면 자동 로그인 시도
- headless/OpenClaw 환경에서는 저장된 계정 정보가 반드시 필요함
- GUI 환경이면 브라우저가 열려 수동 로그인 가능
- 로그인 후 세션이 `${COUPANG_SESSION_DIR:-~/.coupang-session}` 경로에 저장됨

## 주요 명령어

### 상품 검색

```bash
cpcli search "무선 키보드"
cpcli search "무선 키보드" -o
```

### 검색 → 바로 주문

```bash
cpcli order-now "펩시 제로 500ml 24개"
cpcli order-now "뿌셔뿌셔 1박스" -p card
cpcli order-now "생수 2L 12개" -n 3
```

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-n, --pick <번호>` | 검색 결과에서 선택할 상품 번호 | 1 |
| `-p, --payment <방식>` | 결제 수단 (`coupay` 또는 `card`) | `coupay` |

### 장바구니 담기

```bash
cpcli cart-add "두루마리 휴지"
cpcli cart-add "코카콜라 제로" -n 2
```

### URL로 직접 주문

```bash
cpcli order "https://www.coupang.com/vp/products/..."
```

### 장바구니 / 상태 / 로그아웃

```bash
cpcli cart
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
| Chromium | Linux / OpenClaw 기본 | headless/CI 환경에 강함 | Firefox보다 WAF 우회 여유가 적을 수 있음 |
| Chrome CDP | 명시 선택 | 기존 Chrome 세션 재사용 가능 | 시스템 Chrome 경로 필요, 차단 위험 |

### OpenClaw / Linux 팁

- OpenClaw `exec` 환경에서는 자동으로 **Chromium + headless** 조합을 우선 사용합니다.
- `DISPLAY`/`WAYLAND_DISPLAY` 가 없는 Linux에서는 headless 로 자동 전환됩니다.
- headless 에서는 수동 로그인 창을 띄울 수 없으므로 `credentials.json` 을 먼저 채워두는 것이 안전합니다.
- 세션 경로를 분리하고 싶다면 `COUPANG_SESSION_DIR=/path/to/session` 을 사용하세요.
- Chrome CDP 포트 충돌이 나면 `COUPANG_CDP_PORT=9333` 처럼 바꿔 실행할 수 있습니다.

## 동작 방식

```text
cpcli order-now "상품명"
  │
  ├─ 네이버/검색엔진 경유 쿠팡 진입
  ├─ 쿠팡 로그인
  ├─ 검색 결과에서 상품 선택
  ├─ 바로구매 → 주문서 페이지
  ├─ 결제 수단 선택
  ├─ 결제하기 클릭
  ├─ PIN 키패드 자동 인식 (알고리즘 OCR)
  └─ 주문 완료 확인
```

## 파일 구조

```text
${COUPANG_SESSION_DIR:-~/.coupang-session}/
├── credentials.json          # 계정 정보
├── storage-state.json        # 브라우저 세션 (쿠키 등)
├── chrome-user-data/         # Chrome 사용자 데이터 (Chrome CDP 모드 시)
└── screenshots/              # 디버깅용 스크린샷
    ├── order-*.png           # 주문 과정 스크린샷
    └── pad-key-*.png         # PIN 키패드 스크린샷
```

## 주의사항

- Linux/OpenClaw에서는 Chromium이 기본값입니다
- macOS GUI 환경에서는 Firefox 쪽이 더 안정적일 수 있습니다
- `order-now` 명령은 확인 없이 바로 결제를 진행합니다
- PIN 자동 인식 실패 시 스크린샷 기반 fallback이 필요할 수 있습니다
- 쿠팡 UI/정책 변경에 따라 선택자나 흐름이 깨질 수 있습니다

## 라이선스 및 고지

이 저장소는 개인 운영 환경에 맞게 재구성된 private adaptation 입니다.

- 라이선스: MIT (`LICENSE` 참조)
- 출처/수정 고지: `NOTICE` 참조
