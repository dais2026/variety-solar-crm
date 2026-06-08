import { bigint, boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// SMS message log table
export const smsLog = mysqlTable("sms_log", {
  id: int("id").autoincrement().primaryKey(),
  /** 'sent' or 'received' */
  direction: mysqlEnum("direction", ["sent", "received"]).notNull(),
  /** Recipient or sender phone number */
  phone: varchar("phone", { length: 20 }).notNull(),
  /** Recipient or sender name */
  contactName: varchar("contactName", { length: 255 }),
  /** The message content */
  message: text("message").notNull(),
  /** Sender name used (for outgoing) */
  senderName: varchar("senderName", { length: 11 }),
  /** Number of SMS parts (1 for standard, 2 for multi-part) */
  parts: int("parts").default(1).notNull(),
  /** Cost in credits */
  cost: int("cost").default(1),
  /** Delivery status */
  status: mysqlEnum("status", ["pending", "delivered", "failed", "unknown"]).default("pending").notNull(),
  /** User who sent/received (FK to users) */
  userId: int("userId"),
  /** Timestamp in ms */
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});

export type SmsLogEntry = typeof smsLog.$inferSelect;
export type InsertSmsLogEntry = typeof smsLog.$inferInsert;

// Discovery recordings table - links audio recordings + transcripts to leads
export const discoveryRecordings = mysqlTable("discovery_recordings", {
  id: int("id").autoincrement().primaryKey(),
  /** Lead identifier (contact number used as unique key from Google Sheet) */
  leadPhone: varchar("leadPhone", { length: 20 }).notNull(),
  /** Lead name for display */
  leadName: varchar("leadName", { length: 255 }).notNull(),
  /** Title/label for the recording */
  title: varchar("title", { length: 255 }),
  /** S3 storage key for the audio file */
  audioKey: varchar("audioKey", { length: 512 }).notNull(),
  /** URL path to access the audio */
  audioUrl: text("audioUrl").notNull(),
  /** MIME type of the audio file */
  mimeType: varchar("mimeType", { length: 64 }).notNull(),
  /** Duration in seconds */
  durationSeconds: int("durationSeconds"),
  /** Full transcript text */
  transcript: text("transcript"),
  /** AI-generated summary (JSON string with structured fields) */
  aiSummary: text("aiSummary"),
  /** Transcription status */
  transcriptionStatus: mysqlEnum("transcriptionStatus", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  /** Source of recording */
  source: mysqlEnum("source", ["live_recording", "upload"]).notNull(),
  /** User who created the recording */
  userId: int("userId"),
  /** Created timestamp in ms */
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});

export type DiscoveryRecording = typeof discoveryRecordings.$inferSelect;
export type InsertDiscoveryRecording = typeof discoveryRecordings.$inferInsert;

// ─── Closed Sales Table ─────────────────────────────────────────────────────
export const closedSales = mysqlTable("closed_sales", {
  id: int("id").autoincrement().primaryKey(),

  // ── Customer Information ──
  customerName: varchar("customerName", { length: 255 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }),
  customerPhone: varchar("customerPhone", { length: 20 }).notNull(),
  installAddress: text("installAddress").notNull(),
  postalAddress: text("postalAddress"),
  nmi: varchar("nmi", { length: 20 }),
  meterNumber: varchar("meterNumber", { length: 50 }),
  currentRetailer: varchar("currentRetailer", { length: 100 }),
  distributor: varchar("distributor", { length: 100 }),
  existingSolar: mysqlEnum("existingSolar", ["yes", "no"]).default("no"),
  propertyType: mysqlEnum("propertyType", ["house", "townhouse", "unit", "commercial"]).default("house"),
  roofType: mysqlEnum("roofType", ["tile", "colorbond", "flat", "klip-lok", "other"]).default("colorbond"),
  phases: mysqlEnum("phases", ["1-phase", "2-phase", "3-phase"]).default("1-phase"),

  // ── System Specification ──
  systemSizeDc: decimal("systemSizeDc", { precision: 6, scale: 2 }),
  systemSizeAc: decimal("systemSizeAc", { precision: 6, scale: 2 }),
  panelBrand: varchar("panelBrand", { length: 255 }),
  panelModel: varchar("panelModel", { length: 255 }),
  panelQuantity: int("panelQuantity"),
  panelWattage: int("panelWattage"),
  inverterBrand: varchar("inverterBrand", { length: 255 }),
  inverterModel: varchar("inverterModel", { length: 255 }),
  inverterQuantity: int("inverterQuantity").default(1),
  batteryBrand: varchar("batteryBrand", { length: 255 }),
  batteryModel: varchar("batteryModel", { length: 255 }),
  batteryCapacityKwh: decimal("batteryCapacityKwh", { precision: 6, scale: 2 }),
  batteryQuantity: int("batteryQuantity"),
  optimisers: varchar("optimisers", { length: 255 }),
  mountingType: mysqlEnum("mountingType", ["roof", "ground", "tilt-frame"]).default("roof"),
  exportLimitKw: decimal("exportLimitKw", { precision: 5, scale: 2 }),
  evCharger: varchar("evCharger", { length: 255 }),
  hotWaterSystem: varchar("hotWaterSystem", { length: 255 }),
  additionalProducts: text("additionalProducts"),

  // ── Financial Information ──
  totalContractPrice: decimal("totalContractPrice", { precision: 10, scale: 2 }).notNull(),
  depositAmount: decimal("depositAmount", { precision: 10, scale: 2 }),
  depositPaid: mysqlEnum("depositPaid", ["yes", "no"]).default("no"),
  depositDate: bigint("depositDate", { mode: "number" }),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "finance", "green-loan", "interest-free", "mixed"]).default("cash"),
  financeProvider: varchar("financeProvider", { length: 255 }),
  financeAmount: decimal("financeAmount", { precision: 10, scale: 2 }),
  financeTerm: varchar("financeTerm", { length: 100 }),
  stcRebateValue: decimal("stcRebateValue", { precision: 10, scale: 2 }),
  numberOfStcs: int("numberOfStcs"),
  pricePerWatt: decimal("pricePerWatt", { precision: 6, scale: 2 }),
  balanceDue: decimal("balanceDue", { precision: 10, scale: 2 }),
  paymentSchedule: text("paymentSchedule"),

  // ── Contract & Compliance ──
  contractSignedDate: bigint("contractSignedDate", { mode: "number" }).notNull(),
  contractDocumentUrl: text("contractDocumentUrl"),
  coolingOffExpiry: bigint("coolingOffExpiry", { mode: "number" }),
  cecInstaller: varchar("cecInstaller", { length: 255 }),
  cecDesigner: varchar("cecDesigner", { length: 255 }),
  warrantyWorkmanshipYears: int("warrantyWorkmanshipYears").default(5),
  warrantyPanelProductYears: int("warrantyPanelProductYears").default(25),
  warrantyInverterYears: int("warrantyInverterYears").default(10),
  warrantyBatteryYears: int("warrantyBatteryYears").default(10),

  // ── Site & Technical Details ──
  roofOrientation: varchar("roofOrientation", { length: 255 }),
  roofPitch: int("roofPitch"),
  shadingAssessment: varchar("shadingAssessment", { length: 255 }),
  switchboardCondition: mysqlEnum("switchboardCondition", ["good", "needs-upgrade", "asbestos"]).default("good"),
  switchboardUpgrade: mysqlEnum("switchboardUpgrade", ["yes", "no"]).default("no"),
  cableRunMetres: int("cableRunMetres"),
  trenchingRequired: mysqlEnum("trenchingRequired", ["yes", "no"]).default("no"),
  annualProductionEstimate: int("annualProductionEstimate"),
  energyOffsetPercent: int("energyOffsetPercent"),

  // ── Sales Attribution ──
  dealOwner: varchar("dealOwner", { length: 255 }),
  leadSource: varchar("leadSource", { length: 100 }),
  closedWonReason: text("closedWonReason"),
  daysInPipeline: int("daysInPipeline"),
  proposalsSent: int("proposalsSent"),
  referralSource: varchar("referralSource", { length: 255 }),

  // ── Operational Status (post-close tracking) ──
  projectStatus: mysqlEnum("projectStatus", [
    "contract-signed",
    "cooling-off",
    "pre-installation",
    "dnsp-applied",
    "dnsp-approved",
    "permit-applied",
    "permit-approved",
    "scheduled",
    "installation",
    "inspection",
    "commissioning",
    "pto-received",
    "complete"
  ]).default("contract-signed").notNull(),
  scheduledInstallDate: bigint("scheduledInstallDate", { mode: "number" }),
  installCompleteDate: bigint("installCompleteDate", { mode: "number" }),
  ptoDate: bigint("ptoDate", { mode: "number" }),
  finalPaymentReceived: mysqlEnum("finalPaymentReceived", ["yes", "no"]).default("no"),

  // ── Notes ──
  notes: text("notes"),

  // ── Metadata ──
  /** Link back to lead phone from Google Sheet */
  leadPhone: varchar("leadPhone", { length: 20 }),
  userId: int("userId"),
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export type ClosedSale = typeof closedSales.$inferSelect;
export type InsertClosedSale = typeof closedSales.$inferInsert;

// ─── Deleted Leads (Soft Delete) ─────────────────────────────────────────────
// Stores identifiers of leads that have been soft-deleted from the CRM view.
// The lead remains in the Google Sheet but is hidden from the dashboard.
export const deletedLeads = mysqlTable("deleted_leads", {
  id: int("id").autoincrement().primaryKey(),
  /** Lead name (used as part of composite identifier) */
  leadName: varchar("leadName", { length: 255 }).notNull(),
  /** Lead contact number (used as part of composite identifier) */
  leadPhone: varchar("leadPhone", { length: 20 }).notNull(),
  /** Reason for deletion (optional) */
  reason: text("reason"),
  /** User who deleted */
  deletedBy: varchar("deletedBy", { length: 255 }),
  /** Timestamp in ms */
  deletedAt: bigint("deletedAt", { mode: "number" }).notNull(),
});

export type DeletedLead = typeof deletedLeads.$inferSelect;
export type InsertDeletedLead = typeof deletedLeads.$inferInsert;

// ─── NPU Auto-SMS Tracking ──────────────────────────────────────────────────
// Tracks which leads have already received the "Called NPU" auto-SMS to prevent duplicates.
export const npuSmsSent = mysqlTable("npu_sms_sent", {
  id: int("id").autoincrement().primaryKey(),
  /** Lead phone number (unique key to prevent duplicate sends) */
  leadPhone: varchar("leadPhone", { length: 20 }).notNull().unique(),
  /** Lead name */
  leadName: varchar("leadName", { length: 255 }).notNull(),
  /** SMS log entry ID (FK reference) */
  smsLogId: int("smsLogId"),
  /** Timestamp when the auto-SMS was sent */
  sentAt: bigint("sentAt", { mode: "number" }).notNull(),
});

export type NpuSmsSent = typeof npuSmsSent.$inferSelect;
export type InsertNpuSmsSent = typeof npuSmsSent.$inferInsert;

// Tracks which leads have already received the "Left Voicemail" auto-SMS to prevent duplicates.
export const voicemailSmsSent = mysqlTable("voicemail_sms_sent", {
  id: int("id").autoincrement().primaryKey(),
  /** Lead phone number (unique key to prevent duplicate sends) */
  leadPhone: varchar("leadPhone", { length: 20 }).notNull().unique(),
  /** Lead name */
  leadName: varchar("leadName", { length: 255 }).notNull(),
  /** SMS log entry ID (FK reference) */
  smsLogId: int("smsLogId"),
  /** Timestamp when the auto-SMS was sent */
  sentAt: bigint("sentAt", { mode: "number" }).notNull(),
});

export type VoicemailSmsSent = typeof voicemailSmsSent.$inferSelect;
export type InsertVoicemailSmsSent = typeof voicemailSmsSent.$inferInsert;

// Editable SMS templates for auto-SMS messages (NPU and Voicemail).
export const smsTemplates = mysqlTable("sms_templates", {
  id: int("id").autoincrement().primaryKey(),
  /** Template key: unique identifier */
  templateKey: varchar("templateKey", { length: 50 }).notNull().unique(),
  /** Legacy name column (required by DB) */
  name: varchar("name", { length: 255 }).notNull(),
  /** Display name shown in the UI */
  displayName: varchar("displayName", { length: 100 }),
  /** Message body template (supports {name} placeholder) */
  messageBody: text("messageBody").notNull(),
  /** Last updated timestamp */
  updatedAt: bigint("updatedAt", { mode: "number" }).notNull(),
});

export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = typeof smsTemplates.$inferInsert;

// ─── Meetings Sent Log ──────────────────────────────────────────────────────
// Tracks all calendar invites sent from the CRM for appointment history.
export const meetingsSent = mysqlTable("meetings_sent", {
  id: int("id").autoincrement().primaryKey(),
  /** Customer name */
  customerName: varchar("customerName", { length: 255 }).notNull(),
  /** Customer email */
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  /** Customer phone */
  customerPhone: varchar("customerPhone", { length: 20 }),
  /** Meeting subject */
  subject: varchar("subject", { length: 500 }).notNull(),
  /** Meeting location/address */
  location: text("location"),
  /** Meeting start time (UTC ms timestamp) */
  meetingStartTime: bigint("meetingStartTime", { mode: "number" }).notNull(),
  /** Meeting end time (UTC ms timestamp) */
  meetingEndTime: bigint("meetingEndTime", { mode: "number" }).notNull(),
  /** Duration in minutes */
  durationMinutes: int("durationMinutes").notNull(),
  /** Any notes included */
  notes: text("notes"),
  /** Status of the meeting */
  status: mysqlEnum("status", ["scheduled", "completed", "cancelled"]).default("scheduled").notNull(),
  /** User who sent the invite */
  userId: int("userId"),
  /** Whether the 24h reminder email has been sent */
  reminderSent: mysqlEnum("reminderSent", ["yes", "no"]).default("no").notNull(),
  /** Timestamp when invite was sent (ms) */
  sentAt: bigint("sentAt", { mode: "number" }).notNull(),
});

export type MeetingSent = typeof meetingsSent.$inferSelect;
export type InsertMeetingSent = typeof meetingsSent.$inferInsert;

// ─── Solar Quotes Import Tracking ────────────────────────────────────────────
// Tracks which Solar Quotes lead emails have already been imported to prevent duplicates.
export const solarQuotesImports = mysqlTable("solar_quotes_imports", {
  id: int("id").autoincrement().primaryKey(),
  /** Lead reference number from Solar Quotes (unique key to prevent duplicate imports) */
  leadRef: varchar("leadRef", { length: 20 }).notNull().unique(),
  /** Lead name */
  leadName: varchar("leadName", { length: 255 }).notNull(),
  /** Lead email */
  leadEmail: varchar("leadEmail", { length: 255 }),
  /** Lead phone */
  leadPhone: varchar("leadPhone", { length: 50 }),
  /** Lead address */
  leadAddress: varchar("leadAddress", { length: 500 }),
  /** Lead source identifier */
  leadSource: varchar("leadSource", { length: 100 }).default("Solar Quotes"),
  /** Notes/special instructions from the lead */
  notes: text("notes"),
  /** Original lead date string (DD.MM.YY format) for sheet reconciliation */
  leadDate: varchar("leadDate", { length: 20 }),
  /** Product interest for sheet reconciliation */
  leadProduct: varchar("leadProduct", { length: 255 }),
  /** IMAP email UID to track which emails have been processed */
  emailUid: varchar("emailUid", { length: 50 }),
  /** Whether this lead was successfully written to the Google Sheet */
  sheetWritten: boolean("sheetWritten").default(false).notNull(),
  /** Number of sheet-write retry attempts */
  sheetRetries: int("sheetRetries").default(0).notNull(),
  /** Timestamp when the lead was imported */
  importedAt: bigint("importedAt", { mode: "number" }).notNull(),
});

export type SolarQuotesImport = typeof solarQuotesImports.$inferSelect;
export type InsertSolarQuotesImport = typeof solarQuotesImports.$inferInsert;

/**
 * Full email transcripts for leads (from Solar Quotes and other sources).
 * Stores the complete email body so it can be displayed in the CRM.
 */
export const leadTranscripts = mysqlTable("lead_transcripts", {
  id: int("id").autoincrement().primaryKey(),
  /** Lead name (matches the name in the Google Sheet) */
  leadName: varchar("leadName", { length: 255 }).notNull(),
  /** Lead email address */
  leadEmail: varchar("leadEmail", { length: 255 }),
  /** Lead phone */
  leadPhone: varchar("leadPhone", { length: 50 }),
  /** Lead address */
  leadAddress: varchar("leadAddress", { length: 500 }),
  /** Lead source (e.g., Solar Quotes, Energy Matters) */
  leadSource: varchar("leadSource", { length: 100 }).default("Solar Quotes"),
  /** Lead reference number */
  leadRef: varchar("leadRef", { length: 50 }),
  /** Full email body text (the complete transcript) */
  fullTranscript: text("fullTranscript").notNull(),
  /** Parsed summary (shorter version for quick view) */
  summary: text("summary"),
  /** Date the lead was submitted */
  leadDate: varchar("leadDate", { length: 100 }),
  /** Timestamp when stored */
  createdAt: bigint("createdAt", { mode: "number" }).notNull(),
});
export type LeadTranscript = typeof leadTranscripts.$inferSelect;
export type InsertLeadTranscript = typeof leadTranscripts.$inferInsert;

// ─── Email Tracking ───────────────────────────────────────────────────────────
export const emailTracking = mysqlTable("email_tracking", {
  id: int("id").autoincrement().primaryKey(),
  /** Unique tracking ID embedded in the pixel URL */
  trackingId: varchar("trackingId", { length: 64 }).notNull().unique(),
  /** Lead name associated with this email */
  leadName: varchar("leadName", { length: 255 }).notNull(),
  /** Recipient email address */
  recipientEmail: varchar("recipientEmail", { length: 255 }).notNull(),
  /** Email subject line */
  subject: varchar("subject", { length: 500 }).notNull(),
  /** Type of email (meeting_invite, follow_up, etc.) */
  emailType: varchar("emailType", { length: 50 }).default("general"),
  /** Timestamp when email was sent */
  sentAt: bigint("sentAt", { mode: "number" }).notNull(),
  /** Total number of opens */
  openCount: int("openCount").default(0),
  /** Timestamp of first open (null if never opened) */
  firstOpenedAt: bigint("firstOpenedAt", { mode: "number" }),
  /** Timestamp of most recent open */
  lastOpenedAt: bigint("lastOpenedAt", { mode: "number" }),
  /** Whether the open notification has been dismissed */
  notificationDismissed: boolean("notificationDismissed").default(false),
});
export type EmailTracking = typeof emailTracking.$inferSelect;
export type InsertEmailTracking = typeof emailTracking.$inferInsert;

export const emailOpens = mysqlTable("email_opens", {
  id: int("id").autoincrement().primaryKey(),
  /** Reference to email_tracking.trackingId */
  trackingId: varchar("trackingId", { length: 64 }).notNull(),
  /** Timestamp of this open event */
  openedAt: bigint("openedAt", { mode: "number" }).notNull(),
  /** IP address of opener (for location context) */
  ipAddress: varchar("ipAddress", { length: 45 }),
  /** User agent string (device/browser info) */
  userAgent: text("userAgent"),
});
export type EmailOpen = typeof emailOpens.$inferSelect;
export type InsertEmailOpen = typeof emailOpens.$inferInsert;
