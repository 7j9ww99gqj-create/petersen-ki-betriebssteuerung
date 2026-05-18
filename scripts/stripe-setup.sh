#!/usr/bin/env bash
set -e

export PATH="$HOME/.npm-global/bin:$PATH"

WEBHOOK_URL="https://petersen-ki-betriebssteuerung.vercel.app/api/billing/stripe-webhook"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   Petersen KI — Stripe Setup             ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Stripe Secret Key ──────────────────────────────────────────────────────
echo "Schritt 1/4 — Stripe Secret Key"
echo "  → stripe.com → Developers → API Keys → Secret key"
read -rsp "  Key eingeben (sk_test_… oder sk_live_…): " STRIPE_KEY
echo ""
if [[ -z "$STRIPE_KEY" || ! "$STRIPE_KEY" =~ ^sk_ ]]; then
  echo "FEHLER: Kein gültiger Stripe-Key."
  exit 1
fi

# ── 2. Supabase Service Role Key ──────────────────────────────────────────────
echo ""
echo "Schritt 2/4 — Supabase Service Role Key"
echo "  → supabase.com → Projekt cchmjrnzaqvowqihcdte → Settings → API → service_role"
read -rsp "  Key eingeben (eyJ…): " SUPABASE_KEY
echo ""
if [[ -z "$SUPABASE_KEY" ]]; then
  echo "FEHLER: Supabase Service Role Key fehlt."
  exit 1
fi

# ── 3. Alte Stripe-Webhooks für diese URL bereinigen + neuen anlegen ──────────
echo ""
echo "Schritt 3/4 — Stripe Webhook anlegen…"

# Bestehende Webhooks für diese URL finden und löschen (vermeidet Duplikate)
echo "  Suche bestehende Webhooks für $WEBHOOK_URL…"
EXISTING=$(curl -s "https://api.stripe.com/v1/webhook_endpoints?limit=20" \
  -u "${STRIPE_KEY}:" | python3 -c "
import sys, json
d = json.load(sys.stdin)
url = '${WEBHOOK_URL}'
ids = [w['id'] for w in d.get('data', []) if w.get('url') == url]
print('\n'.join(ids))
" 2>/dev/null || echo "")

if [[ -n "$EXISTING" ]]; then
  echo "  Lösche alte Webhooks: $EXISTING"
  while IFS= read -r wid; do
    [[ -z "$wid" ]] && continue
    curl -s -X DELETE "https://api.stripe.com/v1/webhook_endpoints/${wid}" \
      -u "${STRIPE_KEY}:" > /dev/null
    echo "  ✓ Gelöscht: $wid"
  done <<< "$EXISTING"
fi

# Neuen Webhook anlegen
WEBHOOK_RESPONSE=$(curl -s -X POST https://api.stripe.com/v1/webhook_endpoints \
  -u "${STRIPE_KEY}:" \
  -d "url=${WEBHOOK_URL}" \
  -d "api_version=2024-04-10" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.async_payment_succeeded" \
  -d "enabled_events[]=checkout.session.async_payment_failed" \
  -d "enabled_events[]=checkout.session.expired"
)

WEBHOOK_SECRET=$(echo "$WEBHOOK_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('secret',''))" 2>/dev/null || echo "")
WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
ERROR_MSG=$(echo "$WEBHOOK_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',{}).get('message',''))" 2>/dev/null || echo "")

if [[ -z "$WEBHOOK_SECRET" || ! "$WEBHOOK_SECRET" =~ ^whsec_ ]]; then
  echo "FEHLER: ${ERROR_MSG:-unbekannt}"
  echo "$WEBHOOK_RESPONSE"
  exit 1
fi

echo "  ✓ Webhook angelegt: $WEBHOOK_ID"
echo "  ✓ Signing Secret:   ${WEBHOOK_SECRET:0:16}***"

# ── 4. Vercel ENV-Vars überschreiben ─────────────────────────────────────────
echo ""
echo "Schritt 4/4 — Vercel ENV-Vars aktualisieren…"

# Erst entfernen, dann neu setzen
for VAR in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET SUPABASE_SERVICE_ROLE_KEY; do
  vercel env rm "$VAR" production --yes 2>/dev/null || true
  vercel env rm "$VAR" preview    --yes 2>/dev/null || true
  vercel env rm "$VAR" development --yes 2>/dev/null || true
  echo "  ✓ Alt entfernt: $VAR"
done

for VENV in production preview development; do
  printf '%s' "$STRIPE_KEY"     | vercel env add STRIPE_SECRET_KEY        "$VENV" --yes 2>&1 | grep -vE "^$" || true
  printf '%s' "$WEBHOOK_SECRET" | vercel env add STRIPE_WEBHOOK_SECRET     "$VENV" --yes 2>&1 | grep -vE "^$" || true
  printf '%s' "$SUPABASE_KEY"   | vercel env add SUPABASE_SERVICE_ROLE_KEY "$VENV" --yes 2>&1 | grep -vE "^$" || true
done
echo "  ✓ Alle Vars gesetzt"

echo ""
echo "  Redeploy auf Production…"
vercel --prod --yes 2>&1 | tail -3

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   ✓ Setup abgeschlossen!                 ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "E2E-Test (nach Redeploy ~1 Min warten):"
echo "  curl -s https://petersen-ki-betriebssteuerung.vercel.app/api/billing/stripe-webhook \\"
echo "    -X POST -H 'Content-Type: application/json' -d '{}'"
echo ""
echo "Stripe Test-Event senden:"
echo "  stripe.com → Developers → Webhooks → $WEBHOOK_ID → Send test event"
echo "  → checkout.session.completed"
echo ""
