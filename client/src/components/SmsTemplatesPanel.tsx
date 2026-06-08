import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Save, RotateCcw, MessageSquare } from 'lucide-react';

const DEFAULT_NPU_TEMPLATE = `Hi {name}, we tried to reach you regarding your solar enquiry. Please call us back at your convenience or reply to this message.

With Thanks
-----------------------------------------------
George Fotopoulos
Renewables Strategist and Designer
0419574520
george@varietysolar.com.au
www.varietysolar.com.au`;

const DEFAULT_VOICEMAIL_TEMPLATE = `Hi {name}, we just left you a voicemail regarding your solar enquiry. Please call us back at your convenience or reply to this message.

With Thanks
-----------------------------------------------
George Fotopoulos
Renewables Strategist and Designer
0419574520
george@varietysolar.com.au
www.varietysolar.com.au`;

export default function SmsTemplatesPanel() {
  const { data: templates, refetch } = trpc.autoSms.getTemplates.useQuery();
  const updateMutation = trpc.autoSms.updateTemplate.useMutation({
    onSuccess: () => {
      toast.success('Template saved');
      refetch();
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  const [npuText, setNpuText] = useState('');
  const [vmText, setVmText] = useState('');

  useEffect(() => {
    if (templates) {
      setNpuText(templates.npu || DEFAULT_NPU_TEMPLATE);
      setVmText(templates.voicemail || DEFAULT_VOICEMAIL_TEMPLATE);
    }
  }, [templates]);

  const smsPartsCount = (text: string) => {
    const len = text.length;
    if (len <= 160) return 1;
    return Math.ceil(len / 153);
  };

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-white text-xl font-bold mb-1" style={{ fontFamily: 'General Sans' }}>
        SMS Templates
      </h2>
      <p className="text-[#7A7B80] text-sm mb-6" style={{ fontFamily: 'General Sans' }}>
        Customise the auto-SMS messages sent when you mark a lead as "Called NPU" or "Left Voicemail". Use <code className="text-[#5FB854] bg-[#5FB854]/10 px-1 rounded">{'{name}'}</code> to personalise with the lead's name.
      </p>

      {/* NPU Template */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={16} className="text-orange-400" />
          <h3 className="text-white text-sm font-semibold" style={{ fontFamily: 'General Sans' }}>
            Called NPU Template
          </h3>
        </div>
        <textarea
          value={npuText}
          onChange={(e) => setNpuText(e.target.value)}
          rows={8}
          className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-y focus:outline-none focus:border-[#5FB854]/50 transition-colors"
          style={{ fontFamily: 'General Sans' }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
            {npuText.length} chars · {smsPartsCount(npuText)} SMS part{smsPartsCount(npuText) > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setNpuText(DEFAULT_NPU_TEMPLATE)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-[#7A7B80] text-xs font-medium hover:bg-white/10 transition-colors"
              style={{ fontFamily: 'General Sans' }}
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={() => updateMutation.mutate({ key: 'npu', body: npuText })}
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5FB854] text-[#0A0A0A] text-xs font-semibold hover:brightness-110 transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ fontFamily: 'General Sans' }}
            >
              <Save size={12} />
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Voicemail Template */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare size={16} className="text-amber-400" />
          <h3 className="text-white text-sm font-semibold" style={{ fontFamily: 'General Sans' }}>
            Left Voicemail Template
          </h3>
        </div>
        <textarea
          value={vmText}
          onChange={(e) => setVmText(e.target.value)}
          rows={8}
          className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-3 text-white text-sm resize-y focus:outline-none focus:border-[#5FB854]/50 transition-colors"
          style={{ fontFamily: 'General Sans' }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
            {vmText.length} chars · {smsPartsCount(vmText)} SMS part{smsPartsCount(vmText) > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVmText(DEFAULT_VOICEMAIL_TEMPLATE)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-[#7A7B80] text-xs font-medium hover:bg-white/10 transition-colors"
              style={{ fontFamily: 'General Sans' }}
            >
              <RotateCcw size={12} />
              Reset
            </button>
            <button
              onClick={() => updateMutation.mutate({ key: 'voicemail', body: vmText })}
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#5FB854] text-[#0A0A0A] text-xs font-semibold hover:brightness-110 transition-all active:scale-[0.97] disabled:opacity-50"
              style={{ fontFamily: 'General Sans' }}
            >
              <Save size={12} />
              {updateMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="p-4 rounded-xl bg-[#111111] border border-white/5">
        <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: 'General Sans' }}>
          Preview (with sample name "John")
        </p>
        <p className="text-[#B0B1B5] text-xs whitespace-pre-wrap leading-relaxed" style={{ fontFamily: 'General Sans' }}>
          {npuText.replace(/{name}/g, 'John')}
        </p>
      </div>
    </div>
  );
}
