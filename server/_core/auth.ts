/**
 * Standalone Auth System - Replaces Manus OAuth
 * 
 * Features:
 * - JWT-based session management
 * - Email/password authentication
 * - Google OAuth integration (optional)
 * - Secure cookie handling
 */

import { SignJWT, jwtVerify } from "jose";
import crypto from "crypto";
import { cookies } from "constants";
import type { User } from "../../drizzle/schema";

// Configuration
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const COOKIE_NAME = "crm_session";
const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

// Types
export interface SessionPayload {
  userId: number;
  email: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: number;
  openId: string;
  email: string | null;
  name: string | null;
  role: string;
  loginMethod: string | null;
}

// Utility functions
function getSecretKey() {
  return new TextEncoder().encode(JWT_SECRET);
}

function generatePasswordHash(password: string, salt?: string): { hash: string; salt: string } {
  const useSalt = salt || crypto.randomBytes(32).toString("hex");
  const hash = crypto.pbkdf2Sync(password, useSalt, 100000, 64, "sha512").toString("hex");
  return { hash, salt: useSalt };
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const { hash: computedHash } = generatePasswordHash(password, salt);
  return computedHash === hash;
}

// JWT Session Management
export async function createSessionToken(user: AuthUser): Promise<string> {
  const secret = getSecretKey();
  const now = Math.floor(Date.now() / 1000);
  
  return new SignJWT({
    userId: user.id,
    email: user.email || "",
    name: user.name || "",
    role: user.role,
    loginMethod: user.loginMethod || "email",
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + Math.floor(SESSION_DURATION_MS / 1000))
    .sign(secret);
}

export async function verifySessionToken(token: string): Promise<AuthUser | null> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });
    
    return {
      id: payload.userId as number,
      openId: `user_${payload.userId}`,
      email: payload.email as string || null,
      name: payload.name as string || null,
      role: payload.role as string || "user",
      loginMethod: payload.loginMethod as string || "email",
    };
  } catch (error) {
    console.warn("[Auth] Session verification failed:", error);
    return null;
  }
}

// Cookie helpers
export function getSessionCookieOptions(isSecure: boolean = false) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function createSessionCookie(token: string, isSecure: boolean = false) {
  return {
    name: COOKIE_NAME,
    value: token,
    ...getSessionCookieOptions(isSecure),
    maxAge: SESSION_DURATION_MS,
  };
}

// OAuth Routes
export function registerAuthRoutes(app: Express.Application) {
  const express = require("express");
  const router = express.Router();

  // Login page
  router.get("/login", (req: any, res: any) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login - Variety Solar CRM</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
          }
          .login-container { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
          h1 { color: #333; margin-bottom: 1.5rem; text-align: center; }
          .form-group { margin-bottom: 1rem; }
          label { display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.9rem; }
          input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
          input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
          button { width: 100%; padding: 0.875rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
          button:hover { opacity: 0.9; }
          .error { color: #dc3545; margin-top: 1rem; text-align: center; font-size: 0.9rem; }
          .divider { text-align: center; margin: 1.5rem 0; color: #999; }
          .google-btn { background: white; border: 1px solid #ddd; color: #333; }
          .google-btn:hover { background: #f5f5f5; }
        </style>
      </head>
      <body>
        <div class="login-container">
          <h1>Variety Solar CRM</h1>
          <form id="loginForm">
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required placeholder="••••••••">
            </div>
            <button type="submit">Sign In</button>
            <div id="error" class="error" style="display:none;"></div>
          </form>
          <div class="divider">or</div>
          <button class="google-btn" onclick="window.location.href='/auth/google'">Continue with Google</button>
        </div>
        <script>
          document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const errorEl = document.getElementById('error');
            errorEl.style.display = 'none';
            
            const response = await fetch('/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: form.email.value,
                password: form.password.value
              })
            });
            
            const data = await response.json();
            if (data.success) {
              window.location.href = '/';
            } else {
              errorEl.textContent = data.error || 'Login failed';
              errorEl.style.display = 'block';
            }
          });
        </script>
      </body>
      </html>
    `);
  });

  // Register page
  router.get("/register", (req: any, res: any) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Register - Variety Solar CRM</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
          }
          .register-container { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); width: 100%; max-width: 400px; }
          h1 { color: #333; margin-bottom: 1.5rem; text-align: center; }
          .form-group { margin-bottom: 1rem; }
          label { display: block; margin-bottom: 0.5rem; color: #666; font-size: 0.9rem; }
          input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 8px; font-size: 1rem; }
          input:focus { outline: none; border-color: #667eea; box-shadow: 0 0 0 3px rgba(102,126,234,0.1); }
          button { width: 100%; padding: 0.875rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
          button:hover { opacity: 0.9; }
          .error { color: #dc3545; margin-top: 1rem; text-align: center; font-size: 0.9rem; }
        </style>
      </head>
      <body>
        <div class="register-container">
          <h1>Create Account</h1>
          <form id="registerForm">
            <div class="form-group">
              <label for="name">Full Name</label>
              <input type="text" id="name" name="name" required placeholder="John Smith">
            </div>
            <div class="form-group">
              <label for="email">Email</label>
              <input type="email" id="email" name="email" required placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required minlength="8" placeholder="••••••••">
            </div>
            <div class="form-group">
              <label for="confirmPassword">Confirm Password</label>
              <input type="password" id="confirmPassword" name="confirmPassword" required placeholder="••••••••">
            </div>
            <button type="submit">Create Account</button>
            <div id="error" class="error" style="display:none;"></div>
          </form>
        </div>
        <script>
          document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const errorEl = document.getElementById('error');
            errorEl.style.display = 'none';
            
            if (form.password.value !== form.confirmPassword.value) {
              errorEl.textContent = 'Passwords do not match';
              errorEl.style.display = 'block';
              return;
            }
            
            const response = await fetch('/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: form.name.value,
                email: form.email.value,
                password: form.password.value
              })
            });
            
            const data = await response.json();
            if (data.success) {
              window.location.href = '/';
            } else {
              errorEl.textContent = data.error || 'Registration failed';
              errorEl.style.display = 'block';
            }
          });
        </script>
      </body>
      </html>
    `);
  });

  // Login API
  router.post("/login", async (req: any, res: any) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ success: false, error: "Email and password required" });
      }

      // Get user from database
      const db = require("../db").default;
      const user = await db.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      // Verify password
      const dbModule = require("../db").default;
      const storedHash = await dbModule.getUserPasswordHash(user.id);
      
      if (!storedHash || !verifyPassword(password, storedHash.hash, storedHash.salt)) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      // Create session
      const token = await createSessionToken({
        id: user.id,
        openId: user.openId,
        email: user.email,
        name: user.name,
        role: user.role,
        loginMethod: "email",
      });

      const cookieOptions = getSessionCookieOptions(process.env.NODE_ENV === "production");
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Auth] Login error:", error);
      res.status(500).json({ success: false, error: "Login failed" });
    }
  });

  // Register API
  router.post("/register", async (req: any, res: any) => {
    try {
      const { name, email, password } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ success: false, error: "All fields required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
      }

      const db = require("../db").default;
      
      // Check if user exists
      const existingUser = await db.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ success: false, error: "Email already registered" });
      }

      // Create password hash
      const { hash, salt } = generatePasswordHash(password);

      // Create user
      const user = await db.createUser({
        name,
        email,
        passwordHash: hash,
        passwordSalt: salt,
        loginMethod: "email",
      });

      // Create session
      const token = await createSessionToken({
        id: user.id,
        openId: user.openId,
        email: user.email,
        name: user.name,
        role: user.role,
        loginMethod: "email",
      });

      const cookieOptions = getSessionCookieOptions(process.env.NODE_ENV === "production");
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

      res.json({ success: true });
    } catch (error: any) {
      console.error("[Auth] Registration error:", error);
      res.status(500).json({ success: false, error: "Registration failed" });
    }
  });

  // Logout
  router.post("/logout", (req: any, res: any) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
  });

  // Google OAuth
  router.get("/google", (req: any, res: any) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/auth/google/callback`;
    
    const scope = encodeURIComponent("email profile https://www.googleapis.com/auth/spreadsheets.readonly");
    const state = crypto.randomBytes(16).toString("hex");
    
    res.cookie("oauth_state", state, { httpOnly: true, maxAge: 600000 }); // 10 min expiry
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&state=${state}&access_type=offline`;
    
    res.redirect(authUrl);
  });

  // Google OAuth Callback
  router.get("/google/callback", async (req: any, res: any) => {
    try {
      const { code, state } = req.query;
      const savedState = req.cookies?.oauth_state;
      
      if (!code || !state || state !== savedState) {
        return res.status(400).send("Invalid OAuth state");
      }

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
          code,
          grant_type: "authorization_code",
          redirect_uri: process.env.GOOGLE_REDIRECT_URI || `${req.protocol}://${req.get("host")}/auth/google/callback`,
        }),
      });

      const tokens = await tokenResponse.json();
      
      // Get user info
      const userResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const googleUser = await userResponse.json();

      // Create or update user
      const db = require("../db").default;
      const user = await db.upsertGoogleUser({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        avatar: googleUser.picture,
      });

      // Create session
      const sessionToken = await createSessionToken({
        id: user.id,
        openId: user.openId,
        email: user.email,
        name: user.name,
        role: user.role,
        loginMethod: "google",
      });

      const cookieOptions = getSessionCookieOptions(process.env.NODE_ENV === "production");
      res.clearCookie("oauth_state");
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

      res.redirect("/");
    } catch (error: any) {
      console.error("[Auth] Google OAuth error:", error);
      res.redirect("/auth/login?error=oauth_failed");
    }
  });

  // Get current user
  router.get("/me", async (req: any, res: any) => {
    try {
      const token = req.cookies?.[COOKIE_NAME];
      if (!token) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const user = await verifySessionToken(token);
      if (!user) {
        return res.status(401).json({ error: "Invalid session" });
      }

      res.json(user);
    } catch (error) {
      res.status(401).json({ error: "Authentication failed" });
    }
  });

  // Apply routes
  app.use("/auth", router);
}

export { COOKIE_NAME, SESSION_DURATION_MS };