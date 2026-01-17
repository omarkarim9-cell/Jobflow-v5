
import { VercelRequest, VercelResponse } from '@vercel/node';
import * as ClerkServer from '@clerk/nextjs/server';
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const Clerk = (ClerkServer as any).default || ClerkServer;
    const auth = Clerk.getAuth(req);
    if (!auth?.userId) return res.status(401).json({ error: 'Unauthorized' });

    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing URL' });

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract the job details from this URL: ${url}. Return ONLY a JSON object with title, company, location, description, and requirements.`,
      config: {
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            company: { type: Type.STRING },
            location: { type: Type.STRING },
            description: { type: Type.STRING },
            requirements: { type: Type.STRING }
          },
          required: ["title", "company", "description"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return res.status(200).json({ data, sources });
  } catch (error: any) {
    console.error('[API/EXTRACT-JOB] Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
