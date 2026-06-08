import { desc, eq, and, sql, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, InsertSmsLogEntry, InsertDiscoveryRecording, InsertClosedSale, InsertDeletedLead, InsertNpuSmsSent, InsertVoicemailSmsSent, InsertSmsTemplate, InsertMeetingSent, smsLog, users, discoveryRecordings, closedSales, deletedLeads, npuSmsSent, voicemailSmsSent, smsTemplates, meetingsSent } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── SMS Log Queries ───────────────────────────────────────────────────────

export async function insertSmsLog(entry: InsertSmsLogEntry): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert SMS log: database not available");
    return;
  }
  await db.insert(smsLog).values(entry);
}

export async function insertSmsLogBatch(entries: InsertSmsLogEntry[]): Promise<void> {
  const db = await getDb();
  if (!db || entries.length === 0) return;
  await db.insert(smsLog).values(entries);
}

export async function getSmsLogs(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smsLog).orderBy(desc(smsLog.createdAt)).limit(limit).offset(offset);
}

export async function getSmsLogCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(smsLog);
  return result.length;
}

export async function getSmsLogsByDirection(direction: "sent" | "received", limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smsLog).where(eq(smsLog.direction, direction)).orderBy(desc(smsLog.createdAt)).limit(limit).offset(offset);
}

export async function getSmsLogCountByDirection(direction: "sent" | "received") {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select().from(smsLog).where(eq(smsLog.direction, direction));
  return result.length;
}

// ─── Discovery Recording Queries ──────────────────────────────────────────────

export async function insertRecording(entry: InsertDiscoveryRecording): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert recording: database not available");
    return null;
  }
  const result = await db.insert(discoveryRecordings).values(entry);
  return result[0].insertId;
}

export async function getRecordingsByLead(leadPhone: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discoveryRecordings)
    .where(eq(discoveryRecordings.leadPhone, leadPhone))
    .orderBy(desc(discoveryRecordings.createdAt));
}

export async function getRecordingById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(discoveryRecordings)
    .where(eq(discoveryRecordings.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateRecordingTranscript(id: number, transcript: string, status: "completed" | "failed") {
  const db = await getDb();
  if (!db) return;
  await db.update(discoveryRecordings)
    .set({ transcript, transcriptionStatus: status })
    .where(eq(discoveryRecordings.id, id));
}

export async function updateRecordingSummary(id: number, aiSummary: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(discoveryRecordings)
    .set({ aiSummary })
    .where(eq(discoveryRecordings.id, id));
}

export async function updateRecordingStatus(id: number, status: "pending" | "processing" | "completed" | "failed") {
  const db = await getDb();
  if (!db) return;
  await db.update(discoveryRecordings)
    .set({ transcriptionStatus: status })
    .where(eq(discoveryRecordings.id, id));
}

export async function getAllRecordings(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(discoveryRecordings)
    .orderBy(desc(discoveryRecordings.createdAt))
    .limit(limit)
    .offset(offset);
}

// ─── Closed Sales Queries ────────────────────────────────────────────────────

export async function insertClosedSale(entry: InsertClosedSale): Promise<number | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert closed sale: database not available");
    return null;
  }
  const result = await db.insert(closedSales).values(entry);
  return result[0].insertId;
}

export async function getClosedSales(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(closedSales)
    .orderBy(desc(closedSales.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getClosedSalesCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(closedSales);
  return result[0]?.count ?? 0;
}

export async function getClosedSaleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(closedSales)
    .where(eq(closedSales.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getClosedSaleByLeadPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(closedSales)
    .where(eq(closedSales.leadPhone, phone))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getClosedSaleByPylonRef(pylonRef: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(closedSales)
    .where(eq(closedSales.pylonReference, pylonRef))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateClosedSale(id: number, data: Partial<InsertClosedSale>): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(closedSales)
    .set(data)
    .where(eq(closedSales.id, id));
}

export async function getPendingPylonSales() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(closedSales)
    .where(eq(closedSales.projectStatus, "pylon-pending-review"))
    .orderBy(desc(closedSales.createdAt));
}

// ─── Deleted Leads (Soft Delete) Queries ────────────────────────────────────────

export async function insertDeletedLead(entry: InsertDeletedLead): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert deleted lead: database not available");
    return;
  }
  await db.insert(deletedLeads).values(entry);
}

export async function getDeletedLeads(): Promise<{ leadName: string; leadPhone: string }[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    leadName: deletedLeads.leadName,
    leadPhone: deletedLeads.leadPhone,
  }).from(deletedLeads);
}

export async function removeDeletedLead(leadName: string, leadPhone: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(deletedLeads)
    .where(and(eq(deletedLeads.leadName, leadName), eq(deletedLeads.leadPhone, leadPhone)));
}

// ─── NPU Auto-SMS Tracking ─────────────────────────────────────────────────────
export async function insertNpuSmsSent(entry: InsertNpuSmsSent): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(npuSmsSent).values(entry);
}
export async function getNpuSmsSentByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(npuSmsSent).where(eq(npuSmsSent.leadPhone, phone)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function getAllNpuSmsSent() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ leadPhone: npuSmsSent.leadPhone }).from(npuSmsSent);
}

// ─── Voicemail Auto-SMS Tracking ────────────────────────────────────────────────
export async function insertVoicemailSmsSent(entry: InsertVoicemailSmsSent): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(voicemailSmsSent).values(entry);
}
export async function getVoicemailSmsSentByPhone(phone: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(voicemailSmsSent).where(eq(voicemailSmsSent.leadPhone, phone)).limit(1);
  return result.length > 0 ? result[0] : null;
}
export async function getAllVoicemailSmsSent() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ leadPhone: voicemailSmsSent.leadPhone }).from(voicemailSmsSent);
}

// ─── SMS Templates ──────────────────────────────────────────────────────────────
const DEFAULT_NPU_TEMPLATE = `Hi {name}, we tried to reach you regarding your solar enquiry. Please call us back at your convenience or reply to this message.\n\nWith Thanks\nGeorge Fotopoulos\nRenewables Strategist and Designer\n-----------------------------------\n0419574520\ngeorge.f@varietysolar.com.au\nwww.varietysolar.com.au`;

const DEFAULT_VOICEMAIL_TEMPLATE = `Hi {name}, we just left you a voicemail regarding your solar enquiry. Please call us back at your convenience or reply to this message.\n\nWith Thanks\nGeorge Fotopoulos\nRenewables Strategist and Designer\n-----------------------------------\n0419574520\ngeorge.f@varietysolar.com.au\nwww.varietysolar.com.au`;

export async function getSmsTemplate(key: string): Promise<string> {
  const db = await getDb();
  if (!db) return key === 'npu' ? DEFAULT_NPU_TEMPLATE : DEFAULT_VOICEMAIL_TEMPLATE;
  const result = await db.select().from(smsTemplates).where(eq(smsTemplates.templateKey, key)).limit(1);
  if (result.length > 0) return result[0].messageBody;
  return key === 'npu' ? DEFAULT_NPU_TEMPLATE : DEFAULT_VOICEMAIL_TEMPLATE;
}

export async function upsertSmsTemplate(key: string, body: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(smsTemplates).where(eq(smsTemplates.templateKey, key)).limit(1);
  if (existing.length > 0) {
    await db.update(smsTemplates).set({ messageBody: body, updatedAt: Date.now() }).where(eq(smsTemplates.templateKey, key));
  } else {
    await db.insert(smsTemplates).values({ templateKey: key, name: key, messageBody: body, updatedAt: Date.now() });
  }
}

export async function getAllSmsTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smsTemplates);
}

// ─── Delete Recording ───────────────────────────────────────────────────────────
export async function deleteRecording(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(discoveryRecordings).where(eq(discoveryRecordings.id, id));
}


// ─── Meetings Sent Queries ────────────────────────────────────────────────────

export async function insertMeetingSent(entry: InsertMeetingSent): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot insert meeting: database not available");
    return;
  }
  await db.insert(meetingsSent).values(entry);
}

export async function getMeetingsSent(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meetingsSent).orderBy(desc(meetingsSent.sentAt)).limit(limit).offset(offset);
}

export async function getMeetingsSentCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(meetingsSent);
  return result[0]?.count ?? 0;
}

export async function updateMeetingStatus(id: number, status: "scheduled" | "completed" | "cancelled"): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(meetingsSent).set({ status }).where(eq(meetingsSent.id, id));
}

export async function getMeetingsNeedingReminder(windowStartMs: number, windowEndMs: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meetingsSent)
    .where(
      and(
        eq(meetingsSent.status, "scheduled"),
        eq(meetingsSent.reminderSent, "no"),
        gte(meetingsSent.meetingStartTime, windowStartMs),
        lte(meetingsSent.meetingStartTime, windowEndMs),
      )
    );
}

export async function markReminderSent(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(meetingsSent).set({ reminderSent: "yes" }).where(eq(meetingsSent.id, id));
}

export async function getTodaysMeetings(dayStartMs: number, dayEndMs: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meetingsSent)
    .where(
      and(
        eq(meetingsSent.status, "scheduled"),
        gte(meetingsSent.meetingStartTime, dayStartMs),
        lte(meetingsSent.meetingStartTime, dayEndMs),
      )
    )
    .orderBy(meetingsSent.meetingStartTime);
}

// ─── SMS Template CRUD (extended) ─────────────────────────────────────────────

export async function deleteSmsTemplate(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(smsTemplates).where(eq(smsTemplates.templateKey, key));
}

export async function createSmsTemplate(key: string, displayName: string, body: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(smsTemplates).where(eq(smsTemplates.templateKey, key)).limit(1);
  if (existing.length > 0) {
    await db.update(smsTemplates)
      .set({ name: displayName, displayName, messageBody: body, updatedAt: Date.now() })
      .where(eq(smsTemplates.templateKey, key));
  } else {
    await db.insert(smsTemplates).values({
      templateKey: key,
      name: displayName,
      displayName,
      messageBody: body,
      updatedAt: Date.now(),
    });
  }
}

export async function updateSmsTemplateWithName(key: string, displayName: string, body: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(smsTemplates)
    .set({ displayName, messageBody: body, updatedAt: Date.now() })
    .where(eq(smsTemplates.templateKey, key));
}

// ─── Solar Quotes Import Tracking ─────────────────────────────────────────────
import { solarQuotesImports, InsertSolarQuotesImport } from "../drizzle/schema";

export async function insertSolarQuotesImport(entry: InsertSolarQuotesImport): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(solarQuotesImports).values(entry);
}

export async function getSolarQuotesImportByRef(leadRef: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(solarQuotesImports).where(eq(solarQuotesImports.leadRef, leadRef)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function markSheetWritten(leadRef: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(solarQuotesImports)
    .set({ sheetWritten: true })
    .where(eq(solarQuotesImports.leadRef, leadRef));
}

export async function incrementSheetRetries(leadRef: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select({ retries: solarQuotesImports.sheetRetries })
    .from(solarQuotesImports)
    .where(eq(solarQuotesImports.leadRef, leadRef))
    .limit(1);
  const current = existing[0]?.retries ?? 0;
  await db.update(solarQuotesImports)
    .set({ sheetRetries: current + 1 })
    .where(eq(solarQuotesImports.leadRef, leadRef));
}

export async function getUnwrittenLeads() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(solarQuotesImports)
    .where(eq(solarQuotesImports.sheetWritten, false))
    .orderBy(solarQuotesImports.importedAt);
}

export async function getAllSolarQuotesImports() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(solarQuotesImports).orderBy(desc(solarQuotesImports.importedAt));
}

// ─── Lead Transcripts ─────────────────────────────────────────────────────────
import { leadTranscripts, InsertLeadTranscript } from "../drizzle/schema";

export async function insertLeadTranscript(entry: InsertLeadTranscript): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(leadTranscripts).values(entry);
}

export async function getLeadTranscriptByName(leadName: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(leadTranscripts).where(eq(leadTranscripts.leadName, leadName)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getLeadTranscriptByRef(leadRef: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(leadTranscripts).where(eq(leadTranscripts.leadRef, leadRef)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getAllLeadTranscripts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(leadTranscripts).orderBy(desc(leadTranscripts.createdAt));
}

// ─── Email Tracking ───────────────────────────────────────────────────────────
import { emailTracking, emailOpens, InsertEmailTracking, InsertEmailOpen } from "../drizzle/schema";


export async function createEmailTracking(entry: InsertEmailTracking): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(emailTracking).values(entry);
}

export async function recordEmailOpen(trackingId: string, ipAddress?: string, userAgent?: string): Promise<{ leadName: string; subject: string } | null> {
  const db = await getDb();
  if (!db) return null;
  
  const now = Date.now();
  
  // Find the tracking record
  const records = await db.select().from(emailTracking).where(eq(emailTracking.trackingId, trackingId)).limit(1);
  if (records.length === 0) return null;
  
  const record = records[0];
  
  // Log the open event
  await db.insert(emailOpens).values({
    trackingId,
    openedAt: now,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
  });
  
  // Update the tracking record
  const updateData: any = {
    openCount: (record.openCount || 0) + 1,
    lastOpenedAt: now,
  };
  if (!record.firstOpenedAt) {
    updateData.firstOpenedAt = now;
  }
  
  await db.update(emailTracking).set(updateData).where(eq(emailTracking.trackingId, trackingId));
  
  return { leadName: record.leadName, subject: record.subject };
}

export async function getEmailTrackingList(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailTracking).orderBy(desc(emailTracking.sentAt)).limit(limit).offset(offset);
}

export async function getRecentEmailOpens(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailTracking)
    .where(and(
      eq(emailTracking.notificationDismissed, false),
    ))
    .orderBy(desc(emailTracking.lastOpenedAt))
    .limit(limit);
}

export async function getUnreadEmailOpens() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailTracking)
    .where(and(
      eq(emailTracking.notificationDismissed, false),
      // Only show emails that have been opened at least once
    ))
    .orderBy(desc(emailTracking.lastOpenedAt));
}

export async function dismissEmailOpenNotification(trackingId: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(emailTracking).set({ notificationDismissed: true }).where(eq(emailTracking.trackingId, trackingId));
}

export async function getEmailOpensByTrackingId(trackingId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailOpens).where(eq(emailOpens.trackingId, trackingId)).orderBy(desc(emailOpens.openedAt));
}
