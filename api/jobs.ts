import { VercelRequest, VercelResponse } from "@vercel/node";
import { clerkClient, verifyToken } from "@clerk/clerk-sdk-node";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ error: "DATABASE_URL configuration missing." });
    }

    // 1. Extract token
    const authHeader = req.headers.authorization;
    const cookieHeader = req.headers.cookie || "";

    let token: string | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length);
    } else {
      const match = cookieHeader.match(/(?:^|; )__session=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }

    if (!token) {
      return res.status(401).json({ error: "No token provided" });
    }

    // 2. Verify token
    const verified = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const sessionId = verified.sessionId;
    if (!sessionId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // 3. Fetch session
    const session = await clerkClient.sessions.getSession(sessionId);
    if (!session || session.status !== "active") {
      return res.status(401).json({ error: "Session not active" });
    }

    const userId = session.userId;

    // 4. Neon SQL client
    const sql = neon(dbUrl);

    // -------------------------------
    // GET /api/jobs
    // -------------------------------
    if (req.method === "GET") {
      const result = await sql`
        SELECT * FROM jobs 
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `;

      const jobs = result.map((job: any) => ({
        id: job.id,
        title: job.title || "",
        company: job.company || "",
        location: job.data?.location || "",
        salaryRange: job.data?.salaryRange || "",
        description: job.description || "",
        source: job.source || "Manual",
        detectedAt: job.created_at,
        status: job.status || "Detected",
        matchScore: job.match_score || 0,
        requirements: job.data?.requirements || [],
        coverLetter: job.cover_letter,
        customizedResume: job.custom_resume,
        notes: job.data?.notes || "",
        logoUrl: job.data?.logoUrl || "",
        applicationUrl: job.application_url,
      }));

      return res.status(200).json({ jobs });
    }

    // -------------------------------
    // POST /api/jobs
    // -------------------------------
    if (req.method === "POST") {
      const body = req.body;
      if (!body || !body.id) {
        return res.status(400).json({ error: "Invalid Job Payload" });
      }

      const jobData = JSON.stringify({
        location: body.location || "",
        salaryRange: body.salaryRange || "",
        requirements: body.requirements || [],
        notes: body.notes || "",
        logoUrl: body.logoUrl || "",
      });

      const result = await sql`
        INSERT INTO jobs (
          id, user_id, title, company, description, status, source,
          application_url, custom_resume, cover_letter, match_score,
          data, created_at, updated_at
        )
        VALUES (
          ${body.id},
          ${userId},
          ${body.title || "Untitled Role"},
          ${body.company || "Unknown Company"},
          ${body.description || ""},
          ${body.status || "Detected"},
          ${body.source || "Manual"},
          ${body.applicationUrl || null},
          ${body.customizedResume || null},
          ${body.coverLetter || null},
          ${body.matchScore || 0},
          ${jobData},
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          company = EXCLUDED.company,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          custom_resume = EXCLUDED.custom_resume,
          cover_letter = EXCLUDED.cover_letter,
          match_score = EXCLUDED.match_score,
          data = EXCLUDED.data,
          updated_at = NOW()
        RETURNING *
      `;

      return res.status(200).json({ success: true, job: result[0] });
    }

    // -------------------------------
    // DELETE /api/jobs?id=...
    // -------------------------------
    if (req.method === "DELETE") {
      const jobId = req.query.id as string;
      if (!jobId) {
        return res.status(400).json({ error: "Missing Job ID" });
      }

      await sql`
        DELETE FROM jobs 
        WHERE id = ${jobId} AND user_id = ${userId}
      `;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error: any) {
    console.error("[API/JOBS] Error:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
