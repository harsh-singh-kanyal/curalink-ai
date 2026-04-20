const OPENALEX = "https://api.openalex.org";

function workUrl(id) {
  if (!id) return "";
  const s = String(id);
  if (s.startsWith("http")) return s;
  return `https://openalex.org/${s}`;
}

/**
 * Paginated OpenAlex harvest (max 200 per page) to reach depth targets.
 */
export async function searchOpenAlex(query, { perPage = 100, pages = 2 } = {}) {
  const all = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${OPENALEX}/works?search=${encodeURIComponent(query)}&per-page=${perPage}&page=${page}&sort=cited_by_count:desc`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OpenAlex failed: ${res.status}`);
    }
    const json = await res.json();
    const results = json.results || [];
    for (const w of results) {
      const title = w.title || w.display_name || "";
      const year = w.publication_year ? String(w.publication_year) : "";
      const abstract =
        w.abstract_inverted_index && typeof w.abstract_inverted_index === "object"
          ? reconstructAbstract(w.abstract_inverted_index)
          : "";
      const authors = (w.authorships || [])
        .map((a) => a.author?.display_name)
        .filter(Boolean)
        .slice(0, 40);
      const doi = w.doi || "";
      const citedBy = typeof w.cited_by_count === "number" ? w.cited_by_count : 0;
      all.push({
        source: "OpenAlex",
        openalexId: w.id,
        doi,
        title,
        abstract,
        authors,
        year,
        url: workUrl(w.id),
        citedBy,
        raw: w,
      });
    }
    if (results.length < perPage) break;
  }
  return all;
}

function reconstructAbstract(inverted) {
  const entries = Object.entries(inverted);
  const maxPos = Math.max(
    0,
    ...entries.flatMap(([word, positions]) =>
      Array.isArray(positions) ? positions : [positions]
    )
  );
  const words = new Array(maxPos + 1);
  for (const [word, positions] of entries) {
    const posList = Array.isArray(positions) ? positions : [positions];
    for (const p of posList) {
      words[p] = word;
    }
  }
  return words.filter(Boolean).join(" ");
}
