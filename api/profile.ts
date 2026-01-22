import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClerkClient } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";

const DB_URL = process.env.DATABASE_URL;
const CLERK_SECRET = process.env.CLERK_SECRET_KEY;

if (!DB_URL) throw new Error("Missing DATABASE_URL env var");
if (!CLERK_SECRET) throw new Error("Missing CLERK_SECRET_KEY env var");

const sql = neon(DB_URL);
const clerk = createClerkClient({ secretKey: CLERK_SECRET });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Authenticate via Clerk session
    const sessionResult = await clerk.sessions.request({ headers: req.headers as any });
    if (!sessionResult || !sessionResult.userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    const userId = sessionResult.userId as string;

    if (req.method === "GET") {
      const rows = await sql`
        SELECT *
        FROM profiles
        WHERE clerk_user_id = ${userId}
        LIMIT 1
      `;
      return res.status(200).json({ ok: true, profile: rows[0] || null });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

      const email = body.email ?? null;
      const fullName = body.fullName ?? "";
      const phone = body.phone ?? "";
      const resumeContent = body.resumeContent ?? null; // null means "no change"
      const resumeFileName = body.resumeFileName ?? null; // null means "no change"
      const preferences = body.preferences ?? {};
      const connectedAccounts = body.connectedAccounts ?? {};
      const plan = body.plan ?? "free";

      const rows = await sql`
        INSERT INTO profiles (
          id,
          clerk_user_id,
          email,
          full_name,
          phone,
          resume_content,
          resume_file_name,
          preferences,
          connected_accounts,
          plan,
          updated_at
        )
        VALUES (
          gen_random_uuid(),
          ${userId},
          ${email},
          ${fullName},
          ${phone},
          ${resumeContent},
          ${resumeFileName},
          ${JSON.stringify(preferences)},
          ${JSON.stringify(connectedAccounts)},
          ${plan},
          NOW()
        )
        ON CONFLICT (clerk_user_id) DO UPDATE SET
          email = EXCLUDED.email,
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          resume_content = CASE
            WHEN EXCLUDED.resume_content IS NULL OR EXCLUDED.resume_content = ''
              THEN profiles.resume_content
            ELSE EXCLUDED.resume_content
          END,
          resume_file_name = CASE
            WHEN EXCLUDED.resume_file_name IS NULL OR EXCLUDED.resume_file_name = ''
              THEN profiles.resume_file_name
            ELSE EXCLUDED.resume_file_name
          END,
          preferences = EXCLUDED.preferences,
          connected_accounts = EXCLUDED.connected_accounts,
          plan = EXCLUDED.plan,
          updated_at = NOW()
        RETURNING *;
      `;

      return res.status(200).json({ ok: true, profile: rows[0] });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: any) {
    console.error("[API/PROFILE] Error:", err);
    const message = err?.message || "Internal server error";
    return res.status(500).json({ ok: false, error: message });
  }
}
