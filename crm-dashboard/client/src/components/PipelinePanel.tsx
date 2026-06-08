import { Lead, getMetrics } from '@/hooks/useSheetData';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface PipelinePanelProps {
  leads: Lead[];
}

export default function PipelinePanel({ leads }: PipelinePanelProps) {
  const metrics = getMetrics(leads);

  // Group leads by date for timeline
  const dateGroups: Record<string, number> = {};
  leads.forEach(lead => {
    if (lead.dateStamp) {
      const date = lead.dateStamp.replace(/\./g, '/');
      dateGroups[date] = (dateGroups[date] || 0) + 1;
    }
  });

  const timelineData = Object.entries(dateGroups)
    .map(([date, count]) => ({ date, leads: count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Cumulative data
  let cumulative = 0;
  const cumulativeData = timelineData.map(item => {
    cumulative += item.leads;
    return { ...item, cumulative };
  });

  // Pipeline stages
  const stages = [
    {
      name: 'New Leads',
      count: metrics.total,
      pct: 100,
      color: '#5FB854',
      description: 'Total leads received from Solar Quotes',
    },
    {
      name: 'Information Received',
      count: metrics.receivedInfo,
      pct: Math.round((metrics.receivedInfo / metrics.total) * 100),
      color: '#5FB854',
      description: 'Customer information collected and verified',
    },
    {
      name: 'Proposal Sent',
      count: metrics.proposalSent,
      pct: Math.round((metrics.proposalSent / metrics.total) * 100),
      color: '#FFB347',
      description: 'Formal proposal delivered to customer',
    },
    {
      name: 'Awaiting Decision',
      count: metrics.awaitingInfo,
      pct: Math.round((metrics.awaitingInfo / metrics.total) * 100),
      color: '#B0B1B5',
      description: 'Waiting for customer response',
    },
    {
      name: 'Rejected',
      count: metrics.rejected,
      pct: Math.round((metrics.rejected / metrics.total) * 100),
      color: '#EF4444',
      description: 'Customer declined or non-responsive',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
          Sales Pipeline
        </h2>
        <p className="text-[#7A7B80] text-sm mt-1" style={{ fontFamily: 'General Sans' }}>
          Track lead progression through the sales funnel
        </p>
      </div>

      {/* Visual Funnel */}
      <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-6" style={{ fontFamily: 'Urbanist' }}>
          Conversion Funnel
        </h3>
        <div className="space-y-4">
          {stages.map((stage, idx) => (
            <div key={stage.name} className="relative">
              <div className="flex items-center gap-4">
                <div className="w-8 text-center">
                  <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>
                    {idx + 1}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white text-sm font-medium" style={{ fontFamily: 'General Sans' }}>
                      {stage.name}
                    </span>
                    <span className="text-[#B0B1B5] text-sm" style={{ fontFamily: 'Space Mono' }}>
                      {stage.count}
                    </span>
                  </div>
                  <div className="h-10 bg-[#0A0A0A] rounded-xl overflow-hidden relative">
                    <div
                      className="h-full rounded-xl transition-all duration-1000 ease-out flex items-center px-4"
                      style={{
                        width: `${Math.max(stage.pct, 8)}%`,
                        backgroundColor: `${stage.color}30`,
                        borderLeft: `3px solid ${stage.color}`,
                      }}
                    >
                      <span className="text-xs text-[#B0B1B5]" style={{ fontFamily: 'General Sans' }}>
                        {stage.description}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-12 text-right">
                  <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>
                    {stage.pct}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Intake Timeline */}
      <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'Urbanist' }}>
          Lead Intake Timeline
        </h3>
        <div className="h-[250px]" style={{ minWidth: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumulativeData}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5FB854" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5FB854" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                stroke="#7A7B80"
                style={{ fontFamily: 'Space Mono', fontSize: 10 }}
              />
              <YAxis
                stroke="#7A7B80"
                style={{ fontFamily: 'Space Mono', fontSize: 10 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111111',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#FFFFFF',
                  fontFamily: 'General Sans',
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#5FB854"
                strokeWidth={2}
                fill="url(#colorLeads)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversion Rate Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111111] border border-white/5 rounded-xl p-6 text-center">
          <p className="text-[#7A7B80] text-xs uppercase tracking-wider mb-2" style={{ fontFamily: 'General Sans' }}>
            Conversion Rate
          </p>
          <p className="text-3xl font-bold text-[#5FB854]" style={{ fontFamily: 'Space Mono' }}>
            {metrics.total > 0 ? Math.round((metrics.proposalSent / metrics.total) * 100) : 0}%
          </p>
          <p className="text-[#7A7B80] text-xs mt-1" style={{ fontFamily: 'General Sans' }}>
            Leads → Proposals
          </p>
        </div>
        <div className="bg-[#111111] border border-white/5 rounded-xl p-6 text-center">
          <p className="text-[#7A7B80] text-xs uppercase tracking-wider mb-2" style={{ fontFamily: 'General Sans' }}>
            Rejection Rate
          </p>
          <p className="text-3xl font-bold text-[#EF4444]" style={{ fontFamily: 'Space Mono' }}>
            {metrics.total > 0 ? Math.round((metrics.rejected / metrics.total) * 100) : 0}%
          </p>
          <p className="text-[#7A7B80] text-xs mt-1" style={{ fontFamily: 'General Sans' }}>
            Lost Leads
          </p>
        </div>
        <div className="bg-[#111111] border border-white/5 rounded-xl p-6 text-center">
          <p className="text-[#7A7B80] text-xs uppercase tracking-wider mb-2" style={{ fontFamily: 'General Sans' }}>
            Active Pipeline
          </p>
          <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Space Mono' }}>
            {metrics.pending}
          </p>
          <p className="text-[#7A7B80] text-xs mt-1" style={{ fontFamily: 'General Sans' }}>
            Pending Decisions
          </p>
        </div>
      </div>
    </div>
  );
}
