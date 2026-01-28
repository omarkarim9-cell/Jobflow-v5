import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '../clerk-shim';
import { GoogleGenAI } from "@google/genai";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authRequest = await clerkClient.authenticateRequest(req as any);
    const { userId } = authRequest.toAuth() as any;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { jobTitle, company, description, resume: originalResume, name, email } = req.body;
    if (!jobTitle || !description || !resume) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const [resumeResponse, letterResponse] = await Promise.all([
      ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tailor this resume for the ${jobTitle} position at ${company}.

Job Description: ${description}

Original Resume: ${Originalresume}

Instructions:
1. Reorder experience to highlight relevant skills for this specific role
2. Match keywords from the job description
3. Emphasize achievements with metrics
4. Keep the same professional structure
5. Focus on ATS optimization

Return ONLY the tailored resume text, no explanations or markdown.`,
        config: {
          systemInstruction: "You are a professional resume writer specializing in ATS optimization and role-specific tailoring."
        }
      }),

      ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Write a professional cover letter for ${name} (${email}) applying to ${jobTitle} at ${company}.

Job Description: ${description}

Candidate Resume: ${Originalresume}

Instructions:
1. Keep under 400 words
2. Match candidate skills to job requirements
3. Use professional, confident tone
4. Include specific accomplishments from resume
5. NO placeholders - use actual company name and job title

Return ONLY the cover letter text, no explanations or markdown.`,
        config: {
          systemInstruction: "You are an expert career coach writing professional, ATS-optimized cover letters."
        }
      })
    ]);

	const resume = resumeResponse.text;
	const letter = letterResponse.text;


    return res.status(200).json({ resume, letter });
  } catch (error: any) {
    console.error('[API/GENERATE-ASSETS] Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}

