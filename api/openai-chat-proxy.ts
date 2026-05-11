import { handleChatProxy } from "../src/frontend/src/app/api/openai-chat-proxy/route.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : (req.body ?? {});
    const result = await handleChatProxy(body);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.status(result.status).json(result.json);
  } catch {
    return res.status(400).json({ error: "Invalid request body" });
  }
}
