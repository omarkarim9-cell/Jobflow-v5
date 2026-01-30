import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";

export default async function extractFromLinkedIn(url: string) {
  const html = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  }).then(r => r.text());

  if (!html || html.length < 5000) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search the web for this LinkedIn job and extract title, company, location, description, and requirements: ${url}`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json"
      }
    });

    return JSON.parse(response.text || "{}");
  }

  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim();
  const company = $("a.topcard__org-name-link").text().trim();
  const location = $("span.topcard__flavor--bullet").text().trim();
  const description = $("div.show-more-less-html__markup").text().trim();

  return {
    title: title || "Unknown Role",
    company: company || "Unknown Company",
    location: location || "Unknown",
    description: description || "No description available.",
    requirements: [],
    applicationUrl: url
  };
}
