/**
 * Setup Telegram Webhook — one-time script
 * Usage: BOT_TOKEN=xxx WEBHOOK_URL=https://your-app.vercel.app/api/webhook tsx src/scripts/setup-webhook.ts
 *
 * Run this ONCE after deploying to Vercel to register the webhook URL with Telegram.
 */

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

if (!BOT_TOKEN) {
  console.error("ERROR: BOT_TOKEN environment variable is required");
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error("ERROR: WEBHOOK_URL environment variable is required");
  console.error("Example: https://your-app.vercel.app/api/webhook");
  process.exit(1);
}

async function main() {
  console.log(`Setting webhook to: ${WEBHOOK_URL}`);

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: true,
      }),
    },
  );

  const result = await response.json();

  if (result.ok) {
    console.log("Webhook set successfully!");
    console.log(`Result: ${JSON.stringify(result, null, 2)}`);
  } else {
    console.error("Failed to set webhook:");
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  // Verify
  const infoResponse = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`,
  );
  const info = await infoResponse.json();
  console.log("\nWebhook info:");
  console.log(JSON.stringify(info.result, null, 2));
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
