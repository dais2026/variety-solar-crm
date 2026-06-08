import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Sun, Loader2, AlertCircle, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function SolarQuotesImportsPanel() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data, isLoading, isError, error, refetch } = trpc.solarQuotes.listImports.useQuery({ limit, offset: page * limit });
  const manualImport = trpc.solarQuotes.manualImport.useMutation({
    onSuccess: (result) => {
      if (result.errors && result.errors.length > 0 && result.imported === 0) {
        toast.error(`Import failed: ${result.errors.length} email${result.errors.length !== 1 ? 's' : ''} could not be processed. Google Sheets token may be expired.`);
      } else if (result.errors && result.errors.length > 0) {
        toast.warning(`Import partial: ${result.imported} imported, ${result.errors.length} failed.`);
      } else {
        toast.success(`Import complete: ${result.imported} new lead${result.imported !== 1 ? 's' : ''} imported, ${result.skipped} skipped.`);
      }
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Could not connect to email server.");
    },
  });

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Australia/Melbourne',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[#5FB854]" size={32} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-red-400 text-sm" style={{ fontFamily: 'General Sans' }}>
          Failed to load Solar Quotes imports{error?.message ? `: ${error.message}` : ''}
        </p>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-[#B0B1B5] hover:bg-white/10 transition-colors text-xs"
          style={{ fontFamily: 'General Sans' }}
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    );
  }

  const imports = data?.imports ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5A623]/10 flex items-center justify-center">
              <Sun size={20} className="text-[#F5A623]" />
            </div>
            <div>
              <h2 className="text-white text-xl font-bold" style={{ fontFamily: 'Urbanist' }}>
                Solar Quotes Imports
              </h2>
              <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                {total} lead{total !== 1 ? 's' : ''} auto-imported from email lead sources
              </p>
            </div>
          </div>
          {/* Manual Import Button */}
          <button
            onClick={() => manualImport.mutate()}
            disabled={manualImport.isPending}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5A623] hover:bg-[#F5A623]/90 text-black font-semibold text-xs transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'General Sans' }}
          >
            {manualImport.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download size={14} />
                Import Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      {imports.length === 0 ? (
        <div className="text-center py-16">
          <Sun size={48} className="text-[#7A7B80]/30 mx-auto mb-4" />
          <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
            No leads imported yet. Click "Import Now" or wait for the 15-minute auto-check.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/5">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#141414] border-b border-white/5">
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7A7B80]" style={{ fontFamily: 'General Sans' }}>
                  Lead Ref
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7A7B80]" style={{ fontFamily: 'General Sans' }}>
                  Name
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7A7B80]" style={{ fontFamily: 'General Sans' }}>
                  Email
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7A7B80]" style={{ fontFamily: 'General Sans' }}>
                  Phone
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7A7B80]" style={{ fontFamily: 'General Sans' }}>
                  Source
                </th>
                <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#7A7B80]" style={{ fontFamily: 'General Sans' }}>
                  Imported
                </th>
              </tr>
            </thead>
            <tbody>
              {imports.map((imp, idx) => (
                <tr
                  key={imp.id}
                  className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${idx % 2 === 0 ? 'bg-[#0D0D0D]' : 'bg-[#111111]'}`}
                >
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#F5A623]/15 text-[#F5A623]" style={{ fontFamily: 'General Sans' }}>
                      {imp.leadRef}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
                    {imp.leadName}
                  </td>
                  <td className="px-4 py-3 text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>
                    {imp.leadEmail || '—'}
                  </td>
                  <td className="px-4 py-3 text-[#B0B1B5] text-xs" style={{ fontFamily: 'General Sans' }}>
                    {imp.leadPhone || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#5FB854]/15 text-[#5FB854]" style={{ fontFamily: 'General Sans' }}>
                      {imp.leadSource || 'Solar Quotes'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                    {formatDate(imp.importedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[#B0B1B5] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            style={{ fontFamily: 'General Sans' }}
          >
            Previous
          </button>
          <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-[#B0B1B5] hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            style={{ fontFamily: 'General Sans' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
