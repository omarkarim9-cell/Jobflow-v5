import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { jobTitle, company, description, resume, name, email } = req.body;
    
    try {
        const apiKey = process.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error('API key missing');
        
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

        const [resumeResult, letterResult] = await Promise.all([
            model.generateContent(`Tailor this resume for ${jobTitle} at ${company}:\n${resume}\n\nJob: ${description}`),
            model.generateContent(`Write a cover letter for ${name} (${email}) applying to ${jobTitle} at ${company}:\nResume: ${resume}\nJob: ${description}`)
        ]);

        return res.status(200).json({
            resume: (await resumeResult.response).text(),
            letter: (await letterResult.response).text()
        });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}