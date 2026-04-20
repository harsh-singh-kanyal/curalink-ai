function tokens(s) {
  return new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function yearNum(y) {
  const n = parseInt(String(y), 10);
  return Number.isFinite(n) ? n : 1990;
}

/**
 * Rank publications: relevance (Jaccard on tokens) + recency + citation credibility.
 */
export function rankPublications(items, intentText, { topN = 8 } = {}) {
  const intentTok = tokens(intentText);
  const now = new Date().getFullYear();

  const scored = items.map((p) => {
    const text = `${p.title} ${p.abstract || ""}`;
    const docTok = tokens(text);
    const rel = jaccard(intentTok, docTok);
    const y = yearNum(p.year);
    const recency = Math.max(0, Math.min(1, (y - 1990) / (now - 1990)));
    const cite = typeof p.citedBy === "number" ? p.citedBy : 0;
    const credibility = Math.min(1, Math.log10(cite + 10) / 3);
    const score = 0.55 * rel + 0.25 * recency + 0.2 * credibility;
    return {
      ...p,
      _scores: { relevance: rel, recency, credibility, total: score },
    };
  });

  scored.sort((a, b) => b._scores.total - a._scores.total);
  return scored.slice(0, topN);
}

/**
 * Geo-aware trial ranking: boost trials whose locations overlap user locale string.
 */
export function rankTrials(items, intentText, userLocation, { topN = 8 } = {}) {
  const intentTok = tokens(intentText);
  const locNorm = (userLocation || "").toLowerCase();

  const scored = items.map((t) => {
    const text = `${t.title} ${t.eligibility || ""} ${(t.locations || []).join(" ")}`;
    const docTok = tokens(text);
    const rel = jaccard(intentTok, docTok);
    const locText = (t.locations || []).join(" ").toLowerCase();
    let geo = 0;
    if (locNorm && locText) {
      const locParts = locNorm.split(/[, ]+/).filter((p) => p.length > 3);
      geo = locParts.some((p) => locText.includes(p)) ? 1 : 0;
    }
    const statusBoost = /recruit/i.test(t.status || "") ? 0.08 : 0;
    const score = 0.72 * rel + 0.2 * geo + statusBoost;
    return {
      ...t,
      _scores: { relevance: rel, geoBoost: geo, total: score },
    };
  });

  scored.sort((a, b) => b._scores.total - a._scores.total);
  return scored.slice(0, topN);
}
