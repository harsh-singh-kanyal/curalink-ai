const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function toolParams() {
  const email = process.env.NCBI_EMAIL ? `&email=${encodeURIComponent(process.env.NCBI_EMAIL)}` : "";
  const key = process.env.NCBI_API_KEY ? `&api_key=${encodeURIComponent(process.env.NCBI_API_KEY)}` : "";
  return email + key;
}

/**
 * Broad PubMed harvest: esearch → esummary (JSON) for titles, abstract, authors, year, URL.
 */
export async function searchPubMed(term, { retmax = 120 } = {}) {
  const searchUrl = `${EUTILS}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmax=${retmax}&sort=pub+date&retmode=json${toolParams()}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new Error(`PubMed esearch failed: ${searchRes.status}`);
  }
  const searchJson = await searchRes.json();
  const idlist = searchJson?.esearchresult?.idlist || [];
  if (idlist.length === 0) {
    return [];
  }

  const ids = idlist.join(",");
  const summaryUrl = `${EUTILS}/esummary.fcgi?db=pubmed&id=${ids}&retmode=json${toolParams()}`;
  const sumRes = await fetch(summaryUrl);
  if (!sumRes.ok) {
    throw new Error(`PubMed esummary failed: ${sumRes.status}`);
  }
  const sumJson = await sumRes.json();
  const result = sumJson?.result || {};

  const pubs = [];
  for (const id of idlist) {
    const u = result[id];
    if (!u || u.error) continue;
    const title = u.title || "";
    const authors =
      Array.isArray(u.authors?.author) && u.authors.author.length
        ? u.authors.author.map((a) => a.name).filter(Boolean)
        : [];
    const year = u.pubdate ? String(u.pubdate).slice(0, 4) : "";
    let abstract = "";
    if (typeof u.abstract === "string") {
      abstract = u.abstract;
    } else if (Array.isArray(u.abstract)) {
      abstract = u.abstract.map((x) => (typeof x === "string" ? x : x?.value || "")).join(" ");
    } else if (u.abstract?.text) {
      abstract = u.abstract.text;
    }

    pubs.push({
      source: "PubMed",
      pmid: id,
      title,
      abstract,
      authors,
      year: year || "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      raw: u,
    });
  }
  return pubs;
}
