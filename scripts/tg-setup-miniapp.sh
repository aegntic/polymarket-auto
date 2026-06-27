#!/bin/bash
# POLYAGENT Telegram Mini App Registration
# Run these commands via @BotFather to set up the mini app
# https://t.me/BotFather

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-YOUR_BOT_TOKEN_HERE}"

echo "=== POLYAGENT Telegram Mini App Setup ==="
echo ""
echo "1. Go to @BotFather and send: /newapp"
echo "   (or /myapps → select your bot → Bot Settings → Menu Button → Edit Menu Button URL)"
echo ""
echo "2. Set the Mini App URL to:"
echo "   https://your-domain.com/tg"
echo ""
echo "3. Set the menu button text to: Dashboard"
echo ""
echo "--- OR use the API directly ---"
echo ""

MINI_APP_URL="${1:-https://your-domain.com/tg}"

echo "Setting menu button via API..."
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d "{\"menu_button\": {\"type\": \"web_app\", \"text\": \"📊 Dashboard\", \"web_app\": {\"url\": \"${MINI_APP_URL}\"}}}"

echo ""
echo ""
echo "Verifying menu button..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getChatMenuButton" | python3 -m json.tool 2>/dev/null || \
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getChatMenuButton"
