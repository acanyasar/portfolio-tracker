import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Pool } from "pg";
import type { RequestHandler, Request, Response, NextFunction } from "express";
import type { IStorage } from "./storage";
import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      dashboardWidgets?: import("@shared/schema").WidgetPreferences;
    }
  }
}

export function configurePassport(storage: IStorage) {
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) return done(null, false, { message: "Invalid username or password" });
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return done(null, false, { message: "Invalid username or password" });
        return done(null, { id: user.id, username: user.username });
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUserById(id);
      if (!user) return done(null, false);
      done(null, { id: user.id, username: user.username, dashboardWidgets: user.dashboardWidgets });
    } catch (err) {
      done(err);
    }
  });
}

export function sessionMiddleware(pgPool: Pool): RequestHandler[] {
  const PgStore = connectPgSimple(session);
  const store = new PgStore({
    pool: pgPool,
    createTableIfMissing: true,
  });

  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET must be set in .env");

  return [
    session({
      store,
      secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
      },
    }) as RequestHandler,
    passport.initialize(),
    passport.session(),
  ];
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Bypass auth for /api/auth/* routes
  if (req.path.startsWith("/auth")) return next();
  if (req.isAuthenticated()) return next();
  return res.status(401).json({ error: "Unauthorized" });
}
