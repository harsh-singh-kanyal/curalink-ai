import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import chatRouter from "./routes/chat.js";
import { ollamaHeaders } from "./services/ollamaClient.js";

const PORT = Number(process.env.PORT || 5000);

const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));

async function ollamaReachable() {
  const bases = process.env.OLLAMA_API_KEY?.trim()
    ? [
        "https://ollama.com",
        (process.env.OLLAMA_URL || "").replace(/\/$/, ""),
        "http://127.0.0.1:11434",
      ].filter(Boolean)
    : [
        (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
        "http://127.0.0.1:11434",
      ];
  const unique = [...new Set(bases)];
  for (const base of unique) {
    try {
      const r = await fetch(`${base}/api/tags`, {
        headers: ollamaHeaders(),
        signal: AbortSignal.timeout(4000),
      });
      if (r.ok) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

app.get("/api/health", async (_req, res) => {
  const ollama = await ollamaReachable();
  res.json({
    ok: true,
    service: "curalink-server",
    mongo: mongoose.connection.readyState === 1,
    ollama,
    ollamaModel: process.env.OLLAMA_MODEL || "llama3.2",
  });
});

app.use("/api/chat", chatRouter);

app.get("/api/meta", (_req, res) => {
  res.json({
    name: "CuraLink",
    tagline: "AI Medical Research Assistant",
    unique: [
      "CuraLink Trace — transparent retrieval funnel (harvest → merge → rank)",
      "Intent Lattice — disease + topic expansion for APIs",
      "Geo-aware trial ranking using user locale",
    ],
  });
});

async function resolveMongoUri() {
  if (process.env.USE_MEMORY_DB === "1") {
    const mem = await MongoMemoryServer.create();
    const uri = mem.getUri();
    console.log("Using in-memory MongoDB (USE_MEMORY_DB=1)");
    return uri;
  }
  return process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/curalink";
}

async function main() {
  const uri = await resolveMongoUri();
  await mongoose.connect(uri);
  console.log("MongoDB connected");

  app.listen(PORT, () => {
    console.log(`CuraLink API listening on :${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
