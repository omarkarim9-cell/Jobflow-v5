import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";

export default async function extractFromGeneric(url: string) {
  let html = "";
  try {
    html = await fetch(url).then(r => r.text());
  } catch {
    return syntheticJob(url);
  }

  if (!html || html.length < 2000) {
    return syntheticJob(url);
  }

  const $ = cheerio.load(html);

  $("script, style, nav, footer, header").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Extract job details from this text:\n\n${text}`,
    config: {
      responseMimeType: "application/json"
    }
  });

  const data = JSON.parse(response.text || "{}");

  return {
    title: data.title || "Unknown Role",
    company: data.company || "Unknown Company",
    location: data.location || "Unknown",
    description: data.description || "No description available.",
    requirements: data.requirements || [],
    applicationUrl: url
  };
}

function syntheticJob(url: string) {
  return {
    title: "Unknown Role",
    company: "Unknown Company",
    location: "Unknown",
    description: "We could not extract this job automatically.",
    requirements: [],
    applicationUrl: url,
    fallbackSearch: buildSearchFallback(url)
  };
}

function buildSearchFallback(url: string) {
  const encoded = encodeURIComponent(url);
  return {
    query: url,
    google: `https://www.google.com/search?q=${encoded}`,
    indeed: `https://www.indeed.com/jobs?q=${encoded}`,
    linkedin: `https://www.linkedin.com/jobs/search/?keywords=${encoded}`
  };
}
