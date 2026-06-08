import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getAllSolarQuotesImports, getLeadTranscriptByName, getAllLeadTranscripts } from "../db";
import { runSolarQuotesImport } from "../scheduledSolarQuotes";
import { invokeLLM } from "../_core/llm";

export const solarQuotesRouter = router({
  /**
   * List all imported Solar Quotes leads with their details and import timestamp.
   */
  listImports: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      }).optional()
    )
    .query(async ({ input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const imports = await getAllSolarQuotesImports();
      const total = imports.length;
      const paged = imports.slice(offset, offset + limit);
      return { imports: paged, total };
    }),

  /**
   * Get the full transcript for a specific lead by name.
   */
  getTranscript: publicProcedure
    .input(z.object({ leadName: z.string() }))
    .query(async ({ input }) => {
      const transcript = await getLeadTranscriptByName(input.leadName);
      return { transcript };
    }),

  /**
   * List all lead transcripts.
   */
  listTranscripts: publicProcedure
    .query(async () => {
      const transcripts = await getAllLeadTranscripts();
      return { transcripts };
    }),

  /**
   * Manually trigger the Solar Quotes import (checks inbox + Sales folder immediately).
   */
  manualImport: publicProcedure
    .mutation(async () => {
      const result = await runSolarQuotesImport();
      return result;
    }),

  /**
   * Generate AI call prep notes for a specific lead based on their transcript.
   */
  generateCallPrep: publicProcedure
    .input(z.object({ leadName: z.string() }))
    .mutation(async ({ input }) => {
      const transcript = await getLeadTranscriptByName(input.leadName);
      if (!transcript || !transcript.fullTranscript) {
        return { notes: null, error: "No transcript found for this lead." };
      }

      const prompt = `You are a solar sales consultant preparing for a phone call with a potential customer. Based on the following lead information from Solar Quotes, generate concise call preparation notes.

Include:
1. **Opening approach** - How to greet them and reference their enquiry
2. **Key needs** - What they're looking for (products, priorities)
3. **Talking points** - Specific things to discuss based on their answers
4. **Objection handling** - Potential concerns to address proactively
5. **Next steps** - What to propose at the end of the call

Keep it brief, actionable, and conversational. Use dot points.

Lead transcript:
${transcript.fullTranscript.slice(0, 3000)}`;

      try {
        const response = await invokeLLM({
          messages: [
            { role: "system", content: "You are an expert solar energy sales consultant in Victoria, Australia. You help prepare concise, actionable call notes for sales reps. Be specific and practical." },
            { role: "user", content: prompt },
          ],
        });

        const notes = response.choices?.[0]?.message?.content || "Unable to generate notes.";
        return { notes, error: null };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error("[SolarQuotes] LLM call prep error:", errMsg);
        return { notes: null, error: `Failed to generate notes: ${errMsg}` };
      }
    }),
});
