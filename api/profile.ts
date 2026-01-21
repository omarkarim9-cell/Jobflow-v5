import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAuth } from "@clerk/backend";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (req.method === "GET") {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "SELECT * FROM profiles WHERE clerk_user_id = $1 LIMIT 1",
          [userId]
        );

        return res.status(200).json(result.rows[0] || null);
      } finally {
        client.release();
      }
    }

    if (req.method === "POST") {
      const body = req.body;

      const client = await pool.connect();
      try {
        const result = await client.query(
          `
          INSERT INTO profiles (
            id, clerk_user_id, email, full_name, phone, resume_content,
            preferences, connected_accounts, plan, updated_at
          )
          VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5,
            $6::jsonb, $7::jsonb, $8, NOW()
          )
          ON CONFLICT (clerk_user_id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            resume_content = EXCLUDED.resume_content,
            preferences = EXCLUDED.preferences,
            connected_accounts = EXCLUDED.connected_accounts,
            plan = EXCLUDED.plan,
            updated_at = NOW()
          RETURNING *;
        `,
          [
            userId,
            body.email,
            body.fullName,
            body.phone,
            body.resumeContent,
            JSON.stringify(body.preferences),
            JSON.stringify(body.connectedAccounts),
            body.plan || "free",
          ]
        );

        return res.status(200).json(result.rows[0]);
      } finally {
        client.release();
      }
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    console.error("[API/PROFILE] Error:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
