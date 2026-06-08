import { Lead, getMetrics, getProductBreakdown, getOutcomeBreakdown } from '@/hooks/useSheetData';
import { Users, Clock, CheckCircle, XCircle, Send, FileText, CalendarCheck, MapPin, Trophy, DollarSign, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { trpc } from '@/lib/trpc';

interface OverviewPanelProps {
  leads: Lead[];
  lastUpdated: Date | null;
}

const COLORS = ['#5FB854', '#7A7B80', '#FFB347', '#EF4444', '#B0B1B5'];

function ClosedSalesSummary() {
  const { data: salesData, isLoading } = trpc.closedSales.list.useQuery(
    { limit: 100, offset: 0 },
  );

  if (isLoading) {
    return (
      <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-center py-6">
          <div className="w-6 h-6 border-2 border-[#5FB854] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const sales = salesData?.sales || [];
  // Exclude dismissed sales from metrics
  const activeSales = sales.filter(s => s.projectStatus !== 'dismissed');
  const totalSales = activeSales.length;
  const totalRevenue = activeSales.reduce((sum, s) => sum + (parseFloat(s.totalContractPrice) || 0), 0);
  const avgDealSize = totalSales > 0 ? totalRevenue / totalSales : 0;
  const pendingReview = activeSales.filter(s => s.projectStatus === 'pylon-pending-review').length;
  const completed = activeSales.filter(s => s.projectStatus === 'complete').length;
  const inProgress = activeSales.filter(s => s.projectStatus !== 'pylon-pending-review' && s.projectStatus !== 'complete' && s.projectStatus !== 'contract-signed').length;

  const closedSalesKpis = [
    { label: 'Total Closed Sales', value: totalSales.toString(), icon: Trophy, color: '#5FB854' },
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`, icon: DollarSign, color: '#5FB854' },
    { label: 'Avg Deal Size', value: `$${avgDealSize.toLocaleString('en-AU', { maximumFractionDigits: 0 })}`, icon: TrendingUp, color: '#FFB347' },
  ];

  return (
    <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-lg bg-[#5FB854]/10 flex items-center justify-center">
          <Trophy size={20} className="text-[#5FB854]" />
        </div>
        <div>
          <h3 className="text-white font-semibold" style={{ fontFamily: 'Urbanist' }}>
            Closed Sales
          </h3>
          <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
            Revenue & project status summary
          </p>
        </div>
      </div>

      {/* Revenue KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        {closedSalesKpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-[#0A0A0A] rounded-lg p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: kpi.color }} />
                <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                  {kpi.label}
                </span>
              </div>
              <p className="text-white text-xl font-bold" style={{ fontFamily: 'Space Mono' }}>
                {kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Status Breakdown */}
      <div className="flex flex-wrap gap-3 mb-5">
        {pendingReview > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-300 text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
              {pendingReview} Pending Review
            </span>
          </div>
        )}
        {inProgress > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#5FB854]/10 border border-[#5FB854]/30">
            <div className="w-2 h-2 rounded-full bg-[#5FB854]" />
            <span className="text-[#5FB854] text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
              {inProgress} In Progress
            </span>
          </div>
        )}
        {completed > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-emerald-300 text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
              {completed} Complete
            </span>
          </div>
        )}
      </div>

      {/* Recent Closings */}
      {activeSales.length > 0 && (
        <div>
          <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-3" style={{ fontFamily: 'General Sans' }}>
            Recent Closings
          </h4>
          <div className="space-y-2">
            {activeSales
              .sort((a, b) => (b.contractSignedDate || b.createdAt) - (a.contractSignedDate || a.createdAt))
              .slice(0, 5)
              .map((sale) => (
                <div key={sale.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#0A0A0A] border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-[#5FB854]/10 flex items-center justify-center flex-shrink-0">
                    <Trophy size={14} className="text-[#5FB854]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'General Sans' }}>
                      {sale.customerName}
                    </p>
                    <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                      {sale.contractSignedDate
                        ? new Date(sale.contractSignedDate).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                        : 'Date pending'
                      }
                    </p>
                  </div>
                  <span className="text-white text-sm font-bold flex-shrink-0" style={{ fontFamily: 'Space Mono' }}>
                    ${parseFloat(sale.totalContractPrice).toLocaleString('en-AU', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OverviewPanel({ leads, lastUpdated }: OverviewPanelProps) {
  const metrics = getMetrics(leads);
  const productData = getProductBreakdown(leads);
  const outcomeData = getOutcomeBreakdown(leads);

  // Today's meetings query
  const { data: todayData, isLoading: meetingsLoading } = trpc.meetings.today.useQuery(
    { timezoneOffset: 600 }, // AEST +10
  );

  const kpiCards = [
    { label: 'Total Leads', value: metrics.total, icon: Users, color: '#5FB854' },
    { label: 'Pending', value: metrics.pending, icon: Clock, color: '#FFB347' },
    { label: 'Proposals Sent', value: metrics.proposalSent, icon: Send, color: '#5FB854' },
    { label: 'Awaiting Info', value: metrics.awaitingInfo, icon: FileText, color: '#B0B1B5' },
    { label: 'Received Info', value: metrics.receivedInfo, icon: CheckCircle, color: '#5FB854' },
    { label: 'Rejected', value: metrics.rejected, icon: XCircle, color: '#EF4444' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Hero Banner */}
      <div className="relative h-[160px] rounded-2xl overflow-hidden">
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310419663031440910/h2v5e6f48Qe3weQv3uGzmY/hero-solar-panels-UamqPxJYah9bGcoFnzghYP.webp"
          alt="Solar panels at sunset"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-[#0A0A0A]/70" />
        <div className="relative z-10 h-full flex flex-col justify-center px-8">
          <h2 className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'Urbanist' }}>
            Dashboard Overview
          </h2>
          <p className="text-[#B0B1B5] text-sm" style={{ fontFamily: 'General Sans' }}>
            Leads May 2026 — Real-time data from Google Sheets
          </p>
          {lastUpdated && (
            <div className="flex items-center gap-2 mt-3">
              <div className="w-2 h-2 rounded-full bg-[#5FB854] animate-pulse" />
              <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>
                Last synced {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Today's Meetings Widget */}
      <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#5FB854]/10 flex items-center justify-center">
            <CalendarCheck size={20} className="text-[#5FB854]" />
          </div>
          <div>
            <h3 className="text-white font-semibold" style={{ fontFamily: 'Urbanist' }}>
              Today's Meetings
            </h3>
            <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
              {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Melbourne' })}
            </p>
          </div>
        </div>

        {meetingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#5FB854] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !todayData?.meetings || todayData.meetings.length === 0 ? (
          <div className="text-center py-6">
            <CalendarCheck size={32} className="text-[#7A7B80] mx-auto mb-2 opacity-50" />
            <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
              No meetings scheduled for today
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayData.meetings.map((meeting) => {
              const startTime = new Date(meeting.meetingStartTime);
              const endTime = new Date(meeting.meetingEndTime);
              const timeStr = `${startTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Melbourne' })} – ${endTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Melbourne' })}`;
              const isNow = Date.now() >= meeting.meetingStartTime && Date.now() <= meeting.meetingEndTime;

              return (
                <div
                  key={meeting.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border transition-all duration-200 ${
                    isNow
                      ? 'border-[#5FB854]/50 bg-[#5FB854]/5'
                      : 'border-white/5 bg-[#0A0A0A] hover:border-white/10'
                  }`}
                >
                  {/* Time indicator */}
                  <div className="flex flex-col items-center shrink-0 w-16">
                    <span className="text-white text-sm font-bold" style={{ fontFamily: 'Space Mono' }}>
                      {startTime.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Melbourne' })}
                    </span>
                    {isNow && (
                      <span className="text-[#5FB854] text-[10px] font-bold uppercase mt-1">NOW</span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className={`w-0.5 h-10 rounded-full ${isNow ? 'bg-[#5FB854]' : 'bg-white/10'}`} />

                  {/* Meeting details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'General Sans' }}>
                      {meeting.customerName}
                    </p>
                    <p className="text-[#7A7B80] text-xs mt-0.5" style={{ fontFamily: 'General Sans' }}>
                      {timeStr} · {meeting.durationMinutes}min
                    </p>
                    {meeting.location && (
                      <div className="flex items-center gap-1 mt-1">
                        <MapPin size={10} className="text-[#7A7B80] shrink-0" />
                        <p className="text-[#7A7B80] text-xs truncate" style={{ fontFamily: 'General Sans' }}>
                          {meeting.location}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isNow ? 'bg-[#5FB854] animate-pulse' : 'bg-[#FFB347]'}`} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-[#111111] border border-white/5 rounded-xl p-6 transition-all duration-300 hover:border-[#5FB854]/30 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
            >
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${card.color}15` }}
                >
                  <Icon size={20} style={{ color: card.color }} />
                </div>
                <span
                  className="text-3xl font-bold text-white"
                  style={{ fontFamily: 'Space Mono' }}
                >
                  {card.value}
                </span>
              </div>
              <p className="text-[#B0B1B5] text-sm" style={{ fontFamily: 'General Sans' }}>
                {card.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Closed Sales Summary */}
      <ClosedSalesSummary />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Product Breakdown Pie Chart */}
        <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'Urbanist' }}>
            Product Breakdown
          </h3>
          <div className="h-[250px]" style={{ minWidth: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {productData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111111',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontFamily: 'General Sans',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {productData.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>
                  {item.name} ({item.value})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Discovery Bar Chart */}
        <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'Urbanist' }}>
            Lead Discovery
          </h3>
          <div className="h-[250px]" style={{ minWidth: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={outcomeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="#7A7B80" style={{ fontFamily: 'Space Mono', fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#7A7B80"
                  width={140}
                  style={{ fontFamily: 'General Sans', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#111111',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#FFFFFF',
                    fontFamily: 'General Sans',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" fill="#5FB854" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-6" style={{ fontFamily: 'Urbanist' }}>
          Sales Pipeline Funnel
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Total Leads', value: metrics.total, pct: 100, color: '#5FB854' },
            { label: 'Received Information', value: metrics.receivedInfo, pct: metrics.total > 0 ? Math.round((metrics.receivedInfo / metrics.total) * 100) : 0, color: '#5FB854' },
            { label: 'Proposals Sent', value: metrics.proposalSent, pct: metrics.total > 0 ? Math.round((metrics.proposalSent / metrics.total) * 100) : 0, color: '#FFB347' },
            { label: 'Pending Decision', value: metrics.pending, pct: metrics.total > 0 ? Math.round((metrics.pending / metrics.total) * 100) : 0, color: '#B0B1B5' },
          ].map((stage) => (
            <div key={stage.label} className="flex items-center gap-4">
              <span className="text-[#B0B1B5] text-sm w-44 shrink-0" style={{ fontFamily: 'General Sans' }}>
                {stage.label}
              </span>
              <div className="flex-1 h-8 bg-[#0A0A0A] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end pr-3"
                  style={{
                    width: `${Math.max(stage.pct, 5)}%`,
                    backgroundColor: stage.color,
                  }}
                >
                  <span className="text-[#0A0A0A] text-xs font-bold" style={{ fontFamily: 'Space Mono' }}>
                    {stage.value}
                  </span>
                </div>
              </div>
              <span className="text-[#7A7B80] text-xs w-10 text-right" style={{ fontFamily: 'Space Mono' }}>
                {stage.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lead Source Summary */}
      <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'Urbanist' }}>
          Lead Source
        </h3>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#5FB854]/10 flex items-center justify-center">
            <Users size={24} className="text-[#5FB854]" />
          </div>
          <div>
            <p className="text-white text-lg font-bold" style={{ fontFamily: 'Space Mono' }}>
              Solar Quotes
            </p>
            <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
              Primary lead generation channel — {leads.length} leads this month
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
