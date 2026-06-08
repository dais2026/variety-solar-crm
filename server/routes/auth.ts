/**
 * Auth Routes - Handles login, register, logout, and session management
 */

import { Router } from "express";
import { verifySessionToken, createSessionToken, COOKIE_NAME, SESSION_DURATION_MS } from "../_core/auth.js";
import { getUserById, getUserByEmail, getUserByGoogleId, createUser } from "../_core/db.js";
import { isConfigured as isGoogleConfigured, getAuthUrl, exchangeCodeForTokens } from "../_core/google-sheets.js";
import crypto from "crypto";

const router = Router();

// Middleware to verify authentication
export async function requireAuth(req: any, res: any, next: any) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await verifySessionToken(token);
    
    if (!user) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ error: "Invalid session" });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: "Authentication failed" });
  }
}

// Get current user
router.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const sessionUser = await verifySessionToken(token);
    
    if (!sessionUser) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ error: "Invalid session" });
    }

    // Get full user data from database
    const user = await getUserById(sessionUser.id);
    
    if (!user) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ error: "User not found" });
    }

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      loginMethod: user.login_method,
    });
  } catch (error) {
    console.error("[Auth] Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Login with email/password
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    const user = await getUserByEmail(email);
    
    if (!user || !user.password_hash || !user.password_salt) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const crypto = await import("crypto");
    const hash = crypto.default.pbkdf2Sync(password, user.password_salt, 100000, 64, "sha512").toString("hex");
    
    if (hash !== user.password_hash) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Create session token
    const token = await createSessionToken({
      id: user.id,
      openId: user.open_id,
      email: user.email,
      name: user.name,
      role: user.role,
      loginMethod: "email",
    });

    // Set cookie
    const isSecure = process.env.NODE_ENV === "production";
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Check if user exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password
    const salt = crypto.randomBytes(32).toString("hex");
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");

    // Create user
    const user = await createUser({
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
      role: user.role || "user",
      loginMethod: "email",
    });

    const isSecure = process.env.NODE_ENV === "production";
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_MS,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || "user",
      },
    });
  } catch (error) {
    console.error("[Auth] Register error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

// Google OAuth login
router.get("/google", (req, res) => {
  try {
    if (!isGoogleConfigured()) {
      return res.status(400).json({ error: "Google OAuth not configured" });
    }
    
    const authUrl = getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error("[Auth] Google OAuth error:", error);
    res.status(500).json({ error: "Failed to initiate Google login" });
  }
});

// Google OAuth callback
router.get("/google/callback", async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.redirect("/auth/login?error=missing_code");
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code as string);
    
    // TODO: Store tokens in database for the user
    // For now, redirect with success
    res.redirect("/?auth=google_success");
  } catch (error) {
    console.error("[Auth] Google callback error:", error);
    res.redirect("/auth/login?error=oauth_failed");
  }
});

// Change password
router.post("/change-password", async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const sessionUser = await verifySessionToken(token);
    if (!sessionUser) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await getUserById(sessionUser.id);
    
    if (!user || !user.password_hash || !user.password_salt) {
      return res.status(400).json({ error: "No password set" });
    }

    // Verify current password
    const hash = crypto.pbkdf2Sync(currentPassword, user.password_salt, 100000, 64, "sha512").toString("hex");
    
    if (hash !== user.password_hash) {
      return res.status(401).json({ error: "Current password incorrect" });
    }

    // Hash new password
    const salt = crypto.randomBytes(32).toString("hex");
    const newHash = crypto.pbkdf2Sync(newPassword, salt, 100000, 64, "sha512").toString("hex");

    // Update password in database
    // TODO: Add updateUserPassword to db module
    res.json({ success: true });
  } catch (error) {
    console.error("[Auth] Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;