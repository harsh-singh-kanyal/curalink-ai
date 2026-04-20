function normalizeTitle(t) {
  return (t || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 200);
}

function normalizeDoi(d) {
  if (!d) return "";
  return String(d)
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "")
    .trim();
}

export function extractDoiFromPubmed(p) {
  const aid = p.raw?.articleids?.articleid;
  if (!aid) return "";
  const list = Array.isArray(aid) ? aid : [aid];
  const doi = list.find((x) => x?.idtype === "doi");
  return doi?.value || "";
}

function preferRecord(a, b) {
  const score = (x) =>
    (x.abstract?.length || 0) +
    (x.authors?.length || 0) * 10 +
    (typeof x.citedBy === "number" ? x.citedBy : 0) * 0.001;
  return score(b) > score(a) ? { ...a, ...b, merged: true } : { ...b, ...a, merged: true };
}

/**
 * Merge PubMed + OpenAlex works; dedupe by DOI then normalized title.
 */
export function mergePublications(pubmedList, openAlexList) {
  const map = new Map();

  const keyOf = (p) => {
    const d = normalizeDoi(p.doi || extractDoiFromPubmed(p));
    if (d) return `doi:${d}`;
    return `title:${normalizeTitle(p.title)}`;
  };

  const put = (p) => {
    const k = keyOf(p);
    if (!map.has(k)) {
      map.set(k, p);
      return;
    }
    map.set(k, preferRecord(map.get(k), p));
  };

  for (const p of pubmedList) {
    put({ ...p, doi: p.doi || extractDoiFromPubmed(p) });
  }
  for (const p of openAlexList) {
    put(p);
  }

  return [...map.values()];
}
