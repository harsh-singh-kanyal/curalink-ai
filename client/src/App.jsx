import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "";

async function postChat(body) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("health");
  return res.json();
}

function funnelPct(n, max) {
  if (!max || max <= 0) return 0;
  return Math.round((Math.min(n || 0, max) / max) * 100);
}

export default function App() {
  const [patientName, setPatientName] = useState("");
  const [disease, setDisease] = useState("Parkinson disease");
  const [additionalQuery, setAdditionalQuery] = useState("deep brain stimulation");
  const [location, setLocation] = useState("Toronto, Canada");
  const [message, setMessage] = useState(
    "Summarize latest evidence on deep brain stimulation outcomes in Parkinson disease."
  );
  const [sessionId, setSessionId] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [last, setLast] = useState(null);
  const [err, setErr] = useState("");
  const [health, setHealth] = useState(null);
  const [healthErr, setHealthErr] = useState(false);
  const [tab, setTab] = useState("trace");

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealthErr(true));
    const id = setInterval(() => {
      fetchHealth().then(setHealth).catch(() => setHealthErr(true));
    }, 20000);
    return () => clearInterval(id);
  }, []);

  const canSend = useMemo(() => message.trim().length > 0 && !loading, [message, loading]);

  async function onSend(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    setTab("trace");
    try {
      const data = await postChat({
        sessionId,
        message: message.trim(),
        patientName,
        disease,
        additionalQuery,
        location,
      });
      setSessionId(data.sessionId);
      setLast(data.answer);
      setTab("synthesis");
      setLog((prev) => [
        ...prev,
        { role: "user", content: message.trim() },
        { role: "assistant", content: data.answer?.structured?.conditionOverview || "…" },
      ]);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setLoading(false);
    }
  }

  function clearThread() {
    setSessionId(null);
    setLog([]);
    setLast(null);
    setErr("");
    setTab("trace");
  }

  const trace = last?.trace;
  const structured = last?.structured;

  const harvestMax = useMemo(() => {
    const f = trace?.funnel;
    if (!f) return 1;
    return Math.max(f.pubmedHarvested || 0, f.openAlexHarvested || 0, f.trialsHarvested || 0, 1);
  }, [trace]);

  const mongoOk = health?.mongo;
  const ollamaOk = health?.ollama;

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="logo-row">
            <div className="logo-mark" aria-hidden>
              CL
            </div>
            <div>
              <h1 className="brand-title">CuraLink</h1>
              <p className="brand-sub">AI medical research assistant — evidence first, reasoning second.</p>
            </div>
          </div>
        </div>

        <div className="status-grid">
          <div className="pill">
            <div className="pill-left">
              <span className={`dot ${healthErr ? "bad" : mongoOk ? "ok" : "warn"}`} />
              MongoDB
            </div>
            <span className="pill-val">{healthErr ? "?" : mongoOk ? "Live" : "Down"}</span>
          </div>
          <div className="pill">
            <div className="pill-left">
              <span className={`dot ${ollamaOk ? "ok" : "warn"}`} />
              Ollama
            </div>
            <span className="pill-val">{ollamaOk ? (health?.ollamaModel || "model") : "Offline"}</span>
          </div>
        </div>

        <form className="form-block" onSubmit={onSend}>
          <h2>Research profile</h2>

          <div className="field">
            <label>Patient name (optional)</label>
            <input
              className="input"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="How we should refer to you"
            />
          </div>

          <div className="row2">
            <div className="field">
              <label>Condition</label>
              <input className="input" value={disease} onChange={(e) => setDisease(e.target.value)} />
            </div>
            <div className="field">
              <label>Location</label>
              <input
                className="input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, country"
              />
            </div>
          </div>

          <div className="field">
            <label>Focus topic</label>
            <input
              className="input"
              value={additionalQuery}
              onChange={(e) => setAdditionalQuery(e.target.value)}
              placeholder="Intervention, drug, biomarker…"
            />
          </div>

          <div className="field">
            <label>Your question</label>
            <textarea
              className="textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask in natural language — follow-ups reuse your profile."
            />
          </div>

          {err ? <p className="err">{err}</p> : null}

          <button className="btn-primary" type="submit" disabled={!canSend}>
            {loading ? (
              <>
                <span className="spinner" style={{ borderTopColor: "white" }} />
                Running pipeline…
              </>
            ) : (
              <>Run research pipeline</>
            )}
          </button>
          <button type="button" className="btn-ghost" onClick={clearThread}>
            Clear conversation
          </button>
        </form>
      </aside>

      <section className="center">
        <header className="chat-head">
          <div>
            <h2>Conversation</h2>
            <p>
              Multi-turn memory via <span className="mono">MongoDB</span> sessions. Retrieval uses{" "}
              <strong>PubMed</strong>, <strong>OpenAlex</strong>, and <strong>ClinicalTrials.gov</strong> before{" "}
              <strong>Ollama</strong> synthesizes grounded JSON.
            </p>
          </div>
          {sessionId ? (
            <span className="session-pill mono" title={sessionId}>
              Session {sessionId.slice(0, 10)}…
            </span>
          ) : (
            <span className="session-pill">No session yet</span>
          )}
        </header>

        <div className="messages">
          {loading ? (
            <div className="loading-banner" role="status">
              <div className="loading-title">
                <span className="spinner" />
                Retrieving & reasoning…
              </div>
              <div className="pipeline">
                <div className="step">
                  <span className="i on" /> Intent lattice & query expansion
                </div>
                <div className="step">
                  <span className="i on" /> Broad harvest (3 sources, paginated)
                </div>
                <div className="step">
                  <span className="i on" /> Merge · dedupe · rank → top evidence
                </div>
                <div className="step">
                  <span className="i on" /> Ollama JSON synthesis + citations
                </div>
              </div>
            </div>
          ) : null}

          {!loading && log.length === 0 ? (
            <div className="empty-chat">
              <strong>Start with a structured profile + question</strong>
              <span>
                The right rail will light up with <strong>CuraLink Trace</strong> — harvest counts, merged pool size,
                and the exact API query strings your judges asked for.
              </span>
            </div>
          ) : null}

          {log.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              <div className="bubble-meta">{m.role === "user" ? "You" : "CuraLink"}</div>
              <div>{m.content}</div>
            </div>
          ))}
        </div>
      </section>

      <aside className="rail">
        <div className="tabs" role="tablist">
          <button
            type="button"
            className={`tab ${tab === "trace" ? "active" : ""}`}
            onClick={() => setTab("trace")}
          >
            Trace
          </button>
          <button
            type="button"
            className={`tab ${tab === "synthesis" ? "active" : ""}`}
            onClick={() => setTab("synthesis")}
          >
            Synthesis
          </button>
          <button
            type="button"
            className={`tab ${tab === "sources" ? "active" : ""}`}
            onClick={() => setTab("sources")}
          >
            Sources
          </button>
        </div>

        <div className="rail-body">
          {tab === "trace" && (
            <>
              <p className="panel-title">CuraLink Trace</p>
              <p className="muted">
                Transparency layer for hackathon demos: depth first (broad harvest), then precision (top‑K).
              </p>

              {!trace ? (
                <p className="muted">Run a query to populate the funnel.</p>
              ) : (
                <>
                  <div className="section-h">Harvest funnel</div>
                  <div className="funnel">
                    {[
                      ["PubMed", trace.funnel?.pubmedHarvested ?? 0],
                      ["OpenAlex", trace.funnel?.openAlexHarvested ?? 0],
                      ["Trials", trace.funnel?.trialsHarvested ?? 0],
                    ].map(([label, n]) => (
                      <div key={label}>
                        <div className="funnel-row">
                          <span>{label}</span>
                          <span className="mono">{n}</span>
                        </div>
                        <div className="funnel-bar">
                          <span style={{ width: `${funnelPct(n, harvestMax)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="section-h">After merge & rank</div>
                  <div className="stat-grid">
                    <div className="stat-card">
                      <div className="k">Merged pubs</div>
                      <div className="v">{trace.funnel?.mergedPublications ?? "—"}</div>
                    </div>
                    <div className="stat-card">
                      <div className="k">Top ranked</div>
                      <div className="v">{trace.funnel?.afterRanking?.publications ?? "—"}</div>
                    </div>
                    <div className="stat-card">
                      <div className="k">Top trials</div>
                      <div className="v">{trace.funnel?.afterRanking?.trials ?? "—"}</div>
                    </div>
                    <div className="stat-card">
                      <div className="k">Model</div>
                      <div className="v" style={{ fontSize: "0.95rem" }}>
                        {last?.model || "—"}
                      </div>
                    </div>
                  </div>

                  <div className="section-h">Intent lattice</div>
                  <div className="chips">
                    {(trace.intentLattice?.expandedQueries || []).map((q, i) => (
                      <span key={i} className="chip mono">
                        {q}
                      </span>
                    ))}
                  </div>

                  <div className="section-h">API query strings</div>
                  <div className="query-block">
                    <div>
                      <strong>PubMed</strong>
                      <div className="mono" style={{ marginTop: 6 }}>
                        {trace.intentLattice?.pubmedPrimary}
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <strong>OpenAlex</strong>
                      <div className="mono" style={{ marginTop: 6 }}>
                        {trace.intentLattice?.openAlexPrimary}
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <strong>ClinicalTrials condition</strong>
                      <div className="mono" style={{ marginTop: 6 }}>
                        {trace.intentLattice?.trialCondition}
                      </div>
                    </div>
                  </div>

                  {trace.llmNote ? (
                    <p className="err" style={{ marginTop: 12 }}>
                      {trace.llmNote}
                    </p>
                  ) : null}
                </>
              )}
            </>
          )}

          {tab === "synthesis" && (
            <>
              <p className="panel-title">Grounded synthesis</p>
              {!structured ? (
                <p className="muted">Run a query to see Ollama’s structured JSON sections.</p>
              ) : (
                <>
                  <div className="answer-card">{structured.conditionOverview}</div>

                  <div className="section-h">Research insights</div>
                  <div className="list-stack">
                    {(structured.researchInsights || []).map((x, i) => (
                      <div key={i} className="card-mini">
                        {x}
                      </div>
                    ))}
                  </div>

                  <div className="section-h">Clinical trials</div>
                  <div className="list-stack">
                    {(structured.clinicalTrialsSummary || []).map((x, i) => (
                      <div key={i} className="card-mini">
                        {x}
                      </div>
                    ))}
                  </div>

                  <div className="section-h">Limitations</div>
                  <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                    {(structured.limitations || []).map((x, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        {x}
                      </li>
                    ))}
                  </ul>

                  {(structured.citations || []).length ? (
                    <>
                      <div className="section-h">Citation anchors</div>
                      <div className="list-stack">
                        {(structured.citations || []).map((c, i) => (
                          <div key={i} className="card-mini mono" style={{ fontSize: "0.78rem" }}>
                            <strong>{c.refId}</strong> — {c.supportingSnippet}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}

                  <p className="disclaimer-foot" style={{ borderTop: "none", paddingTop: 10 }}>
                    {structured.safetyNote}
                  </p>
                </>
              )}
            </>
          )}

          {tab === "sources" && (
            <>
              <p className="panel-title">Ranked evidence</p>
              {!last?.publications?.length && !last?.trials?.length ? (
                <p className="muted">No sources yet — run the pipeline.</p>
              ) : (
                <>
                  <div className="section-h">Publications</div>
                  <div className="list-stack">
                    {(last?.publications || []).map((p, i) => (
                      <div key={i} className="card-mini">
                        <h3>{p.title}</h3>
                        <small>
                          {p.year} · {p.source} · {(p.authors || []).slice(0, 3).join(", ")}
                        </small>
                        <p>{(p.abstract || "").slice(0, 260)}{(p.abstract || "").length > 260 ? "…" : ""}</p>
                        {p.url ? (
                          <a href={p.url} target="_blank" rel="noreferrer">
                            Open source →
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="section-h">Clinical trials</div>
                  <div className="list-stack">
                    {(last?.trials || []).map((t, i) => (
                      <div key={i} className="card-mini">
                        <h3>{t.title}</h3>
                        <small>
                          {t.status} · {t.nctId}
                        </small>
                        <p>
                          <strong>Locations:</strong> {(t.locations || []).slice(0, 3).join(" · ") || "—"}
                        </p>
                        <p>
                          <strong>Eligibility:</strong> {(t.eligibility || "").slice(0, 220)}
                          {(t.eligibility || "").length > 220 ? "…" : ""}
                        </p>
                        {(t.contacts || []).length ? (
                          <p>
                            <strong>Contact:</strong> {t.contacts[0]}
                          </p>
                        ) : null}
                        {t.url ? (
                          <a href={t.url} target="_blank" rel="noreferrer">
                            ClinicalTrials.gov →
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <p className="disclaimer-foot">
          Educational research tool — not medical advice. Stack: React · Express · MongoDB · Ollama. Deploy reference:{" "}
          <a href="https://curalink-id6x.vercel.app" target="_blank" rel="noreferrer">
            Vercel demo
          </a>
          .
        </p>
      </aside>
    </div>
  );
}
