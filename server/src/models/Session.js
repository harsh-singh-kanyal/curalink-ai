import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    structured: { type: mongoose.Schema.Types.Mixed },
    trace: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

const SessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    patientName: { type: String, default: "" },
    disease: { type: String, default: "" },
    location: { type: String, default: "" },
    additionalQuery: { type: String, default: "" },
    messages: [MessageSchema],
  },
  { timestamps: true }
);

export const Session = mongoose.model("Session", SessionSchema);
