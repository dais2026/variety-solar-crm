import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Mail, Eye, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, BellOff, Monitor, Smartphone, Globe, Send } from "lucide-react";
import { ComposeEmailDialog } from "./ComposeEmailDialog";

function parseUserAgent(ua: string | null): { device: string; icon: typeof Monitor } {
  if (!ua) return { device: "Unknown", icon: Globe };
  if (/iPhone|iPad|Android|Mobile/i.test(ua)) return { device: "Mobile", icon: Smartphone };
  return { device: "Desktop", icon: Monitor };
}

export default function EmailTrackingPanel() {
  const { data, isLoading, refetch } = trpc.emailTracking.list.useQuery({ limit: 50, offset: 0 });
  const { data: recentOpensData } = trpc.emailTracking.recentOpens.useQuery();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);

  const dismissMutation = trpc.emailTracking.dismissNotification.useMutation({
    onSuccess: () => refetch(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5FB854]" />
      </div>
    );
  }

  const emails = data?.emails || [];
  const unreadCount = recentOpensData?.count || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="text-[#5FB854]" size={22} />
          <h2 className="text-white text-lg font-semibold" style={{ fontFamily: "Urbanist" }}>
            Email Open Tracking
          </h2>
          {unreadCount > 0 && (
            <span className="bg-[#F5A623] text-black text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97]"
          style={{ fontFamily: "General Sans" }}
        >
          <Send size={14} />
          Compose Tracked Email
        </button>
      </div>

      {/* Compose Email Dialog */}
      <ComposeEmailDialog open={composeOpen} onOpenChange={setComposeOpen} />

      {/* Info banner */}
      <div className="bg-[#5FB854]/10 border border-[#5FB854]/20 rounded-xl p-4">
        <p className="text-[#B0B1B5] text-sm" style={{ fontFamily: "General Sans" }}>
          Tracking pixels are automatically embedded in all emails sent from this CRM (meeting invites, reminders, and composed emails). 
          When a customer opens the email, it's logged here and you receive a notification.
        </p>
      </div>

      {/* Email tracking table */}
      {emails.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="mx-auto text-[#7A7B80] mb-3" size={32} />
          <p className="text-[#7A7B80] text-sm" style={{ fontFamily: "General Sans" }}>
            No tracked emails yet. Tracking begins when you send meeting invites or reminders.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {emails.map((email: any) => {
            const isExpanded = expandedId === email.trackingId;
            const isOpened = email.openCount > 0;
            const sentDate = new Date(email.sentAt).toLocaleDateString("en-AU", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const firstOpenDate = email.firstOpenedAt
              ? new Date(email.firstOpenedAt).toLocaleDateString("en-AU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;
            const lastOpenDate = email.lastOpenedAt
              ? new Date(email.lastOpenedAt).toLocaleDateString("en-AU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;

            return (
              <div
                key={email.trackingId}
                className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                  isOpened
                    ? "border-[#5FB854]/30 bg-[#5FB854]/5"
                    : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {/* Row header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : email.trackingId)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-white/5 transition-colors"
                >
                  {/* Status icon */}
                  <div className={`flex-shrink-0 ${isOpened ? "text-[#5FB854]" : "text-[#7A7B80]"}`}>
                    {isOpened ? <Eye size={18} /> : <Clock size={18} />}
                  </div>

                  {/* Lead name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate" style={{ fontFamily: "General Sans" }}>
                      {email.leadName}
                    </p>
                    <p className="text-[#7A7B80] text-xs truncate" style={{ fontFamily: "General Sans" }}>
                      {email.subject}
                    </p>
                  </div>

                  {/* Open count badge */}
                  {isOpened && (
                    <span className="flex-shrink-0 bg-[#5FB854]/20 text-[#5FB854] text-xs font-bold px-2 py-0.5 rounded-full">
                      {email.openCount}x opened
                    </span>
                  )}

                  {/* Email type badge */}
                  <span className="flex-shrink-0 bg-white/10 text-[#B0B1B5] text-xs px-2 py-0.5 rounded-full">
                    {email.emailType === "meeting_invite" ? "Invite" : email.emailType === "meeting_reminder" ? "Reminder" : "Email"}
                  </span>

                  {/* Sent date */}
                  <span className="flex-shrink-0 text-[#7A7B80] text-xs" style={{ fontFamily: "General Sans" }}>
                    {sentDate}
                  </span>

                  {/* Expand chevron */}
                  {isExpanded ? (
                    <ChevronUp size={16} className="text-[#7A7B80]" />
                  ) : (
                    <ChevronDown size={16} className="text-[#7A7B80]" />
                  )}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <EmailExpandedDetails
                    email={email}
                    sentDate={sentDate}
                    firstOpenDate={firstOpenDate}
                    lastOpenDate={lastOpenDate}
                    isOpened={isOpened}
                    onDismiss={() => dismissMutation.mutate({ trackingId: email.trackingId })}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmailExpandedDetails({
  email,
  sentDate,
  firstOpenDate,
  lastOpenDate,
  isOpened,
  onDismiss,
}: {
  email: any;
  sentDate: string;
  firstOpenDate: string | null;
  lastOpenDate: string | null;
  isOpened: boolean;
  onDismiss: () => void;
}) {
  const { data: openDetailsData, isLoading: openDetailsLoading } = trpc.emailTracking.openDetails.useQuery(
    { trackingId: email.trackingId },
    { enabled: isOpened }
  );

  return (
    <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-4">
      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-[#7A7B80] text-xs mb-1">Recipient</p>
          <p className="text-white" style={{ fontFamily: "General Sans" }}>{email.recipientEmail}</p>
        </div>
        <div>
          <p className="text-[#7A7B80] text-xs mb-1">Status</p>
          <div className="flex items-center gap-2">
            {isOpened ? (
              <>
                <CheckCircle size={14} className="text-[#5FB854]" />
                <span className="text-[#5FB854]" style={{ fontFamily: "General Sans" }}>Opened</span>
              </>
            ) : (
              <>
                <XCircle size={14} className="text-[#F5A623]" />
                <span className="text-[#F5A623]" style={{ fontFamily: "General Sans" }}>Not opened yet</span>
              </>
            )}
          </div>
        </div>
        <div>
          <p className="text-[#7A7B80] text-xs mb-1">Sent</p>
          <p className="text-white" style={{ fontFamily: "General Sans" }}>{sentDate}</p>
        </div>
        {firstOpenDate && (
          <div>
            <p className="text-[#7A7B80] text-xs mb-1">First Opened</p>
            <p className="text-white" style={{ fontFamily: "General Sans" }}>{firstOpenDate}</p>
          </div>
        )}
        {lastOpenDate && lastOpenDate !== firstOpenDate && (
          <div>
            <p className="text-[#7A7B80] text-xs mb-1">Last Opened</p>
            <p className="text-white" style={{ fontFamily: "General Sans" }}>{lastOpenDate}</p>
          </div>
        )}
      </div>

      {/* Open history timeline */}
      {isOpened && (
        <div className="mt-3">
          <p className="text-[#7A7B80] text-xs uppercase tracking-wider mb-2" style={{ fontFamily: "General Sans" }}>
            Open History
          </p>
          {openDetailsLoading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#5FB854]" />
              <span className="text-[#7A7B80] text-xs">Loading open events...</span>
            </div>
          ) : openDetailsData?.opens && openDetailsData.opens.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {openDetailsData.opens.map((open: any, idx: number) => {
                const { device, icon: DeviceIcon } = parseUserAgent(open.userAgent);
                const openTime = new Date(open.openedAt).toLocaleDateString("en-AU", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                });
                return (
                  <div
                    key={open.id || idx}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5"
                  >
                    <div className="flex-shrink-0 text-[#5FB854]">
                      <DeviceIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-white text-xs" style={{ fontFamily: "General Sans" }}>
                        {openTime}
                      </span>
                    </div>
                    <span className="text-[#7A7B80] text-xs" style={{ fontFamily: "General Sans" }}>
                      {device}
                    </span>
                    {open.ipAddress && (
                      <span className="text-[#7A7B80] text-xs" style={{ fontFamily: "General Sans" }}>
                        {open.ipAddress}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[#7A7B80] text-xs">No detailed open events recorded.</p>
          )}
        </div>
      )}

      {/* Dismiss notification button */}
      {isOpened && !email.notificationDismissed && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="flex items-center gap-2 text-xs text-[#7A7B80] hover:text-white transition-colors"
        >
          <BellOff size={12} />
          <span>Dismiss notification</span>
        </button>
      )}
    </div>
  );
}
