/**
 * get-openai-key.ts  (server-side context only)
 *
 * Resolves the OpenAI API key for use in server-side proxy handlers.
 * The key is NEVER sent to the browser or included in any response body.
 *
 * Resolution order:
 *   1. process.env.OPENAI_API_KEY  (preferred — set this in your deployment env)
 *   2. IC backend via getOpenAIKeyViaAgent()  (fallback for dev without env var)
 *
 * NOTE: The actual runtime implementation for the Vite dev/preview server is
 * in vite-plugin-ai-proxy.js (plain JS with full Node.js context).
 * This TypeScript file is provided for type safety and as a reference.
 */

let cachedKey: string | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the OpenAI API key server-side.
 * Reads from process.env.OPENAI_API_KEY first, then fetches from IC backend.
 * Result is cached for 5 minutes to avoid repeated roundtrips.
 */
export async function getOpenAIKey(): Promise<string | null> {
  // 1. Environment variable — fastest and most secure
  const envKey = process.env.OPENAI_API_KEY;
  if (typeof envKey === "string" && envKey.startsWith("sk-")) {
    return envKey;
  }

  // 2. Return cached IC key if still fresh
  const now = Date.now();
  if (cachedKey && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedKey;
  }

  // 3. Fetch from IC backend via @dfinity/agent (dynamic import — server only)
  const key = await getOpenAIKeyViaAgent();
  if (key) {
    cachedKey = key;
    cacheTimestamp = now;
  }
  return key;
}

/**
 * Fetch the OpenAI key from the IC backend using @dfinity/agent.
 * Uses a dynamic import so this module can be safely imported in any context.
 * Only works in Node.js environments (Vite server middleware).
 */
/**
 * Fetch the OpenAI key from the IC backend using @dfinity/agent.
 * Uses a dynamic import so this module can be safely imported in any context.
 * Only works in Node.js environments (Vite server middleware).
 * Has a 5-second timeout so it never hangs the proxy request indefinitely.
 */
export async function getOpenAIKeyViaAgent(): Promise<string | null> {
  const envKey = process.env.OPENAI_API_KEY;
  if (typeof envKey === "string" && envKey.startsWith("sk-")) {
    return envKey;
  }

  try {
    const canisterId = process.env.CANISTER_ID_BACKEND;
    if (!canisterId) return null;

    // Dynamic import — only available in Node.js context
    const { HttpAgent } = await import("@dfinity/agent");
    const { IDL } = await import("@dfinity/candid");
    const { Principal } = await import("@dfinity/principal");

    const host =
      process.env.DFX_NETWORK === "local"
        ? "http://127.0.0.1:4943"
        : "https://icp0.io";

    const agent = await HttpAgent.create({
      host,
      // Use anonymous identity — getOpenAIKeyPublic is a public query method
      identity: undefined,
      shouldFetchRootKey: process.env.DFX_NETWORK === "local",
    });

    // Wrap the query in a 5-second timeout so slow/unreachable canisters don't hang requests
    const queryPromise = agent.query(Principal.fromText(canisterId), {
      methodName: "getOpenAIKeyPublic",
      arg: IDL.encode([], []),
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("IC canister query timed out after 5s")),
        5000,
      ),
    );

    const result = await Promise.race([queryPromise, timeoutPromise]);

    if (result.status !== "replied") return null;

    // Decode [opt text] response
    const decoded = IDL.decode([IDL.Opt(IDL.Text)], result.reply.arg) as [
      Array<string>,
    ];
    const optValue = decoded[0];
    const key =
      Array.isArray(optValue) && optValue.length > 0 ? optValue[0] : null;

    if (typeof key === "string" && key.startsWith("sk-")) return key;
    return null;
  } catch {
    return null;
  }
}
