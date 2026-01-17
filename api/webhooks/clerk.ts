import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import { GoogleGenAI, Type } from "@google/genai";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authRequest = await clerkClient.authenticateRequest(req as any);
    const auth = authRequest.toAuth();
    const userId = (auth as any)?.userId;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { title, company, description, resume } = req.body;
    if (!title || !description || !resume) return res.status(400).json({ error: 'Missing required fields' });

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 3 relevant practice interview questions for the ${title} role at ${company || 'your company'}. 
        Candidate Resume: ${resume.substring(0, 1000)}
        Job Description: ${description.substring(0, 1000)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["questions"]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{"questions": []}');
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error('[API/INTERVIEW-QUESTIONS] Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}