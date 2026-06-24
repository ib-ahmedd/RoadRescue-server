import express from "express";
import cors from "cors";
import providersRouter from "./routes/providers";
import requestsRouter from "./routes/requests";
import contactRouter from "./routes/contact";

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/providers", providersRouter);
app.use("/api/requests", requestsRouter);
app.use("/api/contact", contactRouter);

// ── Health check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── 404 fallback ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 RoadRescue API server running at http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Providers:    http://localhost:${PORT}/api/providers`);
  console.log(`   Requests:     http://localhost:${PORT}/api/requests`);
  console.log(`   Contact:      http://localhost:${PORT}/api/contact`);
});

export default app;
