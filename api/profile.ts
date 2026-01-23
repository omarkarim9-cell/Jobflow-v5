import { VercelRequest, VercelResponse } from "@vercel/node";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { neon } from "@neondatabase/serverless";

const CLERK_ISSUER = "https://clerk.kush-edu.com";
const JWKS_URL = `${CLERK_ISSUER}/.well-known/jwks.json`;
const jwks = createRemoteJWKSet(new URL(JWKS_URL));
const sql = neon(process.env.DATABASE_URL!);

async function verifyJwtAndGetSub(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer: CLERK_ISSUER });
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    return sub;
  } catch (err) {
    console.error("[JWT VERIFY] Error:", err);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized - Missing token" });
    }

    const token = authHeader.split(" ")[1];
    const userId = await verifyJwtAndGetSub(token);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - Invalid token" });
    }

    if (req.method === "GET") {
      const result = await sql`
        SELECT *
        FROM user_profiles
        WHERE id = ${userId}
      `;
      return res.status(200).json(result[0] || null);
    }

    if (req.method === "POST") {
      const profile = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

      await sql`
        INSERT INTO user_profiles (
          id,
          full_name,
          email,
          phone,
          resume_content,
          resume_file_name,
          preferences,
          connected_accounts,
          plan,
          onboarded_at,
          updated_at
        )
        VALUES (
          ${userId},
          ${profile.fullName},
          ${profile.email},
          ${profile.phone},
          ${profile.resumeContent},
          ${profile.resumeFileName || ""},
          ${JSON.stringify(profile.preferences)},
          ${JSON.stringify(profile.connectedAccounts)},
          ${profile.plan},
          ${profile.onboardedAt},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          email = EXCLUDED.email,
          phone = EXCLUDED.phone,
          resume_content = EXCLUDED.resume_content,
          resume_file_name = EXCLUDED.resume_file_name,
          preferences = EXCLUDED.preferences,
          connected_accounts = EXCLUDED.connected_accounts,
          plan = EXCLUDED.plan,
          updated_at = NOW()
      `;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error: any) {
    console.error("[API/PROFILE] Error:", error);
    return res.status(500).json({ error: error?.message || "Internal Server Error" });
  }
}
