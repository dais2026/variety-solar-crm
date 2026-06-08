import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Zap, 
  ExternalLink,
  Activity,
  UserPlus,
  Calculator,
  MessageSquare,
  Trophy,
  ClipboardList,
  CalendarCheck,
  Sun,
  Mail,
  Upload,
  Settings
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasUnreadSms?: boolean;
  hasUnreadEmailOpens?: boolean;
}

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'pipeline', label: 'Pipeline', icon: BarChart3 },
  { id: 'products', label: 'Products', icon: Zap },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'new-customer', label: 'New Customer', icon: UserPlus },
  { id: 'price-calculator', label: 'Price Calculator', icon: Calculator },
  { id: 'sms', label: 'SMS Broadcast', icon: MessageSquare },
  { id: 'close-sale', label: 'Close Sale', icon: Trophy },
  { id: 'closed-sales', label: 'Closed Sales', icon: ClipboardList },
  { id: 'meetings', label: 'Meetings Sent', icon: CalendarCheck },
  { id: 'solar-quotes', label: 'Solar Quotes', icon: Sun },
  { id: 'email-tracking', label: 'Email Tracking', icon: Mail },
  { id: 'bulk-pylon-import', label: 'Bulk Import', icon: Upload },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeTab, onTabChange, hasUnreadSms = false, hasUnreadEmailOpens = false }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-[#0A0A0A] border-r border-white/5 flex flex-col z-50">
      {/* Logo Area */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#5FB854]/15 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-[#5FB854]" />
          </div>
          <div>
            <h1 className="text-white font-bold text-sm tracking-wider" style={{ fontFamily: 'Urbanist' }}>
              VARIETY SOLAR
            </h1>
            <p className="text-[#7A7B80] text-[10px] tracking-wide" style={{ fontFamily: 'General Sans' }}>
              CRM Dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <p className="text-[#7A7B80] text-[10px] uppercase tracking-[0.2em] mb-4 px-2" style={{ fontFamily: 'General Sans' }}>
          Navigation
        </p>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const showSmsDot = tab.id === 'sms' && hasUnreadSms && !isActive;
          const showEmailDot = tab.id === 'email-tracking' && hasUnreadEmailOpens && !isActive;
          const showNotificationDot = showSmsDot || showEmailDot;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 ease-out relative ${
                isActive
                  ? 'bg-[#5FB854] border-[#5FB854] text-[#0A0A0A] font-semibold'
                  : 'border-white/10 text-[#B0B1B5] hover:bg-white/5 hover:border-white/15 hover:text-white'
              }`}
              style={{ fontFamily: 'General Sans', fontSize: '13px' }}
            >
              <Icon size={16} strokeWidth={isActive ? 2.5 : 1.5} />
              <span>{tab.label}</span>
              {showNotificationDot && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F5A623] opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[#F5A623]" />
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Pylon Link */}
      <div className="p-4 border-t border-white/5">
        <a
          href="https://app.getpylon.com/app"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-[#B0B1B5] hover:bg-white/5 hover:border-white/15 hover:text-white transition-all duration-200"
          style={{ fontFamily: 'General Sans', fontSize: '13px' }}
        >
          <ExternalLink size={16} strokeWidth={1.5} />
          <span>Pylon Programme</span>
        </a>
      </div>

      {/* Copyright */}
      <div className="p-4 pt-2 border-t border-white/5">
        <p className="text-[#7A7B80] text-[10px] text-center leading-relaxed" style={{ fontFamily: 'General Sans' }}>
          &copy; Variety Solar<br />
          George Fotopoulos
        </p>
      </div>
    </aside>
  );
}
