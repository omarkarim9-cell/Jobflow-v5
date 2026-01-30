import * as cheerio from "cheerio";

export default async function extractFromIndeed(url: string) {
  const jk = new URL(url).searchParams.get("jk");
  const jobUrl = jk
    ? `https://www.indeed.com/viewjob?jk=${jk}`
    : url;

  const html = await fetch(jobUrl).then(r => r.text());
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim();
  const company = $("div[data-company-name]").text().trim();
  const location = $("div[data-testid='job-location']").text().trim();
  const description = $("#jobDescriptionText").text().trim();
  const requirements = [];

  return {
    title: title || "Unknown Role",
    company: company || "Unknown Company",
    location: location || "Unknown",
    description: description || "No description available.",
    requirements,
    applicationUrl: jobUrl
  };
}
