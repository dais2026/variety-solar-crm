/**
 * Standalone Database Module - Replaces Manus DB
 * 
 * Supports:
 * - MySQL/TiDB via mysql2
 * - SQLite fallback for development
 * - Auto-migration on startup
 */

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

// Database connection pool
let pool: mysql.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

// Configuration
const config = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "variety_solar_crm",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Initialize database connection
export async function initDatabase(): Promise<void> {
  if (pool) return;

  try {
    // First connect without database to create it if needed
    const tempPool = mysql.createPool({
      ...config,
      database: undefined,
    });

    await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
    await tempPool.end();

    // Now connect to the database
    pool = mysql.createPool(config);

    console.log("[DB] Connected to MySQL database");

    // Run migrations
    await runMigrations();
  } catch (error) {
    console.error("[DB] Failed to connect to MySQL:", error);
    console.warn("[DB] Running without database - some features may not work");
    pool = null;
    db = null;
  }
}

// SQLite fallback for development
let sqliteDb: any = null;

async function initSqliteFallback(): Promise<void> {
  const Database = require("better-sqlite3");
  sqliteDb = new Database("./data/crm.db");
  
  // Create tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      open_id TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      name TEXT,
      role TEXT DEFAULT 'user',
      google_id TEXT,
      avatar TEXT,
      password_hash TEXT,
      password_salt TEXT,
      login_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      address TEXT,
      suburb TEXT,
      state TEXT,
      postcode TEXT,
      status TEXT DEFAULT 'new',
      source TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      direction TEXT NOT NULL,
      duration INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      notes TEXT,
      recording_url TEXT,
      transcription TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      user_id INTEGER NOT NULL,
      channel TEXT NOT NULL,
      direction TEXT NOT NULL,
      message TEXT NOT NULL,
      raw_payload TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  console.log("[DB] Using SQLite fallback database");
}

// Run database migrations
async function runMigrations(): Promise<void> {
  if (sqliteDb) {
    // SQLite handles this in init
    return;
  }

  try {
    // Add missing columns if they don't exist
    const alterQueries = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_salt VARCHAR(255)`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS login_method VARCHAR(50)`,
    ];

    for (const query of alterQueries) {
      try {
        await pool!.query(query);
      } catch (e: any) {
        // Column might already exist, ignore
        if (!e.message.includes("Duplicate")) {
          console.warn("[DB] Migration warning:", e.message);
        }
      }
    }

    console.log("[DB] Migrations completed");
  } catch (error) {
    console.error("[DB] Migration error:", error);
  }
}

// User operations
export async function getUserById(id: number): Promise<any> {
  if (sqliteDb) {
    const stmt = sqliteDb.prepare("SELECT * FROM users WHERE id = ?");
    return stmt.get(id);
  }
  
  const [rows] = await pool!.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<any> {
  if (sqliteDb) {
    const stmt = sqliteDb.prepare("SELECT * FROM users WHERE email = ?");
    return stmt.get(email);
  }
  
  const [rows] = await pool!.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0];
}

export async function getUserByGoogleId(googleId: string): Promise<any> {
  if (sqliteDb) {
    const stmt = sqliteDb.prepare("SELECT * FROM users WHERE google_id = ?");
    return stmt.get(googleId);
  }
  
  const [rows] = await pool!.query("SELECT * FROM users WHERE google_id = ?", [googleId]);
  return rows[0];
}

export async function createUser(data: {
  name?: string;
  email?: string;
  googleId?: string;
  avatar?: string;
  passwordHash?: string;
  passwordSalt?: string;
  loginMethod?: string;
}): Promise<any> {
  const openId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  if (sqliteDb) {
    const stmt = sqliteDb.prepare(`
      INSERT INTO users (open_id, name, email, google_id, avatar, password_hash, password_salt, login_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      openId,
      data.name || null,
      data.email || null,
      data.googleId || null,
      data.avatar || null,
      data.passwordHash || null,
      data.passwordSalt || null,
      data.loginMethod || null
    );
    return { id: result.lastInsertRowid, openId, ...data };
  }

  await pool!.query(
    `INSERT INTO users (open_id, name, email, google_id, avatar, password_hash, password_salt, login_method)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [openId, data.name || null, data.email || null, data.googleId || null, data.avatar || null, data.passwordHash || null, data.passwordSalt || null, data.loginMethod || null]
  );
  
  const [rows] = await pool!.query("SELECT LAST_INSERT_ID() as id");
  return { id: rows[0].id, openId, ...data };
}

export async function upsertGoogleUser(data: {
  googleId: string;
  email: string;
  name: string;
  avatar?: string;
}): Promise<any> {
  const existing = await getUserByGoogleId(data.googleId);
  
  if (existing) {
    // Update existing user
    if (sqliteDb) {
      sqliteDb.prepare(`
        UPDATE users SET name = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE google_id = ?
      `).run(data.name, data.avatar || existing.avatar, data.googleId);
    } else {
      await pool!.query(
        "UPDATE users SET name = ?, avatar = ?, updated_at = CURRENT_TIMESTAMP WHERE google_id = ?",
        [data.name, data.avatar || null, data.googleId]
      );
    }
    return { ...existing, name: data.name, avatar: data.avatar };
  }

  // Create new user
  return createUser({
    name: data.name,
    email: data.email,
    googleId: data.googleId,
    avatar: data.avatar,
    loginMethod: "google",
  });
}

export async function getUserPasswordHash(userId: number): Promise<{ hash: string; salt: string } | null> {
  const user = await getUserById(userId);
  if (!user || !user.password_hash || !user.password_salt) {
    return null;
  }
  return { hash: user.password_hash, salt: user.password_salt };
}

// Lead operations
export async function getLeads(options?: {
  userId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  let query = "SELECT * FROM leads WHERE 1=1";
  const params: any[] = [];

  if (options?.userId) {
    query += " AND owner_id = ?";
    params.push(options.userId);
  }

  if (options?.status) {
    query += " AND status = ?";
    params.push(options.status);
  }

  query += " ORDER BY created_at DESC";

  if (options?.limit) {
    query += " LIMIT ?";
    params.push(options.limit);
  }

  if (options?.offset) {
    query += " OFFSET ?";
    params.push(options.offset);
  }

  if (sqliteDb) {
    const stmt = sqliteDb.prepare(query);
    return stmt.all(...params);
  }

  const [rows] = await pool!.query(query, params);
  return rows;
}

export async function getLeadById(id: number): Promise<any> {
  if (sqliteDb) {
    return sqliteDb.prepare("SELECT * FROM leads WHERE id = ?").get(id);
  }
  const [rows] = await pool!.query("SELECT * FROM leads WHERE id = ?", [id]);
  return rows[0];
}

export async function createLead(data: {
  ownerId?: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  status?: string;
  source?: string;
  notes?: string;
}): Promise<any> {
  if (sqliteDb) {
    const result = sqliteDb.prepare(`
      INSERT INTO leads (owner_id, first_name, last_name, email, phone, address, suburb, state, postcode, status, source, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.ownerId || null,
      data.firstName,
      data.lastName,
      data.email || null,
      data.phone || null,
      data.address || null,
      data.suburb || null,
      data.state || null,
      data.postcode || null,
      data.status || "new",
      data.source || null,
      data.notes || null
    );
    return { id: result.lastInsertRowid, ...data };
  }

  await pool!.query(
    `INSERT INTO leads (owner_id, first_name, last_name, email, phone, address, suburb, state, postcode, status, source, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.ownerId || null, data.firstName, data.lastName, data.email || null, data.phone || null, data.address || null, data.suburb || null, data.state || null, data.postcode || null, data.status || "new", data.source || null, data.notes || null]
  );

  const [rows] = await pool!.query("SELECT LAST_INSERT_ID() as id");
  return { id: rows[0].id, ...data };
}

export async function updateLead(id: number, data: Partial<{
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  status: string;
  source: string;
  notes: string;
}>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    const dbKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    fields.push(`${dbKey} = ?`);
    values.push(value);
  });

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);

  if (sqliteDb) {
    sqliteDb.prepare(`UPDATE leads SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  } else {
    await pool!.query(`UPDATE leads SET ${fields.join(", ")} WHERE id = ?`, values);
  }
}

// Call operations
export async function createCall(data: {
  leadId: number;
  userId: number;
  direction: "inbound" | "outbound";
  duration?: number;
  status?: string;
  notes?: string;
  recordingUrl?: string;
  transcription?: string;
}): Promise<any> {
  if (sqliteDb) {
    const result = sqliteDb.prepare(`
      INSERT INTO calls (lead_id, user_id, direction, duration, status, notes, recording_url, transcription)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.leadId,
      data.userId,
      data.direction,
      data.duration || 0,
      data.status || "completed",
      data.notes || null,
      data.recordingUrl || null,
      data.transcription || null
    );
    return { id: result.lastInsertRowid, ...data };
  }

  await pool!.query(
    `INSERT INTO calls (lead_id, user_id, direction, duration, status, notes, recording_url, transcription)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.leadId, data.userId, data.direction, data.duration || 0, data.status || "completed", data.notes || null, data.recordingUrl || null, data.transcription || null]
  );

  const [rows] = await pool!.query("SELECT LAST_INSERT_ID() as id");
  return { id: rows[0].id, ...data };
}

// Conversation operations
export async function createConversation(data: {
  leadId?: number;
  userId: number;
  channel: string;
  direction: "inbound" | "outbound";
  message: string;
  rawPayload?: string;
}): Promise<any> {
  if (sqliteDb) {
    const result = sqliteDb.prepare(`
      INSERT INTO conversations (lead_id, user_id, channel, direction, message, raw_payload)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.leadId || null,
      data.userId,
      data.channel,
      data.direction,
      data.message,
      data.rawPayload || null
    );
    return { id: result.lastInsertRowid, ...data };
  }

  await pool!.query(
    `INSERT INTO conversations (lead_id, user_id, channel, direction, message, raw_payload)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [data.leadId || null, data.userId, data.channel, data.direction, data.message, data.rawPayload || null]
  );

  const [rows] = await pool!.query("SELECT LAST_INSERT_ID() as id");
  return { id: rows[0].id, ...data };
}

// Activity operations
export async function createActivity(data: {
  leadId?: number;
  userId: number;
  type: string;
  description?: string;
  metadata?: string;
}): Promise<any> {
  if (sqliteDb) {
    const result = sqliteDb.prepare(`
      INSERT INTO activities (lead_id, user_id, type, description, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.leadId || null,
      data.userId,
      data.type,
      data.description || null,
      data.metadata || null
    );
    return { id: result.lastInsertRowid, ...data };
  }

  await pool!.query(
    `INSERT INTO activities (lead_id, user_id, type, description, metadata)
     VALUES (?, ?, ?, ?, ?)`,
    [data.leadId || null, data.userId, data.type, data.description || null, data.metadata || null]
  );

  const [rows] = await pool!.query("SELECT LAST_INSERT_ID() as id");
  return { id: rows[0].id, ...data };
}

// Close database connection
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
}

// Export db instance for direct Drizzle queries
export function getDb() {
  return db;
}