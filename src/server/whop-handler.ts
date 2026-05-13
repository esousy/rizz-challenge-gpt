/**
 * Whop webhook handler & checkout helpers.
 *
 * Handles membership.activated / membership.deactivated / payment.succeeded
 * and provides a function to generate checkout URLs for upgrade flow.
 */
import { neon } from "@neondatabase/serverless";

function getDbUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.NEON_DATABASE_URL;
}

const WHOP_API_KEY = process.env.WHOP_API_KEY ?? "";
const RIZZ_PRO_PLAN_ID = process.env.WHOP_PRO_PLAN_ID ?? "plan_Dxtf7y0t3JZUA";

// ── Webhook Verification ────────────────────────────────────────────────────
// Whop signs webhooks with a signature. For now we do basic validation.
// In production, verify the signature using your webhook secret.

function verifyWebhookSignature(_body: any, _signature: string): boolean {
  // TODO: Implement proper HMAC verification using WHOP_WEBHOOK_SECRET
  // For now, accept all webhooks (signature validation will be added)
  return true;
}

// ── Webhook Handler ─────────────────────────────────────────────────────────

export async function handleWhopWebhook(body: any, signature: string): Promise<{ status: number; json: any }> {
  if (!verifyWebhookSignature(body, signature)) {
    return { status: 401, json: { error: "Invalid signature" } };
  }

  const event = body;
  const eventType = event?.event ?? event?.type;

  console.log(`[whop-webhook] Received: ${eventType}`);

  switch (eventType) {
    case "membership.activated": {
      return await handleMembershipActivated(event?.data ?? event);
    }
    case "membership.deactivated": {
      return await handleMembershipDeactivated(event?.data ?? event);
    }
    case "payment.succeeded": {
      return await handlePaymentSucceeded(event?.data ?? event);
    }
    default:
      console.log(`[whop-webhook] Unhandled event: ${eventType}`);
      return { status: 200, json: { received: true } };
  }
}

async function handleMembershipActivated(data: any): Promise<{ status: number; json: any }> {
  const dbUrl = getDbUrl();
  if (!dbUrl) return { status: 500, json: { error: "DB not configured" } };

  const sql = neon(dbUrl);
  const userId = data?.metadata?.user_id ?? null;
  const email = data?.user?.email ?? null;
  const whopUserId = data?.user?.id ?? null;
  const planId = data?.plan_id ?? null;

  // Only activate if this is for Rizz Pro
  if (planId !== RIZZ_PRO_PLAN_ID) {
    console.log(`[whop-webhook] Ignoring activation for non-Pro plan: ${planId}`);
    return { status: 200, json: { received: true, ignored: true } };
  }

  if (userId) {
    // Upgrade existing user
    await sql`UPDATE users SET plan = 'pro', monthly_revenue_usd = COALESCE(monthly_revenue_usd, 0) WHERE id = ${userId}`;
    console.log(`[whop-webhook] Upgraded user ${userId} to pro`);
  } else if (email) {
    // Try to find user by email
    const rows = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (rows[0]) {
      await sql`UPDATE users SET plan = 'pro', monthly_revenue_usd = COALESCE(monthly_revenue_usd, 0) WHERE id = ${rows[0].id}`;
      console.log(`[whop-webhook] Upgraded user ${rows[0].id} to pro (matched by email)`);
    } else {
      console.log(`[whop-webhook] No matching user found for email: ${email}, whop_user: ${whopUserId}`);
    }
  }

  return { status: 200, json: { received: true } };
}

async function handleMembershipDeactivated(data: any): Promise<{ status: number; json: any }> {
  const dbUrl = getDbUrl();
  if (!dbUrl) return { status: 500, json: { error: "DB not configured" } };

  const sql = neon(dbUrl);
  const userId = data?.metadata?.user_id ?? null;
  const email = data?.user?.email ?? null;

  if (userId) {
    await sql`UPDATE users SET plan = 'free', monthly_revenue_usd = 0 WHERE id = ${userId}`;
    console.log(`[whop-webhook] Downgraded user ${userId} to free`);
  } else if (email) {
    const rows = await sql`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
    if (rows[0]) {
      await sql`UPDATE users SET plan = 'free', monthly_revenue_usd = 0 WHERE id = ${rows[0].id}`;
      console.log(`[whop-webhook] Downgraded user ${rows[0].id} to free (matched by email)`);
    }
  }

  return { status: 200, json: { received: true } };
}

async function handlePaymentSucceeded(data: any): Promise<{ status: number; json: any }> {
  // Log payment for revenue tracking
  const dbUrl = getDbUrl();
  if (!dbUrl) return { status: 200, json: { received: true } };

  const sql = neon(dbUrl);
  const userId = data?.metadata?.user_id ?? null;
  const amount = Number(data?.amount ?? 0) / 100; // Whop sends cents

  if (userId && amount > 0) {
    await sql`UPDATE users SET monthly_revenue_usd = ${amount} WHERE id = ${userId} AND plan = 'pro'`;
  }

  console.log(`[whop-webhook] Payment succeeded: $${amount} for user ${userId}`);
  return { status: 200, json: { received: true } };
}

// ── Checkout URL Generator ──────────────────────────────────────────────────

export async function getCheckoutUrl(userId: string, email: string): Promise<string | null> {
  try {
    const response = await fetch("https://api.whop.com/api/v2/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHOP_API_KEY}`,
      },
      body: JSON.stringify({
        plan_id: RIZZ_PRO_PLAN_ID,
        metadata: {
          user_id: userId,
          email,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[whop-checkout] Error creating checkout:", err);
      return null;
    }

    const data = await response.json() as any;
    return data?.checkout_url ?? data?.url ?? null;
  } catch (err) {
    console.error("[whop-checkout] Error:", err);
    return null;
  }
}
