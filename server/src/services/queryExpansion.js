/**
 * CuraLink "Intent Lattice" — deterministic query expansion for APIs + LLM context.
 * Unique angle: explicit multi-phrase expansion (transparent in CuraLink Trace).
 */

function tokenize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

export function buildIntentLattice({ disease, message, additionalQuery, location }) {
  const diseaseClean = (disease || "").trim();
  const msg = (message || "").trim();
  const add = (additionalQuery || "").trim();
  const loc = (location || "").trim();

  const phrases = [];

  if (diseaseClean && msg) {
    phrases.push(`${diseaseClean} ${msg}`);
    phrases.push(`${msg} ${diseaseClean}`);
  }
  if (diseaseClean && add) {
    phrases.push(`${diseaseClean} ${add}`);
    phrases.push(`${add} ${diseaseClean}`);
  }
  if (diseaseClean) {
    phrases.push(diseaseClean);
  }
  if (msg) {
    phrases.push(msg);
  }
  if (add) {
    phrases.push(add);
  }

  // PubMed-style AND query for precision when we have both disease and topic
  const pubmedPrimary =
    diseaseClean && (add || msg)
      ? `(${diseaseClean}) AND (${add || msg})`
      : diseaseClean || msg || add || "medical research";

  const openAlexPrimary = [diseaseClean, add || msg].filter(Boolean).join(" ") || msg || diseaseClean;

  const trialCondition = diseaseClean || tokenize(msg).slice(0, 6).join(" ") || "disease";

  const expandedQueries = [...new Set(phrases.filter(Boolean))].slice(0, 12);

  return {
    expandedQueries,
    pubmedPrimary,
    openAlexPrimary,
    trialCondition,
    locationHint: loc,
    intentSummary: [
      diseaseClean && `Condition focus: ${diseaseClean}`,
      (add || msg) && `Topic intent: ${add || msg}`,
      loc && `Locale context: ${loc}`,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
