# CuraLink — AI Medical Research Assistant (MERN)

Health **research companion** that harvests a **broad evidence pool** from **PubMed**, **OpenAlex**, and **ClinicalTrials.gov**, **deduplicates & ranks**, then synthesizes a **structured JSON answer** with an **open-source LLM** (Ollama). Built for hackathon demos where judges care about **pipeline transparency**, not black-box chat.

## Unique product hooks (your Loom story)

1. **CuraLink Trace** — live funnel metrics: harvested → merged → top‑K after ranking (shows *depth → precision*).
2. **Intent Lattice** — deterministic expansion of **disease + topic** so searches are context-aware (not isolated keywords).
3. **Geo-aware trial ranking** — when users add a location, recruiting / nearby site strings get a measurable boost in ranking.

## Stack

- **MongoDB** — session + conversation history  
- **Express + Node** — retrieval pipeline + chat API  
- **React (Vite)** — chat UI, structured output, trace panel  
- **Ollama** — local open-source LLM (`llama3.2`, `mistral`, etc.)

## Prerequisites

- Node.js 20+  
- MongoDB (local or Docker)  
- [Ollama](https://ollama.com) with a model pulled, e.g. `ollama pull llama3.2`

## Quick start

### 1) MongoDB

```bash
docker compose up -d
```

Or use your own `MONGODB_URI`.

### 2) Server

```bash
cd server
cp .env.example .env
# Edit MONGODB_URI, optional NCBI_EMAIL / NCBI_API_KEY, OLLAMA_MODEL
npm install
npm run dev
```

### 3) Client

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5173`.

### Production build (client)

```bash
cd client
npm run build
```

Set `VITE_API_URL` to your deployed API origin if the UI is not served behind the same host (see `client/.env.example`).

## Environment

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | Mongo connection string |
| `CLIENT_ORIGIN` | CORS allowlist (e.g. your Vercel URL) |
| `OLLAMA_URL` | Default `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | e.g. `llama3.2` |
| `NCBI_EMAIL` / `NCBI_API_KEY` | Optional; helps E-utilities rate limits |

## API

- `POST /api/chat` — body: `{ sessionId?, message, patientName?, disease?, location?, additionalQuery? }`  
- `GET /api/health` — liveness  
- `GET /api/meta` — product metadata for demos  

## Hackathon checklist

- [ ] Deploy API + Mongo (Atlas or managed) + static React host  
- [ ] Point `CLIENT_ORIGIN` and `VITE_API_URL` correctly  
- [ ] Install Ollama on the server **or** document fallback (template synthesis runs if Ollama is down)  
- [ ] Record Loom: architecture → pipeline → **CuraLink Trace** → live query  

## Disclaimer

Educational research tool — **not** medical advice. No diagnostic or treatment claims.
