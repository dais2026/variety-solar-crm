import { Request, Response } from "express";
import { randomBytes } from "crypto";
import { createEmailTracking, recordEmailOpen } from "./db";
import { notifyOwner } from "./_core/notification";

// 1x1 transparent PNG pixel
const TRACKING_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

/**
 * Generate a unique tracking ID and create a tracking record in the database.
 * Returns the tracking ID to embed in emails.
 */
export async function createTrackingPixel(params: {
  leadName: string;
  recipientEmail: string;
  subject: string;
  emailType?: string;
}): Promise<string> {
  const trackingId = randomBytes(16).toString("hex");
  
  await createEmailTracking({
    trackingId,
    leadName: params.leadName,
    recipientEmail: params.recipientEmail,
    subject: params.subject,
    emailType: params.emailType || "general",
    sentAt: Date.now(),
    openCount: 0,
    notificationDismissed: false,
  });
  
  return trackingId;
}

/**
 * Generate the HTML img tag for the tracking pixel to embed in emails.
 * The baseUrl should be the deployed site URL.
 */
export function getTrackingPixelHtml(trackingId: string, baseUrl: string): string {
  return `<img src="${baseUrl}/api/track/${trackingId}.png" width="1" height="1" style="display:none;width:1px;height:1px;border:0;" alt="" />`;
}

/**
 * Express handler for the tracking pixel endpoint.
 * GET /api/track/:trackingId.png
 */
export async function trackingPixelHandler(req: Request, res: Response): Promise<void> {
  try {
    const trackingIdParam = req.params.trackingId;
    // Strip .png extension if present
    const trackingId = trackingIdParam.replace(/\.png$/, "");
    
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() 
      || req.socket.remoteAddress 
      || undefined;
    const userAgent = req.headers["user-agent"] || undefined;
    
    // Record the open event
    const result = await recordEmailOpen(trackingId, ipAddress, userAgent);
    
    if (result) {
      // Send notification to owner about the email open
      try {
        await notifyOwner({
          title: `📧 Email Opened: ${result.leadName}`,
          content: `${result.leadName} just opened your email: "${result.subject}"`,
        });
      } catch (e) {
        // Don't fail the pixel response if notification fails
        console.warn("[EmailTracking] Notification failed:", e);
      }
    }
  } catch (error) {
    console.error("[EmailTracking] Error recording open:", error);
  }
  
  // Always return the pixel regardless of errors
  res.set({
    "Content-Type": "image/png",
    "Content-Length": String(TRACKING_PIXEL.length),
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });
  res.status(200).send(TRACKING_PIXEL);
}
