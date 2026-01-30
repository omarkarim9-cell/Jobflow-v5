import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '../clerk-shim';

import extractFromIndeed from '../extractors/indeed';
import extractFromLinkedIn from '../extractors/linkedin';
import extractFromGeneric from '../extractors/generic';

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authRequest = await clerkClient.authenticateRequest(req as any);
    const auth = authRequest.toAuth();
    const userId = (auth as any)?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });

    let hostname = "";
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      const data = await extractFromGeneric(url);
      return res.status(200).json({ data });
    }

    if (hostname.includes("indeed.com")) {
      const data = await extractFromIndeed(url);
      return res.status(200).json({ data });
    }

    if (hostname.includes("linkedin.com")) {
      const data = await extractFromLinkedIn(url);
      return res.status(200).json({ data });
    }

    const data = await extractFromGeneric(url);
    return res.status(200).json({ data });

  } catch (error: any) {
    console.error('[API/EXTRACT-JOB] Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
