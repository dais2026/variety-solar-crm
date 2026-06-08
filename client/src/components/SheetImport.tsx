/**
 * Sheet Import Component - Google Sheets integration
 */

import React, { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function SheetImport() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/sheets/import`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        const data = await response.json();
        setError(data.error || "Import failed");
      }
    } catch (err) {
      setError("Network error during import");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-lg font-semibold mb-4">Import from Google Sheets</h2>

      {/* Info */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">How it works</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>1. Leads are imported from your configured Google Sheet</li>
          <li>2. First row should contain column headers (Name, Email, Phone, etc.)</li>
          <li>3. Duplicate leads (by email) are automatically skipped</li>
          <li>4. New leads are added with "new" status</li>
        </ul>
      </div>

      {/* Sheet ID */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Google Sheet ID
        </label>
        <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-600">
          {import.meta.env.VITE_GOOGLE_SHEETS_ID || "Not configured"}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Configure VITE_GOOGLE_SHEETS_ID in your .env file
        </p>
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={isLoading || !import.meta.env.VITE_GOOGLE_SHEETS_ID}
        className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Importing...
          </>
        ) : (
          <>
            <Upload size={20} />
            Import Leads
          </>
        )}
      </button>

      {/* Results */}
      {result && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={20} className="text-green-600" />
            <h3 className="font-medium text-green-900">Import Complete</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.imported}</div>
              <div className="text-xs text-gray-500">Imported</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{result.skipped}</div>
              <div className="text-xs text-gray-500">Skipped</div>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <div className="text-2xl font-bold text-red-600">{result.errors.length}</div>
              <div className="text-xs text-gray-500">Errors</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Errors:</h4>
              <ul className="text-sm text-red-600 space-y-1">
                {result.errors.slice(0, 5).map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>...and {result.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Configure prompt */}
      {!import.meta.env.VITE_GOOGLE_SHEETS_ID && (
        <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Google Sheets integration requires configuration. 
            Make sure VITE_GOOGLE_SHEETS_ID is set in your environment.
          </p>
        </div>
      )}
    </div>
  );
}