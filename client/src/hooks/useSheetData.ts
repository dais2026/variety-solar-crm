import { trpc } from '@/lib/trpc';

export interface Lead {
  dateStamp: string;
  name: string;
  contactNumber: string;
  email: string;
  address: string;
  outcome: string;
  leadSource: string;
  status: string;
  product: string;
  saleStatus: string;
  notes: string;
  costs: string;
  svr: string;
  phases: string;
  rooftopSolar: string;
  hotWater: string;
  heatingCooling: string;
  cooktop: string;
  product2: string;
  vppNightUse: string;
  ev: string;
  brands: string;
  size: string;
}

export interface SheetData {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

export function useSheetData(): SheetData {
  const utils = trpc.useUtils();
  const { data, isLoading, isFetching, error, dataUpdatedAt } = trpc.sheets.getLeads.useQuery(
    undefined,
    {
      refetchInterval: 30000, // Auto-refresh every 30 seconds
      staleTime: 10000, // Consider data stale after 10 seconds
    }
  );

  const leads: Lead[] = data?.leads ?? [];
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null;

  return {
    leads,
    loading: isLoading || isFetching,
    error: error ? error.message : null,
    lastUpdated,
    refresh: () => { utils.sheets.getLeads.invalidate(); },
  };
}

// Utility functions for dashboard metrics
export function getMetrics(leads: Lead[]) {
  const total = leads.length;
  const pending = leads.filter(l => l.saleStatus.toLowerCase() === 'pending').length;
  const rejected = leads.filter(l => l.saleStatus.toLowerCase() === 'rejected').length;
  const proposalSent = leads.filter(l =>
    l.status.toLowerCase().includes('proposal sent') ||
    l.saleStatus.toLowerCase().includes('proposal sent')
  ).length;
  const awaitingInfo = leads.filter(l =>
    l.outcome.toLowerCase().includes('awaiting')
  ).length;
  const receivedInfo = leads.filter(l =>
    l.outcome.toLowerCase().includes('recieved') ||
    l.outcome.toLowerCase().includes('received')
  ).length;

  return { total, pending, rejected, proposalSent, awaitingInfo, receivedInfo };
}

export function getProductBreakdown(leads: Lead[]) {
  const products: Record<string, number> = {};
  leads.forEach(lead => {
    if (lead.product) {
      const key = lead.product.toUpperCase();
      products[key] = (products[key] || 0) + 1;
    }
  });
  return Object.entries(products).map(([name, value]) => ({ name, value }));
}

export function getOutcomeBreakdown(leads: Lead[]) {
  const outcomes: Record<string, number> = {};
  leads.forEach(lead => {
    if (lead.outcome) {
      outcomes[lead.outcome] = (outcomes[lead.outcome] || 0) + 1;
    }
  });
  return Object.entries(outcomes).map(([name, value]) => ({ name, value }));
}
