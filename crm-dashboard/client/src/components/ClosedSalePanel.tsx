import { useState, useMemo } from 'react';
import {
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  User,
  Zap,
  DollarSign,
  FileCheck,
  MapPin,
  Award,
  RotateCcw,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import type { Lead } from '@/hooks/useSheetData';

interface ClosedSalePanelProps {
  leads?: Lead[];
  prefillLead?: Lead | null;
  onComplete?: () => void;
}

interface ClosedSaleFormData {
  // Customer
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  installAddress: string;
  postalAddress: string;
  nmi: string;
  meterNumber: string;
  currentRetailer: string;
  distributor: string;
  existingSolar: 'yes' | 'no';
  propertyType: 'house' | 'townhouse' | 'unit' | 'commercial';
  roofType: 'tile' | 'colorbond' | 'flat' | 'klip-lok' | 'other';
  phases: '1-phase' | '2-phase' | '3-phase';

  // System
  systemSizeDc: string;
  systemSizeAc: string;
  panelBrand: string;
  panelModel: string;
  panelQuantity: string;
  panelWattage: string;
  inverterBrand: string;
  inverterModel: string;
  inverterQuantity: string;
  batteryBrand: string;
  batteryModel: string;
  batteryCapacityKwh: string;
  batteryQuantity: string;
  optimisers: string;
  mountingType: 'roof' | 'ground' | 'tilt-frame';
  exportLimitKw: string;
  evCharger: string;
  hotWaterSystem: string;
  additionalProducts: string;

  // Financial
  totalContractPrice: string;
  depositAmount: string;
  depositPaid: 'yes' | 'no';
  depositDate: string;
  paymentMethod: 'cash' | 'finance' | 'green-loan' | 'interest-free' | 'mixed';
  financeProvider: string;
  financeAmount: string;
  financeTerm: string;
  stcRebateValue: string;
  numberOfStcs: string;
  paymentSchedule: string;

  // Contract & Compliance
  contractSignedDate: string;
  cecInstaller: string;
  cecDesigner: string;
  warrantyWorkmanshipYears: string;
  warrantyPanelProductYears: string;
  warrantyInverterYears: string;
  warrantyBatteryYears: string;

  // Site
  roofOrientation: string;
  roofPitch: string;
  shadingAssessment: string;
  switchboardCondition: 'good' | 'needs-upgrade' | 'asbestos';
  switchboardUpgrade: 'yes' | 'no';
  cableRunMetres: string;
  trenchingRequired: 'yes' | 'no';
  annualProductionEstimate: string;
  energyOffsetPercent: string;

  // Sales Attribution
  dealOwner: string;
  leadSource: string;
  closedWonReason: string;
  daysInPipeline: string;
  proposalsSent: string;
  referralSource: string;
  notes: string;
}

const initialFormData: ClosedSaleFormData = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  installAddress: '',
  postalAddress: '',
  nmi: '',
  meterNumber: '',
  currentRetailer: '',
  distributor: '',
  existingSolar: 'no',
  propertyType: 'house',
  roofType: 'colorbond',
  phases: '1-phase',
  systemSizeDc: '',
  systemSizeAc: '',
  panelBrand: '',
  panelModel: '',
  panelQuantity: '',
  panelWattage: '',
  inverterBrand: '',
  inverterModel: '',
  inverterQuantity: '1',
  batteryBrand: '',
  batteryModel: '',
  batteryCapacityKwh: '',
  batteryQuantity: '',
  optimisers: '',
  mountingType: 'roof',
  exportLimitKw: '',
  evCharger: '',
  hotWaterSystem: '',
  additionalProducts: '',
  totalContractPrice: '',
  depositAmount: '',
  depositPaid: 'no',
  depositDate: '',
  paymentMethod: 'cash',
  financeProvider: '',
  financeAmount: '',
  financeTerm: '',
  stcRebateValue: '',
  numberOfStcs: '',
  paymentSchedule: '',
  contractSignedDate: new Date().toISOString().split('T')[0],
  cecInstaller: '',
  cecDesigner: '',
  warrantyWorkmanshipYears: '5',
  warrantyPanelProductYears: '25',
  warrantyInverterYears: '10',
  warrantyBatteryYears: '10',
  roofOrientation: '',
  roofPitch: '',
  shadingAssessment: '',
  switchboardCondition: 'good',
  switchboardUpgrade: 'no',
  cableRunMetres: '',
  trenchingRequired: 'no',
  annualProductionEstimate: '',
  energyOffsetPercent: '',
  dealOwner: 'George Fotopoulos',
  leadSource: '',
  closedWonReason: '',
  daysInPipeline: '',
  proposalsSent: '',
  referralSource: '',
  notes: '',
};

const steps = [
  { id: 1, title: 'Customer', icon: User },
  { id: 2, title: 'System', icon: Zap },
  { id: 3, title: 'Financial', icon: DollarSign },
  { id: 4, title: 'Contract', icon: FileCheck },
  { id: 5, title: 'Site', icon: MapPin },
  { id: 6, title: 'Attribution', icon: Award },
];

// Reusable form components
function FormInput({ label, value, onChange, type = 'text', placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[#B0B1B5] text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
        {label}{required && <span className="text-[#EF4444] ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl bg-[#111111] border border-white/10 text-white text-sm placeholder:text-[#4A4B50] focus:outline-none focus:border-[#5FB854]/50 focus:ring-1 focus:ring-[#5FB854]/20 transition-all"
        style={{ fontFamily: 'General Sans' }}
        required={required}
      />
    </div>
  );
}

function FormSelect({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[#B0B1B5] text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
        {label}{required && <span className="text-[#EF4444] ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-[#111111] border border-white/10 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 focus:ring-1 focus:ring-[#5FB854]/20 transition-all appearance-none"
        style={{ fontFamily: 'General Sans' }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function FormTextarea({ label, value, onChange, placeholder, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[#B0B1B5] text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2.5 rounded-xl bg-[#111111] border border-white/10 text-white text-sm placeholder:text-[#4A4B50] focus:outline-none focus:border-[#5FB854]/50 focus:ring-1 focus:ring-[#5FB854]/20 transition-all resize-none"
        style={{ fontFamily: 'General Sans' }}
      />
    </div>
  );
}

export default function ClosedSalePanel({ leads, prefillLead, onComplete }: ClosedSalePanelProps) {
  const [formData, setFormData] = useState<ClosedSaleFormData>(() => {
    if (prefillLead) {
      return {
        ...initialFormData,
        customerName: prefillLead.name || '',
        customerEmail: prefillLead.email || '',
        customerPhone: prefillLead.contactNumber || '',
        installAddress: prefillLead.address || '',
        leadSource: prefillLead.leadSource || '',
        phases: prefillLead.phases === '3-Phase' ? '3-phase' : prefillLead.phases === '2-Phase' ? '2-phase' : '1-phase',
        notes: prefillLead.notes || '',
        batteryBrand: prefillLead.brands || '',
        batteryCapacityKwh: prefillLead.size?.replace('kWh', '') || '',
      };
    }
    return initialFormData;
  });
  const [currentStep, setCurrentStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const createMutation = trpc.closedSales.create.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setSubmitting(false);
      toast.success('Closed sale recorded successfully!');
      if (onComplete) onComplete();
    },
    onError: (error) => {
      setSubmitting(false);
      toast.error(`Failed to record sale: ${error.message}`);
    },
  });

  const update = (field: keyof ClosedSaleFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Auto-calculations
  const calculatedValues = useMemo(() => {
    const totalPrice = parseFloat(formData.totalContractPrice) || 0;
    const deposit = parseFloat(formData.depositAmount) || 0;
    const stcRebate = parseFloat(formData.stcRebateValue) || 0;
    const systemKw = parseFloat(formData.systemSizeDc) || 0;

    return {
      balanceDue: totalPrice > 0 ? (totalPrice - deposit - stcRebate).toFixed(2) : '',
      pricePerWatt: totalPrice > 0 && systemKw > 0 ? (totalPrice / (systemKw * 1000)).toFixed(2) : '',
    };
  }, [formData.totalContractPrice, formData.depositAmount, formData.stcRebateValue, formData.systemSizeDc]);

  const handleSubmit = () => {
    // Validate required fields
    if (!formData.customerName || !formData.customerPhone || !formData.installAddress || !formData.totalContractPrice || !formData.contractSignedDate) {
      toast.error('Please fill in all required fields (Customer Name, Phone, Address, Contract Price, Contract Date)');
      return;
    }

    setSubmitting(true);

    createMutation.mutate({
      customerName: formData.customerName,
      customerEmail: formData.customerEmail || undefined,
      customerPhone: formData.customerPhone,
      installAddress: formData.installAddress,
      postalAddress: formData.postalAddress || undefined,
      nmi: formData.nmi || undefined,
      meterNumber: formData.meterNumber || undefined,
      currentRetailer: formData.currentRetailer || undefined,
      distributor: formData.distributor || undefined,
      existingSolar: formData.existingSolar,
      propertyType: formData.propertyType,
      roofType: formData.roofType,
      phases: formData.phases,
      systemSizeDc: formData.systemSizeDc || undefined,
      systemSizeAc: formData.systemSizeAc || undefined,
      panelBrand: formData.panelBrand || undefined,
      panelModel: formData.panelModel || undefined,
      panelQuantity: formData.panelQuantity ? parseInt(formData.panelQuantity) : undefined,
      panelWattage: formData.panelWattage ? parseInt(formData.panelWattage) : undefined,
      inverterBrand: formData.inverterBrand || undefined,
      inverterModel: formData.inverterModel || undefined,
      inverterQuantity: formData.inverterQuantity ? parseInt(formData.inverterQuantity) : undefined,
      batteryBrand: formData.batteryBrand || undefined,
      batteryModel: formData.batteryModel || undefined,
      batteryCapacityKwh: formData.batteryCapacityKwh || undefined,
      batteryQuantity: formData.batteryQuantity ? parseInt(formData.batteryQuantity) : undefined,
      optimisers: formData.optimisers || undefined,
      mountingType: formData.mountingType,
      exportLimitKw: formData.exportLimitKw || undefined,
      evCharger: formData.evCharger || undefined,
      hotWaterSystem: formData.hotWaterSystem || undefined,
      additionalProducts: formData.additionalProducts || undefined,
      totalContractPrice: formData.totalContractPrice,
      depositAmount: formData.depositAmount || undefined,
      depositPaid: formData.depositPaid,
      depositDate: formData.depositDate ? new Date(formData.depositDate).getTime() : undefined,
      paymentMethod: formData.paymentMethod,
      financeProvider: formData.financeProvider || undefined,
      financeAmount: formData.financeAmount || undefined,
      financeTerm: formData.financeTerm || undefined,
      stcRebateValue: formData.stcRebateValue || undefined,
      numberOfStcs: formData.numberOfStcs ? parseInt(formData.numberOfStcs) : undefined,
      paymentSchedule: formData.paymentSchedule || undefined,
      contractSignedDate: new Date(formData.contractSignedDate).getTime(),
      cecInstaller: formData.cecInstaller || undefined,
      cecDesigner: formData.cecDesigner || undefined,
      warrantyWorkmanshipYears: formData.warrantyWorkmanshipYears ? parseInt(formData.warrantyWorkmanshipYears) : undefined,
      warrantyPanelProductYears: formData.warrantyPanelProductYears ? parseInt(formData.warrantyPanelProductYears) : undefined,
      warrantyInverterYears: formData.warrantyInverterYears ? parseInt(formData.warrantyInverterYears) : undefined,
      warrantyBatteryYears: formData.warrantyBatteryYears ? parseInt(formData.warrantyBatteryYears) : undefined,
      roofOrientation: formData.roofOrientation || undefined,
      roofPitch: formData.roofPitch ? parseInt(formData.roofPitch) : undefined,
      shadingAssessment: formData.shadingAssessment || undefined,
      switchboardCondition: formData.switchboardCondition,
      switchboardUpgrade: formData.switchboardUpgrade,
      cableRunMetres: formData.cableRunMetres ? parseInt(formData.cableRunMetres) : undefined,
      trenchingRequired: formData.trenchingRequired,
      annualProductionEstimate: formData.annualProductionEstimate ? parseInt(formData.annualProductionEstimate) : undefined,
      energyOffsetPercent: formData.energyOffsetPercent ? parseInt(formData.energyOffsetPercent) : undefined,
      dealOwner: formData.dealOwner || undefined,
      leadSource: formData.leadSource || undefined,
      closedWonReason: formData.closedWonReason || undefined,
      daysInPipeline: formData.daysInPipeline ? parseInt(formData.daysInPipeline) : undefined,
      proposalsSent: formData.proposalsSent ? parseInt(formData.proposalsSent) : undefined,
      referralSource: formData.referralSource || undefined,
      notes: formData.notes || undefined,
      leadPhone: formData.customerPhone || undefined,
    });
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setCurrentStep(1);
    setSubmitted(false);
  };

  // Success state
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
        <div className="w-20 h-20 rounded-full bg-[#5FB854]/15 flex items-center justify-center">
          <CheckCircle size={40} className="text-[#5FB854]" />
        </div>
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Urbanist' }}>
            Sale Closed Successfully
          </h2>
          <p className="text-[#7A7B80] text-sm mb-6" style={{ fontFamily: 'General Sans' }}>
            {formData.customerName}'s deal has been recorded. The project status is set to "Contract Signed" and the cooling-off period has been calculated automatically.
          </p>

          {/* Summary Card */}
          <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 text-left space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>Customer</span>
              <span className="text-white text-sm font-medium" style={{ fontFamily: 'General Sans' }}>{formData.customerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>Contract Value</span>
              <span className="text-[#5FB854] text-sm font-bold" style={{ fontFamily: 'General Sans' }}>${parseFloat(formData.totalContractPrice).toLocaleString()}</span>
            </div>
            {formData.batteryBrand && (
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>System</span>
                <span className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{formData.batteryBrand} {formData.batteryCapacityKwh && `${formData.batteryCapacityKwh}kWh`}</span>
              </div>
            )}
            {calculatedValues.balanceDue && (
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>Balance Due</span>
                <span className="text-white text-sm font-medium" style={{ fontFamily: 'General Sans' }}>${parseFloat(calculatedValues.balanceDue).toLocaleString()}</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-[#B0B1B5] hover:text-white hover:border-white/20 transition-all text-sm"
              style={{ fontFamily: 'General Sans' }}
            >
              <RotateCcw size={14} />
              New Sale
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 whitespace-nowrap ${
                isActive
                  ? 'bg-[#5FB854]/10 border-[#5FB854]/30 text-[#5FB854]'
                  : isComplete
                  ? 'bg-[#5FB854]/5 border-[#5FB854]/15 text-[#5FB854]/70'
                  : 'border-white/10 text-[#7A7B80] hover:border-white/20'
              }`}
            >
              <Icon size={14} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-xs font-medium" style={{ fontFamily: 'General Sans' }}>{step.title}</span>
              {isComplete && <CheckCircle size={12} className="text-[#5FB854]" />}
            </button>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 lg:p-8">
        {/* Step 1: Customer Information */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Urbanist' }}>Customer Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Customer Name" value={formData.customerName} onChange={(v) => update('customerName', v)} required placeholder="Full name" />
              <FormInput label="Phone" value={formData.customerPhone} onChange={(v) => update('customerPhone', v)} required placeholder="04XX XXX XXX" />
              <FormInput label="Email" value={formData.customerEmail} onChange={(v) => update('customerEmail', v)} type="email" placeholder="email@example.com" />
              <FormInput label="NMI" value={formData.nmi} onChange={(v) => update('nmi', v)} placeholder="National Meter Identifier" />
              <div className="md:col-span-2">
                <FormInput label="Installation Address" value={formData.installAddress} onChange={(v) => update('installAddress', v)} required placeholder="Full installation address" />
              </div>
              <FormInput label="Postal Address (if different)" value={formData.postalAddress} onChange={(v) => update('postalAddress', v)} placeholder="Billing/postal address" />
              <FormInput label="Meter Number" value={formData.meterNumber} onChange={(v) => update('meterNumber', v)} placeholder="Meter serial number" />
              <FormInput label="Current Retailer" value={formData.currentRetailer} onChange={(v) => update('currentRetailer', v)} placeholder="e.g. AGL, Origin, EA" />
              <FormInput label="Distributor (DNSP)" value={formData.distributor} onChange={(v) => update('distributor', v)} placeholder="e.g. AusNet, Powercor, Jemena" />
              <FormSelect label="Existing Solar" value={formData.existingSolar} onChange={(v) => update('existingSolar', v)} options={[{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }]} />
              <FormSelect label="Property Type" value={formData.propertyType} onChange={(v) => update('propertyType', v)} options={[
                { value: 'house', label: 'House' },
                { value: 'townhouse', label: 'Townhouse' },
                { value: 'unit', label: 'Unit/Apartment' },
                { value: 'commercial', label: 'Commercial' },
              ]} />
              <FormSelect label="Roof Type" value={formData.roofType} onChange={(v) => update('roofType', v)} options={[
                { value: 'colorbond', label: 'Colorbond' },
                { value: 'tile', label: 'Tile' },
                { value: 'flat', label: 'Flat' },
                { value: 'klip-lok', label: 'Klip-Lok' },
                { value: 'other', label: 'Other' },
              ]} />
              <FormSelect label="Phases" value={formData.phases} onChange={(v) => update('phases', v)} options={[
                { value: '1-phase', label: '1-Phase' },
                { value: '2-phase', label: '2-Phase' },
                { value: '3-phase', label: '3-Phase' },
              ]} />
            </div>
          </div>
        )}

        {/* Step 2: System Specification */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Urbanist' }}>System Specification</h3>
            
            <div className="space-y-4">
              <p className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Solar Panels</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="System Size DC (kW)" value={formData.systemSizeDc} onChange={(v) => update('systemSizeDc', v)} type="number" placeholder="e.g. 10.36" />
                <FormInput label="System Size AC (kW)" value={formData.systemSizeAc} onChange={(v) => update('systemSizeAc', v)} type="number" placeholder="e.g. 8.0" />
                <FormInput label="Panel Brand" value={formData.panelBrand} onChange={(v) => update('panelBrand', v)} placeholder="e.g. Trina, Jinko, LONGi" />
                <FormInput label="Panel Model" value={formData.panelModel} onChange={(v) => update('panelModel', v)} placeholder="Model number" />
                <FormInput label="Panel Quantity" value={formData.panelQuantity} onChange={(v) => update('panelQuantity', v)} type="number" placeholder="e.g. 24" />
                <FormInput label="Panel Wattage (W)" value={formData.panelWattage} onChange={(v) => update('panelWattage', v)} type="number" placeholder="e.g. 440" />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Inverter</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="Inverter Brand" value={formData.inverterBrand} onChange={(v) => update('inverterBrand', v)} placeholder="e.g. Sigenergy, GoodWe, Fronius" />
                <FormInput label="Inverter Model" value={formData.inverterModel} onChange={(v) => update('inverterModel', v)} placeholder="Model number" />
                <FormInput label="Inverter Quantity" value={formData.inverterQuantity} onChange={(v) => update('inverterQuantity', v)} type="number" placeholder="1" />
                <FormInput label="Optimisers" value={formData.optimisers} onChange={(v) => update('optimisers', v)} placeholder="e.g. SolarEdge P505, N/A" />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Battery</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput label="Battery Brand" value={formData.batteryBrand} onChange={(v) => update('batteryBrand', v)} placeholder="e.g. Sigenergy, Tesla, BYD" />
                <FormInput label="Battery Model" value={formData.batteryModel} onChange={(v) => update('batteryModel', v)} placeholder="Model number" />
                <FormInput label="Battery Capacity (kWh)" value={formData.batteryCapacityKwh} onChange={(v) => update('batteryCapacityKwh', v)} type="number" placeholder="e.g. 10" />
                <FormInput label="Battery Quantity" value={formData.batteryQuantity} onChange={(v) => update('batteryQuantity', v)} type="number" placeholder="1" />
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Additional</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormSelect label="Mounting Type" value={formData.mountingType} onChange={(v) => update('mountingType', v)} options={[
                  { value: 'roof', label: 'Roof Mount' },
                  { value: 'ground', label: 'Ground Mount' },
                  { value: 'tilt-frame', label: 'Tilt Frame' },
                ]} />
                <FormInput label="Export Limit (kW)" value={formData.exportLimitKw} onChange={(v) => update('exportLimitKw', v)} type="number" placeholder="e.g. 5.0" />
                <FormInput label="EV Charger" value={formData.evCharger} onChange={(v) => update('evCharger', v)} placeholder="e.g. Zappi 7kW, N/A" />
                <FormInput label="Hot Water System" value={formData.hotWaterSystem} onChange={(v) => update('hotWaterSystem', v)} placeholder="e.g. Heat Pump 250L" />
                <div className="md:col-span-2">
                  <FormTextarea label="Additional Products" value={formData.additionalProducts} onChange={(v) => update('additionalProducts', v)} placeholder="Any other products included in the deal..." />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Financial Information */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Urbanist' }}>Financial Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Total Contract Price ($)" value={formData.totalContractPrice} onChange={(v) => update('totalContractPrice', v)} type="number" required placeholder="e.g. 18500" />
              <FormInput label="Deposit Amount ($)" value={formData.depositAmount} onChange={(v) => update('depositAmount', v)} type="number" placeholder="e.g. 1000" />
              <FormSelect label="Deposit Paid?" value={formData.depositPaid} onChange={(v) => update('depositPaid', v)} options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
              ]} />
              <FormInput label="Deposit Date" value={formData.depositDate} onChange={(v) => update('depositDate', v)} type="date" />
              <FormSelect label="Payment Method" value={formData.paymentMethod} onChange={(v) => update('paymentMethod', v)} options={[
                { value: 'cash', label: 'Cash/Transfer' },
                { value: 'finance', label: 'Finance' },
                { value: 'green-loan', label: 'Green Loan' },
                { value: 'interest-free', label: 'Interest Free' },
                { value: 'mixed', label: 'Mixed' },
              ]} />
              <FormInput label="Finance Provider" value={formData.financeProvider} onChange={(v) => update('financeProvider', v)} placeholder="e.g. Plenti, Brighte" />
              <FormInput label="Finance Amount ($)" value={formData.financeAmount} onChange={(v) => update('financeAmount', v)} type="number" placeholder="Amount financed" />
              <FormInput label="Finance Term" value={formData.financeTerm} onChange={(v) => update('financeTerm', v)} placeholder="e.g. 5 years" />
              <FormInput label="STC Rebate Value ($)" value={formData.stcRebateValue} onChange={(v) => update('stcRebateValue', v)} type="number" placeholder="e.g. 3200" />
              <FormInput label="Number of STCs" value={formData.numberOfStcs} onChange={(v) => update('numberOfStcs', v)} type="number" placeholder="e.g. 85" />
            </div>

            {/* Auto-calculated fields */}
            {(calculatedValues.balanceDue || calculatedValues.pricePerWatt) && (
              <div className="mt-6 p-4 rounded-xl bg-[#5FB854]/5 border border-[#5FB854]/15">
                <p className="text-[#5FB854] text-xs font-medium mb-3" style={{ fontFamily: 'General Sans' }}>Auto-Calculated</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {calculatedValues.balanceDue && (
                    <div className="flex justify-between">
                      <span className="text-[#B0B1B5] text-sm" style={{ fontFamily: 'General Sans' }}>Balance Due</span>
                      <span className="text-white text-sm font-bold" style={{ fontFamily: 'General Sans' }}>${parseFloat(calculatedValues.balanceDue).toLocaleString()}</span>
                    </div>
                  )}
                  {calculatedValues.pricePerWatt && (
                    <div className="flex justify-between">
                      <span className="text-[#B0B1B5] text-sm" style={{ fontFamily: 'General Sans' }}>Price per Watt</span>
                      <span className="text-white text-sm font-bold" style={{ fontFamily: 'General Sans' }}>${calculatedValues.pricePerWatt}/W</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <FormTextarea label="Payment Schedule Notes" value={formData.paymentSchedule} onChange={(v) => update('paymentSchedule', v)} placeholder="e.g. 50% on install, 50% on commissioning..." />
          </div>
        )}

        {/* Step 4: Contract & Compliance */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Urbanist' }}>Contract & Compliance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Contract Signed Date" value={formData.contractSignedDate} onChange={(v) => update('contractSignedDate', v)} type="date" required />
              <FormInput label="CEC Installer" value={formData.cecInstaller} onChange={(v) => update('cecInstaller', v)} placeholder="CEC accredited installer name" />
              <FormInput label="CEC Designer" value={formData.cecDesigner} onChange={(v) => update('cecDesigner', v)} placeholder="CEC accredited designer name" />
            </div>

            <div className="space-y-4 mt-6">
              <p className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Warranty Periods (Years)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormInput label="Workmanship" value={formData.warrantyWorkmanshipYears} onChange={(v) => update('warrantyWorkmanshipYears', v)} type="number" />
                <FormInput label="Panel Product" value={formData.warrantyPanelProductYears} onChange={(v) => update('warrantyPanelProductYears', v)} type="number" />
                <FormInput label="Inverter" value={formData.warrantyInverterYears} onChange={(v) => update('warrantyInverterYears', v)} type="number" />
                <FormInput label="Battery" value={formData.warrantyBatteryYears} onChange={(v) => update('warrantyBatteryYears', v)} type="number" />
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/15">
              <p className="text-[#F59E0B] text-xs font-medium mb-2" style={{ fontFamily: 'General Sans' }}>Cooling-Off Period</p>
              <p className="text-[#B0B1B5] text-sm" style={{ fontFamily: 'General Sans' }}>
                The 10 business day cooling-off period will be automatically calculated from the contract signed date per CEC Code of Conduct requirements.
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Site & Technical Details */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Urbanist' }}>Site & Technical Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Roof Orientation" value={formData.roofOrientation} onChange={(v) => update('roofOrientation', v)} placeholder="e.g. North, North-West" />
              <FormInput label="Roof Pitch (degrees)" value={formData.roofPitch} onChange={(v) => update('roofPitch', v)} type="number" placeholder="e.g. 22" />
              <FormInput label="Shading Assessment" value={formData.shadingAssessment} onChange={(v) => update('shadingAssessment', v)} placeholder="e.g. Minimal, Moderate, Heavy" />
              <FormSelect label="Switchboard Condition" value={formData.switchboardCondition} onChange={(v) => update('switchboardCondition', v)} options={[
                { value: 'good', label: 'Good - No upgrade needed' },
                { value: 'needs-upgrade', label: 'Needs Upgrade' },
                { value: 'asbestos', label: 'Asbestos Panel' },
              ]} />
              <FormSelect label="Switchboard Upgrade Required?" value={formData.switchboardUpgrade} onChange={(v) => update('switchboardUpgrade', v)} options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
              ]} />
              <FormInput label="Cable Run (metres)" value={formData.cableRunMetres} onChange={(v) => update('cableRunMetres', v)} type="number" placeholder="e.g. 15" />
              <FormSelect label="Trenching Required?" value={formData.trenchingRequired} onChange={(v) => update('trenchingRequired', v)} options={[
                { value: 'no', label: 'No' },
                { value: 'yes', label: 'Yes' },
              ]} />
              <FormInput label="Annual Production Est. (kWh)" value={formData.annualProductionEstimate} onChange={(v) => update('annualProductionEstimate', v)} type="number" placeholder="e.g. 14500" />
              <FormInput label="Energy Offset (%)" value={formData.energyOffsetPercent} onChange={(v) => update('energyOffsetPercent', v)} type="number" placeholder="e.g. 85" />
            </div>
          </div>
        )}

        {/* Step 6: Sales Attribution */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Urbanist' }}>Sales Attribution & Notes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput label="Deal Owner" value={formData.dealOwner} onChange={(v) => update('dealOwner', v)} placeholder="Sales consultant name" />
              <FormInput label="Lead Source" value={formData.leadSource} onChange={(v) => update('leadSource', v)} placeholder="e.g. Solar Quotes, Referral" />
              <FormInput label="Referral Source" value={formData.referralSource} onChange={(v) => update('referralSource', v)} placeholder="Who referred this customer?" />
              <FormInput label="Days in Pipeline" value={formData.daysInPipeline} onChange={(v) => update('daysInPipeline', v)} type="number" placeholder="Days from lead to close" />
              <FormInput label="Proposals Sent" value={formData.proposalsSent} onChange={(v) => update('proposalsSent', v)} type="number" placeholder="Number of proposals" />
            </div>
            <FormTextarea label="Closed Won Reason" value={formData.closedWonReason} onChange={(v) => update('closedWonReason', v)} placeholder="Why did the customer choose us? Key factors in their decision..." />
            <FormTextarea label="Additional Notes" value={formData.notes} onChange={(v) => update('notes', v)} placeholder="Any other important information about this sale..." />
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-[#B0B1B5] hover:text-white hover:border-white/20 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontFamily: 'General Sans' }}
          >
            <ChevronLeft size={14} />
            Previous
          </button>

          <span className="text-[#7A7B80] text-xs" style={{ fontFamily: 'General Sans' }}>
            Step {currentStep} of {steps.length}
          </span>

          {currentStep < steps.length ? (
            <button
              onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97]"
              style={{ fontFamily: 'General Sans' }}
            >
              Next
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
              style={{ fontFamily: 'General Sans' }}
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {submitting ? 'Saving...' : 'Close Sale'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
