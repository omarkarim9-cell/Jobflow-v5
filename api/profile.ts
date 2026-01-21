import { clerkClient, verifyToken } from "@clerk/clerk-sdk-node";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  try {
    // 1. Extract token
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie || "";

    let token = null;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length);
    } else {
      const match = cookieHeader.match(/(?:^|; )__session=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }

    if (!token) {
      return res.status(401).json({ ok: false, error: "No token provided" });
    }

    // 2. Verify token
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const sessionId = verified.sessionId;
    if (!sessionId) {
      return res.status(401).json({ ok: false, error: "Invalid token" });
    }

    // 3. Fetch session
    const session = await clerkClient.sessions.getSession(sessionId);
    if (!session || session.status !== "active") {
      return res.status(401).json({ ok: false, error: "Session not active" });
    }

    const clerkUserId = session.userId;

    // 4. Handle GET (load profile)
    if (req.method === "GET") {
      const client = await pool.connect();
      try {
        const result = await client.query(
          "SELECT * FROM profiles WHERE clerk_user_id = $1 LIMIT 1",
          [clerkUserId]
        );

        if (result.rowCount === 0) {
          return res.status(200).json(null);
        }

        return res.status(200).json(result.rows[0]);
      } finally {
        client.release();
      }
    }

    // 5. Handle POST (save profile)
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
            clerkUserId,
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
