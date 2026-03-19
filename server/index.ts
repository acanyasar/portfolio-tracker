import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { storage } from "./storage";
import { configurePassport, sessionMiddleware, requireAuth } from "./auth";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  // Wire session + passport (requires DATABASE_URL for session store)
  if (process.env.DATABASE_URL) {
    const { pool } = await import("./db");
    const middlewares = sessionMiddleware(pool);
    for (const mw of middlewares) app.use(mw);
  }

  configurePassport(storage);

  // Health check — no auth required
  app.get("/health", async (_req, res) => {
    if (process.env.DATABASE_URL) {
      try {
        const { pool } = await import("./db");
        await pool.query("SELECT 1");
        res.json({ status: "ok", db: "connected" });
      } catch {
        res.status(503).json({ status: "error", db: "unreachable" });
      }
    } else {
      res.json({ status: "ok", db: "none" });
    }
  });

  // Protect all /api routes except /api/auth/*
  app.use("/api", requireAuth);

  await registerRoutes(httpServer, app);

  if (process.env.DATABASE_URL) {
    const { seedIfEmpty } = await import("./seed");
    await seedIfEmpty();

    const { startAlertJob } = await import("./alerts");
    const alertHandle = startAlertJob(storage);

    process.on("SIGTERM", () => {
      clearInterval(alertHandle);
      process.exit(0);
    });
  }

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "3001", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})().catch((err) => {
  console.error("[startup] Fatal error during startup:", err);
  process.exit(1);
});
