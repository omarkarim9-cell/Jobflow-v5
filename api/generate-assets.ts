import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import { GoogleGenAI } from "@google/genai";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authRequest = await clerkClient.authenticateRequest(req as any);
    const { userId } = authRequest.toAuth() as any;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { job, profile } = req.body;
    if (!job || !profile) return res.status(400).json({ error: 'Missing job or profile data' });

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a custom application summary for the ${job.title} role at ${job.company}. 
      Context: ${profile.resumeContent.substring(0, 500)}`,
    });

    return res.status(200).json({ text: response.text || "" });
  } catch (error: any) {
    console.error('[API/GENERATE-ASSETS] Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}