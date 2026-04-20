import {
  resolveOllamaBase,
  listOllamaModels,
  resolveModelName,
  ollamaChatJson,
} from "./ollamaClient.js";

function stripFence(s) {
  return s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
}

/**
 * Open-source LLM via Ollama — structured JSON answer grounded on retrieved evidence only.
 * Resolves a working base URL + an installed model before calling /api/chat.
 */
export async function synthesizeWithOllama({
  model: modelOverride,
  patientName,
  disease,
  location,
  userMessage,
  conversationSummary,
  publications,
  trials,
}) {
  const base = await resolveOllamaBase();
  const installed = await listOllamaModels(base);
  const m = resolveModelName(modelOverride || process.env.OLLAMA_MODEL, installed);

  const evidencePack = {
    publications: publications.map((p, i) => ({
      id: `P${i + 1}`,
      title: p.title,
      year: p.year,
      source: p.source,
      authors: (p.authors || []).slice(0, 6),
      snippet: (p.abstract || "").slice(0, 900),
      url: p.url,
    })),
    trials: trials.map((t, i) => ({
      id: `T${i + 1}`,
      title: t.title,
      status: t.status,
      locations: (t.locations || []).slice(0, 6),
      eligibility: (t.eligibility || "").slice(0, 700),
      contacts: (t.contacts || []).slice(0, 2),
      url: t.url,
    })),
  };

  const system = `You are CuraLink, a medical research assistant. You NEVER diagnose or prescribe.
You MUST cite only from the evidencePack. If information is missing, say so.
Output valid JSON only (no markdown), with this exact shape:
{
  "conditionOverview": string,
  "researchInsights": string[],
  "clinicalTrialsSummary": string[],
  "limitations": string[],
  "citations": [
    { "refId": "P1"|"T1", "supportingSnippet": string }
  ],
  "safetyNote": string
}`;

  const user = JSON.stringify({
    patientName: patientName || "User",
    diseaseFocus: disease || "",
    location: location || "",
    userMessage,
    priorContext: conversationSummary || "",
    evidencePack,
  });

  const { text } = await ollamaChatJson({
    base,
    model: m,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    preferJsonFormat: true,
  });

  let parsed;
  try {
    parsed = JSON.parse(stripFence(text));
  } catch {
    parsed = {
      conditionOverview: text.slice(0, 1200),
      researchInsights: [],
      clinicalTrialsSummary: [],
      limitations: ["Model returned non-JSON; install a newer Ollama or use a JSON-capable model."],
      citations: [],
      safetyNote: "Not medical advice; verify with a qualified clinician.",
    };
  }

  return { parsed, rawModelText: text, model: m };
}

/**
 * Last-resort synthesis when Ollama cannot be reached after all retries.
 */
export function fallbackSynthesis({ disease, userMessage, publications, trials, reason }) {
  return {
    parsed: {
      conditionOverview: `Research-oriented summary for “${disease || "your topic"}” based on retrieved literature and trials. LLM synthesis was skipped.`,
      researchInsights: publications.slice(0, 4).map(
        (p) => `“${p.title}” (${p.year || "n.d."}, ${p.source}) — ${(p.abstract || "").slice(0, 220)}…`
      ),
      clinicalTrialsSummary: trials.slice(0, 4).map(
        (t) => `${t.title} — ${t.status || "Unknown status"}; locations: ${(t.locations || []).slice(0, 2).join("; ") || "See trial page"}.`
      ),
      limitations: [
        reason ||
          "Ollama was not reachable from the API server. Install and start Ollama on the same machine as the backend, then run: ollama pull llama3.2",
      ],
      citations: [
        ...publications.slice(0, 6).map((p, i) => ({
          refId: `P${i + 1}`,
          supportingSnippet: (p.abstract || p.title).slice(0, 200),
        })),
        ...trials.slice(0, 4).map((t, i) => ({
          refId: `T${i + 1}`,
          supportingSnippet: (t.eligibility || t.title).slice(0, 200),
        })),
      ],
      safetyNote: "Educational use only; not medical advice.",
    },
    rawModelText: "",
    model: "fallback",
  };
}
