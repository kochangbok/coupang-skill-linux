# OpenClaw smoke commands

아래 블록은 **비파괴 확인용**입니다. 주문/결제는 하지 않습니다.

```bash
cd /path/to/coupang-skill-linux
node scripts/openclaw-smoke.mjs
npx playwright install chromium
COUPANG_HEADLESS=1 node scripts/cpcli-launcher.mjs --help
COUPANG_HEADLESS=1 node scripts/cpcli-launcher.mjs status
```

자격 증명이 아직 없으면:

```bash
mkdir -p ~/.coupang-session
cat > ~/.coupang-session/credentials.json <<'JSON'
{
  "email": "your@email.com",
  "password": "your-password",
  "paymentPin": "123456"
}
JSON
```

가격/검색 확인(주문 없음):

```bash
COUPANG_HEADLESS=1 node scripts/cpcli-launcher.mjs search "마이노멀 바닐라 아이스크림 파인트"
```

주의:
- `search` 는 상품 선택 프롬프트가 나올 수 있습니다.
- 실제 주문은 `order-now` 이므로, smoke 단계에서는 호출하지 않는 것을 권장합니다.
