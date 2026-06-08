import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import {
  getEmailTrackingList,
  getRecentEmailOpens,
  dismissEmailOpenNotification,
  getEmailOpensByTrackingId,
} from "../db";

export const emailTrackingRouter = router({
  /**
   * List all tracked emails with their open status.
   */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const emails = await getEmailTrackingList(limit, offset);
      return { emails };
    }),

  /**
   * Get recent email opens that haven't been dismissed (for notification badge).
   */
  recentOpens: publicProcedure
    .query(async () => {
      const opens = await getRecentEmailOpens();
      // Filter to only those that have actually been opened
      const opened = opens.filter(o => o.openCount && o.openCount > 0);
      return { opens: opened, count: opened.length };
    }),

  /**
   * Get detailed open events for a specific tracked email.
   */
  openDetails: publicProcedure
    .input(z.object({ trackingId: z.string() }))
    .query(async ({ input }) => {
      const opens = await getEmailOpensByTrackingId(input.trackingId);
      return { opens };
    }),

  /**
   * Dismiss a notification for a specific email open.
   */
  dismissNotification: publicProcedure
    .input(z.object({ trackingId: z.string() }))
    .mutation(async ({ input }) => {
      await dismissEmailOpenNotification(input.trackingId);
      return { success: true };
    }),
});
