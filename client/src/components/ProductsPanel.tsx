import { Lead, getProductBreakdown } from '@/hooks/useSheetData';
import { Battery, Sun, Zap, Car, Flame } from 'lucide-react';

interface ProductsPanelProps {
  leads: Lead[];
}

const productIcons: Record<string, typeof Battery> = {
  'BATTERY': Battery,
  'PV+BATT+EV': Car,
  'PV+BATT': Sun,
  'BATT+HP': Flame,
  'PV': Zap,
};

const productDescriptions: Record<string, string> = {
  'BATTERY': 'Standalone battery storage system',
  'PV+BATT+EV': 'Solar + Battery + EV Charger bundle',
  'PV+BATT': 'Solar panels + Battery storage',
  'BATT+HP': 'Battery + Heat Pump system',
  'PV': 'Solar PV panels only',
};

const productColors: Record<string, string> = {
  'BATTERY': '#5FB854',
  'PV+BATT+EV': '#A3E635',
  'PV+BATT': '#34D399',
  'BATT+HP': '#FBBF24',
  'PV': '#F97316',
};

export default function ProductsPanel({ leads }: ProductsPanelProps) {
  const productData = getProductBreakdown(leads);
  const total = leads.length;
  const sorted = [...productData].sort((a, b) => b.value - a.value);
  const maxValue = sorted.length > 0 ? sorted[0].value : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
          Product Analytics
        </h2>
        <p className="text-[#7A7B80] text-sm mt-1" style={{ fontFamily: 'General Sans' }}>
          Demand breakdown by product category
        </p>
      </div>

      {/* Product Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {productData.map((product) => {
          const Icon = productIcons[product.name] || Zap;
          const pct = Math.round((product.value / total) * 100);
          const color = productColors[product.name] || '#5FB854';
          return (
            <div
              key={product.name}
              className="bg-[#111111] border border-white/5 rounded-xl p-6 transition-all duration-300 hover:border-[#5FB854]/30 hover:scale-[1.02]"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon size={24} style={{ color }} />
                </div>
                <span className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Mono' }}>
                  {product.value}
                </span>
              </div>
              <h4 className="text-white font-semibold text-sm mb-1" style={{ fontFamily: 'Urbanist' }}>
                {product.name}
              </h4>
              <p className="text-[#7A7B80] text-xs mb-3" style={{ fontFamily: 'General Sans' }}>
                {productDescriptions[product.name] || 'Energy solution'}
              </p>
              {/* Progress bar */}
              <div className="h-2 bg-[#0A0A0A] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
              </div>
              <p className="text-[#7A7B80] text-xs mt-2 text-right" style={{ fontFamily: 'Space Mono' }}>
                {pct}% of leads
              </p>
            </div>
          );
        })}
      </div>

      {/* Horizontal Bar Chart — replaces the old radar chart */}
      <div className="bg-[#111111] border border-white/5 rounded-xl p-6">
        <h3 className="text-white font-semibold mb-6" style={{ fontFamily: 'Urbanist' }}>
          Product Demand
        </h3>
        <div className="space-y-4">
          {sorted.map((product, idx) => {
            const pct = total > 0 ? Math.round((product.value / total) * 100) : 0;
            const barWidth = maxValue > 0 ? Math.round((product.value / maxValue) * 100) : 0;
            const color = productColors[product.name] || '#5FB854';
            const Icon = productIcons[product.name] || Zap;
            return (
              <div
                key={product.name}
                className="group"
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                <div className="flex items-center gap-3 mb-1.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <Icon size={16} style={{ color }} />
                  </div>
                  <span className="text-white text-sm font-medium flex-1" style={{ fontFamily: 'General Sans' }}>
                    {product.name}
                  </span>
                  <span className="text-white text-sm font-bold tabular-nums" style={{ fontFamily: 'Space Mono' }}>
                    {product.value}
                  </span>
                  <span className="text-[#7A7B80] text-xs w-10 text-right tabular-nums" style={{ fontFamily: 'Space Mono' }}>
                    {pct}%
                  </span>
                </div>
                <div className="ml-11 h-3 bg-[#0A0A0A] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${barWidth}%`,
                      backgroundColor: color,
                      opacity: 0.85,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend / total */}
        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
          <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
            Total Leads
          </span>
          <span className="text-white text-sm font-bold" style={{ fontFamily: 'Space Mono' }}>
            {total}
          </span>
        </div>
      </div>

      {/* Key Insight */}
      <div className="bg-[#111111] border border-[#5FB854]/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-[#5FB854]/10 flex items-center justify-center shrink-0">
            <Zap size={20} className="text-[#5FB854]" />
          </div>
          <div>
            <h4 className="text-white font-semibold text-sm mb-1" style={{ fontFamily: 'Urbanist' }}>
              Key Insight
            </h4>
            <p className="text-[#B0B1B5] text-sm" style={{ fontFamily: 'General Sans' }}>
              {sorted.length > 0 && (
                <>
                  <strong className="text-white">{sorted[0]?.name}</strong> is the most requested product
                  with {sorted[0]?.value} leads ({Math.round((sorted[0]?.value / total) * 100)}% of total demand).
                  Combined solar + battery solutions account for the majority of enquiries.
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
