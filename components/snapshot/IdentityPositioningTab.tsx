import React, { useState, useEffect, useMemo } from 'react';
import {
    Card,
    Button,
    Input,
    Select,
    Label,
    Tooltip,
    TooltipContent,
    TooltipTrigger
} from '../ui'; // Importing from components/ui.tsx
import {
    Building2,
    Info,
    Check,
    Loader2,
    AlertCircle,
    ChevronDown,
    ChevronUp,
    Target,
    Lightbulb,
    Sparkles
} from 'lucide-react';
import { MultiSelectDropdown } from '../MultiSelectDropdown';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// --- Types ---

interface IdentityFormData {
    agencyTypes: string[];
    agencyTypesOther: string;
    servicesOffered: string[];
    servicesOfferedOther: string;
    industriesServed: string[];
    industriesServedOther: string;
    geographicFootprint: string;
    pricingStrategies: string[];
    websiteUrl: string;
    positioningContext: string;
}

interface SynthesisState {
    status: 'idle' | 'running' | 'complete' | 'error' | 'skipped';
    beats: Array<{ headline: string; copy: string }>;
    signal: string;
    errorMsg: string;
}

// --- Constants ---

const SERVICE_OPTIONS = [
    { value: 'seo', label: 'SEO' },
    { value: 'paid_media', label: 'Paid Media (PPC/SEM)' },
    { value: 'social_media', label: 'Social Media Marketing' },
    { value: 'content_marketing', label: 'Content Marketing' },
    { value: 'creative_design', label: 'Creative/Design' },
    { value: 'branding_strategy', label: 'Branding/Strategy' },
    { value: 'web_development', label: 'Web Development' },
    { value: 'email_marketing', label: 'Email Marketing' },
    { value: 'marketing_automation', label: 'Marketing Automation' },
    { value: 'analytics_bi', label: 'Analytics/BI' },
    { value: 'other', label: 'Other' },
];

const INDUSTRY_OPTIONS = [
    { value: 'b2b_saas', label: 'B2B SaaS' },
    { value: 'ecommerce', label: 'E-commerce' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'finance', label: 'Finance/Financial Services' },
    { value: 'pro_services', label: 'Professional Services' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'real_estate', label: 'Real Estate' },
    { value: 'education', label: 'Education' },
    { value: 'nonprofit', label: 'Nonprofit' },
    { value: 'hospitality', label: 'Hospitality/Travel' },
    { value: 'tech_nonsaas', label: 'Technology (non-SaaS)' },
    { value: 'retail', label: 'Retail' },
    { value: 'generalist', label: 'Generalist (Industry Agnostic)' },
    { value: 'other', label: 'Other' },
];

const PRICING_OPTIONS = [
    { value: 'value_based', label: 'Value-based pricing' },
    { value: 'retainer', label: 'Retainer (ongoing monthly)' },
    { value: 'project_based', label: 'Project-based (fixed scope/price)' },
    { value: 'hourly', label: 'Hourly/Time-based' },
    { value: 'cost_plus', label: 'Cost-plus (expenses + markup)' },
    { value: 'performance', label: 'Performance/Results-based' },
    { value: 'hybrid', label: 'Hybrid model' },
];

// --- Canonical input hash (SHA-256 over sorted, normalized fields) ---

async function computeInputHash(form: IdentityFormData): Promise<string> {
    const canonical = {
        agency_types: [...form.agencyTypes.filter(v => v !== 'other' && v !== 'generalist')].sort(),
        agency_types_other: form.agencyTypesOther.trim() || null,
        services_offered: [...form.servicesOffered.filter(v => v !== 'other' && v !== 'generalist')].sort(),
        services_offered_other: form.servicesOfferedOther.trim() || null,
        industries_served: [...form.industriesServed.filter(v => v !== 'other' && v !== 'generalist')].sort(),
        industries_served_other: form.industriesServedOther.trim() || null,
        geographic_footprint: form.geographicFootprint.trim() || null,
        pricing_strategies: [...form.pricingStrategies].sort(),
        website_url: form.websiteUrl.trim() || null,
        positioning_context: form.positioningContext.trim() || null,
    };
    const encoded = new TextEncoder().encode(JSON.stringify(canonical));
    const buf = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Helper Components ---

const PositioningAccordion: React.FC<{ children: React.ReactNode; title: string, description?: string }> = ({ children, title, description }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="border border-[var(--aos-mist)] rounded-lg bg-[var(--bg-canvas)] mb-8 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--bg-sunken)] transition-colors"
            >
                <div>
                    <span className="block text-sm font-medium text-[var(--fg-2)]">{title}</span>
                    <span className="block text-xs text-[var(--fg-3)] mt-1 font-normal">
                        {description}
                    </span>
                </div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-[var(--fg-4)]" /> : <ChevronDown className="h-4 w-4 text-[var(--fg-4)]" />}
            </button>
            {isOpen && (
                <div className="p-4 border-t border-[var(--aos-mist)] bg-[var(--bg-surface)] space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
};

const ExpandableInsightCard: React.FC<{ headline: string, copy: string }> = ({ headline, copy }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg shadow-[var(--shadow-soft-1)] relative overflow-hidden group transition-all hover:border-[var(--aos-insight)] hover:shadow-[var(--shadow-soft-2)]">
            <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${isOpen ? 'bg-[var(--aos-insight)]' : 'bg-[var(--aos-mist)] group-hover:bg-[var(--aos-insight)]'}`}></div>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-left p-5 focus:outline-none flex flex-col"
            >
                <div className="flex justify-between items-start gap-4 w-full">
                    <h5 className={`font-bold text-sm leading-tight transition-colors ${isOpen ? 'text-[var(--fg-1)]' : 'text-[var(--fg-1)] group-hover:text-[var(--fg-1)]'}`}>
                        {headline}
                    </h5>
                    <div className="shrink-0 bg-[var(--bg-canvas)] p-1 rounded-md text-[var(--fg-4)] group-hover:text-[var(--aos-insight)] group-hover:bg-[var(--aos-insight-tint)] transition-colors">
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                </div>
                {!isOpen && (
                    <div className="mt-2 text-xs font-semibold text-[var(--fg-4)] group-hover:text-[var(--aos-insight)] transition-colors flex items-center gap-1">
                        Read analysis
                    </div>
                )}
            </button>

            {isOpen && (
                <div className="px-5 pb-5 pt-2 border-t border-[var(--aos-mist)] animate-in slide-in-from-top-1 fade-in duration-200">
                    <p className="text-sm text-[var(--fg-2)] leading-relaxed">{copy}</p>
                </div>
            )}
        </div>
    );
};

// --- Main Component ---

export const IdentityPositioningTab: React.FC = () => {
    const { user } = useAuth();

    const [currentRowId, setCurrentRowId] = useState<string | null>(null);
    const [formData, setFormData] = useState<IdentityFormData>({
        agencyTypes: [],
        agencyTypesOther: '',
        servicesOffered: [],
        servicesOfferedOther: '',
        industriesServed: [],
        industriesServedOther: '',
        geographicFootprint: '',
        pricingStrategies: [],
        websiteUrl: '',
        positioningContext: '',
    });
    const [initialData, setInitialData] = useState<IdentityFormData | null>(null);

    const hasChanges = useMemo(() => {
        if (!initialData) return true;
        return JSON.stringify(formData) !== JSON.stringify(initialData);
    }, [formData, initialData]);

    const hasSavedRecord = !!initialData && !!currentRowId;

    // Reference Data State
    const [agencyTypes, setAgencyTypes] = useState<{ value: string; label: string }[]>([]);
    const [serviceOptions, setServiceOptions] = useState<{ value: string; label: string }[]>([]);
    const [industryOptions, setIndustryOptions] = useState<{ value: string; label: string }[]>([]);
    const [loadingRefData, setLoadingRefData] = useState(true);

    React.useEffect(() => {
        const loadRefData = async () => {
            try {
                setLoadingRefData(true);

                const { data: types } = await supabase
                    .from('agency_snapshot_agency_type_ref_table')
                    .select('id, name')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (types) {
                    setAgencyTypes(types.map(t => ({ value: t.id, label: t.name })));
                }

                const { data: services } = await supabase
                    .from('agency_snapshot_services_ref_table')
                    .select('id, name')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (services) {
                    const ops = services.map(s => ({ value: s.id, label: s.name }));
                    ops.push({ value: 'other', label: 'Other (please specify below)' });
                    setServiceOptions(ops);
                }

                const { data: industries } = await supabase
                    .from('agency_snapshot_industries_ref_table')
                    .select('id, name')
                    .eq('is_active', true)
                    .order('sort_order', { ascending: true });

                if (industries) {
                    const ops = industries.map(i => ({ value: i.id, label: i.name }));
                    if (!ops.find(o => o.label.toLowerCase().includes('generalist'))) {
                        ops.push({ value: 'generalist', label: 'Generalist (Industry Agnostic)' });
                    }
                    ops.push({ value: 'other', label: 'Other (please specify below)' });
                    setIndustryOptions(ops);
                }

            } catch (error) {
                console.error("Error loading reference data:", error);
            } finally {
                setLoadingRefData(false);
            }
        };

        loadRefData();
    }, []);

    // Load the user's current version on mount
    useEffect(() => {
        if (!user) return;
        const loadUserData = async () => {
            try {
                const { data, error } = await supabase
                    .from('agency_snapshot_market_footprint')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('is_current', true)
                    .maybeSingle();

                if (error) throw error;

                if (data) {
                    const loadedData: IdentityFormData = {
                        agencyTypes: data.agency_types || [],
                        agencyTypesOther: data.agency_types_other || '',
                        servicesOffered: data.services_offered || [],
                        servicesOfferedOther: data.services_offered_other || '',
                        industriesServed: data.industries_served || [],
                        industriesServedOther: data.industries_served_other || '',
                        geographicFootprint: data.geographic_footprint || '',
                        pricingStrategies: data.pricing_strategies || [],
                        websiteUrl: data.website_url || '',
                        positioningContext: data.positioning_context || '',
                    };

                    // Re-inject 'other' sentinel if the freetext field is populated
                    if (loadedData.agencyTypesOther && !loadedData.agencyTypes.includes('other')) {
                        loadedData.agencyTypes.push('other');
                    }
                    if (loadedData.servicesOfferedOther && !loadedData.servicesOffered.includes('other')) {
                        loadedData.servicesOffered.push('other');
                    }
                    if (loadedData.industriesServedOther && !loadedData.industriesServed.includes('other')) {
                        loadedData.industriesServed.push('other');
                    }

                    setFormData(loadedData);
                    setInitialData(loadedData);
                    setCurrentRowId(data.id);

                    hydrateSynthesis(data);
                    setShowProfile(true);
                }
            } catch (error) {
                console.error("Error loading user data:", error);
            }
        };
        loadUserData();
    }, [user]);

    const hydrateSynthesis = (data: Record<string, unknown>) => {
        if (data.synthesis_status) {
            setSynthesis(prev => ({ ...prev, status: data.synthesis_status as SynthesisState['status'] }));
        }
        if (data.synthesis_beat_1_headline) {
            setSynthesis(prev => ({
                ...prev,
                beats: [
                    { headline: data.synthesis_beat_1_headline as string, copy: (data.synthesis_beat_1 as string) || '' },
                    { headline: (data.synthesis_beat_2_headline as string) || '', copy: (data.synthesis_beat_2 as string) || '' },
                    { headline: (data.synthesis_beat_3_headline as string) || '', copy: (data.synthesis_beat_3 as string) || '' },
                ],
            }));
        }
        if (data.synthesis_signal) {
            setSynthesis(prev => ({ ...prev, signal: data.synthesis_signal as string }));
        }
        if (data.synthesis_error) {
            setSynthesis(prev => ({ ...prev, errorMsg: data.synthesis_error as string }));
        }
    };

    const [isProcessing, setIsProcessing] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [synthesis, setSynthesis] = useState<SynthesisState>({
        status: 'idle',
        beats: [],
        signal: '',
        errorMsg: '',
    });

    // Validation
    const errors = {
        agencyTypes: formData.agencyTypes.length === 0,
        industriesServed: formData.industriesServed.length === 0,
        geographicFootprint: formData.geographicFootprint === '',
        pricingStrategies: formData.pricingStrategies.length === 0,
    };

    const isValid = !errors.agencyTypes && !errors.industriesServed && !errors.geographicFootprint && !errors.pricingStrategies;

    const handleChange = (field: keyof IdentityFormData, value: unknown) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (saveStatus === 'success') setSaveStatus('idle');
    };

    // Reactivate-or-insert save logic
    const handleSave = async (): Promise<string | null> => {
        if (!isValid || !user) return null;

        setIsProcessing(true);
        setSaveStatus('idle');

        try {
            const h = await computeInputHash(formData);

            // Check if this combination already exists for this user
            const { data: match } = await supabase
                .from('agency_snapshot_market_footprint')
                .select('*')
                .eq('user_id', user.id)
                .eq('input_hash', h)
                .limit(1)
                .maybeSingle();

            let rowId: string;

            if (match) {
                // Resurfaced: re-promote the existing row, hydrate its cached synthesis
                const { error } = await supabase
                    .from('agency_snapshot_market_footprint')
                    .update({ is_current: true, updated_at: new Date().toISOString() })
                    .eq('id', match.id);
                if (error) throw error;

                rowId = match.id;
                hydrateSynthesis(match);
            } else {
                // Net-new combination: insert a new row (trigger assigns version_number, is_current demotes prior)
                const { data: inserted, error } = await supabase
                    .from('agency_snapshot_market_footprint')
                    .insert({
                        user_id: user.id,
                        agency_types: formData.agencyTypes.filter(id => id !== 'other' && id !== 'generalist'),
                        agency_types_other: formData.agencyTypesOther,
                        services_offered: formData.servicesOffered.filter(id => id !== 'other' && id !== 'generalist'),
                        services_offered_other: formData.servicesOfferedOther,
                        industries_served: formData.industriesServed.filter(id => id !== 'other' && id !== 'generalist'),
                        industries_served_other: formData.industriesServedOther,
                        geographic_footprint: formData.geographicFootprint,
                        pricing_strategies: formData.pricingStrategies,
                        website_url: formData.websiteUrl,
                        positioning_context: formData.positioningContext,
                        input_hash: h,
                        is_current: true,
                        is_complete: true,
                        // version_number: omitted — trigger assigns it
                        // snapshot_instance_id: omitted — dashboard-owned, stays null
                        // synthesis_status: omitted — starts idle
                    })
                    .select('id')
                    .single();
                if (error) throw error;

                rowId = inserted.id;
                // Clear synthesis state for the new row
                setSynthesis({ status: 'idle', beats: [], signal: '', errorMsg: '' });
            }

            setCurrentRowId(rowId);
            setInitialData(formData);
            setSaveStatus('success');
            setShowProfile(true);
            setTimeout(() => setSaveStatus('idle'), 3000);
            return rowId;

        } catch (error) {
            console.error("Error saving market footprint data:", error);
            setSaveStatus('error');
            return null;
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRunSynthesis = async () => {
        if (!isValid || !user) return;

        let rowId = currentRowId;

        // Save first if the form is dirty
        if (hasChanges) {
            rowId = await handleSave();
            if (!rowId) return;
        }

        // If this row already has complete synthesis, do nothing
        if (synthesis.status === 'complete' && synthesis.beats.length > 0) return;

        setIsSynthesizing(true);
        setSynthesis(prev => ({ ...prev, status: 'running' }));

        try {
            const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'http://localhost:5678/webhook';
            fetch(`${webhookUrl}/agency-snapshot/market-footprint/synthesize`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-architectos-secret': 'ArchitectOS_9f3a2c1d_7b8e_4c99_a1e2_3d4f5g6h7i8j'
                },
                body: JSON.stringify({ id: rowId, user_id: user.id })
            }).catch(console.error);

            pollSynthesisStatus(rowId!);

        } catch (error) {
            console.error("Error triggering synthesis:", error);
            setSynthesis(prev => ({ ...prev, status: 'error' }));
            setIsSynthesizing(false);
        }
    };

    const pollSynthesisStatus = async (rowId: string) => {
        try {
            const { data, error } = await supabase
                .from('agency_snapshot_market_footprint')
                .select('synthesis_status, synthesis_beat_1_headline, synthesis_beat_1, synthesis_beat_2_headline, synthesis_beat_2, synthesis_beat_3_headline, synthesis_beat_3, synthesis_signal, synthesis_error')
                .eq('id', rowId)
                .single();

            if (error) throw error;

            if (data && (data.synthesis_status === 'complete' || data.synthesis_status === 'error')) {
                setIsSynthesizing(false);
                if (data.synthesis_status === 'complete') {
                    setSynthesis({
                        status: 'complete',
                        beats: [
                            { headline: data.synthesis_beat_1_headline || '', copy: data.synthesis_beat_1 || '' },
                            { headline: data.synthesis_beat_2_headline || '', copy: data.synthesis_beat_2 || '' },
                            { headline: data.synthesis_beat_3_headline || '', copy: data.synthesis_beat_3 || '' },
                        ],
                        signal: data.synthesis_signal || '',
                        errorMsg: '',
                    });
                } else {
                    setSynthesis(prev => ({
                        ...prev,
                        status: 'error',
                        errorMsg: data.synthesis_error || 'Unknown error occurred during synthesis.',
                    }));
                }
            } else {
                setTimeout(() => pollSynthesisStatus(rowId), 3000);
            }
        } catch (err) {
            console.error("Error polling synthesis status:", err);
            setTimeout(() => pollSynthesisStatus(rowId), 3000);
        }
    };

    const getButtonText = () => {
        if (!hasSavedRecord) return "Save Market Footprint Data";
        if (hasChanges) return "Update Market Footprint Data";
        return "Saved";
    };

    const isSaveDisabled = !isValid || isProcessing || (!hasChanges && hasSavedRecord);

    const getAgencyTypeLabels = (ids: string[]) => ids.map(id => agencyTypes.find(t => t.value === id)?.label || id).join(', ');
    const getServiceLabels = (ids: string[]) => ids.map(id => serviceOptions.find(s => s.value === id)?.label || id).join(', ');
    const getIndustryLabels = (ids: string[]) => ids.map(id => industryOptions.find(i => i.value === id)?.label || id).join(', ');
    const getPricingLabels = (ids: string[]) => ids.map(id => PRICING_OPTIONS.find(p => p.value === id)?.label || id).join(', ');

    const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[var(--aos-mist)]">
            <h3 className="text-sm font-bold text-[var(--fg-1)] uppercase tracking-wider">{title}</h3>
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Panel: Form */}
            <div className="flex-1 min-w-0">
                <Card className="p-6 sm:p-8">
                    <div className="flex items-start gap-4 mb-6 pb-6 border-b border-[var(--aos-mist)]">
                        <div className="p-2 bg-[var(--bg-canvas)] rounded-lg">
                            <Building2 className="h-6 w-6 text-[var(--fg-2)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--fg-1)]">Market Footprint</h2>
                            <p className="text-sm text-[var(--fg-3)] mt-1">Who you are, who you serve, and how you work.</p>
                        </div>
                    </div>

                    {/* SECTION 1: AGENCY FOCUS & SERVICES */}
                    <div className="mb-8">
                        <SectionHeader title="Agency Focus & Services" />
                        <div className="space-y-6">

                            <div>
                                <Label>Agency Focus (Primary Services) *</Label>
                                <MultiSelectDropdown
                                    options={[...agencyTypes, { value: 'other', label: 'Other (please specify below)' }]}
                                    value={formData.agencyTypes}
                                    onChange={(val) => handleChange('agencyTypes', val)}
                                    placeholder="Select agency focus..."
                                    searchable={true}
                                />
                                {formData.agencyTypes.includes('other') && (
                                    <div className="mt-2">
                                        <Input
                                            placeholder="Specify agency focus"
                                            value={formData.agencyTypesOther}
                                            onChange={(e) => handleChange('agencyTypesOther', e.target.value)}
                                            maxLength={100}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <Label>Services Offered (Secondary) (Optional)</Label>
                                </div>
                                <MultiSelectDropdown
                                    options={serviceOptions}
                                    value={formData.servicesOffered}
                                    onChange={(val) => handleChange('servicesOffered', val)}
                                    placeholder="Select services offered..."
                                    searchable={true}
                                />
                                {formData.servicesOffered.includes('other') && (
                                    <div className="mt-2">
                                        <Input
                                            placeholder="Specify other services"
                                            value={formData.servicesOfferedOther}
                                            onChange={(e) => handleChange('servicesOfferedOther', e.target.value)}
                                            maxLength={100}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: MARKET FOCUS */}
                    <div className="mb-8">
                        <SectionHeader title="Market Focus" />

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                        <Label className="mb-0">Primary Industries Served * <span className="text-[var(--fg-4)] font-normal">(Max 10)</span></Label>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Info className="h-4 w-4 text-[var(--fg-4)] cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-xs">
                                                <p>If you are industry agnostic, select <strong>Generalist</strong> as one option, but also select the primary industries that make up your current client base.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>
                                <MultiSelectDropdown
                                    options={industryOptions}
                                    value={formData.industriesServed}
                                    onChange={(val) => handleChange('industriesServed', val)}
                                    maxSelection={10}
                                    placeholder="Select industries..."
                                    searchable={true}
                                />
                                {formData.industriesServed.includes('other') && (
                                    <div className="mt-2 ml-4">
                                        <Input
                                            placeholder="Specify other industries"
                                            value={formData.industriesServedOther}
                                            onChange={(e) => handleChange('industriesServedOther', e.target.value)}
                                            maxLength={100}
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <Label>Geographic Footprint *</Label>
                                <Select
                                    value={formData.geographicFootprint}
                                    onChange={(e) => handleChange('geographicFootprint', e.target.value)}
                                >
                                    <option value="" disabled>Select footprint...</option>
                                    <option value="local">Local (single city/metro area)</option>
                                    <option value="regional">Regional (state or multi-state region)</option>
                                    <option value="national">National (US-wide)</option>
                                    <option value="international">International</option>
                                </Select>
                                <p className="text-xs text-[var(--fg-3)] mt-1">Generally, how distributed are the clients you serve?</p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: PRICING MODEL */}
                    <div className="mb-8">
                        <SectionHeader title="Pricing Model" />
                        <div>
                            <Label className="mb-2">Overall Pricing Strategy *</Label>
                            <MultiSelectDropdown
                                options={PRICING_OPTIONS}
                                value={formData.pricingStrategies}
                                onChange={(val) => handleChange('pricingStrategies', val)}
                                placeholder="Select all that apply..."
                            />
                            <p className="text-xs text-[var(--fg-3)] mt-1">How do you typically or generally price your work?</p>
                        </div>
                    </div>

                    {/* SECTION 4: POSITIONING */}
                    <PositioningAccordion
                        title="Positioning (Optional)"
                        description="Provide additional context for deeper insights"
                    >
                        <div className="space-y-6">
                            <div>
                                <Label>Website URL</Label>
                                <Input
                                    type="url"
                                    placeholder="https://yourwebsite.com"
                                    value={formData.websiteUrl}
                                    onChange={(e) => handleChange('websiteUrl', e.target.value)}
                                />
                                <p className="text-xs text-[var(--fg-3)] mt-1">We'll analyze your web presence to understand your market positioning</p>
                            </div>
                            <div>
                                <Label>Additional Positioning Context</Label>
                                <textarea
                                    className="block w-full rounded-md border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] focus:border-[var(--aos-obsidian)] focus:ring-[var(--aos-brass-tint)] sm:text-sm px-3 py-2 border placeholder-[var(--fg-4)] text-[var(--fg-1)] bg-[var(--bg-surface)]"
                                    rows={4}
                                    placeholder="Optional: Add any additional context about your positioning, differentiation, or unique approach..."
                                    value={formData.positioningContext}
                                    onChange={(e) => handleChange('positioningContext', e.target.value)}
                                    maxLength={500}
                                />
                                <p className="text-xs text-[var(--fg-3)] mt-1">If our web analysis doesn't capture your full positioning, add context here</p>
                            </div>
                        </div>
                    </PositioningAccordion>

                    {/* SAVE BUTTON AREA */}
                    <div className="mt-8 pt-6 border-t border-[var(--aos-mist)]">
                        {!isValid && (
                            <div className="mb-4 space-y-1">
                                {errors.agencyTypes && <div className="text-xs text-[var(--aos-risk)] flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Agency Focus is required</div>}
                                {errors.industriesServed && <div className="text-xs text-[var(--aos-risk)] flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Please select at least one industry</div>}
                                {errors.geographicFootprint && <div className="text-xs text-[var(--aos-risk)] flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Geographic footprint is required</div>}
                                {errors.pricingStrategies && <div className="text-xs text-[var(--aos-risk)] flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Please select at least one pricing strategy</div>}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button
                                variant="outline"
                                onClick={handleSave}
                                disabled={isSaveDisabled}
                                className={`w-full sm:w-auto min-w-[200px] transition-colors ${isSaveDisabled
                                    ? 'bg-[var(--bg-canvas)] text-[var(--fg-4)] border-[var(--aos-mist)] cursor-not-allowed'
                                    : 'text-[var(--fg-2)] hover:bg-[var(--bg-canvas)]'
                                    }`}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : saveStatus === 'success' ? (
                                    <>
                                        <Check className="mr-2 h-4 w-4 text-[var(--aos-success)]" />
                                        Saved
                                    </>
                                ) : (
                                    getButtonText()
                                )}
                            </Button>

                            <Button
                                variant="primary"
                                onClick={handleRunSynthesis}
                                disabled={!isValid || isProcessing || isSynthesizing || !hasSavedRecord && hasChanges}
                                className={`w-full sm:w-auto min-w-[200px] text-[var(--fg-on-dark)] transition-colors ${(!isValid || isProcessing || isSynthesizing || (!hasSavedRecord && hasChanges))
                                    ? 'bg-[var(--aos-brass)] opacity-50 cursor-not-allowed'
                                    : 'bg-[var(--aos-brass)] hover:bg-[var(--aos-brass-soft)] shadow-sm'
                                    }`}
                            >
                                {isSynthesizing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Synthesizing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Submit for Synthesis
                                    </>
                                )}
                            </Button>
                        </div>

                        {synthesis.status === 'complete' && (
                            <div className="mt-4 p-3 bg-[var(--aos-success-tint)] text-[var(--aos-success)] rounded-md border border-[var(--aos-success)] flex items-center gap-2 text-sm animate-in fade-in">
                                <Check className="h-4 w-4" />
                                Synthesis complete! View your positioning analysis to the right.
                            </div>
                        )}
                        {synthesis.status === 'skipped' && (
                            <div className="mt-4 p-3 bg-[var(--aos-insight-tint)] text-[var(--aos-insight)] rounded-md border border-[var(--aos-insight)] flex items-center gap-2 text-sm animate-in fade-in">
                                <Info className="h-4 w-4" />
                                Already synthesized. No changes detected to re-run.
                            </div>
                        )}
                        {synthesis.status === 'error' && (
                            <div className="mt-4 p-3 bg-[var(--aos-risk-tint)] text-[var(--aos-risk)] rounded-md border border-[var(--aos-risk)] flex items-center gap-2 text-sm animate-in fade-in">
                                <AlertCircle className="h-4 w-4" />
                                There was an error running synthesis. Please try again.
                            </div>
                        )}

                        {(isProcessing || isSynthesizing) && (
                            <div className="mt-4 p-4 bg-[var(--bg-canvas)] rounded-lg border border-[var(--aos-mist)] flex items-center gap-3 animate-in fade-in">
                                <Loader2 className="h-5 w-5 text-[var(--fg-3)] animate-spin" />
                                <div>
                                    <p className="text-sm font-medium text-[var(--fg-1)]">
                                        {isSynthesizing ? "Running AI Synthesis..." : "Saving your configuration..."}
                                    </p>
                                    <p className="text-xs text-[var(--fg-3)]">This typically takes a few seconds.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* IDENTITY PROFILE SECTION (Post-Save) */}
                    {showProfile && (
                        <div className="mt-8 pt-8 border-t border-[var(--aos-mist)] animate-in slide-in-from-top-4 fade-in duration-700">
                            <div className="bg-[var(--bg-canvas)] rounded-xl border border-[var(--aos-mist)] p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="h-8 w-8 bg-[var(--bg-surface)] rounded-lg border border-[var(--aos-mist)] flex items-center justify-center shadow-[var(--shadow-soft-1)]">
                                        <Building2 className="h-5 w-5 text-[var(--aos-insight)]" />
                                    </div>
                                    <h3 className="text-lg font-bold text-[var(--fg-1)]">Market Footprint Profile</h3>
                                </div>

                                <div className="space-y-4 text-sm text-[var(--fg-2)]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <span className="block text-xs font-semibold text-[var(--fg-3)] uppercase tracking-wider mb-1">Agency Focus</span>
                                            <p className="font-medium text-[var(--fg-1)]">{getAgencyTypeLabels(formData.agencyTypes)}</p>
                                            {formData.agencyTypes.includes('other') && <p className="text-xs text-[var(--fg-3)] italic mt-1">{formData.agencyTypesOther}</p>}
                                        </div>
                                        <div>
                                            <span className="block text-xs font-semibold text-[var(--fg-3)] uppercase tracking-wider mb-1">Geographic Footprint</span>
                                            <p className="font-medium text-[var(--fg-1)] capitalize">{formData.geographicFootprint}</p>
                                        </div>
                                        <div className="md:col-span-2">
                                            <span className="block text-xs font-semibold text-[var(--fg-3)] uppercase tracking-wider mb-1">Primary Industries</span>
                                            <p className="font-medium text-[var(--fg-1)]">{getIndustryLabels(formData.industriesServed)}</p>
                                            {formData.industriesServed.includes('other') && <p className="text-xs text-[var(--fg-3)] italic mt-1">Other: {formData.industriesServedOther}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <span className="block text-xs font-semibold text-[var(--fg-3)] uppercase tracking-wider mb-1">Secondary Capabilities</span>
                                            <p className="font-medium text-[var(--fg-1)]">{formData.servicesOffered.length > 0 ? getServiceLabels(formData.servicesOffered) : 'None selected'}</p>
                                            {formData.servicesOffered.includes('other') && <p className="text-xs text-[var(--fg-3)] italic mt-1">Other: {formData.servicesOfferedOther}</p>}
                                        </div>
                                        <div className="md:col-span-2">
                                            <span className="block text-xs font-semibold text-[var(--fg-3)] uppercase tracking-wider mb-1">Pricing Strategy</span>
                                            <p className="font-medium text-[var(--fg-1)]">{getPricingLabels(formData.pricingStrategies)}</p>
                                        </div>
                                        {formData.websiteUrl && (
                                            <div className="md:col-span-2">
                                                <span className="block text-xs font-semibold text-[var(--fg-3)] uppercase tracking-wider mb-1">Website</span>
                                                <a href={formData.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--aos-insight)] hover:underline">{formData.websiteUrl}</a>
                                            </div>
                                        )}
                                        {formData.positioningContext && (
                                            <div className="md:col-span-2 mt-2 pt-2 border-t border-[var(--aos-mist)]">
                                                <span className="block text-xs font-semibold text-[var(--fg-3)] uppercase tracking-wider mb-1">Positioning Context</span>
                                                <p className="text-[var(--fg-2)] italic">"{formData.positioningContext}"</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* SYNTHESIS RENDER BLOCK */}
                                <div className="mt-8 p-6 bg-[var(--bg-sunken)] border border-[var(--aos-mist)] rounded-xl">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Lightbulb className="h-5 w-5 text-[var(--aos-warning)]" />
                                        <h4 className="text-base font-bold text-[var(--fg-1)]">Market Footprint Insights</h4>
                                    </div>

                                    {(!synthesis.status || synthesis.status === 'idle') && (
                                        <p className="text-sm text-[var(--fg-3)] italic">Contextual insights will appear here after synthesis runs.</p>
                                    )}

                                    {synthesis.status === 'running' && (
                                        <div className="flex items-center gap-3 py-4 text-sm text-[var(--fg-2)] animate-pulse">
                                            <Loader2 className="h-5 w-5 animate-spin text-[var(--aos-warning)]" />
                                            <span>Synthesizing structural insights and market footprint...</span>
                                        </div>
                                    )}

                                    {synthesis.status === 'complete' && synthesis.beats.length > 0 && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                            {synthesis.beats.map((beat, i) => (
                                                <ExpandableInsightCard key={i} headline={beat.headline} copy={beat.copy} />
                                            ))}

                                            {synthesis.signal && (
                                                <div className="mt-6 p-6 bg-[var(--aos-insight-tint)] border border-[var(--aos-insight)] rounded-xl">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Target className="h-4 w-4 text-[var(--aos-insight)]" />
                                                        <span className="text-xs font-bold text-[var(--fg-1)] tracking-widest uppercase">The Signal</span>
                                                    </div>
                                                    <p className="text-[15px] font-medium text-[var(--fg-1)] leading-relaxed italic">
                                                        "{synthesis.signal}"
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {synthesis.status === 'error' && (
                                        <div className="flex items-start gap-4 p-5 bg-[var(--aos-risk-tint)] border border-[var(--aos-risk)] rounded-xl animate-in fade-in">
                                            <div className="p-2 bg-[var(--aos-risk-tint)] rounded-full shrink-0">
                                                <AlertCircle className="h-5 w-5 text-[var(--aos-risk)]" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-[var(--fg-1)] mb-1">Synthesis failed</p>
                                                <p className="text-xs text-[var(--fg-2)] mb-4">{synthesis.errorMsg || "An unexpected error occurred during synthesis."}</p>
                                                <Button
                                                    variant="outline"
                                                    onClick={handleRunSynthesis}
                                                    className="bg-[var(--bg-surface)] hover:bg-[var(--aos-risk-tint)] text-[var(--aos-risk)] border-[var(--aos-risk)] text-xs py-1.5 px-3 h-auto"
                                                >
                                                    Retry Synthesis
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* END SYNTHESIS RENDER BLOCK */}

                            </div>
                        </div>
                    )}

                </Card>
            </div>

            {/* Right Panel: Positioning Analysis */}
            <div className="flex-shrink-0 lg:w-80">
                <div className="sticky top-24 space-y-4">
                    <div className="bg-[var(--bg-canvas)] rounded-lg border border-[var(--aos-mist)] p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Target className="h-4 w-4 text-[var(--fg-3)]" />
                            <h3 className="text-sm font-semibold text-[var(--fg-1)]">Positioning Analysis</h3>
                        </div>
                        <p className="text-xs text-[var(--fg-3)] mb-4">Contextual insights derived from your identity profile.</p>

                        <div className="py-8 text-center border-t border-[var(--aos-mist)] border-dashed">
                            <div className="inline-flex items-center justify-center p-3 bg-[var(--bg-surface)] rounded-full mb-3 shadow-[var(--shadow-soft-1)] border border-[var(--aos-mist)]">
                                <Sparkles className="h-5 w-5 text-[var(--aos-insight)]" />
                            </div>
                            <p className="text-xs text-[var(--fg-4)] italic px-2">
                                Analysis will appear here after saving.
                            </p>
                        </div>

                        <div className="mt-4 pt-4 border-t border-[var(--aos-mist)]">
                            <div className="flex items-center justify-center font-medium text-[var(--fg-4)] mb-2">
                                <Lightbulb className="h-4 w-4 mr-2" />
                                <span className="uppercase tracking-wider text-xs">What This Tells Us</span>
                            </div>
                            <div className="text-center">
                                <p className="text-center text-sm text-[var(--fg-3)] italic px-1">
                                    Click "Submit for Synthesis" below to generate contextual insights and benchmark comparisons for your positioning.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
