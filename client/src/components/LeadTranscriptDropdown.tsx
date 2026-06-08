import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, Loader2, Phone, Sparkles } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

interface LeadTranscriptDropdownProps {
  leadName: string;
}

export default function LeadTranscriptDropdown({ leadName }: LeadTranscriptDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [callPrepNotes, setCallPrepNotes] = useState<string | null>(null);
  const [isCallPrepOpen, setIsCallPrepOpen] = useState(false);

  const { data, isLoading, error } = trpc.solarQuotes.getTranscript.useQuery(
    { leadName },
    { enabled: isOpen }
  );

  const generateCallPrep = trpc.solarQuotes.generateCallPrep.useMutation({
    onSuccess: (result) => {
      if (result.notes) {
        setCallPrepNotes(result.notes as string);
        setIsCallPrepOpen(true);
      } else {
        toast.error(result.error || 'Unable to generate call prep notes.');
      }
    },
    onError: (err) => {
      toast.error(`Failed to generate notes: ${err.message}`);
    },
  });

  const transcript = data?.transcript;

  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="flex items-center gap-2 w-full text-left group"
      >
        <FileText size={14} className="text-[#5FB854]" />
        <h4 className="text-white text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
          Solar Quotes Transcript
        </h4>
        <div className="ml-auto">
          {isOpen ? (
            <ChevronUp size={14} className="text-[#7A7B80] group-hover:text-white transition-colors" />
          ) : (
            <ChevronDown size={14} className="text-[#7A7B80] group-hover:text-white transition-colors" />
          )}
        </div>
      </button>

      {isOpen && (
        <div className="mt-3 rounded-xl bg-[#0A0A0A] border border-white/5 p-4 transition-all duration-200">
          {isLoading && (
            <div className="flex items-center gap-2 text-[#7A7B80]">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs" style={{ fontFamily: 'General Sans' }}>Loading transcript...</span>
            </div>
          )}

          {error && (
            <p className="text-[#EF4444] text-xs" style={{ fontFamily: 'General Sans' }}>
              Unable to load transcript.
            </p>
          )}

          {!isLoading && !error && !transcript && (
            <p className="text-[#7A7B80] text-xs italic" style={{ fontFamily: 'General Sans' }}>
              No transcript available for this lead.
            </p>
          )}

          {transcript && (
            <div className="space-y-3">
              {/* Summary header */}
              {transcript.summary && (
                <div className="pb-3 border-b border-white/5">
                  <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: 'General Sans' }}>Summary</p>
                  <p className="text-[#B0B1B5] text-sm leading-relaxed" style={{ fontFamily: 'General Sans' }}>
                    {transcript.summary}
                  </p>
                </div>
              )}

              {/* Metadata row */}
              <div className="flex flex-wrap gap-4 pb-3 border-b border-white/5">
                {transcript.leadRef && (
                  <div>
                    <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Lead Ref</p>
                    <p className="text-[#FFB347] text-xs font-medium" style={{ fontFamily: 'General Sans' }}>{transcript.leadRef}</p>
                  </div>
                )}
                {transcript.leadSource && (
                  <div>
                    <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Source</p>
                    <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{transcript.leadSource}</p>
                  </div>
                )}
                {transcript.leadDate && (
                  <div>
                    <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Lead Date</p>
                    <p className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>{transcript.leadDate}</p>
                  </div>
                )}
              </div>

              {/* AI Call Prep Notes */}
              <div className="pb-3 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-[#F5A623]" />
                    <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                      AI Call Prep Notes
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (callPrepNotes) {
                        setIsCallPrepOpen(!isCallPrepOpen);
                      } else {
                        generateCallPrep.mutate({ leadName });
                      }
                    }}
                    disabled={generateCallPrep.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F5A623]/10 hover:bg-[#F5A623]/20 text-[#F5A623] text-[10px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50"
                    style={{ fontFamily: 'General Sans' }}
                  >
                    {generateCallPrep.isPending ? (
                      <>
                        <Loader2 size={10} className="animate-spin" />
                        Generating...
                      </>
                    ) : callPrepNotes ? (
                      <>
                        {isCallPrepOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        {isCallPrepOpen ? 'Hide' : 'Show'} Notes
                      </>
                    ) : (
                      <>
                        <Sparkles size={10} />
                        Generate
                      </>
                    )}
                  </button>
                </div>

                {isCallPrepOpen && callPrepNotes && (
                  <div className="mt-2 p-3 rounded-lg bg-[#F5A623]/5 border border-[#F5A623]/10">
                    <div className="text-[#E0E0E0] text-xs leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'General Sans' }}>
                      {callPrepNotes}
                    </div>
                  </div>
                )}
              </div>

              {/* Full transcript */}
              <div>
                <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-2" style={{ fontFamily: 'General Sans' }}>Full Email Transcript</p>
                <div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                  <p className="text-[#B0B1B5] text-xs leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'General Sans' }}>
                    {transcript.fullTranscript}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
