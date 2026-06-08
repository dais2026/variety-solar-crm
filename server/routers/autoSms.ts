import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  insertNpuSmsSent,
  getNpuSmsSentByPhone,
  getAllNpuSmsSent,
  insertVoicemailSmsSent,
  getVoicemailSmsSentByPhone,
  getAllVoicemailSmsSent,
  getSmsTemplate,
  upsertSmsTemplate,
  getAllSmsTemplates,
  createSmsTemplate,
  updateSmsTemplateWithName,
  deleteSmsTemplate,
  insertSmsLog,
} from "../db";
import { ENV } from "../_core/env";

// Send SMS via SMS Broadcast API
async function sendSms(to: string, message: string): Promise<{ ok: boolean; ref?: string }> {
  const username = ENV.smsBroadcastUsername;
  const password = ENV.smsBroadcastPassword;
  if (!username || !password) {
    console.error("[AutoSMS] SMS credentials not configured");
    return { ok: false };
  }

  const params = new URLSearchParams({
    username,
    password,
    to,
    message,
    maxsplit: "2",
  });

  try {
    const resp = await fetch(`https://api.smsbroadcast.com.au/api-adv.php?${params.toString()}`);
    const text = await resp.text();
    const ok = text.includes("OK:");
    const ref = ok ? text.split("OK:")[1]?.split(":")[0]?.trim() : undefined;
    return { ok, ref };
  } catch (err) {
    console.error("[AutoSMS] Failed to send SMS:", err);
    return { ok: false };
  }
}

export const autoSmsRouter = router({
  // Trigger NPU auto-SMS for a lead
  triggerNpu: publicProcedure
    .input(z.object({ leadName: z.string(), leadPhone: z.string() }))
    .mutation(async ({ input }) => {
      const { leadName, leadPhone } = input;

      // Check if already sent
      const existing = await getNpuSmsSentByPhone(leadPhone);
      if (existing) {
        return { success: true, alreadySent: true, message: "NPU SMS already sent to this lead" };
      }

      // Get template and personalise
      const template = await getSmsTemplate("npu");
      const message = template.replace(/\{name\}/g, leadName.split(" ")[0]);

      // Send SMS
      const result = await sendSms(leadPhone, message);
      if (!result.ok) {
        return { success: false, alreadySent: false, message: "Failed to send SMS" };
      }

      // Log the SMS
      const parts = Math.ceil(message.length / 160);
      await insertSmsLog({
        direction: "sent",
        phone: leadPhone,
        contactName: leadName,
        message,
        parts,
        cost: parts * 0.09,
        status: "delivered",
        createdAt: Date.now(),
      });

      // Track as sent
      await insertNpuSmsSent({ leadPhone, leadName, sentAt: Date.now() });

      return { success: true, alreadySent: false, message: "NPU SMS sent successfully" };
    }),

  // Trigger Voicemail auto-SMS for a lead
  triggerVoicemail: publicProcedure
    .input(z.object({ leadName: z.string(), leadPhone: z.string() }))
    .mutation(async ({ input }) => {
      const { leadName, leadPhone } = input;

      // Check if already sent
      const existing = await getVoicemailSmsSentByPhone(leadPhone);
      if (existing) {
        return { success: true, alreadySent: true, message: "Voicemail SMS already sent to this lead" };
      }

      // Get template and personalise
      const template = await getSmsTemplate("voicemail");
      const message = template.replace(/\{name\}/g, leadName.split(" ")[0]);

      // Send SMS
      const result = await sendSms(leadPhone, message);
      if (!result.ok) {
        return { success: false, alreadySent: false, message: "Failed to send SMS" };
      }

      // Log the SMS
      const parts = Math.ceil(message.length / 160);
      await insertSmsLog({
        direction: "sent",
        phone: leadPhone,
        contactName: leadName,
        message,
        parts,
        cost: parts * 0.09,
        status: "delivered",
        createdAt: Date.now(),
      });

      // Track as sent
      await insertVoicemailSmsSent({ leadPhone, leadName, sentAt: Date.now() });

      return { success: true, alreadySent: false, message: "Voicemail SMS sent successfully" };
    }),

  // Get all sent tracking data (for badges)
  getSentStatus: publicProcedure.query(async () => {
    const [npuList, vmList] = await Promise.all([
      getAllNpuSmsSent(),
      getAllVoicemailSmsSent(),
    ]);
    return {
      npu: npuList.map((r) => r.leadPhone),
      voicemail: vmList.map((r) => r.leadPhone),
    };
  }),

  // Get templates
  getTemplates: publicProcedure.query(async () => {
    const [npuTemplate, vmTemplate] = await Promise.all([
      getSmsTemplate("npu"),
      getSmsTemplate("voicemail"),
    ]);
    return { npu: npuTemplate, voicemail: vmTemplate };
  }),

  // Update a template (legacy - for NPU/Voicemail panel)
  updateTemplate: publicProcedure
    .input(z.object({ key: z.enum(["npu", "voicemail"]), body: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await upsertSmsTemplate(input.key, input.body);
      return { success: true };
    }),

  // List all broadcast templates
  listAllTemplates: publicProcedure.query(async () => {
    return getAllSmsTemplates();
  }),

  // Create a new broadcast template
  createTemplate: publicProcedure
    .input(z.object({
      key: z.string().min(1).max(50),
      displayName: z.string().min(1).max(100),
      body: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      await createSmsTemplate(input.key, input.displayName, input.body);
      return { success: true };
    }),

  // Update a broadcast template (with display name)
  updateTemplateWithName: publicProcedure
    .input(z.object({
      key: z.string().min(1).max(50),
      displayName: z.string().min(1).max(100),
      body: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      await updateSmsTemplateWithName(input.key, input.displayName, input.body);
      return { success: true };
    }),

  // Delete a broadcast template
  deleteTemplate: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await deleteSmsTemplate(input.key);
      return { success: true };
    }),
});
