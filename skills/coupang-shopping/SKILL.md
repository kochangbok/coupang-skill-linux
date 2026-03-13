# coupang-shopping

쿠팡에서 상품 검색, 장바구니 담기, 주문/결제를 자동화하는 스킬.

## Triggers

- 사용자가 쿠팡에서 물건 사달라고 할 때
- "쿠팡", "coupang", "물건 사줘", "주문해줘", "장바구니" 키워드 언급 시
- 쿠팡 검색, 장바구니 확인, 주문/결제 요청 시

## Prerequisites

이 스킬을 사용하려면 `cpcli` CLI가 설치되어 있어야 합니다.

### 1. cpcli 설치 확인

```bash
npx cpcli --version
```

설치가 안 되어 있으면 사용자에게 안내합니다:

```bash
npm install -g cpcli
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
npx cpcli login
```

- 로그인 상태는 `npx cpcli status`로 확인할 수 있습니다.

## Instructions

사용자의 요청에 따라 아래 CLI 명령을 **백그라운드로 실행**하고, 완료되면 결과를 사용자에게 알려줍니다.

### 상품 검색

```bash
npx cpcli search "검색어"
```

### 장바구니 담기

```bash
npx cpcli cart-add "상품명"
npx cpcli cart-add "상품명" -n 2  # 2번째 검색 결과 선택
```

완료 시: "장바구니에 [상품명] 담았습니다" 라고 알려줍니다.

### 바로 주문

```bash
npx cpcli order-now "상품명"                  # 1번 상품, 쿠페이 머니
npx cpcli order-now "상품명" -p card          # 신용/체크카드
npx cpcli order-now "상품명" -n 3             # 3번째 검색 결과
npx cpcli order-now "상품명" -n 2 -p card     # 2번 상품, 카드 결제
```

완료 시: "주문 완료! [상품명] 결제되었습니다" 라고 알려줍니다.
실패 시: 에러 메시지와 함께 `~/.coupang-session/screenshots/` 스크린샷 확인을 안내합니다.

### 장바구니 조회

```bash
npx cpcli cart
```

### URL로 직접 주문

```bash
npx cpcli order "https://www.coupang.com/vp/products/..."
```

## Options

| 옵션 | 설명 | 기본값 |
|------|------|--------|
| `-n, --pick <번호>` | 검색 결과에서 선택할 상품 번호 | 1 |
| `-p, --payment <방식>` | 결제 수단 (`coupay` 또는 `card`) | `coupay` |

## Notes

- CLI 명령은 시간이 걸릴 수 있으므로 백그라운드로 실행하는 것을 권장합니다.
- macOS 전용입니다 (Chrome 설치 필요).
- `order-now` 명령은 확인 없이 바로 결제를 진행하므로, 주문 전 사용자에게 상품명과 결제 수단을 확인하세요.
