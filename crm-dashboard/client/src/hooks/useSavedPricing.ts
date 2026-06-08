import { useCallback } from 'react';
import { trpc } from '@/lib/trpc';

export interface SavedQuoteItem {
  label: string;
  price: number;
}

export interface SavedQuoteRebate {
  amount: number;
  id: string;
  label: string;
}

export interface SavedQuote {
  id: number;
  totalPrice: number;
  items: SavedQuoteItem[];
  commission: number;
  solarSTCs: number;
  batterySTCs: number;
  stcPrice: number;
  rebates: SavedQuoteRebate[];
  savedAt: number;
}

export interface SavedPricingCustomer {
  id: number;
  customerName: string;
  referenceNumber: string;
  createdAt: string;
  updatedAt: string;
  quotes: SavedQuote[];
  quoteCount: number;
  lastQuoteAt: number;
}

export interface SavedPricingData {
  customers: SavedPricingCustomer[];
  loading: boolean;
  error: string | null;
  getMatchesForLead: (leadName: string) => SavedPricingCustomer[];
}

/**
 * Normalise a name for fuzzy matching:
 * - lowercase
 * - strip trailing numeric suffixes like "1", "2" (used for quote revisions)
 * - trim whitespace
 */
function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+\d+$/, '') // remove trailing " 1", " 2" etc.
    .trim();
}

export function useSavedPricing(): SavedPricingData {
  const { data, isLoading, error } = trpc.pricing.listCustomers.useQuery(undefined, {
    staleTime: 60_000, // Cache for 60 seconds
    refetchInterval: 60_000, // Auto-refresh every 60 seconds
  });

  const customers = (data || []) as SavedPricingCustomer[];

  const getMatchesForLead = useCallback((leadName: string): SavedPricingCustomer[] => {
    if (!leadName || customers.length === 0) return [];

    const normalised = normaliseName(leadName);

    // Match by normalised name (handles "Cody Feeney" matching "Cody Feeney 1" and "Cody Feeney")
    return customers.filter(c => {
      const custNorm = normaliseName(c.customerName);
      return custNorm === normalised;
    });
  }, [customers]);

  return {
    customers,
    loading: isLoading,
    error: error ? error.message : null,
    getMatchesForLead,
  };
}
