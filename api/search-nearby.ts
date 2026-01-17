import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';
import { GoogleGenAI } from "@google/genai";

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const authRequest = await clerkClient.authenticateRequest(req as any);
    const auth = authRequest.toAuth();
    const userId = (auth as any)?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { lat, lng, role } = req.body;
    if (!lat || !lng) return res.status(400).json({ error: 'Missing coordinates' });

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Find hiring companies and job openings for "${role || 'Software Engineer'}" near my location.`,
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

    // Process the grounding chunks into job objects
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const jobs = chunks.filter(c => c.maps).map((c, i) => ({
      id: `map-${i}-${Date.now()}`,
      title: role || 'Relevant Position',
      company: c.maps?.title || 'Local Company',
      location: 'Nearby',
      description: 'Found via Maps discovery.',
      source: 'Google Maps',
      detectedAt: new Date().toISOString(),
      status: 'Detected',
      matchScore: 85,
      applicationUrl: c.maps?.uri || '#'
    }));

    return res.status(200).json({ jobs });
  } catch (error: any) {
    console.error('[API/SEARCH-NEARBY] Error:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}