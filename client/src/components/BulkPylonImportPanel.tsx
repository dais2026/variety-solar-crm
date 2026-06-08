import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';

interface FileEntry {
  file: File;
  base64: string;
}

interface ImportResult {
  filename: string;
  success: boolean;
  customerName?: string;
  error?: string;
  id?: number;
}

export default function BulkPylonImportPanel() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const bulkImportMutation = trpc.closedSales.bulkPylonImport.useMutation({
    onSuccess: (data) => {
      setResults(data.results);
      setIsImporting(false);
      if (data.success > 0) {
        toast.success(`${data.success} PDF${data.success > 1 ? 's' : ''} imported successfully`);
        utils.closedSales.pendingPylonReview.invalidate();
        utils.closedSales.list.invalidate();
      }
      if (data.failed > 0) {
        toast.error(`${data.failed} PDF${data.failed > 1 ? 's' : ''} failed to import`);
      }
    },
    onError: (err) => {
      setIsImporting(false);
      toast.error(`Import failed: ${err.message}`);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const pdfFiles = selectedFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      toast.error('Please select PDF files only');
      return;
    }

    if (pdfFiles.length > 20) {
      toast.error('Maximum 20 PDFs per batch');
      return;
    }

    // Check size (16MB per file max)
    const oversized = pdfFiles.filter(f => f.size > 16 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} file(s) exceed 16MB limit`);
      return;
    }

    const entries: FileEntry[] = [];
    for (const file of pdfFiles) {
      const base64 = await readFileAsBase64(file);
      entries.push({ file, base64 });
    }

    setFiles(prev => [...prev, ...entries]);
    setResults(null);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data:...;base64, prefix
        const base64 = result.split(',')[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = () => {
    if (files.length === 0) return;
    setIsImporting(true);
    setResults(null);
    bulkImportMutation.mutate({
      files: files.map(f => ({
        filename: f.file.name,
        base64: f.base64,
      })),
    });
  };

  const clearAll = () => {
    setFiles([]);
    setResults(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
            Bulk Pylon PDF Import
          </h2>
          <p className="text-white/50 text-sm mt-1" style={{ fontFamily: 'General Sans' }}>
            Upload multiple signed Pylon proposal PDFs to create draft sales for review
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-emerald-500/40 transition-colors duration-200 cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          const droppedFiles = Array.from(e.dataTransfer.files).filter(
            f => f.type === 'application/pdf' || f.name.endsWith('.pdf')
          );
          if (droppedFiles.length === 0) {
            toast.error('Please drop PDF files only');
            return;
          }
          const entries: FileEntry[] = [];
          for (const file of droppedFiles.slice(0, 20)) {
            const base64 = await readFileAsBase64(file);
            entries.push({ file, base64 });
          }
          setFiles(prev => [...prev, ...entries]);
          setResults(null);
        }}
      >
        <Upload size={40} className="text-white/30 mx-auto mb-3" />
        <p className="text-white/70 text-sm font-medium" style={{ fontFamily: 'General Sans' }}>
          Click to select or drag & drop Pylon PDFs here
        </p>
        <p className="text-white/40 text-xs mt-1">
          Up to 20 PDFs per batch · Max 16MB each
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-white/70 text-sm font-medium" style={{ fontFamily: 'General Sans' }}>
              {files.length} PDF{files.length > 1 ? 's' : ''} selected
            </p>
            <button
              onClick={clearAll}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Clear All
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {files.map((entry, idx) => {
              const result = results?.find(r => r.filename === entry.file.name);
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    result
                      ? result.success
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-red-500/30 bg-red-500/5'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <FileText size={16} className={result ? (result.success ? 'text-emerald-400' : 'text-red-400') : 'text-white/40'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-xs truncate">{entry.file.name}</p>
                    {result && (
                      <p className={`text-xs mt-0.5 ${result.success ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                        {result.success ? `✓ ${result.customerName}` : result.error}
                      </p>
                    )}
                  </div>
                  <span className="text-white/30 text-xs flex-shrink-0">
                    {(entry.file.size / 1024).toFixed(0)} KB
                  </span>
                  {!isImporting && !result && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                      className="text-white/30 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {result && (
                    result.success
                      ? <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                      : <XCircle size={16} className="text-red-400 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Import Button */}
      {files.length > 0 && !results && (
        <button
          onClick={handleImport}
          disabled={isImporting}
          className="w-full py-3 rounded-xl bg-emerald-500 text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{ fontFamily: 'General Sans' }}
        >
          {isImporting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Importing {files.length} PDF{files.length > 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <Upload size={16} />
              Import {files.length} PDF{files.length > 1 ? 's' : ''}
            </>
          )}
        </button>
      )}

      {/* Results Summary */}
      {results && (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <h3 className="text-white text-sm font-semibold" style={{ fontFamily: 'Urbanist' }}>
            Import Complete
          </h3>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="text-emerald-400 text-xs font-medium">
                {results.filter(r => r.success).length} imported
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle size={14} className="text-red-400" />
              <span className="text-red-400 text-xs font-medium">
                {results.filter(r => !r.success).length} failed
              </span>
            </div>
          </div>
          <p className="text-white/50 text-xs">
            Imported sales appear as "Pylon — Pending Review" in Closed Sales. Use the banner notification to review and confirm each one.
          </p>
          <button
            onClick={clearAll}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors font-medium"
          >
            Import More PDFs
          </button>
        </div>
      )}
    </div>
  );
}
