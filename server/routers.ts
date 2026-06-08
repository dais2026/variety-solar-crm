import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { smsRouter } from "./routers/sms";
import { recordingsRouter } from "./routers/recordings";
import { sheetsRouter } from "./routers/sheets";
import { closedSalesRouter } from "./routers/closedSales";
import { pricingRouter } from "./routers/pricing";
import { autoSmsRouter } from "./routers/autoSms";
import { calendarRouter } from "./routers/calendar";
import { meetingsRouter } from "./routers/meetings";
import { solarQuotesRouter } from "./routers/solarQuotes";
import { emailTrackingRouter } from "./routers/emailTracking";
import { sendEmailRouter } from "./routers/sendEmail";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  sms: smsRouter,
  recordings: recordingsRouter,
  sheets: sheetsRouter,
  closedSales: closedSalesRouter,
  pricing: pricingRouter,
  autoSms: autoSmsRouter,
  calendar: calendarRouter,
  meetings: meetingsRouter,
  solarQuotes: solarQuotesRouter,
  emailTracking: emailTrackingRouter,
  sendEmail: sendEmailRouter,
});

export type AppRouter = typeof appRouter;
