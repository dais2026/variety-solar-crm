import { useState } from 'react';
import { 
  Calculator, 
  ExternalLink, 
  Maximize2, 
  Minimize2,
  RefreshCw
} from 'lucide-react';

const CALCULATOR_URL = 'https://pricecalculator-varietysolar.manus.space/?code=8GSgWY6DXsXSU8gbRmpcTy';

export default function PriceCalculatorPanel() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-[100] bg-[#0A0A0A]">
        {/* Fullscreen Top Bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-[#111111] border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5FB854]/10 flex items-center justify-center">
              <Calculator size={16} className="text-[#5FB854]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm" style={{ fontFamily: 'Urbanist' }}>
                System Pricing Calculator
              </h2>
              <p className="text-[#7A7B80] text-[10px]" style={{ fontFamily: 'General Sans' }}>
                Variety Solar — Full Product Catalogue
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg border border-white/10 text-[#B0B1B5] hover:text-white hover:border-white/20 transition-all"
              title="Refresh calculator"
            >
              <RefreshCw size={14} />
            </button>
            <a
              href={CALCULATOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg border border-white/10 text-[#B0B1B5] hover:text-white hover:border-white/20 transition-all"
              title="Open in new tab"
            >
              <ExternalLink size={14} />
            </a>
            <button
              onClick={() => setIsFullscreen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#5FB854] text-[#0A0A0A] font-semibold text-xs transition-all hover:brightness-110 active:scale-[0.97]"
              style={{ fontFamily: 'General Sans' }}
            >
              <Minimize2 size={14} />
              Exit Fullscreen
            </button>
          </div>
        </div>
        {/* Fullscreen iframe */}
        <iframe
          key={iframeKey}
          src={CALCULATOR_URL}
          className="w-full border-0"
          style={{ height: 'calc(100vh - 52px)' }}
          title="Variety Solar Price Calculator"
          allow="clipboard-write"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
            Price Calculator
          </h2>
          <p className="text-[#7A7B80] text-sm mt-1" style={{ fontFamily: 'General Sans' }}>
            Build quotes with the full Variety Solar product catalogue
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg border border-white/10 text-[#B0B1B5] hover:text-white hover:border-white/20 transition-all"
            title="Refresh calculator"
          >
            <RefreshCw size={14} />
          </button>
          <a
            href={CALCULATOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-[#B0B1B5] hover:text-white hover:border-white/20 transition-all text-xs"
            style={{ fontFamily: 'General Sans' }}
          >
            <ExternalLink size={14} />
            Open in New Tab
          </a>
          <button
            onClick={() => setIsFullscreen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-xs transition-all hover:brightness-110 active:scale-[0.97]"
            style={{ fontFamily: 'General Sans' }}
          >
            <Maximize2 size={14} />
            Fullscreen
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Solar + Battery', count: '70+', color: '#5FB854' },
          { label: 'Battery Only', count: '15+', color: '#B0B1B5' },
          { label: 'EV Chargers', count: '5+', color: '#FFB347' },
          { label: 'Heat Pumps', count: '10+', color: '#FF6B6B' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[#111111] border border-white/5 rounded-xl p-4"
          >
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: 'General Sans', color: stat.color }}>
              {stat.label}
            </p>
            <p className="text-white text-lg font-bold" style={{ fontFamily: 'Urbanist' }}>
              {stat.count}
            </p>
            <p className="text-[#7A7B80] text-[10px]" style={{ fontFamily: 'General Sans' }}>
              systems
            </p>
          </div>
        ))}
      </div>

      {/* Embedded Calculator */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden">
        <iframe
          key={iframeKey}
          src={CALCULATOR_URL}
          className="w-full border-0 rounded-2xl"
          style={{ height: 'calc(100vh - 280px)', minHeight: '600px' }}
          title="Variety Solar Price Calculator"
          allow="clipboard-write"
        />
      </div>
    </div>
  );
}
