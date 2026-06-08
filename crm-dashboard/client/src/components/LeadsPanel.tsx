import { Lead } from '@/hooks/useSheetData';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Filter, ChevronDown, ChevronUp, Phone, Mail, MapPin, Zap, Flame, Sun, Battery, Car, FileText, Trophy, Hash, DollarSign, ExternalLink, Trash2, Calendar } from 'lucide-react';
import ScheduleMeetingModal from './ScheduleMeetingModal';
import { ComposeEmailDialog } from './ComposeEmailDialog';
import DiscoveryRecorder from './DiscoveryRecorder';
import LeadTranscriptDropdown from './LeadTranscriptDropdown';
import { useSavedPricing } from '@/hooks/useSavedPricing';
import { trpc } from '@/lib/trpc';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface LeadsPanelProps {
  leads: Lead[];
  onCloseSale?: (lead: Lead) => void;
  onLeadDeleted?: () => void;
}

type SortField = 'name' | 'dateStamp' | 'product' | 'outcome' | 'saleStatus';
type SortDir = 'asc' | 'desc';

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

type DateFilter = 'all' | 'today' | 'this_week' | 'last_7_days' | 'last_30_days';

function parseLeadDate(d: string): Date | null {
  if (!d) return null;
  const dotParts = d.split('.');
  if (dotParts.length === 3) {
    const day = parseInt(dotParts[0], 10);
    const month = parseInt(dotParts[1], 10) - 1;
    const year = dotParts[2].length === 2 ? 2000 + parseInt(dotParts[2], 10) : parseInt(dotParts[2], 10);
    return new Date(year, month, day);
  }
  const slashParts = d.split('/');
  if (slashParts.length === 3) {
    const day = parseInt(slashParts[0], 10);
    const month = parseInt(slashParts[1], 10) - 1;
    const year = slashParts[2].length === 2 ? 2000 + parseInt(slashParts[2], 10) : parseInt(slashParts[2], 10);
    return new Date(year, month, day);
  }
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isToday(d: string): boolean {
  const parsed = parseLeadDate(d);
  if (!parsed) return false;
  const now = new Date();
  return parsed.getDate() === now.getDate() && parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
}

// Collapsible quote dropdown component
function QuoteDropdown({ quote }: { quote: { id: number; savedAt: number; totalPrice: number; items: { label: string; price: number }[]; solarSTCs: number; batterySTCs: number; stcPrice: number; rebates: { id: string; label: string; amount: number }[] } }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg bg-[#0A0A0A] border border-white/5 overflow-hidden">
      {/* Clickable quote header */}
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/3 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <FileText size={12} className="text-[#7A7B80]" />
          <span className="text-white text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
            Quote #{quote.id}
          </span>
          <span className="text-[#7A7B80] text-[10px]" style={{ fontFamily: 'General Sans' }}>
            {new Date(quote.savedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(quote.savedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#5FB854] text-sm font-bold" style={{ fontFamily: 'Space Mono' }}>
            ${quote.totalPrice.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </span>
          {expanded ? <ChevronUp size={14} className="text-[#7A7B80]" /> : <ChevronDown size={14} className="text-[#7A7B80]" />}
        </div>
      </button>
      {/* Expandable content */}
      {expanded && (
        <>
          <div className="px-4 py-2 border-t border-white/5">
            {quote.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 border-b border-white/3 last:border-0">
                <span className="text-[#C4C4C4] text-xs" style={{ fontFamily: 'General Sans' }}>
                  {item.label}
                </span>
                <span className={`text-xs font-medium ${item.price < 0 ? 'text-[#EF4444]' : 'text-white'}`} style={{ fontFamily: 'Space Mono' }}>
                  {item.price < 0 ? '-' : ''}${Math.abs(item.price).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
          {(quote.solarSTCs > 0 || quote.batterySTCs > 0 || quote.rebates.length > 0) && (
            <div className="px-4 py-2 border-t border-white/5 bg-[#0D0D0D]">
              {quote.solarSTCs > 0 && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                    Solar STCs ({quote.solarSTCs} x ${quote.stcPrice.toFixed(2)})
                  </span>
                  <span className="text-[#EF4444] text-xs font-medium" style={{ fontFamily: 'Space Mono' }}>
                    -${(quote.solarSTCs * quote.stcPrice).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {quote.batterySTCs > 0 && (
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                    Battery STCs ({quote.batterySTCs} x ${quote.stcPrice.toFixed(2)})
                  </span>
                  <span className="text-[#EF4444] text-xs font-medium" style={{ fontFamily: 'Space Mono' }}>
                    -${(quote.batterySTCs * quote.stcPrice).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {quote.rebates.map((rebate) => (
                <div key={rebate.id} className="flex items-center justify-between py-1.5">
                  <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                    {rebate.label}
                  </span>
                  <span className="text-[#EF4444] text-xs font-medium" style={{ fontFamily: 'Space Mono' }}>
                    -${rebate.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LeadsPanel({ leads, onCloseSale, onLeadDeleted }: LeadsPanelProps) {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('dateStamp');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterProduct, setFilterProduct] = useState<string>('all');
  const [filterDiscovery, setFilterDiscovery] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<DateFilter>('all');
  const { getMatchesForLead, loading: pricingLoading, error: pricingError } = useSavedPricing();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [scheduleLead, setScheduleLead] = useState<Lead | null>(null);
  const [emailLead, setEmailLead] = useState<Lead | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const LEADS_PER_PAGE = 15;

  const deleteMutation = trpc.sheets.deleteLead.useMutation({
    onSuccess: () => {
      toast.success('Lead deleted successfully');
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setExpandedRow(null);
      onLeadDeleted?.();
    },
    onError: (err) => {
      toast.error(`Failed to delete lead: ${err.message}`);
    },
  });

  // Auto-SMS tracking
  const sentStatus = trpc.autoSms.getSentStatus.useQuery();
  const npuMutation = trpc.autoSms.triggerNpu.useMutation({
    onSuccess: (data) => {
      if (data.alreadySent) {
        toast.info('NPU SMS was already sent to this lead');
      } else if (data.success) {
        toast.success('NPU follow-up SMS sent successfully');
        sentStatus.refetch();
      } else {
        toast.error(data.message || 'Failed to send NPU SMS');
      }
    },
    onError: (err) => toast.error(`Failed to send NPU SMS: ${err.message}`),
  });
  const vmMutation = trpc.autoSms.triggerVoicemail.useMutation({
    onSuccess: (data) => {
      if (data.alreadySent) {
        toast.info('Voicemail SMS was already sent to this lead');
      } else if (data.success) {
        toast.success('Voicemail follow-up SMS sent successfully');
        sentStatus.refetch();
      } else {
        toast.error(data.message || 'Failed to send Voicemail SMS');
      }
    },
    onError: (err) => toast.error(`Failed to send Voicemail SMS: ${err.message}`),
  });

  const products = useMemo(() => {
    const set = new Set(leads.map(l => l.product).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [leads]);

  const discoveryStages = useMemo(() => {
    const set = new Set(leads.map(l => l.outcome).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [leads]);

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        l.address.toLowerCase().includes(q) ||
        l.contactNumber.includes(q)
      );
    }

    if (filterProduct !== 'all') {
      result = result.filter(l => l.product === filterProduct);
    }

    if (filterDiscovery !== 'all') {
      result = result.filter(l => l.outcome === filterDiscovery);
    }

    if (filterDate !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      result = result.filter(l => {
        const parsed = parseLeadDate(l.dateStamp);
        if (!parsed) return false;
        switch (filterDate) {
          case 'today':
            return parsed >= today;
          case 'this_week': {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            return parsed >= startOfWeek;
          }
          case 'last_7_days': {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            return parsed >= sevenDaysAgo;
          }
          case 'last_30_days': {
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);
            return parsed >= thirtyDaysAgo;
          }
          default:
            return true;
        }
      });
    }

    result.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      let cmp: number;
      if (sortField === 'dateStamp') {
        // Parse dates for proper chronological sorting
        const parseDate = (d: string) => {
          if (!d) return 0;
          // Handle DD.MM.YY format (e.g., 26.05.26)
          const dotParts = d.split('.');
          if (dotParts.length === 3) {
            const day = dotParts[0];
            const month = dotParts[1];
            const year = dotParts[2].length === 2 ? `20${dotParts[2]}` : dotParts[2];
            return new Date(`${year}-${month}-${day}`).getTime() || 0;
          }
          // Handle DD/MM/YYYY format
          const slashParts = d.split('/');
          if (slashParts.length === 3) {
            const year = slashParts[2].length === 2 ? `20${slashParts[2]}` : slashParts[2];
            return new Date(`${year}-${slashParts[1]}-${slashParts[0]}`).getTime() || 0;
          }
          return new Date(d).getTime() || 0;
        };
        cmp = parseDate(aVal) - parseDate(bVal);
      } else {
        cmp = aVal.localeCompare(bVal);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [leads, search, filterProduct, filterDiscovery, filterDate, sortField, sortDir]);

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / LEADS_PER_PAGE));

  // Clamp currentPage when filteredLeads shrinks (e.g. after delete or refresh)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
      setExpandedRow(null);
    }
  }, [totalPages, currentPage]);

  const paginatedLeads = useMemo(() => {
    const startIdx = (currentPage - 1) * LEADS_PER_PAGE;
    return filteredLeads.slice(startIdx, startIdx + LEADS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  // Reset to page 1 when filters change
  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
    setExpandedRow(null);
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setCurrentPage(1);
    setExpandedRow(null);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
            All Leads
          </h2>
          <p className="text-[#7A7B80] text-sm mt-1" style={{ fontFamily: 'General Sans' }}>
            {filteredLeads.length} of {leads.length} leads{totalPages > 1 ? ` • Page ${currentPage} of ${totalPages}` : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7B80]" />
          <input
            type="text"
            placeholder="Search by name, email, address, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); setExpandedRow(null); }}
            className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 transition-colors placeholder:text-[#7A7B80]"
            style={{ fontFamily: 'General Sans' }}
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7B80]" />
          <select
            value={filterProduct}
            onChange={(e) => { setFilterProduct(e.target.value); setCurrentPage(1); setExpandedRow(null); }}
            className="bg-[#111111] border border-white/10 rounded-xl pl-10 pr-8 py-3 text-white text-sm appearance-none focus:outline-none focus:border-[#5FB854]/50 transition-colors"
            style={{ fontFamily: 'General Sans' }}
          >
            {products.map(p => (
              <option key={p} value={p}>{p === 'all' ? 'All Products' : p}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select
            value={filterDiscovery}
            onChange={(e) => { setFilterDiscovery(e.target.value); setCurrentPage(1); setExpandedRow(null); }}
            className="bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm appearance-none focus:outline-none focus:border-[#5FB854]/50 transition-colors"
            style={{ fontFamily: 'General Sans' }}
          >
            {discoveryStages.map(d => (
              <option key={d} value={d}>{d === 'all' ? 'All Discovery' : d}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value as DateFilter); setCurrentPage(1); setExpandedRow(null); }}
            className="bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm appearance-none focus:outline-none focus:border-[#5FB854]/50 transition-colors"
            style={{ fontFamily: 'General Sans' }}
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="this_week">This Week</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111111] border border-white/5 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-[#0A0A0A]/50">
                <th
                  className="text-left px-4 py-3.5 text-[#7A7B80] text-[11px] uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('name')}
                  style={{ fontFamily: 'General Sans' }}
                >
                  <span className="flex items-center gap-1">Name <SortIcon field="name" /></span>
                </th>
                <th className="text-left px-4 py-3.5 text-[#7A7B80] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                  Contact
                </th>
                <th
                  className="text-left px-4 py-3.5 text-[#7A7B80] text-[11px] uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('outcome')}
                  style={{ fontFamily: 'General Sans' }}
                >
                  <span className="flex items-center gap-1">Discovery <SortIcon field="outcome" /></span>
                </th>
                <th
                  className="text-left px-4 py-3.5 text-[#7A7B80] text-[11px] uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('saleStatus')}
                  style={{ fontFamily: 'General Sans' }}
                >
                  <span className="flex items-center gap-1">Status <SortIcon field="saleStatus" /></span>
                </th>
                <th className="text-left px-4 py-3.5 text-[#7A7B80] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.map((lead, idx) => (
                <>
                  <tr
                    key={`${lead.name}-${idx}`}
                    className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer ${isToday(lead.dateStamp) ? 'bg-[#5FB854]/[0.04] border-l-2 border-l-[#5FB854]' : ''}`}
                    onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-white text-sm font-medium" style={{ fontFamily: 'General Sans' }}>
                          {lead.name}
                        </p>
                        <p className="text-[#7A7B80] text-xs mt-0.5 truncate max-w-[200px]" style={{ fontFamily: 'General Sans' }}>
                          {lead.address}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'Space Mono' }}>
                          {lead.contactNumber}
                        </p>
                        <p className="text-[#7A7B80] text-xs mt-0.5 truncate max-w-[180px]" style={{ fontFamily: 'General Sans' }}>
                          {lead.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getStatusColor(lead.outcome) }}
                        />
                        <span className="text-[#B0B1B5] text-sm" style={{ fontFamily: 'General Sans' }}>
                          {lead.outcome || '—'}
                        </span>
                        {sentStatus.data?.npu.includes(lead.contactNumber) && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400">NPU</span>
                        )}
                        {sentStatus.data?.voicemail.includes(lead.contactNumber) && (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">VM</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium"
                        style={{
                          backgroundColor: `${getStatusColor(lead.saleStatus)}15`,
                          color: getStatusColor(lead.saleStatus),
                          fontFamily: 'General Sans',
                        }}
                      >
                        {lead.saleStatus || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="flex items-center gap-2">
                        <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'Space Mono' }}>
                          {lead.dateStamp}
                        </span>
                        {isToday(lead.dateStamp) && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#5FB854]/20 text-[#5FB854] text-[10px] font-semibold uppercase" style={{ fontFamily: 'General Sans' }}>
                            Today
                          </span>
                        )}
                      </span>
                    </td>
                  </tr>
                  {/* Expanded Row Detail */}
                  {expandedRow === idx && (
                    <tr key={`expanded-${idx}`} className="bg-[#0A0A0A]/50">
                      <td colSpan={6} className="px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div className="flex items-center gap-2">
                            <Phone size={14} className="text-[#7A7B80]" />
                            <div>
                              <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider">Phone</p>
                              <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'Space Mono' }}>{lead.contactNumber}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail size={14} className="text-[#7A7B80]" />
                            <div>
                              <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider">Email</p>
                              <p className="text-[#B0B1B5] text-xs">{lead.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-[#7A7B80]" />
                            <div>
                              <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider">Address</p>
                              <p className="text-[#B0B1B5] text-xs">{lead.address}</p>
                            </div>
                          </div>
                          <div>
                            <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider">Lead Source</p>
                            <p className="text-[#B0B1B5] text-xs">{lead.leadSource || '—'}</p>
                          </div>
                          {lead.brands && (
                            <div>
                              <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider">Brands</p>
                              <p className="text-[#B0B1B5] text-xs">{lead.brands}</p>
                            </div>
                          )}
                          {lead.size && (
                            <div>
                              <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider">Size</p>
                              <p className="text-[#B0B1B5] text-xs">{lead.size}</p>
                            </div>
                          )}
                          {lead.phases && (
                            <div>
                              <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider">Phases</p>
                              <p className="text-[#B0B1B5] text-xs">{lead.phases}</p>
                            </div>
                          )}
                          {lead.status && (
                            <div>
                              <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider">Status Detail</p>
                              <p className="text-[#B0B1B5] text-xs">{lead.status}</p>
                            </div>
                          )}
                        </div>

                        {/* Saved Pricing Reference */}
                        {(() => {
                          if (pricingLoading) {
                            return (
                              <div className="mt-4 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                  <Hash size={14} className="text-[#7A7B80] animate-pulse" />
                                  <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>Loading pricing data...</span>
                                </div>
                              </div>
                            );
                          }
                          if (pricingError) {
                            return (
                              <div className="mt-4 pt-4 border-t border-white/5">
                                <div className="flex items-center gap-2">
                                  <Hash size={14} className="text-[#EF4444]" />
                                  <span className="text-[#EF4444] text-xs" style={{ fontFamily: 'General Sans' }}>Unable to load pricing data</span>
                                </div>
                              </div>
                            );
                          }
                          const pricingMatches = getMatchesForLead(lead.name);
                          if (pricingMatches.length === 0) return null;
                          return (
                            <div className="mt-4 pt-4 border-t border-white/5">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <Hash size={14} className="text-[#FFB347]" />
                                  <h4 className="text-white text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                                    Saved Pricing
                                  </h4>
                                </div>
                                <a
                                  href={`https://pricecalculator-varietysolar.manus.space/?code=8GSgWY6DXsXSU8gbRmpcTy`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-[#7A7B80] hover:text-[#FFB347] transition-colors text-[10px]"
                                  style={{ fontFamily: 'General Sans' }}
                                >
                                  Open Calculator <ExternalLink size={10} />
                                </a>
                              </div>
                              <div className="space-y-4">
                                {pricingMatches.map((match) => (
                                  <div key={match.id} className="space-y-3">
                                    {/* Header with ref number and quote count */}
                                    <div className="flex items-center gap-3">
                                      <span className="text-[#FFB347] text-xs font-semibold" style={{ fontFamily: 'Space Mono' }}>
                                        {match.referenceNumber}
                                      </span>
                                      <span className="text-[#7A7B80] text-[10px]" style={{ fontFamily: 'General Sans' }}>
                                        {match.quoteCount} {match.quoteCount === 1 ? 'quote' : 'quotes'}
                                      </span>
                                    </div>
                                    {/* Each quote - collapsible */}
                                    {match.quotes.map((quote) => (
                                      <QuoteDropdown key={quote.id} quote={quote} />
                                    ))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Notes */}
                        {lead.notes && (
                          <div className="mt-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText size={14} className="text-[#5FB854]" />
                              <h4 className="text-white text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                                Notes
                              </h4>
                            </div>
                            <p className="text-[#B0B1B5] text-sm leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'General Sans' }}>
                              {lead.notes}
                            </p>
                          </div>
                        )}

                        {/* Electrification Profile */}
                        {(lead.rooftopSolar || lead.hotWater || lead.heatingCooling || lead.cooktop || lead.product2 || lead.vppNightUse || lead.ev || lead.svr) && (
                          <div className="mt-4 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-2 mb-3">
                              <Zap size={14} className="text-[#5FB854]" />
                              <h4 className="text-white text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                                Electrification Profile
                              </h4>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                              {lead.rooftopSolar && (
                                <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-white/5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Sun size={11} className="text-[#FFB347]" />
                                    <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Rooftop Solar</p>
                                  </div>
                                  <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{lead.rooftopSolar}</p>
                                </div>
                              )}
                              {lead.hotWater && (
                                <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-white/5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Flame size={11} className="text-[#EF4444]" />
                                    <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Hot Water</p>
                                  </div>
                                  <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{lead.hotWater}</p>
                                </div>
                              )}
                              {lead.heatingCooling && (
                                <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-white/5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Zap size={11} className="text-[#8B5CF6]" />
                                    <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Heating/Cooling</p>
                                  </div>
                                  <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{lead.heatingCooling}</p>
                                </div>
                              )}
                              {lead.cooktop && (
                                <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-white/5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Flame size={11} className="text-[#FFB347]" />
                                    <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Cooktop</p>
                                  </div>
                                  <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{lead.cooktop}</p>
                                </div>
                              )}
                              {lead.product2 && (
                                <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-white/5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Battery size={11} className="text-[#5FB854]" />
                                    <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Product 2</p>
                                  </div>
                                  <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{lead.product2}</p>
                                </div>
                              )}
                              {lead.vppNightUse && (
                                <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-white/5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Battery size={11} className="text-[#8B5CF6]" />
                                    <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>VPP/Night Use</p>
                                  </div>
                                  <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{lead.vppNightUse}</p>
                                </div>
                              )}
                              {lead.ev && (
                                <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-white/5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Car size={11} className="text-[#5FB854]" />
                                    <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>EV</p>
                                  </div>
                                  <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{lead.ev}</p>
                                </div>
                              )}
                              {lead.svr && (
                                <div className="p-2.5 rounded-lg bg-[#0A0A0A] border border-white/5">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Zap size={11} className="text-[#FFB347]" />
                                    <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>SVR</p>
                                  </div>
                                  <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{lead.svr}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Actions Row */}
                        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3">
                          {onCloseSale && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onCloseSale(lead); }}
                              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97]"
                              style={{ fontFamily: 'General Sans' }}
                            >
                              <Trophy size={14} />
                              Close This Deal
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); npuMutation.mutate({ leadName: lead.name, leadPhone: lead.contactNumber }); }}
                            disabled={npuMutation.isPending || sentStatus.data?.npu.includes(lead.contactNumber)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 text-orange-400 font-semibold text-sm transition-all duration-160 hover:bg-orange-500/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ fontFamily: 'General Sans' }}
                          >
                            <Phone size={14} />
                            {sentStatus.data?.npu.includes(lead.contactNumber) ? 'NPU Sent' : 'Called NPU'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); vmMutation.mutate({ leadName: lead.name, leadPhone: lead.contactNumber }); }}
                            disabled={vmMutation.isPending || sentStatus.data?.voicemail.includes(lead.contactNumber)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 text-amber-400 font-semibold text-sm transition-all duration-160 hover:bg-amber-500/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ fontFamily: 'General Sans' }}
                          >
                            <Phone size={14} />
                            {sentStatus.data?.voicemail.includes(lead.contactNumber) ? 'VM Sent' : 'Left Voicemail'}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setScheduleLead(lead); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5FB854]/10 text-[#5FB854] font-semibold text-sm transition-all duration-160 hover:bg-[#5FB854]/20 active:scale-[0.97]"
                            style={{ fontFamily: 'General Sans' }}
                          >
                            <Calendar size={14} />
                            Schedule Meeting
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setEmailLead(lead); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/10 text-blue-400 font-semibold text-sm transition-all duration-160 hover:bg-blue-500/20 active:scale-[0.97]"
                            style={{ fontFamily: 'General Sans' }}
                          >
                            <Mail size={14} />
                            Send Email
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(lead); setDeleteDialogOpen(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EF4444]/10 text-[#EF4444] font-semibold text-sm transition-all duration-160 hover:bg-[#EF4444]/20 active:scale-[0.97]"
                            style={{ fontFamily: 'General Sans' }}
                          >
                            <Trash2 size={14} />
                            Delete Lead
                          </button>
                        </div>

                        {/* Solar Quotes Transcript Dropdown */}
                        <LeadTranscriptDropdown leadName={lead.name} />

                        {/* Discovery Recordings Section */}
                        <div className="mt-4">
                          <DiscoveryRecorder
                            leadPhone={lead.contactNumber}
                            leadName={lead.name}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
        {filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
              No leads found matching your criteria.
            </p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
              Showing {((currentPage - 1) * LEADS_PER_PAGE) + 1}–{Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} leads
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCurrentPage(p => Math.max(1, p - 1)); setExpandedRow(null); }}
                disabled={currentPage === 1}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                style={{ fontFamily: 'General Sans' }}
              >
                <ChevronUp size={14} className="rotate-[-90deg]" />
                <span className="hidden sm:inline">Previous</span>
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => { setCurrentPage(page); setExpandedRow(null); }}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      page === currentPage
                        ? 'bg-[#5FB854] text-[#0A0A0A]'
                        : 'text-[#7A7B80] hover:text-white hover:bg-white/5'
                    }`}
                    style={{ fontFamily: 'General Sans' }}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages, p + 1)); setExpandedRow(null); }}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition-colors"
                style={{ fontFamily: 'General Sans' }}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronDown size={14} className="rotate-[-90deg]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#111111] border border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white" style={{ fontFamily: 'General Sans' }}>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription className="text-[#7A7B80]" style={{ fontFamily: 'General Sans' }}>
              Are you sure you want to delete <span className="text-white font-medium">{deleteTarget?.name}</span>? This will permanently remove the lead from the Google Sheet and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-transparent border-white/10 text-white hover:bg-white/5"
              style={{ fontFamily: 'General Sans' }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#EF4444] text-white hover:bg-[#DC2626]"
              style={{ fontFamily: 'General Sans' }}
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  deleteMutation.mutate({ name: deleteTarget.name, contactNumber: deleteTarget.contactNumber });
                }
              }}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Schedule Meeting Modal */}
      {scheduleLead && (
        <ScheduleMeetingModal
          lead={{
            name: scheduleLead.name,
            email: scheduleLead.email,
            address: scheduleLead.address,
            contactNumber: scheduleLead.contactNumber,
          }}
          onClose={() => setScheduleLead(null)}
        />
      )}

      {/* Compose Email Dialog */}
      <ComposeEmailDialog
        open={!!emailLead}
        onOpenChange={(open) => { if (!open) setEmailLead(null); }}
        defaultRecipientName={emailLead?.name || ''}
        defaultRecipientEmail={emailLead?.email || ''}
      />
    </div>
  );
}
