import { Webhook } from "svix";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!WEBHOOK_SECRET) {
    return res.status(500).json({ error: "Missing CLERK_WEBHOOK_SECRET" });
  }

  const svix_id = req.headers["svix-id"] as string;
  const svix_timestamp = req.headers["svix-timestamp"] as string;
  const svix_signature = req.headers["svix-signature"] as string;

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: "Missing svix headers" });
  }

  const body = JSON.stringify(req.body);
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  const eventType = evt.type;
  const user = evt.data;

  if (eventType === "user.created" || eventType === "user.updated") {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ error: "DATABASE_URL missing" });
    }

    const sql = neon(dbUrl);

    const email = user.email_addresses?.[0]?.email_address || null;
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
    const phone = user.phone_numbers?.[0]?.phone_number || "";
    const connectedAccounts = user.external_accounts || [];
    const preferences = user.public_metadata?.preferences || {};
    const plan = user.public_metadata?.plan || "free";

    await sql`
      INSERT INTO profiles (
        id,
        clerk_user_id,
        email,
        full_name,
        phone,
        connected_accounts,
        preferences,
        plan,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${user.id},
        ${email},
        ${fullName},
        ${phone},
        ${JSON.stringify(connectedAccounts)},
        ${JSON.stringify(preferences)},
        ${plan},
        NOW()
      )
      ON CONFLICT (clerk_user_id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        phone = EXCLUDED.phone,
        connected_accounts = EXCLUDED.connected_accounts,
        preferences = EXCLUDED.preferences,
        plan = EXCLUDED.plan,
        updated_at = NOW()
    `;
  }

  return res.status(200).json({ success: true });
}
