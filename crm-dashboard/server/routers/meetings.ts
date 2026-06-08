import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getMeetingsSent, getMeetingsSentCount, updateMeetingStatus, getTodaysMeetings } from "../db";

export const meetingsRouter = router({
  /**
   * Get all meetings sent, ordered by most recent first.
   */
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const { limit, offset } = input ?? { limit: 50, offset: 0 };
      const [meetings, total] = await Promise.all([
        getMeetingsSent(limit, offset),
        getMeetingsSentCount(),
      ]);
      return { meetings, total };
    }),

  /**
   * Update the status of a meeting (e.g., mark as completed or cancelled).
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["scheduled", "completed", "cancelled"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateMeetingStatus(input.id, input.status);
      return { success: true };
    }),

  /**
   * Get today's upcoming meetings for the Overview widget.
   * Uses Australia/Melbourne timezone (UTC+10 AEST / UTC+11 AEDT).
   */
  today: protectedProcedure
    .input(
      z.object({
        timezoneOffset: z.number().optional().default(600), // minutes offset from UTC (default AEST +10)
      }).optional()
    )
    .query(async ({ input }) => {
      const offsetMinutes = input?.timezoneOffset ?? 600;
      // Calculate today's start and end in the user's timezone
      const now = new Date();
      const localNow = new Date(now.getTime() + offsetMinutes * 60 * 1000);
      const dayStart = new Date(localNow);
      dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(localNow);
      dayEnd.setUTCHours(23, 59, 59, 999);
      // Convert back to UTC timestamps
      const dayStartMs = dayStart.getTime() - offsetMinutes * 60 * 1000;
      const dayEndMs = dayEnd.getTime() - offsetMinutes * 60 * 1000;
      const meetings = await getTodaysMeetings(dayStartMs, dayEndMs);
      return { meetings };
    }),
});
