import { Lead } from '@/hooks/useSheetData';
import { Clock, User, Mail, Phone, MapPin } from 'lucide-react';

interface ActivityPanelProps {
  leads: Lead[];
}

function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('lost')) return '#6B7280';
  if (s.includes('pending')) return '#FFB347';
  if (s.includes('rejected')) return '#EF4444';
  if (s.includes('proposal')) return '#5FB854';
  if (s.includes('received') || s.includes('recieved')) return '#5FB854';
  if (s.includes('awaiting')) return '#B0B1B5';
  if (s.includes('non-responsive')) return '#EF4444';
  if (s.includes('on hold')) return '#7A7B80';
  return '#7A7B80';
}

export default function ActivityPanel({ leads }: ActivityPanelProps) {
  // Sort leads by date (most recent first)
  const sortedLeads = [...leads].sort((a, b) => {
    const dateA = a.dateStamp || '';
    const dateB = b.dateStamp || '';
    return dateB.localeCompare(dateA);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
          Recent Activity
        </h2>
        <p className="text-[#7A7B80] text-sm mt-1" style={{ fontFamily: 'General Sans' }}>
          Latest lead activity and updates
        </p>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        {sortedLeads.map((lead, idx) => (
          <div
            key={`${lead.name}-${idx}`}
            className="bg-[#111111] border border-white/5 rounded-xl p-5 transition-all duration-300 hover:border-[#5FB854]/30"
          >
            <div className="flex items-start gap-4">
              {/* Timeline dot */}
              <div className="flex flex-col items-center pt-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getStatusColor(lead.saleStatus || lead.outcome) }}
                />
                {idx < sortedLeads.length - 1 && (
                  <div className="w-px h-full bg-white/5 mt-2" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-semibold text-sm" style={{ fontFamily: 'Urbanist' }}>
                    {lead.name}
                  </h4>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} className="text-[#7A7B80]" />
                    <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>
                      {lead.dateStamp}
                    </span>
                  </div>
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {lead.outcome && (
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs"
                      style={{
                        backgroundColor: `${getStatusColor(lead.outcome)}15`,
                        color: getStatusColor(lead.outcome),
                        fontFamily: 'General Sans',
                      }}
                    >
                      {lead.outcome}
                    </span>
                  )}
                  {lead.saleStatus && (
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs"
                      style={{
                        backgroundColor: `${getStatusColor(lead.saleStatus)}15`,
                        color: getStatusColor(lead.saleStatus),
                        fontFamily: 'General Sans',
                      }}
                    >
                      {lead.saleStatus}
                    </span>
                  )}
                  {lead.product && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#5FB854]/10 text-[#5FB854] text-xs" style={{ fontFamily: 'General Sans' }}>
                      {lead.product}
                    </span>
                  )}
                </div>

                {/* Contact details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lead.contactNumber && (
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-[#7A7B80]" />
                      <span className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'Space Mono' }}>
                        {lead.contactNumber}
                      </span>
                    </div>
                  )}
                  {lead.email && (
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-[#7A7B80]" />
                      <span className="text-[#B0B1B5] text-xs truncate" style={{ fontFamily: 'General Sans' }}>
                        {lead.email}
                      </span>
                    </div>
                  )}
                  {lead.address && (
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <MapPin size={12} className="text-[#7A7B80] shrink-0" />
                      <span className="text-[#B0B1B5] text-xs truncate" style={{ fontFamily: 'General Sans' }}>
                        {lead.address}
                      </span>
                    </div>
                  )}
                </div>

                {/* Additional info */}
                {(lead.brands || lead.size) && (
                  <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-3">
                    {lead.brands && (
                      <div>
                        <span className="text-[#7A7B80] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                          Brand
                        </span>
                        <p className="text-[#B0B1B5] text-xs mt-0.5" style={{ fontFamily: 'General Sans' }}>
                          {lead.brands}
                        </p>
                      </div>
                    )}
                    {lead.size && (
                      <div>
                        <span className="text-[#7A7B80] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                          Size
                        </span>
                        <p className="text-[#B0B1B5] text-xs mt-0.5" style={{ fontFamily: 'General Sans' }}>
                          {lead.size}
                        </p>
                      </div>
                    )}
                    {lead.leadSource && (
                      <div>
                        <span className="text-[#7A7B80] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                          Source
                        </span>
                        <p className="text-[#B0B1B5] text-xs mt-0.5" style={{ fontFamily: 'General Sans' }}>
                          {lead.leadSource}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
