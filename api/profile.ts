import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL missing" });
    }

    const { userId } = await verifyRequest({
  headers: req.headers,
  secretKey: process.env.CLERK_SECRET_KEY!,
});

    const sql = neon(dbUrl);

    if (req.method === "GET") {
      const rows = await sql`
        SELECT *
        FROM profiles
        WHERE clerk_user_id = ${userId}
        LIMIT 1
      `;
      return res.status(200).json(rows[0] || null);
    }

    if (req.method === "POST") {
      const body = req.body || {};

      const email = body.email ?? null;
      const fullName = body.fullName ?? "";
      const phone = body.phone ?? "";
      const resumeContent = body.resumeContent ?? null;
      const resumeFileName = body.resumeFileName ?? "";
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

      return res.status(200).json(rows[0]);
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("[API/PROFILE] Error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
