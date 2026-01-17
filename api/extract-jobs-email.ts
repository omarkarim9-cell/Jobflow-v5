import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import { GoogleGenAI, Type } from "@google/genai";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // Fixed: authenticateRequest returns a RequestState. userId is accessible via the toAuth() method. 
    // req is cast as any to bypass VercelRequest type assignment errors.
    const { userId } = (await clerkClient.authenticateRequest(req as any)).toAuth();
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { html } = req.body;
    if (!html) return res.status(400).json({ error: 'Missing HTML' });

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Identify all job listings in this email content: ${html.substring(0, 20000)}. For each job, extract the title, company, location, and application URL.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            jobs: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  company: { type: Type.STRING },
                  location: { type: Type.STRING },
                  applicationUrl: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text || '{"jobs": []}');
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('[API/EXTRACT-JOBS-EMAIL] Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}