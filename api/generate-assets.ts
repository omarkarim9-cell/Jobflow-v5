import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { jobTitle, company, description, resume: originalResume, name, email } = req.body;

    if (!jobTitle || !description || !originalResume) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const [resumeResponse, letterResponse] = await Promise.all([
      ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Tailor this resume for the ${jobTitle} position at ${company}.

Job Description: ${description}

Original Resume: ${originalResume}

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

Candidate Resume: ${originalResume}

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

    const tailoredResume = resumeResponse.text;
    const coverLetter = letterResponse.text;

    return res.status(200).json({ resume: tailoredResume, letter: coverLetter });
  } catch (error: any) {
    console.error('[API/GENERATE-ASSETS] Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}
