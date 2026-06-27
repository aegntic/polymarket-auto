#!/bin/bash
# POLYAGENT Telegram Webhook Setup
# Run this to register the webhook with Telegram

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-YOUR_BOT_TOKEN_HERE}"

# Set this to your public URL
WEBHOOK_URL="${1:-https://your-domain.com/api/tg/webhook}"

echo "Setting Telegram webhook..."
echo "URL: $WEBHOOK_URL"

RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\": \"${WEBHOOK_URL}\", \"allowed_updates\": [\"message\", \"callback_query\"]}")

echo "Response: $RESPONSE"

# Verify
echo ""
echo "Verifying webhook..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool 2>/dev/null || \
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
