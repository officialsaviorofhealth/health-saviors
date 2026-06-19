/**
 * Vercel Serverless Webhook Handler
 * Telegram → Vercel → grammY bot
 *
 * This is the main entry point for Telegram updates.
 * Telegram sends POST requests to this endpoint for every message/callback.
 */

import { webhookCallback } from "grammy";
import { getBot } from "../src/bot";

// grammY's webhookCallback handles:
// - Parsing the incoming JSON body
// - Feeding it to the bot's middleware stack
// - Returning 200 OK to Telegram
export default webhookCallback(getBot(), "std:http");
