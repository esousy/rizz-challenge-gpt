import { handleWhopWebhook } from "../src/server/whop-handler.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
    // Whop sends the webhook signature in the Whop-Signature header
    const signature = req.headers["whop-signature"] ?? "";
    const result = await handleWhopWebhook(body, signature);
    return res.status(result.status).json(result.json);
  } catch (err) {
    console.error("[whop-webhook] Error:", err);
    return res.status(400).json({ error: "Invalid webhook payload" });
  }
}

