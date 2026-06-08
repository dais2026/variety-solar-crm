import { useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { MessageSquare, Send, Users, CreditCard, CheckCircle, XCircle, Loader2, Phone, FileText, Eye, History, AlertTriangle, Inbox, Pencil, Trash2, Plus, Save, X } from 'lucide-react';
import type { Lead } from '@/hooks/useSheetData';

interface SmsPanelProps {
  leads?: Lead[];
  onInboxViewed?: () => void;
}

interface SelectedRecipient {
  phone: string;
  name: string;
}

const DEFAULT_SMS_TEMPLATES = [
  { key: "follow-up", name: "Follow-up", message: "Hi {name}, this is George from Variety Solar. Just following up on your recent enquiry. Would you like to discuss your solar options? Book a time that suits you: https://calendly.com/variety-solar/new-meeting or call us anytime." },
  { key: "book-consultation", name: "Book Consultation", message: "Hi {name}, this is George from Variety Solar. I'd love to chat about your energy needs. Book a free 30-min solar consultation at a time that suits you:\n\nhttps://calendly.com/variety-solar/new-meeting\n\nLooking forward to it! - George" },
  { key: "proposal-ready", name: "Proposal Ready", message: "Hi {name}, great news! Your solar proposal is ready. Check your email or give us a call to discuss. If you'd like to book a time to go through it: https://calendly.com/variety-solar/new-meeting - Variety Solar" },
  { key: "appointment-reminder", name: "Appointment Reminder", message: "Hi {name}, just a reminder about your upcoming appointment with Variety Solar. Looking forward to speaking with you!" },
  { key: "thank-you", name: "Thank You", message: "Hi {name}, thank you for choosing Variety Solar! We're excited to help you with your solar journey. Any questions, just call." },
  { key: "info-request", name: "Info Request", message: "Hi {name}, we need a few more details to finalise your solar quote. Could you please give us a call or reply? Thanks - Variety Solar" },
  { key: "reminder-req-info", name: "Reminder Req for Info", message: "Hi {name}, friendly reminder from Variety Solar - we still need further info to proceed with your quote. Please reply or call us when you can." },
  { key: "missed-call", name: "Missed Call", message: `Hi {name},\n\nThis is George from Variety Solar. I hope this message finds you well. I tried calling you for our scheduled phone consult, please advise me of what you would like to do.\n\nTo reschedule, book a new time here:\nhttps://calendly.com/variety-solar/new-meeting\n\nOr to provide you with the most accurate information, I would like to have a brief discovery conversation:\nhttps://forms.gle/mjg1BNWunk1WFmTn8\n\nWith Thanks\n-----------------------------------------------\nGeorge Fotopoulos\nRenewables Strategist and Designer\n0419574520\ngeorge@varietysolar.com.au\nwww.varietysolar.com.au` },
];

const MAX_MULTIPART_SMS = 765;
const COST_PER_PART = 1; // 1 credit per SMS part

export default function SmsPanel({ leads = [], onInboxViewed }: SmsPanelProps) {
  const [activeMode, setActiveMode] = useState<'single' | 'bulk' | 'templates' | 'log' | 'inbox'>('single');
  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [outcomeFilter, setOutcomeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'single' | 'bulk'>('single');

  // tRPC queries/mutations
  const balanceQuery = trpc.sms.balance.useQuery(undefined, {
    refetchInterval: 60000,
  });

  const logQuery = trpc.sms.getLog.useQuery({ limit: 50, offset: 0 }, {
    enabled: activeMode === 'log',
  });

  const inboxQuery = trpc.sms.getInbox.useQuery({ limit: 50, offset: 0 }, {
    enabled: activeMode === 'inbox',
    refetchInterval: activeMode === 'inbox' ? 30000 : false, // Auto-refresh every 30s when viewing inbox
  });

  const sendMutation = trpc.sms.send.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSendResult({ success: true, message: `SMS sent successfully! (${data.parts} part${data.parts > 1 ? 's' : ''})` });
        setMessage('');
        setRecipient('');
        balanceQuery.refetch();
        logQuery.refetch();
      } else {
        const errors = data.results.filter(r => r.status !== 'ok').map(r => r.reason).join(', ');
        setSendResult({ success: false, message: `Failed: ${errors}` });
      }
    },
    onError: (error) => {
      setSendResult({ success: false, message: error.message });
    },
  });

  const bulkSendMutation = trpc.sms.bulkSend.useMutation({
    onSuccess: (data) => {
      setSendResult({
        success: data.success,
        message: `Sent: ${data.sent}/${data.total} (${data.totalParts} SMS parts used)${data.failed > 0 ? ` — ${data.failed} failed` : ''} — personalised for each recipient`,
      });
      setSelectedRecipients([]);
      setMessage('');
      setShowPreview(false);
      balanceQuery.refetch();
      logQuery.refetch();
    },
    onError: (error) => {
      setSendResult({ success: false, message: error.message });
    },
  });

  // Auto-dismiss result after 5 seconds
  useEffect(() => {
    if (sendResult) {
      const timer = setTimeout(() => setSendResult(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [sendResult]);

  const handleSendSingle = () => {
    if (!recipient || !message) return;
    setConfirmMode('single');
    setShowConfirmDialog(true);
  };

  const handleSendBulk = () => {
    if (selectedRecipients.length === 0 || !message) return;
    setConfirmMode('bulk');
    setShowConfirmDialog(true);
  };

  const confirmAndSend = () => {
    setShowConfirmDialog(false);
    if (confirmMode === 'single') {
      sendMutation.mutate({ to: recipient, message, from: senderName });
    } else {
      bulkSendMutation.mutate({
        recipients: selectedRecipients.map(r => ({ phone: r.phone, name: r.name })),
        message,
        from: senderName,
      });
    }
  };

  const handleTemplateSelect = (template: { name: string; message: string }) => {
    setMessage(template.message);
  };

  const toggleLeadSelection = (lead: Lead) => {
    setSelectedRecipients(prev => {
      const exists = prev.find(r => r.phone === lead.contactNumber);
      if (exists) {
        return prev.filter(r => r.phone !== lead.contactNumber);
      } else {
        return [...prev, { phone: lead.contactNumber, name: lead.name.split(' ')[0] }];
      }
    });
  };

  const selectAllLeads = () => {
    if (selectedRecipients.length === filteredLeads.length) {
      setSelectedRecipients([]);
    } else {
      setSelectedRecipients(filteredLeads.map(l => ({ phone: l.contactNumber, name: l.name.split(' ')[0] })));
    }
  };

  // Get unique outcome values for the filter dropdown
  const outcomeOptions = useMemo(() => {
    const outcomes = new Set(leads.map(l => l.outcome).filter(Boolean));
    return Array.from(outcomes).sort();
  }, [leads]);

  // Get unique status values for the filter dropdown
  const statusOptions = useMemo(() => {
    const statuses = new Set(leads.map(l => l.status).filter(Boolean));
    return Array.from(statuses).sort();
  }, [leads]);

  const filteredLeads = leads.filter(l =>
    l.contactNumber && l.contactNumber.trim() !== '' &&
    (l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     l.contactNumber.includes(searchQuery)) &&
    (outcomeFilter === 'all' || l.outcome.toLowerCase().includes(outcomeFilter.toLowerCase())) &&
    (statusFilter === 'all' || l.status.toLowerCase().includes(statusFilter.toLowerCase()))
  );

  const charCount = message.length;
  // When {name} placeholder is used, calculate effective length with longest recipient name
  const longestName = selectedRecipients.length > 0
    ? selectedRecipients.reduce((max, r) => Math.max(max, (r.name || 'there').length), 0)
    : 10; // default assumption for single mode
  const effectiveCharCount = message.includes('{name}')
    ? message.replace(/{name}/g, 'x'.repeat(longestName)).length
    : charCount;
  const isOverLimit = effectiveCharCount > MAX_MULTIPART_SMS;
  const isMultiPart = effectiveCharCount > 160;
  const smsParts = effectiveCharCount <= 160 ? 1 : effectiveCharCount <= MAX_MULTIPART_SMS ? 2 : Math.ceil(effectiveCharCount / 153);
  const hasNamePlaceholder = message.includes('{name}');

  // Cost estimate for confirmation dialog
  const estimatedCost = confirmMode === 'single'
    ? smsParts * COST_PER_PART
    : selectedRecipients.length * smsParts * COST_PER_PART;

  // Preview of personalised messages for first few recipients
  const previewMessages = useMemo(() => {
    if (!hasNamePlaceholder) return [];
    return selectedRecipients.slice(0, 5).map(r => ({
      name: r.name,
      phone: r.phone,
      message: message.replace(/{name}/g, r.name || 'there'),
    }));
  }, [selectedRecipients, message, hasNamePlaceholder]);

  return (
    <div className="space-y-6">
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#5FB854]/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-[#5FB854]" />
              </div>
              <h3 className="text-white text-lg font-bold" style={{ fontFamily: 'Urbanist' }}>
                Confirm SMS Send
              </h3>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>Recipients</span>
                <span className="text-white text-sm font-medium" style={{ fontFamily: 'General Sans' }}>
                  {confirmMode === 'single' ? '1' : selectedRecipients.length}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>Message Length</span>
                <span className="text-white text-sm font-medium" style={{ fontFamily: 'General Sans' }}>
                  {effectiveCharCount} chars {isMultiPart && `(${smsParts} parts)`}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>SMS Parts per Message</span>
                <span className="text-white text-sm font-medium" style={{ fontFamily: 'General Sans' }}>
                  {smsParts}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>Estimated Cost</span>
                <span className="text-[#5FB854] text-sm font-bold" style={{ fontFamily: 'Space Mono' }}>
                  {estimatedCost} credit{estimatedCost !== 1 ? 's' : ''}
                </span>
              </div>
              {hasNamePlaceholder && (
                <div className="flex justify-between items-center py-2">
                  <span className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>Personalised</span>
                  <span className="text-[#5FB854] text-sm font-medium" style={{ fontFamily: 'General Sans' }}>Yes — each gets their name</span>
                </div>
              )}
            </div>

            {/* Message preview */}
            <div className="p-3 rounded-xl bg-white/5 mb-6">
              <p className="text-[#7A7B80] text-xs mb-1 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Message Preview</p>
              <p className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>
                {confirmMode === 'single'
                  ? message
                  : hasNamePlaceholder
                    ? message.replace(/{name}/g, selectedRecipients[0]?.name || 'there')
                    : message
                }
              </p>
              {confirmMode === 'bulk' && hasNamePlaceholder && selectedRecipients.length > 1 && (
                <p className="text-[#7A7B80] text-xs mt-2 italic" style={{ fontFamily: 'General Sans' }}>
                  (Showing preview for {selectedRecipients[0]?.name} — all {selectedRecipients.length} will be personalised)
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-[#B0B1B5] hover:text-white hover:border-white/20 text-sm font-medium transition-all"
                style={{ fontFamily: 'General Sans' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmAndSend}
                className="flex-1 px-4 py-3 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ fontFamily: 'General Sans' }}
              >
                Confirm & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with Balance */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
            SMS Broadcast
          </h2>
          <p className="text-[#7A7B80] text-sm mt-1" style={{ fontFamily: 'General Sans' }}>
            Send SMS messages to leads directly from the CRM
          </p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111111] border border-white/5">
          <CreditCard size={18} className="text-[#5FB854]" />
          <div>
            <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>Credits</p>
            <p className="text-white font-bold text-lg" style={{ fontFamily: 'Space Mono' }}>
              {balanceQuery.isLoading ? '...' : balanceQuery.data?.success ? balanceQuery.data.balance.toFixed(0) : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Result Toast */}
      {sendResult && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          sendResult.success
            ? 'bg-[#5FB854]/10 border-[#5FB854]/20 text-[#5FB854]'
            : 'bg-[#EF4444]/10 border-[#EF4444]/20 text-[#EF4444]'
        }`}>
          {sendResult.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span className="text-sm font-medium" style={{ fontFamily: 'General Sans' }}>{sendResult.message}</span>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'single' as const, label: 'Single SMS', icon: MessageSquare },
          { id: 'bulk' as const, label: 'Bulk Send', icon: Users },
          { id: 'templates' as const, label: 'Templates', icon: FileText },
          { id: 'inbox' as const, label: 'Received', icon: Inbox },
          { id: 'log' as const, label: 'Sent Log', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveMode(tab.id); if (tab.id === 'inbox' && onInboxViewed) onInboxViewed(); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-160 ${
              activeMode === tab.id
                ? 'bg-[#5FB854] text-[#0A0A0A]'
                : 'bg-[#111111] border border-white/5 text-[#B0B1B5] hover:text-white hover:border-white/10'
            }`}
            style={{ fontFamily: 'General Sans' }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Single SMS Mode */}
      {activeMode === 'single' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recipient */}
            <div>
              <label className="block text-[#B0B1B5] text-xs mb-2 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                Recipient Number
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7B80]" />
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0400 000 000"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#111111] border border-white/5 text-white placeholder-[#4A4B50] text-sm focus:outline-none focus:border-[#5FB854]/50"
                  style={{ fontFamily: 'General Sans' }}
                />
              </div>
            </div>

            {/* Sender Name */}
            <div>
              <label className="block text-[#B0B1B5] text-xs mb-2 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                Sender Name (max 11 chars)
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value.slice(0, 11))}
                placeholder="Leave blank for shared number"
                className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/5 text-white placeholder-[#4A4B50] text-sm focus:outline-none focus:border-[#5FB854]/50"
                style={{ fontFamily: 'General Sans' }}
              />
              <p className="text-[#7A7B80] text-xs mt-1" style={{ fontFamily: 'General Sans' }}>Leave blank to send from a shared number pool (recommended)</p>
            </div>
          </div>

          {/* Quick Select from Leads */}
          {leads.length > 0 && (
            <div>
              <label className="block text-[#B0B1B5] text-xs mb-2 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                Quick Select Lead
              </label>
              <select
                onChange={(e) => {
                  const lead = leads.find(l => l.contactNumber === e.target.value);
                  if (lead) {
                    setRecipient(lead.contactNumber);
                  }
                }}
                className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/5 text-white text-sm focus:outline-none focus:border-[#5FB854]/50"
                style={{ fontFamily: 'General Sans' }}
                value=""
              >
                <option value="" className="bg-[#111111]">-- Select a lead --</option>
                {leads.filter(l => l.contactNumber && l.contactNumber.trim() !== '').map((lead, i) => (
                  <option key={i} value={lead.contactNumber} className="bg-[#111111]">
                    {lead.name} - {lead.contactNumber}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[#B0B1B5] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                Message
              </label>
              <div className="flex items-center gap-2">
                {isMultiPart && !isOverLimit && (
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20" style={{ fontFamily: 'General Sans' }}>
                    {smsParts} parts
                  </span>
                )}
                <span className={`text-xs font-mono ${isOverLimit ? 'text-[#EF4444]' : isMultiPart ? 'text-orange-400' : 'text-[#7A7B80]'}`}>
                  {charCount}/{MAX_MULTIPART_SMS}
                </span>
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/5 text-white placeholder-[#4A4B50] text-sm focus:outline-none focus:border-[#5FB854]/50 resize-none"
              style={{ fontFamily: 'General Sans' }}
            />
            {isMultiPart && !isOverLimit && (
              <p className="text-orange-400 text-xs mt-1" style={{ fontFamily: 'General Sans' }}>
                This message will be sent as {smsParts} SMS parts ({smsParts} credits per recipient)
              </p>
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendSingle}
            disabled={!recipient || !message || isOverLimit || sendMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'General Sans' }}
          >
            {sendMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sendMutation.isPending ? 'Sending...' : 'Send SMS'}
          </button>
        </div>
      )}

      {/* Bulk SMS Mode */}
      {activeMode === 'bulk' && (
        <div className="space-y-4">
          {/* Personalisation info banner */}
          {hasNamePlaceholder && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#5FB854]/5 border border-[#5FB854]/20">
              <Users size={16} className="text-[#5FB854] shrink-0" />
              <p className="text-[#5FB854] text-xs" style={{ fontFamily: 'General Sans' }}>
                <span className="font-semibold">Personalised mode:</span> Each recipient will receive their own message with {'{name}'} replaced by their first name.
              </p>
            </div>
          )}

          {/* Discovery Filter */}
          <div>
            <label className="block text-[#B0B1B5] text-xs mb-2 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
              Filter by Discovery
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setOutcomeFilter('all'); setSelectedRecipients([]); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  outcomeFilter === 'all'
                    ? 'bg-[#5FB854] text-[#0A0A0A]'
                    : 'bg-[#111111] border border-white/5 text-[#B0B1B5] hover:text-white hover:border-white/10'
                }`}
                style={{ fontFamily: 'General Sans' }}
              >
                All Leads
              </button>
              {outcomeOptions.map((outcome) => (
                <button
                  key={outcome}
                  onClick={() => { setOutcomeFilter(outcome); setSelectedRecipients([]); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    outcomeFilter === outcome
                      ? 'bg-[#5FB854] text-[#0A0A0A]'
                      : 'bg-[#111111] border border-white/5 text-[#B0B1B5] hover:text-white hover:border-white/10'
                  }`}
                  style={{ fontFamily: 'General Sans' }}
                >
                  {outcome}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[#B0B1B5] text-xs mb-2 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
              Filter by Status
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setStatusFilter('all'); setSelectedRecipients([]); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-[#5FB854] text-[#0A0A0A]'
                    : 'bg-[#111111] border border-white/5 text-[#B0B1B5] hover:text-white hover:border-white/10'
                }`}
                style={{ fontFamily: 'General Sans' }}
              >
                All
              </button>
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => { setStatusFilter(status); setSelectedRecipients([]); }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    statusFilter === status
                      ? 'bg-[#5FB854] text-[#0A0A0A]'
                      : 'bg-[#111111] border border-white/5 text-[#B0B1B5] hover:text-white hover:border-white/10'
                  }`}
                  style={{ fontFamily: 'General Sans' }}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Search and Select All */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search leads by name or phone..."
              className="flex-1 px-4 py-3 rounded-xl bg-[#111111] border border-white/5 text-white placeholder-[#4A4B50] text-sm focus:outline-none focus:border-[#5FB854]/50"
              style={{ fontFamily: 'General Sans' }}
            />
            <button
              onClick={selectAllLeads}
              className="px-4 py-3 rounded-xl bg-[#111111] border border-white/5 text-[#B0B1B5] hover:text-white hover:border-white/10 text-sm font-medium transition-all"
              style={{ fontFamily: 'General Sans' }}
            >
              {selectedRecipients.length === filteredLeads.length && filteredLeads.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          {/* Selected count */}
          <p className="text-[#5FB854] text-sm font-medium" style={{ fontFamily: 'General Sans' }}>
            {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''} selected
          </p>

          {/* Lead List */}
          <div className="max-h-[240px] overflow-y-auto rounded-xl border border-white/5 bg-[#111111]">
            {filteredLeads.map((lead, i) => (
              <label
                key={i}
                className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-b-0 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={!!selectedRecipients.find(r => r.phone === lead.contactNumber)}
                  onChange={() => toggleLeadSelection(lead)}
                  className="w-4 h-4 rounded border-white/20 bg-transparent accent-[#5FB854]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate" style={{ fontFamily: 'General Sans' }}>{lead.name}</p>
                  <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>{lead.contactNumber}</p>
                </div>
                <span className="text-[#7A7B80] text-xs px-2 py-1 rounded-lg bg-white/5" style={{ fontFamily: 'General Sans' }}>
                  {lead.outcome || lead.status}
                </span>
              </label>
            ))}
            {filteredLeads.length === 0 && (
              <p className="text-[#7A7B80] text-sm text-center py-6" style={{ fontFamily: 'General Sans' }}>
                No leads with phone numbers found
              </p>
            )}
          </div>

          {/* Sender Name */}
          <div>
            <label className="block text-[#B0B1B5] text-xs mb-2 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
              Sender Name (max 11 chars)
            </label>
            <input
              type="text"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value.slice(0, 11))}
              placeholder="Leave blank for shared number"
              className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/5 text-white placeholder-[#4A4B50] text-sm focus:outline-none focus:border-[#5FB854]/50"
              style={{ fontFamily: 'General Sans' }}
            />
            <p className="text-[#7A7B80] text-xs mt-1" style={{ fontFamily: 'General Sans' }}>Leave blank to send from a shared number pool (recommended)</p>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[#B0B1B5] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                Message {hasNamePlaceholder && <span className="text-[#5FB854] normal-case">(contains {'{name}'} — will be personalised)</span>}
              </label>
              <div className="flex items-center gap-2">
                {isMultiPart && !isOverLimit && (
                  <span className="text-xs px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20" style={{ fontFamily: 'General Sans' }}>
                    {smsParts} parts
                  </span>
                )}
                <span className={`text-xs font-mono ${isOverLimit ? 'text-[#EF4444]' : isMultiPart ? 'text-orange-400' : 'text-[#7A7B80]'}`}>
                  {effectiveCharCount}/{MAX_MULTIPART_SMS}{hasNamePlaceholder && effectiveCharCount !== charCount && ` (with name)`}
                </span>
              </div>
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your bulk message here... Use {name} to personalise for each recipient"
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-[#111111] border border-white/5 text-white placeholder-[#4A4B50] text-sm focus:outline-none focus:border-[#5FB854]/50 resize-none"
              style={{ fontFamily: 'General Sans' }}
            />
            {isMultiPart && !isOverLimit && (
              <p className="text-orange-400 text-xs mt-1" style={{ fontFamily: 'General Sans' }}>
                This message will be sent as {smsParts} SMS parts ({smsParts} credits per recipient)
              </p>
            )}
          </div>

          {/* Preview Toggle */}
          {hasNamePlaceholder && selectedRecipients.length > 0 && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-[#B0B1B5] hover:text-white text-sm transition-colors"
              style={{ fontFamily: 'General Sans' }}
            >
              <Eye size={14} />
              {showPreview ? 'Hide' : 'Preview'} personalised messages
            </button>
          )}

          {/* Personalisation Preview */}
          {showPreview && previewMessages.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-[#111111] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 bg-[#5FB854]/5">
                <p className="text-[#5FB854] text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                  Preview — Each person receives their own message
                </p>
              </div>
              <div className="divide-y divide-white/5">
                {previewMessages.map((preview, i) => (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-white text-xs font-semibold" style={{ fontFamily: 'General Sans' }}>{preview.name}</span>
                      <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>{preview.phone}</span>
                    </div>
                    <p className="text-[#B0B1B5] text-xs leading-relaxed" style={{ fontFamily: 'General Sans' }}>
                      "{preview.message}"
                    </p>
                  </div>
                ))}
                {selectedRecipients.length > 5 && (
                  <div className="px-4 py-2.5">
                    <p className="text-[#7A7B80] text-xs italic" style={{ fontFamily: 'General Sans' }}>
                      + {selectedRecipients.length - 5} more recipients will also receive personalised messages
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Send Bulk Button */}
          <button
            onClick={handleSendBulk}
            disabled={selectedRecipients.length === 0 || !message || isOverLimit || bulkSendMutation.isPending}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'General Sans' }}
          >
            {bulkSendMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
            {bulkSendMutation.isPending ? 'Sending personalised messages...' : `Send to ${selectedRecipients.length} Recipient${selectedRecipients.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Templates Mode */}
      {activeMode === 'templates' && (
        <TemplatesPanel
          onSelectTemplate={(msg) => {
            setMessage(msg);
            setActiveMode('bulk');
          }}
          currentMessage={message}
        />
      )}

      {/* Inbox Mode - Received Messages */}
      {activeMode === 'inbox' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
              Received messages — {inboxQuery.data?.total ?? 0} total
            </p>
            <button
              onClick={() => inboxQuery.refetch()}
              className="text-[#5FB854] text-xs hover:underline"
              style={{ fontFamily: 'General Sans' }}
            >
              Refresh
            </button>
          </div>

          {inboxQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-[#5FB854] animate-spin" />
            </div>
          )}

          {inboxQuery.data && inboxQuery.data.logs.length === 0 && (
            <div className="text-center py-12">
              <Inbox size={32} className="text-[#7A7B80] mx-auto mb-3" />
              <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
                No received messages yet
              </p>
              <p className="text-[#4A4B50] text-xs mt-2" style={{ fontFamily: 'General Sans' }}>
                Inbound messages will appear here when customers reply to your SMS
              </p>
            </div>
          )}

          {inboxQuery.data && inboxQuery.data.logs.length > 0 && (
            <div className="space-y-3">
              {inboxQuery.data.logs.map((msg, i) => {
                // Try to match phone to a lead name
                const matchedLead = leads.find(l => {
                  const cleanLeadPhone = l.contactNumber?.replace(/\s+/g, '').replace(/^0/, '61');
                  const cleanMsgPhone = msg.phone?.replace(/\s+/g, '');
                  return cleanLeadPhone === cleanMsgPhone || l.contactNumber?.replace(/\s+/g, '') === cleanMsgPhone;
                });
                const displayName = msg.contactName || matchedLead?.name || 'Unknown';

                return (
                  <div key={i} className="rounded-xl border border-white/5 bg-[#111111] p-4 hover:border-white/10 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#5FB854]/10 flex items-center justify-center">
                          <span className="text-[#5FB854] text-sm font-bold" style={{ fontFamily: 'Urbanist' }}>
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white text-sm font-semibold" style={{ fontFamily: 'General Sans' }}>
                            {displayName}
                          </p>
                          <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>
                            {msg.phone}
                          </p>
                        </div>
                      </div>
                      <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                        {msg.createdAt ? new Date(Number(msg.createdAt)).toLocaleString('en-AU', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : '—'}
                      </span>
                    </div>
                    <div className="ml-12">
                      <p className="text-[#E0E0E0] text-sm leading-relaxed" style={{ fontFamily: 'General Sans' }}>
                        {msg.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sent Log Mode */}
      {activeMode === 'log' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
              SMS sent history — {logQuery.data?.total ?? 0} total messages
            </p>
            <button
              onClick={() => logQuery.refetch()}
              className="text-[#5FB854] text-xs hover:underline"
              style={{ fontFamily: 'General Sans' }}
            >
              Refresh
            </button>
          </div>

          {logQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="text-[#5FB854] animate-spin" />
            </div>
          )}

          {logQuery.data && logQuery.data.logs.length === 0 && (
            <div className="text-center py-12">
              <History size={32} className="text-[#7A7B80] mx-auto mb-3" />
              <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
                No SMS messages sent yet
              </p>
            </div>
          )}

          {logQuery.data && logQuery.data.logs.length > 0 && (
            <div className="rounded-xl border border-white/5 bg-[#111111] overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_1fr_2fr_80px_80px] gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Contact</span>
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Phone</span>
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Message</span>
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Status</span>
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Date</span>
              </div>

              {/* Table Rows */}
              <div className="max-h-[400px] overflow-y-auto">
                {logQuery.data.logs.map((log, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_2fr_80px_80px] gap-2 px-4 py-3 border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                    <span className="text-white text-xs truncate" style={{ fontFamily: 'General Sans' }}>
                      {log.contactName || '—'}
                    </span>
                    <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>
                      {log.phone}
                    </span>
                    <span className="text-[#B0B1B5] text-xs truncate" style={{ fontFamily: 'General Sans' }}>
                      {log.message}
                    </span>
                    <span className={`text-xs font-medium ${log.status === 'delivered' ? 'text-[#5FB854]' : 'text-[#EF4444]'}`} style={{ fontFamily: 'General Sans' }}>
                      {log.status === 'delivered' ? '✓ Sent' : '✗ Failed'}
                    </span>
                    <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                      {log.createdAt ? new Date(Number(log.createdAt)).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit' }) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Editable Templates Panel ─────────────────────────────────────────────────

interface TemplatesPanelProps {
  onSelectTemplate: (msg: string) => void;
  currentMessage: string;
}

function TemplatesPanel({ onSelectTemplate, currentMessage }: TemplatesPanelProps) {
  const { data: dbTemplates, refetch } = trpc.autoSms.listAllTemplates.useQuery();
  const createMutation = trpc.autoSms.createTemplate.useMutation({
    onSuccess: () => { toast.success('Template created'); refetch(); setIsCreating(false); },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });
  const updateMutation = trpc.autoSms.updateTemplateWithName.useMutation({
    onSuccess: () => { toast.success('Template saved'); refetch(); setEditingKey(null); },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });
  const deleteMutation = trpc.autoSms.deleteTemplate.useMutation({
    onSuccess: () => { toast.success('Template deleted'); refetch(); },
    onError: (err: any) => toast.error(`Failed: ${err.message}`),
  });

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBody, setNewBody] = useState('');

  // Merge DB templates with defaults (DB overrides defaults by key)
  const templates = useMemo(() => {
    const dbMap = new Map((dbTemplates || []).map(t => [t.templateKey, t]));
    const merged: { key: string; name: string; message: string; isCustom: boolean }[] = [];
    // Add defaults (overridden by DB if exists)
    for (const def of DEFAULT_SMS_TEMPLATES) {
      const dbEntry = dbMap.get(def.key);
      if (dbEntry) {
        merged.push({ key: dbEntry.templateKey, name: dbEntry.displayName || def.name, message: dbEntry.messageBody, isCustom: false });
        dbMap.delete(def.key);
      } else {
        merged.push({ key: def.key, name: def.name, message: def.message, isCustom: false });
      }
    }
    // Add any extra custom templates from DB
    dbMap.forEach((entry) => {
      if (entry.templateKey !== 'npu' && entry.templateKey !== 'voicemail') {
        merged.push({ key: entry.templateKey, name: entry.displayName || entry.templateKey, message: entry.messageBody, isCustom: true });
      }
    });
    return merged;
  }, [dbTemplates]);

  const startEdit = (t: { key: string; name: string; message: string }) => {
    setEditingKey(t.key);
    setEditName(t.name);
    setEditBody(t.message);
  };

  const saveEdit = () => {
    if (!editingKey || !editName.trim() || !editBody.trim()) return;
    // Check if it exists in DB
    const inDb = (dbTemplates || []).find(t => t.templateKey === editingKey);
    if (inDb) {
      updateMutation.mutate({ key: editingKey, displayName: editName.trim(), body: editBody.trim() });
    } else {
      // First time saving a default template to DB
      createMutation.mutate({ key: editingKey, displayName: editName.trim(), body: editBody.trim() });
    }
  };

  const handleCreate = () => {
    if (!newName.trim() || !newBody.trim()) return;
    const key = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
    createMutation.mutate({ key, displayName: newName.trim(), body: newBody.trim() });
    setNewName('');
    setNewBody('');
  };

  const handleDelete = (key: string) => {
    if (!confirm('Delete this template?')) return;
    deleteMutation.mutate({ key });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
          Click a template to use it. Edit or create your own custom templates.
        </p>
        <button
          onClick={() => { setIsCreating(true); setEditingKey(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5FB854] text-[#0A0A0A] text-xs font-semibold hover:brightness-110 transition-all active:scale-[0.97]"
          style={{ fontFamily: 'General Sans' }}
        >
          <Plus size={12} />
          New Template
        </button>
      </div>

      {/* Create new template form */}
      {isCreating && (
        <div className="p-4 rounded-xl bg-[#111111] border border-[#5FB854]/30 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-white text-sm font-semibold" style={{ fontFamily: 'Urbanist' }}>New Template</span>
            <button onClick={() => setIsCreating(false)} className="text-[#7A7B80] hover:text-white"><X size={16} /></button>
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Template name..."
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#5FB854]/50"
            style={{ fontFamily: 'General Sans' }}
          />
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Message body... Use {name} for personalisation"
            rows={4}
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-y focus:outline-none focus:border-[#5FB854]/50"
            style={{ fontFamily: 'General Sans' }}
          />
          <button
            onClick={handleCreate}
            disabled={createMutation.isPending || !newName.trim() || !newBody.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5FB854] text-[#0A0A0A] text-xs font-semibold hover:brightness-110 transition-all active:scale-[0.97] disabled:opacity-50"
            style={{ fontFamily: 'General Sans' }}
          >
            <Save size={12} />
            {createMutation.isPending ? 'Creating...' : 'Create Template'}
          </button>
        </div>
      )}

      {/* Template grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {templates.map((template) => (
          editingKey === template.key ? (
            <div key={template.key} className="p-4 rounded-xl bg-[#111111] border border-[#5FB854]/30 space-y-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-semibold focus:outline-none focus:border-[#5FB854]/50"
                style={{ fontFamily: 'Urbanist' }}
              />
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={5}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-lg px-3 py-2 text-white text-xs resize-y focus:outline-none focus:border-[#5FB854]/50"
                style={{ fontFamily: 'General Sans' }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={saveEdit}
                  disabled={updateMutation.isPending || createMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5FB854] text-[#0A0A0A] text-xs font-semibold hover:brightness-110 transition-all active:scale-[0.97] disabled:opacity-50"
                  style={{ fontFamily: 'General Sans' }}
                >
                  <Save size={12} />
                  Save
                </button>
                <button
                  onClick={() => setEditingKey(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-[#7A7B80] text-xs font-medium hover:bg-white/10 transition-colors"
                  style={{ fontFamily: 'General Sans' }}
                >
                  <X size={12} />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={template.key}
              className="relative text-left p-4 rounded-xl bg-[#111111] border border-white/5 hover:border-[#5FB854]/30 transition-all group cursor-pointer"
              onClick={() => onSelectTemplate(template.message)}
            >
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-[#5FB854]" />
                <span className="text-white text-sm font-semibold" style={{ fontFamily: 'Urbanist' }}>
                  {template.name}
                </span>
                {template.isCustom && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#5FB854]/10 text-[#5FB854] font-medium">Custom</span>
                )}
              </div>
              <p className="text-[#7A7B80] text-xs leading-relaxed line-clamp-3" style={{ fontFamily: 'General Sans' }}>
                {template.message}
              </p>
              {/* Action buttons */}
              <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(template); }}
                  className="p-1.5 rounded-lg bg-white/5 text-[#7A7B80] hover:text-white hover:bg-white/10 transition-colors"
                  title="Edit template"
                >
                  <Pencil size={12} />
                </button>
                {template.isCustom && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(template.key); }}
                    className="p-1.5 rounded-lg bg-white/5 text-[#7A7B80] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <p className="text-[#5FB854] text-xs mt-2 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontFamily: 'General Sans' }}>
                Click to use →
              </p>
            </div>
          )
        ))}
      </div>

      {/* Current message preview */}
      {currentMessage && (
        <div className="p-4 rounded-xl bg-[#5FB854]/5 border border-[#5FB854]/20">
          <p className="text-[#5FB854] text-xs uppercase tracking-wider mb-2" style={{ fontFamily: 'General Sans' }}>
            Current Message
          </p>
          <p className="text-white text-sm whitespace-pre-wrap" style={{ fontFamily: 'General Sans' }}>{currentMessage}</p>
        </div>
      )}
    </div>
  );
}
