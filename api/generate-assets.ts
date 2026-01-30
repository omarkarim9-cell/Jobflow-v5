import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from "@google/genai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log("[v0] generate-assets API called");
  console.log("[v0] Request method:", req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { jobTitle, company, description, resume: originalResume, name, email } = req.body;

    console.log("[v0] Request body received:", {
      jobTitle,
      company,
      descriptionLength: description?.length || 0,
      descriptionPreview: description?.substring(0, 100) || '',
      resumeLength: originalResume?.length || 0,
      name,
      email
    });

    if (!jobTitle || !description || !originalResume) {
      console.log("[v0] Missing required fields:", {
        hasJobTitle: !!jobTitle,
        hasDescription: !!description,
        hasResume: !!originalResume
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log("[v0] API_KEY exists:", !!process.env.API_KEY);
    console.log("[v0] API_KEY length:", process.env.API_KEY?.length || 0);

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    console.log("[v0] GoogleGenAI initialized");

    console.log("[v0] Starting parallel generation...");

    const [resumeResponse, letterResponse] = await Promise.all([
      ai.models.generateContent({
        model: 'gemini-2.0-flash',
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
        model: 'gemini-2.0-flash',
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

    console.log("[v0] Generation complete");
    console.log("[v0] resumeResponse:", resumeResponse);
    console.log("[v0] letterResponse:", letterResponse);

    const tailoredResume = resumeResponse.text;
    const coverLetter = letterResponse.text;

    console.log("[v0] Extracted text:");
    console.log("[v0] tailoredResume type:", typeof tailoredResume);
    console.log("[v0] tailoredResume length:", tailoredResume?.length || 0);
    console.log("[v0] coverLetter type:", typeof coverLetter);
    console.log("[v0] coverLetter length:", coverLetter?.length || 0);

    return res.status(200).json({ resume: tailoredResume, letter: coverLetter });
  } catch (error: any) {
    console.error('[v0] API Error:', error);
    console.error('[v0] Error name:', error.name);
    console.error('[v0] Error message:', error.message);
    console.error('[v0] Error stack:', error.stack);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
}