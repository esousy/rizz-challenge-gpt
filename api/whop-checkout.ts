import { getCheckoutUrl } from "../src/server/whop-handler.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
    const { userId, email } = body;

    if (!userId || !email) {
      return res.status(400).json({ error: "userId and email required" });
    }

    const checkoutUrl = await getCheckoutUrl(userId, email);
    if (!checkoutUrl) {
      return res.status(500).json({ error: "Failed to create checkout session" });
    }

    return res.status(200).json({ url: checkoutUrl });
  } catch (err) {
    console.error("[whop-checkout] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
