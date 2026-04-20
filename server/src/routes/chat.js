import { Router } from "express";
import { nanoid } from "nanoid";
import { Session } from "../models/Session.js";
import { runRetrievalPipeline } from "../services/retrieval.js";
import { synthesizeWithOllama, fallbackSynthesis } from "../services/llm.js";

const router = Router();

function summarizeHistory(messages, max = 6) {
  const tail = messages.slice(-max);
  return tail
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n---\n");
}

function stripScores(items) {
  return items.map(({ _scores, raw, ...rest }) => rest);
}

router.post("/", async (req, res) => {
  try {
    const {
      sessionId: incomingSid,
      message,
      patientName = "",
      disease = "",
      location = "",
      additionalQuery = "",
    } = req.body || {};

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "message is required" });
    }

    const sessionId = incomingSid || nanoid();

    let session = await Session.findOne({ sessionId });
    if (!session) {
      session = new Session({
        sessionId,
        patientName,
        disease,
        location,
        additionalQuery,
        messages: [],
      });
    } else {
      if (patientName) session.patientName = patientName;
      if (disease) session.disease = disease;
      if (location) session.location = location;
      if (additionalQuery) session.additionalQuery = additionalQuery;
    }

    session.messages.push({
      role: "user",
      content: message,
    });
    if (session.messages.length > 40) {
      session.messages = session.messages.slice(-40);
    }

    const effDisease = disease || session.disease || "";
    const effLocation = location || session.location || "";
    const effAdditional = additionalQuery || session.additionalQuery || "";

    const retrieval = await runRetrievalPipeline({
      message,
      disease: effDisease,
      additionalQuery: effAdditional,
      location: effLocation,
    });

    const conversationSummary = summarizeHistory(session.messages);

    let synthesis;
    try {
      synthesis = await synthesizeWithOllama({
        patientName: patientName || session.patientName,
        disease: effDisease,
        location: effLocation,
        userMessage: message,
        conversationSummary,
        publications: stripScores(retrieval.publications),
        trials: stripScores(retrieval.trials),
      });
    } catch (e) {
      console.error("LLM synthesis failed, using fallback:", e.message);
      synthesis = fallbackSynthesis({
        disease: effDisease,
        userMessage: message,
        publications: stripScores(retrieval.publications),
        trials: stripScores(retrieval.trials),
        reason: e.message,
      });
      retrieval.trace.llmNote = `Ollama: ${e.message}`;
    }

    const assistantPayload = {
      structured: synthesis.parsed,
      publications: stripScores(retrieval.publications),
      trials: stripScores(retrieval.trials),
      trace: retrieval.trace,
      model: synthesis.model,
    };

    session.messages.push({
      role: "assistant",
      content: synthesis.parsed?.conditionOverview || "Response generated.",
      structured: synthesis.parsed,
      trace: retrieval.trace,
    });

    await session.save();

    return res.json({
      sessionId: session.sessionId,
      answer: assistantPayload,
      rawModelText: synthesis.rawModelText,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

router.get("/session/:sessionId", async (req, res) => {
  const s = await Session.findOne({ sessionId: req.params.sessionId }).lean();
  if (!s) return res.status(404).json({ error: "Not found" });
  return res.json(s);
});

export default router;
