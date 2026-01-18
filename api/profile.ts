import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import { neon } from '@neondatabase/serverless';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return res.status(500).json({ error: 'Database configuration error.' });
    }

    let userId: string | null = null;
    try {
      // Use standard header extraction for resilience
      const authRequest = await clerkClient.authenticateRequest(req as any);
      const auth = authRequest.toAuth();
      userId = auth?.userId || null;
    } catch (e) {
      console.error('[API/PROFILE] Auth verification failed:', e);
    }

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized - Invalid or missing Clerk session.' });
    }

    const sql = neon(dbUrl);

    const formatProfile = (p: any) => ({
      id: p.id,
      fullName: p.full_name || '',
      email: p.email || '',
      phone: p.phone || '',
      resumeContent: p.resume_content || '',
      resumeFileName: p.resume_file_name || '',
      preferences: typeof p.preferences === 'string' ? JSON.parse(p.preferences) : (p.preferences || {}),
      connectedAccounts: typeof p.connected_accounts === 'string' ? JSON.parse(p.connected_accounts) : (p.connected_accounts || []),
      plan: p.plan || 'free',
      onboardedAt: p.created_at
    });

    if (req.method === 'GET') {
      const result = await sql`SELECT * FROM profiles WHERE id = ${userId} LIMIT 1`;
      if (result.length === 0) return res.status(404).json({ error: 'Profile not found' });
      return res.status(200).json(formatProfile(result[0]));
    }

    if (req.method === 'POST') {
      const body = req.body;
      const prefs = body.preferences || {};
      const accounts = body.connectedAccounts || [];

      const result = await sql`
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
          ${userId}, 
          ${userId}, 
          ${body.email || ''}, 
          ${body.fullName || ''}, 
          ${body.phone || ''}, 
          ${body.resumeContent || ''}, 
          ${body.resumeFileName || ''}, 
          ${JSON.stringify(prefs)}, 
          ${JSON.stringify(accounts)}, 
          ${body.plan || 'free'}, 
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
          updated_at = NOW()
        RETURNING *
      `;
      
      return res.status(200).json(formatProfile(result[0]));
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    console.error('[API/PROFILE] Error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}