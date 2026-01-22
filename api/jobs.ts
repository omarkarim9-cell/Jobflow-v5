import type { VercelRequest, VercelResponse } from "@vercel/node";
import { auth } from "@clerk/backend";
import { neon } from "@neondatabase/serverless";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ error: "DATABASE_URL missing" });
    }

    const { userId } = auth(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sql = neon(dbUrl);

    // Resolve internal profile.id from Clerk userId
    const profileRows = await sql`
      SELECT id
      FROM profiles
      WHERE clerk_user_id = ${userId}
      LIMIT 1
    `;
    if (!profileRows[0]) {
      return res.status(404).json({ error: "Profile not found for user" });
    }
    const profileId = profileRows[0].id as string;

    if (req.method === "GET") {
      const result = await sql`
        SELECT *
        FROM jobs
        WHERE user_id = ${profileId}
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
        status: job.status || "saved",
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

    if (req.method === "POST") {
      const body = req.body || {};

      if (!body.id) {
        return res.status(400).json({ error: "Invalid Job Payload: missing id" });
      }

      const jobData = {
        location: body.location || "",
        salaryRange: body.salaryRange || "",
        requirements: body.requirements || [],
        notes: body.notes || "",
        logoUrl: body.logoUrl || "",
      };

      const result = await sql`
        INSERT INTO jobs (
          id,
          user_id,
          title,
          company,
          description,
          status,
          source,
          application_url,
          custom_resume,
          cover_letter,
          match_score,
          data,
          created_at,
          updated_at
        )
        VALUES (
          ${body.id},
          ${profileId},
          ${body.title || "Untitled Role"},
          ${body.company || "Unknown Company"},
          ${body.description || ""},
          ${body.status || "saved"},
          ${body.source || "Manual"},
          ${body.applicationUrl || null},
          ${body.customizedResume || null},
          ${body.coverLetter || null},
          ${body.matchScore || 0},
          ${JSON.stringify(jobData)},
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
        RETURNING *;
      `;

      return res.status(200).json({ success: true, job: result[0] });
    }

    if (req.method === "DELETE") {
      const jobId = req.query.id as string;

      if (!jobId) {
        return res.status(400).json({ error: "Missing Job ID" });
      }

      await sql`
        DELETE FROM jobs
        WHERE id = ${jobId} AND user_id = ${profileId}
      `;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method Not Allowed" });
  } catch (error: any) {
    console.error("[API/JOBS] Error:", error?.message || error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
