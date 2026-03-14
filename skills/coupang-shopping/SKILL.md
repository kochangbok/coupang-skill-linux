---
name: coupang-shopping
description: "쿠팡에서 상품 검색, 장바구니, 주문/결제를 CLI로 자동화. 사용 시점 - (1) 사용자가 쿠팡에서 물건 사달라고 할 때, (2) 쿠팡 검색, (3) 쿠팡 장바구니 확인, (4) 쿠팡 주문/결제, (5) 쿠팡, coupang, 물건 사줘, 주문해줘, 장바구니 키워드 언급 시."
---

# coupang-shopping

쿠팡에서 상품 검색, 장바구니 담기, 주문/결제를 자동화하는 스킬.

## Triggers

- 사용자가 쿠팡에서 물건 사달라고 할 때
- "쿠팡", "coupang", "물건 사줘", "주문해줘", "장바구니" 키워드 언급 시
- 쿠팡 검색, 장바구니 확인, 주문/결제 요청 시

## Prerequisites

이 스킬을 사용하려면 `coupang-cli`가 설치되어 있어야 합니다.

### 1. 설치 확인

```bash
npx coupang-cli --version
```

### 2. 계정 정보 확인

`~/.coupang-session/credentials.json` 파일이 있어야 합니다:

```json
{
  "email": "your@email.com",
  "password": "your-password",
  "paymentPin": "123456"
}
```

- `paymentPin`은 쿠페이 결제 비밀번호 (6자리)로, 결제 시 필수입니다.
- 파일이 없으면 사용자에게 생성을 안내하세요.

### 3. 로그인

```bash
npx coupang-cli login
```

## Important: 에이전트는 브라우저를 직접 조작하지 않는다

- **모든 쿠팡 작업(검색, 로그인, 장바구니, 주문)은 반드시 CLI 명령(`npx coupang-cli ...`)으로만 실행**
- 에이전트가 직접 네이버/쿠팡 웹사이트를 방문하거나, 브라우저 자동화 도구로 조작하면 안 됨
- 로그인, 네이버 경유 접근 등은 CLI 내부에서 자동으로 처리됨
- 에이전트의 역할은 오직: (1) CLI 명령 실행, (2) 키패드 이미지 판독, (3) 결과 보고

## Instructions

### 핵심 아키텍처: CLI 백그라운드 실행 + 에이전트 키패드 판독

주문/결제 시 쿠팡 PIN 키패드는 **이미지로 렌더링된 랜덤 숫자**를 사용합니다.
DOM 텍스트와 실제 표시 숫자가 의도적으로 다르므로, **반드시 스크린샷 기반 시각 판독**이 필요합니다.

#### 주문 실행 흐름 (반드시 이 순서를 따를 것)

**Step 1: CLI를 백그라운드로 실행**

```bash
# 백그라운드로 주문 실행 (run_in_background: true)
npx coupang-cli order-now "상품명" -p card
```

- 반드시 `run_in_background: true`로 Bash 실행
- `-p card` (카드결제) 또는 `-p coupay` (쿠페이머니)

**Step 2: 키패드 준비 신호 모니터링**

CLI가 결제 단계에서 PIN 키패드를 만나면:
1. 각 버튼 스크린샷을 `~/.coupang-session/screenshots/pad-key-{0-9}.png`에 저장
2. `~/.coupang-session/keypad-ready` 시그널 파일 생성
3. `~/.coupang-session/keypad-mapping.json` 파일이 생길 때까지 최대 180초 대기

Step 1과 **동시에** 아래 폴링을 실행:

```bash
# 키패드 준비 신호 대기 (최대 180초)
for i in $(seq 1 180); do
  if [ -f ~/.coupang-session/keypad-ready ]; then
    echo "KEYPAD_READY"; exit 0
  fi
  sleep 1
done
echo "TIMEOUT"
```

**Step 3: 키패드 스크린샷 판독 + 매핑 파일 생성**

`KEYPAD_READY` 감지 시, Read 도구로 10개 스크린샷을 **모두 동시에** 읽기:

```
Read: ~/.coupang-session/screenshots/pad-key-0.png
Read: ~/.coupang-session/screenshots/pad-key-1.png
... (pad-key-9.png까지)
```

각 이미지에 표시된 숫자를 시각적으로 판독하여 매핑 JSON 작성:

```json
// 예: pad-key-0에 "9"가 보이고, pad-key-1에 "3"이 보이면:
{"0":"9","1":"3","2":"2","3":"4","4":"0","5":"8","6":"5","7":"6","8":"1","9":"7"}
```

Write 도구로 `~/.coupang-session/keypad-mapping.json`에 저장하면 CLI가 자동으로 읽어서 PIN 입력.

**Step 4: 결과 확인**

백그라운드 CLI의 TaskOutput을 확인하여 주문 성공/실패 보고.

### 네이버 경유 쿠팡 이동 (로그인 포함)

네이버 검색 → 쿠팡 링크 클릭 → 쿠팡 진입 + 로그인까지 CLI가 자동 처리:

```bash
npx coupang-cli navigate
```

- 에이전트가 직접 네이버/쿠팡을 방문할 필요 없음. 이 명령 하나로 해결.

### 검색만 할 때

검색은 키패드 판독이 필요 없으므로 단순 실행:

```bash
npx coupang-cli search "검색어"
```

### 장바구니 담기

```bash
npx coupang-cli cart-add "상품명"
npx coupang-cli cart-add "상품명" -n 2  # 2번째 검색 결과 선택
```

### 장바구니 조회

```bash
npx coupang-cli cart
```

## Options

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-n, --pick <번호>` | 검색 결과에서 선택할 상품 번호 | 1 |
| `-p, --payment <방식>` | 결제 수단 (`coupay` 또는 `card`) | `coupay` |

## Notes

- **키패드 매핑은 DOM 스크래핑 불가** — 반드시 이미지 판독으로 처리
- CLI 명령은 시간이 걸리므로 반드시 백그라운드로 실행
- macOS 전용 (Chrome/Firefox 설치 필요)
- 기본 브라우저는 Firefox (Akamai WAF 우회). Chrome 사용 시: `COUPANG_BROWSER=chrome`
- `order-now`은 확인 없이 바로 결제하므로, 주문 전 사용자에게 상품명/결제 수단 확인 필수
- 키패드가 2회 이상 나올 수 있음 (충전 PIN + 결제 PIN). 각 키패드마다 위 Step 2-3 반복 필요
