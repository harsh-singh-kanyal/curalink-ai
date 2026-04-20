/**
 * Ollama HTTP client:
 * - Local: http://127.0.0.1:11434 (no key)
 * - Cloud: https://ollama.com + OLLAMA_API_KEY → Authorization: Bearer …
 * @see https://docs.ollama.com/api/authentication
 */

const DEFAULT_PORT = 11434;
const OLLAMA_CLOUD = "https://ollama.com";

function normalizeBase(url) {
  if (!url) return "";
  return String(url).replace(/\/$/, "");
}

/** Headers for all Ollama API calls */
export function ollamaHeaders(extra = {}) {
  const h = {
    "Content-Type": "application/json",
    ...extra,
  };
  const key = process.env.OLLAMA_API_KEY?.trim();
  if (key) {
    h.Authorization = `Bearer ${key}`;
  }
  return h;
}

function candidateBases() {
  const fromEnv = normalizeBase(process.env.OLLAMA_URL);
  const hasKey = Boolean(process.env.OLLAMA_API_KEY?.trim());
  const out = [];

  if (hasKey) {
    out.push(OLLAMA_CLOUD);
  }
  if (fromEnv) {
    out.push(fromEnv);
  }
  if (!hasKey) {
    out.push(`http://127.0.0.1:${DEFAULT_PORT}`);
    out.push(`http://localhost:${DEFAULT_PORT}`);
  }

  return [...new Set(out.filter(Boolean))];
}

export async function resolveOllamaBase() {
  const errors = [];
  for (const base of candidateBases()) {
    try {
      const r = await fetch(`${base}/api/tags`, {
        headers: ollamaHeaders(),
        signal: AbortSignal.timeout(30000), // Increased from 8s to 30s
      });
      if (r.ok) return base;
      const t = await r.text().catch(() => "");
      errors.push(`${base} → HTTP ${r.status} ${t.slice(0, 80)}`);
    } catch (e) {
      errors.push(`${base} → ${e.cause?.code || e.code || e.message}`);
    }
  }
  const hint = process.env.OLLAMA_API_KEY
    ? "Check OLLAMA_API_KEY at https://ollama.com/settings/keys and set OLLAMA_URL=https://ollama.com if using cloud."
    : "Start the Ollama app or `ollama serve`, then `ollama pull " +
      (process.env.OLLAMA_MODEL || "llama3.2").split(":")[0] +
      "` on this machine (default port 11434).";
  throw new Error(`Cannot reach Ollama. Tried: ${errors.join(" | ")}. ${hint}`);
}

export async function listOllamaModels(base) {
  const r = await fetch(`${base}/api/tags`, {
    headers: ollamaHeaders(),
    signal: AbortSignal.timeout(30000), // Increased from 15s to 30s
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`Ollama /api/tags HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  const data = await r.json();
  return (data.models || []).map((m) => m.name).filter(Boolean);
}

/**
 * Pick an installed model: exact match, :latest, name prefix, or first available.
 */
export function resolveModelName(preferred, installed) {
  const want = (preferred || process.env.OLLAMA_MODEL || "llama3.2").trim();
  if (!installed.length) {
    throw new Error(`No models available. Run: ollama pull ${want.split(":")[0]} (or pick a cloud model you have access to).`);
  }
  if (installed.includes(want)) return want;
  if (installed.includes(`${want}:latest`)) return `${want}:latest`;
  const baseName = want.split(":")[0];
  const byPrefix = installed.find((n) => n === baseName || n.startsWith(`${baseName}:`));
  if (byPrefix) return byPrefix;
  return installed[0];
}

export async function ollamaChatJson({
  base,
  model,
  messages,
  preferJsonFormat = true,
}) {
  const body = {
    model,
    stream: false,
    messages,
  };
  if (preferJsonFormat) {
    body.format = "json";
  }

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: ollamaHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(1200000), // 20 minutes for slow hardware
  });

  const errText = await res.text().catch(() => "");

  if (!res.ok) {
    if (preferJsonFormat && res.status === 400) {
      const retry = /format|json|invalid/i.test(errText) || errText.length < 500;
      if (retry) {
        return ollamaChatJson({
          base,
          model,
          messages,
          preferJsonFormat: false,
        });
      }
    }
    throw new Error(`Ollama /api/chat ${res.status}: ${errText.slice(0, 280)}`);
  }

  let data;
  try {
    data = JSON.parse(errText);
  } catch {
    throw new Error(`Ollama returned non-JSON body: ${errText.slice(0, 200)}`);
  }
  const text = data?.message?.content || data?.response || "";
  return { text, modelUsed: model };
}
