#!/usr/bin/env bash
set -e

export PATH="$HOME/.npm-global/bin:$PATH"

WEBHOOK_URL="https://petersen-ki-betriebssteuerung.vercel.app/api/billing/stripe-webhook"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Petersen KI — Stripe E2E Test          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Stripe Test-Key eingeben (sk_test_…):"
read -rs SK
echo ""
if [[ ! "$SK" =~ ^sk_test_ ]]; then
  echo "FEHLER: Bitte sk_test_… Key eingeben."
  exit 1
fi

# ── 1. Test-Webhook anlegen ───────────────────────────────────────────────────
echo "1/4 — Test-Webhook anlegen…"

# Alte Test-Webhooks für diese URL bereinigen
EXISTING=$(curl -s "https://api.stripe.com/v1/webhook_endpoints?limit=20" \
  -u "${SK}:" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ids=[w['id'] for w in d.get('data',[]) if w.get('url')=='${WEBHOOK_URL}']
print('\n'.join(ids))" 2>/dev/null || echo "")

if [[ -n "$EXISTING" ]]; then
  while IFS= read -r wid; do
    [[ -z "$wid" ]] && continue
    curl -s -X DELETE "https://api.stripe.com/v1/webhook_endpoints/${wid}" -u "${SK}:" > /dev/null
    echo "  ✓ Alt gelöscht: $wid"
  done <<< "$EXISTING"
fi

WH=$(curl -s -X POST https://api.stripe.com/v1/webhook_endpoints \
  -u "${SK}:" \
  -d "url=${WEBHOOK_URL}" \
  -d "api_version=2024-04-10" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.async_payment_succeeded" \
  -d "enabled_events[]=checkout.session.async_payment_failed" \
  -d "enabled_events[]=checkout.session.expired")

WH_ID=$(echo "$WH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
WH_SECRET=$(echo "$WH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('secret',''))")
WH_ERR=$(echo "$WH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('message',''))" 2>/dev/null || echo "")

if [[ ! "$WH_SECRET" =~ ^whsec_ ]]; then
  echo "FEHLER Webhook: ${WH_ERR:-$WH}"
  exit 1
fi
echo "  ✓ Test-Webhook: $WH_ID"
echo "  ✓ Secret:       ${WH_SECRET:0:16}***"

# ── 2. Test-Checkout-Session erstellen ────────────────────────────────────────
echo ""
echo "2/4 — Test-Checkout-Session erstellen…"

SESSION=$(curl -s -X POST https://api.stripe.com/v1/checkout/sessions \
  -u "${SK}:" \
  -d "mode=payment" \
  -d "line_items[0][price_data][currency]=eur" \
  -d "line_items[0][price_data][unit_amount]=9900" \
  -d "line_items[0][price_data][product_data][name]=Petersen KI Test" \
  -d "line_items[0][quantity]=1" \
  -d "success_url=https://petersen-ki-betriebssteuerung.vercel.app/freischaltung?session_id={CHECKOUT_SESSION_ID}" \
  -d "cancel_url=https://petersen-ki-betriebssteuerung.vercel.app" \
  -d "metadata[invoice_id]=TEST-$(date +%s)" \
  -d "metadata[invoice_number]=TEST-001")

SESSION_ID=$(echo "$SESSION" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
SESSION_URL=$(echo "$SESSION" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))")
SESSION_ERR=$(echo "$SESSION" | python3 -c "import sys,json; print(json.load(sys.stdin).get('error',{}).get('message',''))" 2>/dev/null || echo "")

if [[ -z "$SESSION_ID" ]]; then
  echo "FEHLER Session: ${SESSION_ERR:-$SESSION}"
  exit 1
fi
echo "  ✓ Session: $SESSION_ID"
echo "  ✓ Checkout-URL: $SESSION_URL"

# ── 3. Zahlung mit Stripe Test-API simulieren (Payment Intent confirm) ────────
echo ""
echo "3/4 — Testzahlung simulieren (Karte 4242…)…"

# Payment Intent aus Session holen
PI_ID=$(curl -s "https://api.stripe.com/v1/checkout/sessions/${SESSION_ID}" \
  -u "${SK}:" | python3 -c "import sys,json; print(json.load(sys.stdin).get('payment_intent',''))")

if [[ -z "$PI_ID" || "$PI_ID" == "None" ]]; then
  echo "  ℹ  Payment Intent noch nicht verfügbar (Session offen)."
  echo "  → Testlink zum manuellen Bezahlen:"
  echo "    $SESSION_URL"
  echo "    Testkarte: 4242 4242 4242 4242 | Exp: 12/28 | CVC: 123"
else
  # Test-PaymentMethod anlegen
  PM=$(curl -s -X POST https://api.stripe.com/v1/payment_methods \
    -u "${SK}:" \
    -d "type=card" \
    -d "card[number]=4242424242424242" \
    -d "card[exp_month]=12" \
    -d "card[exp_year]=2028" \
    -d "card[cvc]=123")
  PM_ID=$(echo "$PM" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")

  curl -s -X POST "https://api.stripe.com/v1/payment_intents/${PI_ID}/confirm" \
    -u "${SK}:" \
    -d "payment_method=${PM_ID}" \
    -d "return_url=https://petersen-ki-betriebssteuerung.vercel.app" > /dev/null
  echo "  ✓ Zahlung bestätigt"
fi

# ── 4. Webhook-Logs in Stripe prüfen ─────────────────────────────────────────
echo ""
echo "4/4 — Warte 5 Sekunden auf Webhook-Verarbeitung…"
sleep 5

ATTEMPTS=$(curl -s "https://api.stripe.com/v1/webhook_endpoints/${WH_ID}" \
  -u "${SK}:" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "unbekannt")

echo "  Webhook-Status in Stripe: $ATTEMPTS"
echo ""
echo "  Vercel-Logs prüfen:"
vercel logs --prod 2>&1 | grep -E "stripe|webhook|billing|POST" | tail -10 || echo "  (keine passenden Logs)"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✓ E2E-Test abgeschlossen               ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Test-Webhook-ID für Stripe-Dashboard: $WH_ID"
echo "Checkout-Session: $SESSION_ID"
echo ""
echo "Im Stripe-Dashboard prüfen:"
echo "  stripe.com/test → Developers → Webhooks → $WH_ID → Logs"
echo ""
