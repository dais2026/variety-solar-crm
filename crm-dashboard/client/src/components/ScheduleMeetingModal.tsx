import { useState } from 'react';
import { Calendar, Clock, MapPin, User, Mail, Send, X, FileText } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface ScheduleMeetingModalProps {
  lead: {
    name: string;
    email: string;
    address: string;
    contactNumber: string;
  };
  onClose: () => void;
}

export default function ScheduleMeetingModal({ lead, onClose }: ScheduleMeetingModalProps) {
  const [subject, setSubject] = useState(`Solar Consultation - ${lead.name}`);
  const [location, setLocation] = useState(lead.address || '');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sendInviteMutation = trpc.calendar.sendInvite.useMutation({
    onSuccess: (data) => {
      setSent(true);
      toast.success(`Calendar invite sent to ${lead.name}!`);
    },
    onError: (error) => {
      toast.error(`Failed to send invite: ${error.message}`);
      setSending(false);
    },
  });

  const handleSend = async () => {
    if (!date) {
      toast.error('Please select a date');
      return;
    }
    if (!lead.email) {
      toast.error('This lead has no email address');
      return;
    }

    setSending(true);
    sendInviteMutation.mutate({
      customerName: lead.name,
      customerEmail: lead.email,
      customerAddress: lead.address || '',
      subject,
      location,
      date,
      startTime,
      duration,
      notes,
    });
  };

  // Generate time options (6:00 AM to 8:00 PM in 15-min increments)
  const timeOptions = [];
  for (let h = 6; h <= 20; h++) {
    for (let m = 0; m < 60; m += 15) {
      const hour = h.toString().padStart(2, '0');
      const min = m.toString().padStart(2, '0');
      const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      timeOptions.push({
        value: `${hour}:${min}`,
        label: `${displayHour}:${min.padStart(2, '0')} ${ampm}`,
      });
    }
  }

  // Get tomorrow's date as minimum
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  if (sent) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-8 max-w-md w-full text-center" onClick={(e) => e.stopPropagation()}>
          <div className="w-16 h-16 rounded-full bg-[#5FB854]/20 flex items-center justify-center mx-auto mb-4">
            <Send size={28} className="text-[#5FB854]" />
          </div>
          <h3 className="text-white text-lg font-semibold mb-2" style={{ fontFamily: 'General Sans' }}>
            Invite Sent!
          </h3>
          <p className="text-[#7A7B80] text-sm mb-6" style={{ fontFamily: 'General Sans' }}>
            Calendar invite has been sent to {lead.name} at {lead.email}
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97]"
            style={{ fontFamily: 'General Sans' }}
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#141414] border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5FB854]/10 flex items-center justify-center">
              <Calendar size={20} className="text-[#5FB854]" />
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold" style={{ fontFamily: 'General Sans' }}>
                Schedule Meeting
              </h3>
              <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                Send a calendar invite to {lead.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <X size={16} className="text-[#7A7B80]" />
          </button>
        </div>

        {/* Attendees */}
        <div className="mb-5 p-3 rounded-xl bg-[#0A0A0A] border border-white/5">
          <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: 'General Sans' }}>
            Attendees
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <User size={12} className="text-[#5FB854]" />
              <span className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>
                George Fotopoulos (Organizer)
              </span>
              <span className="text-[#7A7B80] text-[10px] ml-auto" style={{ fontFamily: 'General Sans' }}>
                george@varietysolar.com.au
              </span>
            </div>
            <div className="flex items-center gap-2">
              <User size={12} className="text-[#FFB347]" />
              <span className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>
                {lead.name}
              </span>
              <span className="text-[#7A7B80] text-[10px] ml-auto" style={{ fontFamily: 'General Sans' }}>
                {lead.email || 'No email'}
              </span>
            </div>
          </div>
        </div>

        {/* Subject */}
        <div className="mb-4">
          <label className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1.5 block" style={{ fontFamily: 'General Sans' }}>
            Subject
          </label>
          <div className="relative">
            <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7B80]" />
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 pl-9 py-2.5 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 transition-colors"
              style={{ fontFamily: 'General Sans' }}
              placeholder="Meeting subject..."
            />
          </div>
        </div>

        {/* Date & Time Row */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1.5 block" style={{ fontFamily: 'General Sans' }}>
              Date
            </label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7B80]" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={minDate}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 pl-9 py-2.5 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 transition-colors [color-scheme:dark]"
                style={{ fontFamily: 'General Sans' }}
              />
            </div>
          </div>
          <div>
            <label className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1.5 block" style={{ fontFamily: 'General Sans' }}>
              Start Time
            </label>
            <div className="relative">
              <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7B80]" />
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 pl-9 py-2.5 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 transition-colors appearance-none"
                style={{ fontFamily: 'General Sans' }}
              >
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Duration */}
        <div className="mb-4">
          <label className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1.5 block" style={{ fontFamily: 'General Sans' }}>
            Duration
          </label>
          <div className="flex gap-2">
            {[15, 30, 45, 60, 90, 120].map((d) => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-160 ${
                  duration === d
                    ? 'bg-[#5FB854] text-[#0A0A0A]'
                    : 'bg-white/5 text-[#7A7B80] hover:bg-white/10'
                }`}
                style={{ fontFamily: 'General Sans' }}
              >
                {d < 60 ? `${d}m` : `${d / 60}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="mb-4">
          <label className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1.5 block" style={{ fontFamily: 'General Sans' }}>
            Location / Address
          </label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7B80]" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 pl-9 py-2.5 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 transition-colors"
              style={{ fontFamily: 'General Sans' }}
              placeholder="Enter address or 'Phone call' / 'Zoom'..."
            />
          </div>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1.5 block" style={{ fontFamily: 'General Sans' }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 transition-colors resize-none"
            style={{ fontFamily: 'General Sans' }}
            placeholder="Any additional notes for the invite..."
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sending || !date || !lead.email}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: 'General Sans' }}
        >
          <Send size={16} />
          {sending ? 'Sending Invite...' : 'Send Calendar Invite'}
        </button>

        {!lead.email && (
          <p className="text-[#EF4444] text-xs text-center mt-2" style={{ fontFamily: 'General Sans' }}>
            This lead has no email address. Please add one before sending an invite.
          </p>
        )}
      </div>
    </div>
  );
}
