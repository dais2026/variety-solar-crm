import { useState } from 'react';
import {
  CheckCircle,
  Clock,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Loader2,
  Package,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Zap,
  Shield,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const PROJECT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  'contract-signed': { label: 'Contract Signed', color: '#F59E0B' },
  'cooling-off': { label: 'Cooling Off', color: '#F59E0B' },
  'pre-installation': { label: 'Pre-Installation', color: '#3B82F6' },
  'dnsp-applied': { label: 'DNSP Applied', color: '#8B5CF6' },
  'dnsp-approved': { label: 'DNSP Approved', color: '#8B5CF6' },
  'permit-applied': { label: 'Permit Applied', color: '#EC4899' },
  'permit-approved': { label: 'Permit Approved', color: '#EC4899' },
  'scheduled': { label: 'Scheduled', color: '#06B6D4' },
  'installation': { label: 'Installation', color: '#F97316' },
  'inspection': { label: 'Inspection', color: '#F97316' },
  'commissioning': { label: 'Commissioning', color: '#10B981' },
  'pto-received': { label: 'PTO Received', color: '#10B981' },
  'complete': { label: 'Complete', color: '#5FB854' },
};

const ALL_STATUSES = Object.keys(PROJECT_STATUS_LABELS);

export default function ClosedSalesListPanel() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = trpc.closedSales.list.useQuery({ limit: 50, offset: 0 });
  const updateMutation = trpc.closedSales.update.useMutation({
    onSuccess: () => {
      toast.success('Project status updated');
      refetch();
      setUpdatingId(null);
    },
    onError: (err) => {
      toast.error(`Update failed: ${err.message}`);
      setUpdatingId(null);
    },
  });

  const handleStatusUpdate = (id: number, newStatus: string) => {
    setUpdatingId(id);
    updateMutation.mutate({
      id,
      data: { projectStatus: newStatus as any },
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-white/5 flex items-center justify-center">
          <Loader2 size={28} className="text-[#5FB854] animate-spin" />
        </div>
        <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>Loading closed sales...</p>
      </div>
    );
  }

  const sales = data?.sales ?? [];
  const total = data?.total ?? 0;

  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-16 h-16 rounded-2xl bg-[#111111] border border-white/5 flex items-center justify-center">
          <Package size={28} className="text-[#7A7B80]" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold mb-1" style={{ fontFamily: 'Urbanist' }}>No Closed Sales Yet</p>
          <p className="text-[#7A7B80] text-sm" style={{ fontFamily: 'General Sans' }}>
            Close a deal from the Leads panel or use the "Close Sale" tab to record your first win.
          </p>
        </div>
      </div>
    );
  }

  // Summary stats
  const totalRevenue = sales.reduce((sum, s) => sum + (parseFloat(s.totalContractPrice ?? '0') || 0), 0);
  const completedCount = sales.filter(s => s.projectStatus === 'complete').length;
  const inProgressCount = sales.filter(s => s.projectStatus !== 'complete').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#5FB854]/10 flex items-center justify-center">
              <DollarSign size={16} className="text-[#5FB854]" />
            </div>
            <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>Total Revenue</span>
          </div>
          <p className="text-white text-xl font-bold" style={{ fontFamily: 'General Sans' }}>
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
              <Clock size={16} className="text-[#F59E0B]" />
            </div>
            <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>In Progress</span>
          </div>
          <p className="text-white text-xl font-bold" style={{ fontFamily: 'General Sans' }}>
            {inProgressCount}
          </p>
        </div>
        <div className="bg-[#111111] border border-white/5 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#5FB854]/10 flex items-center justify-center">
              <CheckCircle size={16} className="text-[#5FB854]" />
            </div>
            <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>Completed</span>
          </div>
          <p className="text-white text-xl font-bold" style={{ fontFamily: 'General Sans' }}>
            {completedCount}
          </p>
        </div>
      </div>

      {/* Sales List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-base" style={{ fontFamily: 'Urbanist' }}>
            All Closed Sales ({total})
          </h3>
        </div>

        {sales.map((sale) => {
          const isExpanded = expandedId === sale.id;
          const statusInfo = PROJECT_STATUS_LABELS[sale.projectStatus ?? 'contract-signed'] || PROJECT_STATUS_LABELS['contract-signed'];
          const contractDate = sale.contractSignedDate ? new Date(sale.contractSignedDate).toLocaleDateString('en-AU') : 'N/A';
          const coolingOffDate = sale.coolingOffExpiry ? new Date(sale.coolingOffExpiry).toLocaleDateString('en-AU') : null;
          const isCoolingOff = sale.coolingOffExpiry ? Date.now() < sale.coolingOffExpiry : false;

          return (
            <div key={sale.id} className="bg-[#111111] border border-white/5 rounded-2xl overflow-hidden transition-all duration-200">
              {/* Row Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                className="w-full flex items-center justify-between p-4 lg:p-5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#5FB854]/10 flex items-center justify-center">
                    <span className="text-[#5FB854] text-sm font-bold" style={{ fontFamily: 'General Sans' }}>
                      {sale.customerName?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold" style={{ fontFamily: 'General Sans' }}>
                      {sale.customerName}
                    </p>
                    <p className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
                      {contractDate} &middot; {sale.batteryBrand || sale.inverterBrand || 'System TBD'} {sale.batteryCapacityKwh ? `${sale.batteryCapacityKwh}kWh` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {isCoolingOff && (
                    <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                      <AlertCircle size={11} className="text-[#F59E0B]" />
                      <span className="text-[#F59E0B] text-[10px] font-medium" style={{ fontFamily: 'General Sans' }}>COOLING OFF</span>
                    </div>
                  )}
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ backgroundColor: `${statusInfo.color}15`, border: `1px solid ${statusInfo.color}30` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusInfo.color }} />
                    <span className="text-[10px] font-medium" style={{ color: statusInfo.color, fontFamily: 'General Sans' }}>{statusInfo.label}</span>
                  </div>
                  <span className="text-[#5FB854] text-sm font-bold" style={{ fontFamily: 'General Sans' }}>
                    ${parseFloat(sale.totalContractPrice ?? '0').toLocaleString()}
                  </span>
                  {isExpanded ? <ChevronUp size={16} className="text-[#7A7B80]" /> : <ChevronDown size={16} className="text-[#7A7B80]" />}
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-white/5 p-4 lg:p-6 space-y-6">
                  {/* Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center gap-2">
                      <Phone size={13} className="text-[#7A7B80]" />
                      <span className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{sale.customerPhone}</span>
                    </div>
                    {sale.customerEmail && (
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-[#7A7B80]" />
                        <span className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{sale.customerEmail}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-[#7A7B80]" />
                      <span className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{sale.installAddress}</span>
                    </div>
                  </div>

                  {/* Key Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {sale.nmi && (
                      <DetailItem label="NMI" value={sale.nmi} />
                    )}
                    {sale.distributor && (
                      <DetailItem label="DNSP" value={sale.distributor} />
                    )}
                    {sale.phases && (
                      <DetailItem label="Phases" value={sale.phases} />
                    )}
                    {sale.propertyType && (
                      <DetailItem label="Property" value={sale.propertyType} />
                    )}
                  </div>

                  {/* System Info */}
                  {(sale.panelBrand || sale.inverterBrand || sale.batteryBrand) && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Zap size={13} className="text-[#5FB854]" />
                        <span className="text-[#5FB854] text-xs font-medium uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>System</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {sale.systemSizeDc && <DetailItem label="DC Size" value={`${sale.systemSizeDc} kW`} />}
                        {sale.panelBrand && <DetailItem label="Panels" value={`${sale.panelQuantity || ''}x ${sale.panelBrand} ${sale.panelWattage ? sale.panelWattage + 'W' : ''}`} />}
                        {sale.inverterBrand && <DetailItem label="Inverter" value={`${sale.inverterBrand} ${sale.inverterModel || ''}`} />}
                        {sale.batteryBrand && <DetailItem label="Battery" value={`${sale.batteryBrand} ${sale.batteryCapacityKwh ? sale.batteryCapacityKwh + 'kWh' : ''}`} />}
                      </div>
                    </div>
                  )}

                  {/* Financial Summary */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign size={13} className="text-[#5FB854]" />
                      <span className="text-[#5FB854] text-xs font-medium uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Financial</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <DetailItem label="Contract Price" value={`$${parseFloat(sale.totalContractPrice ?? '0').toLocaleString()}`} />
                      {sale.depositAmount && <DetailItem label="Deposit" value={`$${parseFloat(sale.depositAmount).toLocaleString()} (${sale.depositPaid === 'yes' ? 'Paid' : 'Pending'})`} />}
                      {sale.balanceDue && <DetailItem label="Balance Due" value={`$${parseFloat(sale.balanceDue).toLocaleString()}`} />}
                      {sale.paymentMethod && <DetailItem label="Payment" value={sale.paymentMethod} />}
                      {sale.stcRebateValue && <DetailItem label="STC Rebate" value={`$${parseFloat(sale.stcRebateValue).toLocaleString()}`} />}
                      {sale.pricePerWatt && <DetailItem label="$/Watt" value={`$${sale.pricePerWatt}`} />}
                      {sale.financeProvider && <DetailItem label="Finance" value={`${sale.financeProvider} ${sale.financeTerm || ''}`} />}
                    </div>
                  </div>

                  {/* Compliance */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Shield size={13} className="text-[#5FB854]" />
                      <span className="text-[#5FB854] text-xs font-medium uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Compliance</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <DetailItem label="Contract Signed" value={contractDate} />
                      {coolingOffDate && <DetailItem label="Cooling Off Expires" value={coolingOffDate} highlight={isCoolingOff} />}
                      {sale.cecInstaller && <DetailItem label="CEC Installer" value={sale.cecInstaller} />}
                      {sale.cecDesigner && <DetailItem label="CEC Designer" value={sale.cecDesigner} />}
                    </div>
                  </div>

                  {/* Notes */}
                  {sale.notes && (
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <p className="text-[#7A7B80] text-xs mb-1" style={{ fontFamily: 'General Sans' }}>Notes</p>
                      <p className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{sale.notes}</p>
                    </div>
                  )}

                  {/* Project Status Update */}
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <TrendingUp size={13} className="text-[#5FB854]" />
                      <span className="text-[#5FB854] text-xs font-medium uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Update Project Status</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {ALL_STATUSES.map((status) => {
                        const info = PROJECT_STATUS_LABELS[status];
                        const isCurrent = sale.projectStatus === status;
                        return (
                          <button
                            key={status}
                            onClick={() => !isCurrent && handleStatusUpdate(sale.id, status)}
                            disabled={isCurrent || updatingId === sale.id}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all duration-160 ${
                              isCurrent
                                ? 'ring-2 ring-offset-1 ring-offset-[#111111]'
                                : 'hover:brightness-125 active:scale-[0.97]'
                            } ${updatingId === sale.id ? 'opacity-50' : ''}`}
                            style={{
                              backgroundColor: `${info.color}${isCurrent ? '25' : '10'}`,
                              border: `1px solid ${info.color}${isCurrent ? '60' : '20'}`,
                              color: info.color,
                              fontFamily: 'General Sans',
                            }}
                          >
                            {info.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[#7A7B80] text-[10px] uppercase tracking-wider mb-0.5" style={{ fontFamily: 'General Sans' }}>{label}</p>
      <p className={`text-sm font-medium ${highlight ? 'text-[#F59E0B]' : 'text-white'}`} style={{ fontFamily: 'General Sans' }}>{value}</p>
    </div>
  );
}
