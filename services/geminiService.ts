import { GoogleGenAI, Modality, Type } from "@google/genai";
import { Job, UserProfile, JobStatus } from "../app-types";

// Initialize inside functions to ensure latest process.env values are used
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeJobsWithAi = async (html: string, resume: string, token: string) => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze this email for job listings. 
        User Resume: ${resume.substring(0, 1500)}
        Email HTML: ${html.substring(0, 15000)}
        
        TASK: Extract job listings. Rank fit 0-100.
        Filter out irrelevant notifications, newsletter updates, or recruiter connection requests. Focus ONLY on actual job postings.
        Return structured JSON.`,
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
                                applicationUrl: { type: Type.STRING },
                                matchScore: { type: Type.NUMBER },
                                fitReason: { type: Type.STRING },
                                salaryRange: { type: Type.STRING },
                                employmentType: { type: Type.STRING, enum: ["Full-time", "Part-time", "Contract", "Internship"] },
                                requirements: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                            required: ["title", "company", "applicationUrl", "matchScore"]
                        }
                    }
                }
            }
        }
    });

    const parsed = JSON.parse(response.text || '{"jobs": []}');
    return parsed.jobs || [];
};

export const generateAudioBriefing = async (job: Job, profile: UserProfile): Promise<string> => {
    const ai = getAi();
    const prompt = `Say cheerfully: Hi ${profile.fullName.split(' ')[0]}! I've analyzed the ${job.title} role at ${job.company}. 
    Based on your resume, this is a ${job.matchScore}% match. I've tailored a custom briefing for you. Let's get to work!`;

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
            },
        },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!base64Audio) throw new Error("Audio generation failed");
    return base64Audio;
};

export const generateInterviewQuestions = async (job: Job, profile: UserProfile) => {
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate exactly 10 comprehensive and highly relevant practice interview questions for the ${job.title} role at ${job.company}. 
        Candidate Resume: ${profile.resumeContent.substring(0, 1000)}
        Job Description: ${job.description.substring(0, 1000)}
        
        Provide a mix of technical, behavioral, and situational questions tailored to this candidate's background and this specific role.`,
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
    return parsed.questions || [];
};

export const extractJobFromUrl = async (url: string): Promise<{data: any, sources: any[]}> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Visit this URL and extract all job details: ${url}`,
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
            requirements: { type: Type.STRING },
            salaryRange: { type: Type.STRING }
          },
          required: ["title", "company", "description"]
        }
      }
    });

    return { 
        data: JSON.parse(response.text || "{}"), 
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || [] 
    };
};

export const searchNearbyJobs = async (lat: number, lng: number, role: string): Promise<Job[]> => {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find hiring companies and current job openings for the specific role "${role}" within a 20km radius of the coordinates latitude ${lat} and longitude ${lng}. Do not return generic locations.`,
      config: {
        tools: [{googleMaps: {}}],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    return chunks.filter(c => c.maps).map((c, i) => ({
      id: `map-${i}-${Date.now()}`,
      title: role,
      company: c.maps?.title || 'Local Company',
      location: 'Nearby',
      description: 'Discovered via Google Maps grounding.',
      source: 'Google Maps' as const,
      detectedAt: new Date().toISOString(),
      status: JobStatus.DETECTED,
      matchScore: 85,
      applicationUrl: c.maps?.uri || '#',
      requirements: []
    }));
};

export const getSmartApplicationUrl = (url: string): string => {
    try {
        const u = new URL(url);
        ['utm_source', 'utm_medium', 'utm_campaign'].forEach(p => u.searchParams.delete(p));
        return u.toString();
    } catch (e) { return url; }
};
// Backwards-compatible wrapper for old InboxScanner
// Restores the original function name expected by the scanner
export const extractJobsFromEmailHtml = async (
    html: string,
    targetRoles: string[] = []
) => {
    try {
        // We don't need resume or token for email extraction
        const jobs = await analyzeJobsWithAi(html, "", "");

        // Optional: filter by target roles if provided
        if (targetRoles.length > 0) {
            const lower = targetRoles.map(r => r.toLowerCase());
            return jobs.filter((j: any) =>
                lower.some(r => j.title?.toLowerCase().includes(r))
            );
        }

        return jobs;
    } catch (err) {
        console.error("[extractJobsFromEmailHtml] Error:", err);
        return [];
    }
};
// Backwards compatibility for JobDetail.tsx
export const fetchAudioBriefing = generateAudioBriefing;
export const fetchInterviewQuestions = generateInterviewQuestions;
