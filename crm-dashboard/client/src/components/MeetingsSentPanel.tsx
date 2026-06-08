import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { CalendarCheck, MapPin, Clock, User, Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function MeetingsSentPanel() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data, isLoading, refetch } = trpc.meetings.list.useQuery({ limit, offset: page * limit });
  const updateStatus = trpc.meetings.updateStatus.useMutation({
    onSuccess: () => {
      refetch();
      toast.success('Meeting status updated');
    },
    onError: (err) => toast.error(err.message),
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Australia/Melbourne',
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Australia/Melbourne',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-[#F5A623]/15 text-[#F5A623]';
      case 'completed': return 'bg-[#5FB854]/15 text-[#5FB854]';
      case 'cancelled': return 'bg-[#EF4444]/15 text-[#EF4444]';
      default: return 'bg-white/10 text-white';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#5FB854]" size={32} />
      </div>
    );
  }

  const meetings = data?.meetings ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[#5FB854]/10 flex items-center justify-center">
            <CalendarCheck size={20} className="text-[#5FB854]" />
          </div>
          <div>
            <h2 className="text-white text-xl font-bold" style={{ fontFamily: 'Urbanist' }}>
              Meetings Sent
            </h2>
            <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
              {total} calendar invite{total !== 1 ? 's' : ''} sent
            </p>
          </div>
        </div>
      </div>

      {/* Meetings List */}
      {meetings.length === 0 ? (
        <div className="text-center py-16">
          <CalendarCheck size={48} className="text-[#7A7B80]/30 mx-auto mb-4" />
          <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
            No meetings sent yet. Schedule a meeting from the Leads panel to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="bg-[#141414] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Subject & Status */}
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-white text-sm font-semibold" style={{ fontFamily: 'General Sans' }}>
                      {meeting.subject}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${getStatusColor(meeting.status)}`}>
                      {meeting.status}
                    </span>
                  </div>

                  {/* Customer Info */}
                  <div className="flex flex-wrap items-center gap-4 mb-2">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-[#7A7B80]" />
                      <span className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>
                        {meeting.customerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Mail size={12} className="text-[#7A7B80]" />
                      <span className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>
                        {meeting.customerEmail}
                      </span>
                    </div>
                  </div>

                  {/* Date, Time & Location */}
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-[#7A7B80]" />
                      <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                        {formatDate(meeting.meetingStartTime)} &middot; {formatTime(meeting.meetingStartTime)} – {formatTime(meeting.meetingEndTime)} ({meeting.durationMinutes}min)
                      </span>
                    </div>
                    {meeting.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-[#7A7B80]" />
                        <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                          {meeting.location}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                {meeting.status === 'scheduled' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateStatus.mutate({ id: meeting.id, status: 'completed' })}
                      className="p-2 rounded-lg bg-[#5FB854]/10 text-[#5FB854] hover:bg-[#5FB854]/20 transition-colors"
                      title="Mark as completed"
                    >
                      <CheckCircle size={16} />
                    </button>
                    <button
                      onClick={() => updateStatus.mutate({ id: meeting.id, status: 'cancelled' })}
                      className="p-2 rounded-lg bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 transition-colors"
                      title="Mark as cancelled"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[#B0B1B5] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            style={{ fontFamily: 'General Sans' }}
          >
            Previous
          </button>
          <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[#B0B1B5] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            style={{ fontFamily: 'General Sans' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
