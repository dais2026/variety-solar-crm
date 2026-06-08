import { useState } from 'react';
import { 
  UserPlus, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Package, 
  FileText,
  CheckCircle,
  Copy,
  Download,
  RotateCcw,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface NewCustomerPanelProps {
  onCustomerCreated?: () => void;
}

interface CustomerFormData {
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
  phases: string;
  rooftopSolar: string;
  hotWater: string;
  heatingCooling: string;
  cooktop: string;
  vppNightUse: string;
  ev: string;
  brands: string;
  size: string;
  svr: string;
  notes: string;
}

const initialFormData: CustomerFormData = {
  dateStamp: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  name: '',
  contactNumber: '',
  email: '',
  address: '',
  outcome: 'Awaiting Information',
  leadSource: 'Solar Quotes',
  status: '',
  product: '',
  saleStatus: 'Pending',
  phases: '',
  rooftopSolar: '',
  hotWater: '',
  heatingCooling: '',
  cooktop: '',
  vppNightUse: '',
  ev: '',
  brands: '',
  size: '',
  svr: '',
  notes: '',
};

const outcomeOptions = [
  '-------',
  'Awaiting Information',
  'Recieved Information',
  'On hold',
  'Non-responsive.',
];

const leadSourceOptions = [
  '-------',
  'Solar Quotes',
  'Referral',
  'Website',
  'Phone Enquiry',
  'Walk-in',
  'Social Media',
  'Other',
];

const productOptions = [
  '-------',
  'PV+BATT',
  'PV',
  'PV+BATT+EV',
  'HP',
  'BATTERY',
  'PV+BATT+EV+HP',
  'EV',
  'BATT+HP',
  'BATT+EV',
  'AC+HP',
  'DO NOT OFFER',
];

const saleStatusOptions = [
  '-------',
  'Pending',
  'Proposal Sent',
  'Rejected',
  'Accepted',
  'Follow-up',
];

const brandsOptions = [
  '-------',
  'Goodwe GW8',
  'Goodwe G20',
  'Sigenergy 1Phase',
  'Sigenergy 3Phase',
  'Tesla PW3',
  'Anker 1 Phase',
  'Anker 3 Phase',
  'Fox ESS 1 Phase',
  'Swatten 1P',
  'Swatten 3P',
  'Sofar 1P',
  'Sofar 3P',
  'SolaX 1P',
  'SolaX 3P',
  'Neo 1P',
  'Neo 3P',
  'Hiker 1P',
  'Hiker 3P',
  'Alpha 1P',
  'Alpha 3P',
];

const sizeOptions = [
  '-------',
  '8kWh',
  '10kWh',
  '12kWh',
  '14kWh',
  '18kWh',
  '20kWh',
  '24kWh',
  '27kWh',
  '28kWh',
  '30kWh',
  '32kWh',
  '36kWh',
  '40kWh',
  '42kWh',
  '48kWh',
];

const rooftopSolarOptions = [
  '-------',
  'Existing',
  '6.6kW',
  '8kW',
  '8.5kW',
  '9kW',
  '9.5kW',
  '10kW',
  '10.5kW',
  '11kW',
  '12kW',
  '13kW',
  '14kW',
];

const phasesOptions = [
  '-------',
  '1-Phase',
  '2-Phase',
  '3-Phase',
];

const evOptions = [
  '-------',
  'EV - 1 -1P',
  'EV - 2 -1P',
  'EV - 1 -3P',
  'EV - 2 -3P',
  'Not Interested',
];

const vppNightUseOptions = [
  '-------',
  'VPP',
  'Night Usage',
  'VPP-Mainly',
  'VPP+Night Usage',
  'Not Sure',
];

const hotWaterOptions = [
  '-------',
  'Gas Storage',
  'Gas Instantaneous',
  'Gas storage.',
  'Gas - solar boosted',
  'Not sure.',
];

const cooktopOptions = [
  '-------',
  'Gas',
  'Gas + Electric oven',
  'Induction small',
  'Induction medium',
  'Induction Lodge.',
  'Not sure.',
];

const heatingCoolingOptions = [
  '-------',
  'Gas ducted',
  'Reverse cycle',
  'Evaporative.',
  'Gas plus splits.',
  'Splits only.',
  'Not sure.',
];

const svrOptions = [
  '-------',
  'SVR-Yes',
  'SVR-No',
];

export default function NewCustomerPanel({ onCustomerCreated }: NewCustomerPanelProps) {
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [submitted, setSubmitted] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const appendMutation = trpc.sheets.appendCustomer.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      setSubmitFailed(false);
      setSubmitting(false);
      toast.success('Customer added to Google Sheets successfully');
      if (onCustomerCreated) onCustomerCreated();
    },
    onError: (error) => {
      setSubmitting(false);
      setSubmitFailed(true);
      setSubmitted(true);
      toast.error(`Failed to add to Google Sheets: ${error.message}`);
    },
  });

  const updateField = (field: keyof CustomerFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value === '-------' ? '' : value }));
  };

  const handleReset = () => {
    setFormData({
      ...initialFormData,
      dateStamp: new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    });
    setSubmitted(false);
    setSubmitFailed(false);
    setCurrentStep(1);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (!formData.contactNumber.trim() && !formData.email.trim()) {
      toast.error('At least a phone number or email is required');
      return;
    }
    setSubmitting(true);
    // Format date as DD.MM.YY to match sheet format
    const now = new Date();
    const dateForSheet = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`;
    appendMutation.mutate({
      dateStamp: dateForSheet,
      name: formData.name,
      contactNumber: formData.contactNumber,
      email: formData.email,
      address: formData.address,
      outcome: formData.outcome,
      leadSource: formData.leadSource,
      status: formData.status,
      product: formData.product,
      saleStatus: formData.saleStatus,
      notes: formData.notes,
      svr: formData.svr,
      phases: formData.phases,
      rooftopSolar: formData.rooftopSolar,
      hotWater: formData.hotWater,
      heatingCooling: formData.heatingCooling,
      cooktop: formData.cooktop,
      vppNightUse: formData.vppNightUse,
      ev: formData.ev,
      brands: formData.brands,
      size: formData.size,
    });
  };

  const generateCSVRow = () => {
    const fields = [
      formData.dateStamp,
      formData.name,
      formData.contactNumber,
      formData.email,
      formData.address,
      formData.outcome,
      formData.leadSource,
      formData.status,
      formData.product,
      formData.saleStatus,
      '', // DATE SENT
      '', // No of Days
      '', // COSTS
      '', // SELL MARGINS
      formData.svr,
      formData.phases,
      formData.rooftopSolar,
      formData.hotWater,
      formData.heatingCooling,
      formData.cooktop,
      '', // Product2
      formData.vppNightUse,
      formData.ev,
      formData.brands,
      formData.size,
    ];
    return fields.map(f => `"${f}"`).join(',');
  };

  const handleCopyToClipboard = () => {
    const csvRow = generateCSVRow();
    navigator.clipboard.writeText(csvRow).then(() => {
      toast.success('Row copied to clipboard — paste into Google Sheets');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const handleDownloadCSV = () => {
    const headers = 'DATE STAMP,Name,Contact Number,Email Address,Address,Outcome,Lead Source,Status,Product,Sale Status,DATE SENT,No of Days,COSTS,SELL MARGINS (%),SVR,Phases,Rooftop Solar,Hot Water,Heating Cooling,Cooktop,Product,VPP - NIGHT USE,EV,Brands,SIZE';
    const csvRow = generateCSVRow();
    const blob = new Blob([headers + '\n' + csvRow], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `new-customer-${formData.name.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const steps = [
    { id: 1, label: 'Contact Details', icon: User },
    { id: 2, label: 'Lead Information', icon: FileText },
    { id: 3, label: 'Product Details', icon: Package },
  ];

  // Input component for consistent styling
  const FormInput = ({ label, value, onChange, placeholder, type = 'text', icon: Icon }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    icon?: typeof User;
  }) => (
    <div>
      <label className="text-[#B0B1B5] text-xs mb-2 block" style={{ fontFamily: 'General Sans' }}>
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A7B80]" />
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-[#0A0A0A] border border-white/10 rounded-xl ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-3 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 transition-colors placeholder:text-[#7A7B80]/50`}
          style={{ fontFamily: 'General Sans' }}
        />
      </div>
    </div>
  );

  const FormSelect = ({ label, value, onChange, options }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
  }) => (
    <div>
      <label className="text-[#B0B1B5] text-xs mb-2 block" style={{ fontFamily: 'General Sans' }}>
        {label}
      </label>
      <select
        value={value || '-------'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm appearance-none focus:outline-none focus:border-[#5FB854]/50 transition-colors"
        style={{ fontFamily: 'General Sans' }}
      >
        {options.map(opt => (
          <option key={opt} value={opt} className="bg-[#0A0A0A] text-white">{opt}</option>
        ))}
      </select>
    </div>
  );

  if (submitted) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Success State */}
        <div className="bg-[#111111] border border-[#5FB854]/20 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#5FB854]/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-[#5FB854]" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'Urbanist' }}>
            {submitFailed ? 'Customer Saved Locally' : 'Customer Created'}
          </h2>
          <p className="text-[#B0B1B5] text-sm mb-6" style={{ fontFamily: 'General Sans' }}>
            {submitFailed
              ? `Could not sync ${formData.name} to Google Sheets (token may have expired). Download the CSV below and add manually, or try again later.`
              : `${formData.name} has been added to your Google Sheet. The Leads panel will update on next refresh. You can also download a CSV copy below.`
            }
          </p>

          {/* Customer Summary Card */}
          <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-6 text-left mb-6 max-w-lg mx-auto">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Name</span>
                <span className="text-white text-sm font-medium" style={{ fontFamily: 'General Sans' }}>{formData.name}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Phone</span>
                <span className="text-white text-sm" style={{ fontFamily: 'Space Mono' }}>{formData.contactNumber || '—'}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Email</span>
                <span className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{formData.email || '—'}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Product</span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#5FB854]/10 text-[#5FB854] text-xs" style={{ fontFamily: 'General Sans' }}>{formData.product || '—'}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Brands</span>
                <span className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{formData.brands || '—'}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Size</span>
                <span className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{formData.size || '—'}</span>
              </div>
              <div className="h-px bg-white/5" />
              <div className="flex justify-between items-center">
                <span className="text-[#7A7B80] text-xs uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>Source</span>
                <span className="text-white text-sm" style={{ fontFamily: 'General Sans' }}>{formData.leadSource}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleCopyToClipboard}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97]"
              style={{ fontFamily: 'General Sans' }}
            >
              <Copy size={16} />
              Copy Row for Sheets
            </button>
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-white text-sm transition-all duration-160 hover:bg-white/5 active:scale-[0.97]"
              style={{ fontFamily: 'General Sans' }}
            >
              <Download size={16} />
              Download CSV
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-white/10 text-[#B0B1B5] text-sm transition-all duration-160 hover:bg-white/5 active:scale-[0.97]"
              style={{ fontFamily: 'General Sans' }}
            >
              <RotateCcw size={16} />
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Urbanist' }}>
            New Customer
          </h2>
          <p className="text-[#7A7B80] text-sm mt-1" style={{ fontFamily: 'General Sans' }}>
            Create a new lead entry for the CRM
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#5FB854]/10 border border-[#5FB854]/20">
          <UserPlus size={14} className="text-[#5FB854]" />
          <span className="text-[#5FB854] text-xs font-medium" style={{ fontFamily: 'General Sans' }}>
            Step {currentStep} of 3
          </span>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === step.id;
          const isComplete = currentStep > step.id;
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => setCurrentStep(step.id)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all duration-200 w-full ${
                  isActive
                    ? 'bg-[#5FB854]/10 border-[#5FB854]/30 text-[#5FB854]'
                    : isComplete
                    ? 'bg-[#5FB854]/10 border-[#5FB854]/20 text-[#5FB854]'
                    : 'border-white/5 text-[#7A7B80] hover:border-white/10'
                }`}
                style={{ fontFamily: 'General Sans', fontSize: '12px' }}
              >
                {isComplete ? <CheckCircle size={14} /> : <Icon size={14} />}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < steps.length - 1 && (
                <ChevronRight size={14} className="text-[#7A7B80] shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Form Content */}
      <div className="bg-[#111111] border border-white/5 rounded-2xl p-6">
        {/* Step 1: Contact Details */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <h3 className="text-white font-semibold text-lg mb-4" style={{ fontFamily: 'Urbanist' }}>
              Contact Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormInput
                label="Full Name *"
                value={formData.name}
                onChange={(v) => updateField('name', v)}
                placeholder="e.g. John Smith"
                icon={User}
              />
              <FormInput
                label="Date"
                value={formData.dateStamp}
                onChange={(v) => updateField('dateStamp', v)}
                placeholder="DD/MM/YYYY"
              />
              <FormInput
                label="Contact Number"
                value={formData.contactNumber}
                onChange={(v) => updateField('contactNumber', v)}
                placeholder="e.g. 0412 345 678"
                type="tel"
                icon={Phone}
              />
              <FormInput
                label="Email Address"
                value={formData.email}
                onChange={(v) => updateField('email', v)}
                placeholder="e.g. john@example.com"
                type="email"
                icon={Mail}
              />
            </div>
            <FormInput
              label="Address"
              value={formData.address}
              onChange={(v) => updateField('address', v)}
              placeholder="e.g. 123 Main Street, Melbourne VIC 3000"
              icon={MapPin}
            />
          </div>
        )}

        {/* Step 2: Lead Information */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <h3 className="text-white font-semibold text-lg mb-4" style={{ fontFamily: 'Urbanist' }}>
              Lead Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormSelect
                label="Lead Source"
                value={formData.leadSource}
                onChange={(v) => updateField('leadSource', v)}
                options={leadSourceOptions}
              />
              <FormSelect
                label="Discovery"
                value={formData.outcome}
                onChange={(v) => updateField('outcome', v)}
                options={outcomeOptions}
              />
              <FormSelect
                label="Sale Status"
                value={formData.saleStatus}
                onChange={(v) => updateField('saleStatus', v)}
                options={saleStatusOptions}
              />
              <FormInput
                label="Status Detail"
                value={formData.status}
                onChange={(v) => updateField('status', v)}
                placeholder="e.g. Proposal sent."
              />
            </div>
            <div>
              <label className="text-[#B0B1B5] text-xs mb-2 block" style={{ fontFamily: 'General Sans' }}>
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any additional notes about this lead..."
                rows={3}
                className="w-full bg-[#0A0A0A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#5FB854]/50 transition-colors placeholder:text-[#7A7B80]/50 resize-none"
                style={{ fontFamily: 'General Sans' }}
              />
            </div>
          </div>
        )}

        {/* Step 3: Product Details */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <h3 className="text-white font-semibold text-lg mb-4" style={{ fontFamily: 'Urbanist' }}>
              Product Details
            </h3>
            
            {/* Primary Product Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              <FormSelect
                label="Product"
                value={formData.product}
                onChange={(v) => updateField('product', v)}
                options={productOptions}
              />
              <FormSelect
                label="Brands"
                value={formData.brands}
                onChange={(v) => updateField('brands', v)}
                options={brandsOptions}
              />
              <FormSelect
                label="SIZE (Battery)"
                value={formData.size}
                onChange={(v) => updateField('size', v)}
                options={sizeOptions}
              />
            </div>

            {/* System Configuration */}
            <div className="pt-4 border-t border-white/5">
              <p className="text-[#B0B1B5] text-xs mb-4 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                System Configuration
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <FormSelect
                  label="Rooftop Solar"
                  value={formData.rooftopSolar}
                  onChange={(v) => updateField('rooftopSolar', v)}
                  options={rooftopSolarOptions}
                />
                <FormSelect
                  label="Phases"
                  value={formData.phases}
                  onChange={(v) => updateField('phases', v)}
                  options={phasesOptions}
                />
                <FormSelect
                  label="SVR"
                  value={formData.svr}
                  onChange={(v) => updateField('svr', v)}
                  options={svrOptions}
                />
              </div>
            </div>

            {/* Electrification Options */}
            <div className="pt-4 border-t border-white/5">
              <p className="text-[#B0B1B5] text-xs mb-4 uppercase tracking-wider" style={{ fontFamily: 'General Sans' }}>
                Electrification Options
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <FormSelect
                  label="EV"
                  value={formData.ev}
                  onChange={(v) => updateField('ev', v)}
                  options={evOptions}
                />
                <FormSelect
                  label="VPP - Night Use"
                  value={formData.vppNightUse}
                  onChange={(v) => updateField('vppNightUse', v)}
                  options={vppNightUseOptions}
                />
                <FormSelect
                  label="Hot Water"
                  value={formData.hotWater}
                  onChange={(v) => updateField('hotWater', v)}
                  options={hotWaterOptions}
                />
                <FormSelect
                  label="Cooktop"
                  value={formData.cooktop}
                  onChange={(v) => updateField('cooktop', v)}
                  options={cooktopOptions}
                />
                <FormSelect
                  label="Heating / Cooling"
                  value={formData.heatingCooling}
                  onChange={(v) => updateField('heatingCooling', v)}
                  options={heatingCoolingOptions}
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-white/5">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-[#B0B1B5] text-sm transition-all hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.97]"
            style={{ fontFamily: 'General Sans' }}
          >
            Back
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-[#7A7B80] text-sm transition-all hover:bg-white/5 active:scale-[0.97]"
              style={{ fontFamily: 'General Sans' }}
            >
              <RotateCcw size={14} />
              Reset
            </button>
            {currentStep < 3 ? (
              <button
                onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97]"
                style={{ fontFamily: 'General Sans' }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5FB854] text-[#0A0A0A] font-semibold text-sm transition-all duration-160 hover:brightness-110 active:scale-[0.97] disabled:opacity-50"
                style={{ fontFamily: 'General Sans' }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                {submitting ? 'Adding to Sheet...' : 'Create Customer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
