import { useState, useMemo } from 'react';
import { useSheetData, Lead } from '@/hooks/useSheetData';
import { useUnreadSms } from '@/hooks/useUnreadSms';
import { trpc } from '@/lib/trpc';
import Sidebar from '@/components/Sidebar';
import SmsNotificationToast from '@/components/SmsNotificationToast';
import OverviewPanel from '@/components/OverviewPanel';
import LeadsPanel from '@/components/LeadsPanel';
import PipelinePanel from '@/components/PipelinePanel';
import ProductsPanel from '@/components/ProductsPanel';
import ActivityPanel from '@/components/ActivityPanel';
import NewCustomerPanel from '@/components/NewCustomerPanel';
import PriceCalculatorPanel from '@/components/PriceCalculatorPanel';
import SmsPanel from '@/components/SmsPanel';
import ClosedSalePanel from '@/components/ClosedSalePanel';
import ClosedSalesListPanel from '@/components/ClosedSalesListPanel';
import SmsTemplatesPanel from '@/components/SmsTemplatesPanel';
import MeetingsSentPanel from '@/components/MeetingsSentPanel';
import SolarQuotesImportsPanel from '@/components/SolarQuotesImportsPanel';
import EmailTrackingPanel from '@/components/EmailTrackingPanel';
import { RefreshCw, Loader2, AlertCircle, ExternalLink, Menu, X } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { leads: rawLeads, loading, error, lastUpdated, refresh } = useSheetData();
  const { hasUnread, newMessages, dismissNotification, dismissAll, markAsRead } = useUnreadSms();
  const { data: emailOpensData } = trpc.emailTracking.recentOpens.useQuery(undefined, { refetchInterval: 60000 });
  const hasUnreadEmailOpens = (emailOpensData?.count ?? 0) > 0;
  const { data: deletedLeads } = trpc.sheets.getDeletedLeads.useQuery();
  const utils = trpc.useUtils();

  // Filter out soft-deleted leads
  const leads = useMemo(() => {
    if (!deletedLeads || deletedLeads.length === 0) return rawLeads;
    const deletedSet = new Set(deletedLeads.map(d => `${d.leadName}|||${d.leadPhone}`));
    return rawLeads.filter(lead => !deletedSet.has(`${lead.name}|||${lead.contactNumber}`));
  }, [rawLeads, deletedLeads]);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const renderPanel = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPanel leads={leads} lastUpdated={lastUpdated} />;
      case 'leads':
        return <LeadsPanel leads={leads} onCloseSale={(lead) => { setSelectedLead(lead); setActiveTab('close-sale'); }} onLeadDeleted={() => { utils.sheets.getDeletedLeads.invalidate(); }} />;
      case 'pipeline':
        return <PipelinePanel leads={leads} />;
      case 'products':
        return <ProductsPanel leads={leads} />;
      case 'activity':
        return <ActivityPanel leads={leads} />;
      case 'new-customer':
        return <NewCustomerPanel onCustomerCreated={refresh} />;
      case 'price-calculator':
        return <PriceCalculatorPanel />;
      case 'sms':
        return <SmsPanel leads={leads} onInboxViewed={markAsRead} />;
      case 'close-sale':
        return <ClosedSalePanel leads={leads} prefillLead={selectedLead} onComplete={() => { setSelectedLead(null); refresh(); }} />;
      case 'closed-sales':
        return <ClosedSalesListPanel />;
      case 'meetings':
        return <MeetingsSentPanel />;
      case 'solar-quotes':
        return <SolarQuotesImportsPanel />;
      case 'email-tracking':
        return <EmailTrackingPanel />;
      case 'settings':
        return <SmsTemplatesPanel />;
      default:
        return <OverviewPanel leads={leads} lastUpdated={lastUpdated} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - always visible on desktop, toggle on mobile */}
      <div className={`lg:block ${mobileMenuOpen ? 'block' : 'hidden'}`}>
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} hasUnreadSms={hasUnread} hasUnreadEmailOpens={hasUnreadEmailOpens} />
      </div>

      {/* Main Content Area */}
      <main className="lg:ml-[220px] min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-[#0A0A0A] border-b border-white/5 px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg border border-white/10 text-white"
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <h1 className="text-base lg:text-lg font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
                CRM 2026
              </h1>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5FB854]/10 border border-[#5FB854]/20">
                <div className="w-2 h-2 rounded-full bg-[#5FB854] animate-pulse" />
                <span className="text-[#5FB854] text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
                  LIVE
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:gap-4">
              {/* Google Sheets Link */}
              <a
                href="https://docs.google.com/spreadsheets/d/1oVFGomjgmbYlX7YJUFWKH0-1snrjCkcBsUC6AW4rmgA/edit?gid=0#gid=0"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-[#B0B1B5] hover:text-white hover:border-white/20 transition-all text-xs"
                style={{ fontFamily: 'General Sans' }}
              >
                <ExternalLink size={14} />
                Open Sheet
              </a>
              {/* Refresh Button */}
              <button
                onClick={async () => {
                  setIsRefreshing(true);
                  refresh();
                  await Promise.all([
                    utils.emailTracking.invalidate(),
                    utils.solarQuotes.invalidate(),
                    utils.sheets.getLeads.invalidate(),
                  ]);
                  // Keep spinner visible for at least 2s so user sees feedback
                  setTimeout(() => setIsRefreshing(false), 2000);
                }}
                disabled={isRefreshing}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-xs transition-all duration-160 hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                style={{ fontFamily: 'General Sans' }}
              >
                <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-4 lg:p-8">
          {/* Loading State */}
          {loading && leads.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-white/5 flex items-center justify-center">
                <Loader2 size={28} className="text-[#5FB854] animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1" style={{ fontFamily: 'Urbanist' }}>
                  Loading Live Data
                </p>
                <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
                  Connecting to Google Sheets...
                </p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && leads.length === 0 && (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 flex items-center justify-center">
                <AlertCircle size={28} className="text-[#EF4444]" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold mb-1" style={{ fontFamily: 'Urbanist' }}>
                  Connection Error
                </p>
                <p className="text-[#7A7B80] text-sm mb-4" style={{ fontFamily: 'General Sans' }}>
                  {error}
                </p>
                <button
                  onClick={refresh}
                  className="px-4 py-2 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all active:scale-[0.97]"
                  style={{ fontFamily: 'General Sans' }}
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Main Panel Content */}
          {(activeTab === 'new-customer' || activeTab === 'price-calculator' || activeTab === 'sms' || activeTab === 'close-sale' || activeTab === 'closed-sales' || activeTab === 'settings' || activeTab === 'email-tracking') && renderPanel()}
          {activeTab !== 'new-customer' && activeTab !== 'price-calculator' && activeTab !== 'sms' && activeTab !== 'close-sale' && activeTab !== 'closed-sales' && activeTab !== 'settings' && activeTab !== 'email-tracking' && leads.length > 0 && renderPanel()}
        </div>
      </main>
      {/* SMS Notification Toast */}
      <SmsNotificationToast
        notifications={newMessages.map(m => ({
          id: String(m.id),
          phone: m.phone,
          message: m.message,
          contactName: m.contactName || undefined,
          timestamp: m.createdAt,
        }))}
        onDismiss={(id) => dismissNotification(Number(id))}
        onViewInbox={() => { dismissAll(); handleTabChange('sms'); }}
      />
    </div>
  );
}
