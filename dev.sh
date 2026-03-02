#!/bin/bash
# dev.sh — starts Next.js + backend tunnels and keeps them alive

FRONTEND_PORT=3000
BACKEND_PORT=3001
CF_FRONT_LOG=/tmp/cf-front.log
CF_BACK_LOG=/tmp/cf-back.log

echo "🚀 Starting dev tunnels..."

start_tunnel() {
  local port=$1
  local logfile=$2
  pkill -f "cloudflared tunnel --url http://localhost:$port" 2>/dev/null
  sleep 1
  nohup cloudflared tunnel --url "http://localhost:$port" > "$logfile" 2>&1 &
  sleep 8
  grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$logfile" | head -1
}

echo "Frontend tunnel (port $FRONTEND_PORT):"
FRONT_URL=$(start_tunnel $FRONTEND_PORT $CF_FRONT_LOG)
echo "  → $FRONT_URL"

echo "Backend tunnel (port $BACKEND_PORT):"
BACK_URL=$(start_tunnel $BACKEND_PORT $CF_BACK_LOG)
echo "  → $BACK_URL"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 Update Developer Portal App URL:"
echo "   $FRONT_URL"
echo ""
echo "📝 Update frontend/.env.local:"
echo "   NEXT_PUBLIC_API_URL=$BACK_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Press Ctrl+C to stop all tunnels"

# Keep alive — restart tunnels if they die
while true; do
  sleep 30
  if ! ps ax | grep -q "cloudflared tunnel --url http://localhost:$FRONTEND_PORT"; then
    echo "⚠️  Frontend tunnel died, restarting..."
    NEW_URL=$(start_tunnel $FRONTEND_PORT $CF_FRONT_LOG)
    echo "  → New URL: $NEW_URL (update portal!)"
  fi
  if ! ps ax | grep -q "cloudflared tunnel --url http://localhost:$BACKEND_PORT"; then
    echo "⚠️  Backend tunnel died, restarting..."
    start_tunnel $BACKEND_PORT $CF_BACK_LOG > /dev/null
  fi
done
