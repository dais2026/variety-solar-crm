/**
 * Main Server Entry Point - Standalone CRM
 * 
 * Replaces Manus Forge backend with:
 * - Express.js server
 * - JWT authentication
 * - OpenAI integration
 * - AWS S3 storage
 * - Google Sheets API
 * - SMS/Email notifications
 */

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initDatabase, closeDatabase } from "./_core/db.js";
import { registerAuthRoutes } from "./_core/auth.js";

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(",") || ["http://localhost:3000"],
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      database: !!process.env.DATABASE_URL,
      openai: !!process.env.OPENAI_API_KEY,
      s3: !!process.env.AWS_ACCESS_KEY_ID,
      google: !!process.env.GOOGLE_CLIENT_ID,
    },
  });
});

// Serve static frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static("../client/dist"));
}

// API Routes
app.use("/auth", (await import("./routes/auth.js")).default);
app.use("/api/leads", (await import("./routes/leads.js")).default);
app.use("/api/calls", (await import("./routes/calls.js")).default);
app.use("/api/ai", (await import("./routes/ai.js")).default);
app.use("/api/sheets", (await import("./routes/sheets.js")).default);
app.use("/api/upload", (await import("./routes/upload.js")).default);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Server] Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Start server
async function start() {
  try {
    // Initialize database
    await initDatabase();
    console.log("[Server] Database initialized");

    // Start listening
    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   ██████╗ ██╗      █████╗ ███╗   ██╗███████╗███████╗    ║
║   ██╔══██╗██║     ██╔══██╗████╗  ██║██╔════╝██╔════╝    ║
║   ██████╔╝██║     ███████║██╔██╗ ██║█████╗  ███████╗    ║
║   ██╔═══╝ ██║     ██╔══██║██║╚██╗██║██╔══╝  ╚════██║   ║
║   ██║     ███████╗██║  ██║██║ ╚████║███████╗███████║   ║
║   ╚═╝     ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝   ║
║                                                          ║
║   CRM Standalone Server v1.0.0                          ║
║   Running on http://localhost:${PORT}                       ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("[Server] Failed to start:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Server] Shutting down...");
  await closeDatabase();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Server] Shutting down...");
  await closeDatabase();
  process.exit(0);
});

start();

export default app;