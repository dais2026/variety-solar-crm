import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Mic, MicOff, Upload, Play, Pause, FileAudio, Loader2, Brain, ChevronDown, ChevronUp, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface DiscoveryRecorderProps {
  leadPhone: string;
  leadName: string;
}

interface RecordingEntry {
  id: number;
  leadPhone: string;
  leadName: string;
  title: string | null;
  audioUrl: string;
  mimeType: string;
  durationSeconds: number | null;
  transcript: string | null;
  aiSummary: string | null;
  transcriptionStatus: string;
  source: string;
  createdAt: number;
}

export default function DiscoveryRecorder({ leadPhone, leadName }: DiscoveryRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedRecording, setExpandedRecording] = useState<number | null>(null);
  const [playingAudio, setPlayingAudio] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch recordings for this lead
  const { data: recordings, refetch } = trpc.recordings.getByLead.useQuery(
    { leadPhone },
    { enabled: !!leadPhone }
  );

  const uploadMutation = trpc.recordings.upload.useMutation({
    onSuccess: async (data) => {
      toast.success('Recording saved successfully');
      refetch();
      // Auto-trigger transcription
      if (data.id) {
        transcribeMutation.mutate({ recordingId: data.id });
      }
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });

  const transcribeMutation = trpc.recordings.transcribe.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Transcription complete');
      } else {
        toast.error(`Transcription failed: ${data.error}`);
      }
      refetch();
    },
    onError: (error) => {
      toast.error(`Transcription error: ${error.message}`);
      refetch();
    },
  });

  const deleteMutation = trpc.recordings.delete.useMutation({
    onSuccess: () => {
      toast.success('Recording deleted');
      refetch();
    },
    onError: (err: any) => toast.error(`Failed to delete: ${err.message}`),
  });

  const summarizeMutation = trpc.recordings.summarize.useMutation({
    onSuccess: () => {
      toast.success('AI summary generated');
      refetch();
    },
    onError: (error) => {
      toast.error(`Summary failed: ${error.message}`);
    },
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        // Convert to base64 and upload
        setIsUploading(true);
        try {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            uploadMutation.mutate({
              leadPhone,
              leadName,
              title: `Discovery Session - ${new Date().toLocaleDateString()}`,
              audioBase64: base64,
              mimeType: 'audio/webm',
              durationSeconds: recordingTime,
              source: 'live_recording',
            });
            setIsUploading(false);
          };
          reader.readAsDataURL(blob);
        } catch {
          setIsUploading(false);
          toast.error('Failed to process recording');
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (error) {
      toast.error('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mp4', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(webm|mp3|wav|ogg|m4a|mp4)$/i)) {
      toast.error('Unsupported audio format. Please use webm, mp3, wav, ogg, or m4a.');
      return;
    }

    // Check file size (16MB limit)
    if (file.size > 16 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 16MB.');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const mimeType = file.type || 'audio/mpeg';
        uploadMutation.mutate({
          leadPhone,
          leadName,
          title: file.name.replace(/\.[^.]+$/, '') || `Voice Memo - ${new Date().toLocaleDateString()}`,
          audioBase64: base64,
          mimeType,
          source: 'upload',
        });
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploading(false);
      toast.error('Failed to read file');
    }

    // Reset the input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const togglePlayback = (recording: RecordingEntry) => {
    if (playingAudio === recording.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudio(null);
    } else {
      // Start playing
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(recording.audioUrl);
      audio.onended = () => setPlayingAudio(null);
      audio.play();
      audioRef.current = audio;
      setPlayingAudio(recording.id);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const parseSummary = (summaryJson: string | null) => {
    if (!summaryJson) return null;
    try {
      return JSON.parse(summaryJson);
    } catch {
      return null;
    }
  };

  return (
    <div className="mt-4 border-t border-white/5 pt-4">
      {/* Recording Controls */}
      <div className="flex items-center gap-3 mb-4">
        <h4 className="text-white text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
          Discovery Recordings
        </h4>
        <div className="flex-1" />

        {/* Live Record Button */}
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isUploading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs font-medium transition-all hover:bg-[#EF4444]/20 active:scale-[0.97] disabled:opacity-50"
            style={{ fontFamily: 'General Sans' }}
          >
            <Mic size={13} />
            Record
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EF4444] text-white text-xs font-medium transition-all hover:brightness-110 active:scale-[0.97] animate-pulse"
            style={{ fontFamily: 'General Sans' }}
          >
            <MicOff size={13} />
            Stop ({formatTime(recordingTime)})
          </button>
        )}

        {/* Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording || isUploading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5FB854]/10 border border-[#5FB854]/20 text-[#5FB854] text-xs font-medium transition-all hover:bg-[#5FB854]/20 active:scale-[0.97] disabled:opacity-50"
          style={{ fontFamily: 'General Sans' }}
        >
          <Upload size={13} />
          Upload
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,.webm,.mp3,.wav,.ogg,.m4a"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Upload/Processing Indicator */}
      {(isUploading || uploadMutation.isPending) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111111] border border-white/5 mb-3">
          <Loader2 size={14} className="text-[#5FB854] animate-spin" />
          <span className="text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>
            Uploading and processing...
          </span>
        </div>
      )}

      {/* Recordings List */}
      {recordings && recordings.length > 0 ? (
        <div className="space-y-2">
          {recordings.map((rec) => {
            const recording = rec as RecordingEntry;
            const isExpanded = expandedRecording === recording.id;
            const summary = parseSummary(recording.aiSummary);

            return (
              <div
                key={recording.id}
                className="rounded-lg bg-[#111111] border border-white/5 overflow-hidden"
              >
                {/* Recording Header */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedRecording(isExpanded ? null : recording.id)}
                >
                  {/* Play/Pause Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePlayback(recording);
                    }}
                    className="w-8 h-8 rounded-full bg-[#5FB854]/10 border border-[#5FB854]/20 flex items-center justify-center text-[#5FB854] hover:bg-[#5FB854]/20 transition-colors shrink-0"
                  >
                    {playingAudio === recording.id ? <Pause size={12} /> : <Play size={12} />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate" style={{ fontFamily: 'General Sans' }}>
                      {recording.title || 'Untitled Recording'}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[#7A7B80] text-[10px]" style={{ fontFamily: 'General Sans' }}>
                        {formatDate(recording.createdAt)}
                      </span>
                      {recording.durationSeconds && (
                        <span className="flex items-center gap-1 text-[#7A7B80] text-[10px]">
                          <Clock size={9} />
                          {formatTime(recording.durationSeconds)}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                        recording.source === 'live_recording'
                          ? 'bg-[#EF4444]/10 text-[#EF4444]'
                          : 'bg-[#5FB854]/10 text-[#5FB854]'
                      }`}>
                        {recording.source === 'live_recording' ? 'LIVE' : 'UPLOAD'}
                      </span>
                    </div>
                  </div>

                  {/* Transcription Status Badge */}
                  <div className="flex items-center gap-2">
                    {recording.transcriptionStatus === 'processing' && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded bg-[#FFB347]/10 text-[#FFB347] text-[10px]">
                        <Loader2 size={10} className="animate-spin" />
                        Transcribing
                      </span>
                    )}
                    {recording.transcriptionStatus === 'completed' && !recording.aiSummary && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          summarizeMutation.mutate({ recordingId: recording.id });
                        }}
                        disabled={summarizeMutation.isPending}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 text-[#8B5CF6] text-[10px] font-medium hover:bg-[#8B5CF6]/20 transition-colors"
                      >
                        <Brain size={10} />
                        {summarizeMutation.isPending ? 'Generating...' : 'AI Summary'}
                      </button>
                    )}
                    {recording.transcriptionStatus === 'failed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          transcribeMutation.mutate({ recordingId: recording.id });
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-[#EF4444]/10 text-[#EF4444] text-[10px] font-medium hover:bg-[#EF4444]/20"
                      >
                        Retry
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={14} className="text-[#7A7B80]" /> : <ChevronDown size={14} className="text-[#7A7B80]" />}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-white/5">
                    {/* Transcript */}
                    {recording.transcript && (
                      <div className="mt-3">
                        <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'General Sans' }}>
                          Transcript
                        </p>
                        <div className="p-3 rounded-lg bg-[#0A0A0A] border border-white/5 max-h-[200px] overflow-y-auto">
                          <p className="text-[#B0B1B5] text-xs leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'General Sans' }}>
                            {recording.transcript}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* AI Summary */}
                    {summary && (
                      <div className="mt-3">
                        <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'General Sans' }}>
                          AI Summary
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {summary.customerNeeds && summary.customerNeeds !== 'N/A' && (
                            <SummaryField label="Customer Needs" value={summary.customerNeeds} />
                          )}
                          {summary.systemSizeDiscussed && summary.systemSizeDiscussed !== 'N/A' && (
                            <SummaryField label="System Size" value={summary.systemSizeDiscussed} />
                          )}
                          {summary.budget && summary.budget !== 'N/A' && (
                            <SummaryField label="Budget" value={summary.budget} />
                          )}
                          {summary.roofDetails && summary.roofDetails !== 'N/A' && (
                            <SummaryField label="Roof Details" value={summary.roofDetails} />
                          )}
                          {summary.currentElectricity && summary.currentElectricity !== 'N/A' && (
                            <SummaryField label="Current Electricity" value={summary.currentElectricity} />
                          )}
                          {summary.objections && summary.objections !== 'N/A' && (
                            <SummaryField label="Objections" value={summary.objections} />
                          )}
                          {summary.nextSteps && summary.nextSteps !== 'N/A' && (
                            <SummaryField label="Next Steps" value={summary.nextSteps} />
                          )}
                          {summary.urgency && summary.urgency !== 'N/A' && (
                            <SummaryField label="Urgency" value={summary.urgency} />
                          )}
                          {summary.keyInsights && summary.keyInsights !== 'N/A' && (
                            <div className="sm:col-span-2">
                              <SummaryField label="Key Insights" value={summary.keyInsights} />
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Pending transcription message */}
                    {recording.transcriptionStatus === 'pending' && (
                      <div className="mt-3 flex items-center gap-2">
                        <Loader2 size={12} className="text-[#FFB347] animate-spin" />
                        <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                          Transcription queued...
                        </span>
                      </div>
                    )}

                    {/* Delete Recording */}
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Are you sure you want to delete this recording? This cannot be undone.')) {
                            deleteMutation.mutate({ id: recording.id });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#EF4444]/10 text-[#EF4444] text-xs font-medium hover:bg-[#EF4444]/20 transition-colors disabled:opacity-50"
                        style={{ fontFamily: 'General Sans' }}
                      >
                        <Trash2 size={12} />
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete Recording'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        !isUploading && !uploadMutation.isPending && (
          <div className="text-center py-4">
            <FileAudio size={20} className="text-[#7A7B80] mx-auto mb-2" />
            <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
              No recordings yet. Start a live recording or upload a Voice Memo.
            </p>
          </div>
        )
      )}
    </div>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-lg bg-[#0A0A0A] border border-white/5">
      <p className="text-[#7A7B80] text-[9px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'General Sans' }}>
        {label}
      </p>
      <p className="text-[#B0B1B5] text-[11px] leading-relaxed" style={{ fontFamily: 'General Sans' }}>
        {value}
      </p>
    </div>
  );
}
