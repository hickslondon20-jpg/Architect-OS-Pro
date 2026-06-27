import { formatNumberWithCommas } from './formatUtils';

export interface CurrentStateInputs {
    currentRevenue: string;
    currentMargin: string;
    currentTeam: string;
    currentClients: string;
    currentRetention: string;
    currentACV: string;
    currentMarginType: 'percent' | 'dollar';
}

export interface TargetStateInputs {
    targetGrossRevenue: string;
    targetRevenue: string;
    targetMarginType: 'percent' | 'dollar';
    targetMarginValue: string;
    targetTeam: string;
    targetClients: string;
    targetRetention: string;
    targetACV: string;
    // Presets default to 12 months usually, but we won't force it here
}

export interface ScenarioPreset {
    id: string;
    label: string;
    description: string;
}

export const PRESETS: ScenarioPreset[] = [
    {
        id: 'steady-climb',
        label: 'Steady Climb',
        description: 'Sustainable growth focusing on steady client acquisition.'
    },
    {
        id: 'active-growth',
        label: 'Active Growth',
        description: 'Accelerated acquisition with moderate team expansion.'
    },
    {
        id: 'aggressive-scale',
        label: 'Aggressive Scale',
        description: 'Rapid expansion requiring significant hiring and slight margin hit.'
    },
    {
        id: 'positioning-shift',
        label: 'Positioning Shift',
        description: 'Moving upmarket with higher ACV and efficiency.'
    }
];

export const calculatePresetTargets = (
    current: CurrentStateInputs,
    presetId: string
): TargetStateInputs => {
    // Parse base values (default to 0 if invalid)
    const baseRevenue = parseFloat(current.currentRevenue.replace(/,/g, '')) || 0;

    // Margin calculation
    let baseMarginPercent = 0;
    if (current.currentMarginType === 'percent') {
        baseMarginPercent = parseFloat(current.currentMargin) || 0;
    } else {
        // If dollar margin, calculate implied percent: (margin$ / revenue) * 100
        const marginDol = parseFloat(current.currentMargin.replace(/,/g, '')) || 0;
        if (baseRevenue > 0) {
            baseMarginPercent = (marginDol / baseRevenue) * 100;
        }
    }

    const baseClients = parseFloat(current.currentClients.replace(/,/g, '')) || 0;
    const baseRetention = parseFloat(current.currentRetention) || 0;

    // Parse ACV (or calculate if missing and possible)
    let baseACV = parseFloat(current.currentACV.replace(/,/g, '')) || 0;
    if (baseACV === 0 && baseClients > 0 && baseRevenue > 0) {
        baseACV = baseRevenue / baseClients;
    }

    // Initialize targets
    let targetRevenue = 0;
    let targetMarginPercent = baseMarginPercent;
    let targetClients = 0;
    let targetRetention = baseRetention;
    let targetACV = baseACV;

    // Flags for what to explicit set vs leave blank
    let setClients = false;
    let setACV = false;
    let setRetention = false;
    let setTeam = false;
    let targetTeam = parseFloat(current.currentTeam) || 0;

    switch (presetId) {
        case 'steady-climb':
            // +20% AGI, +15% Clients, +5% ACV, hold Margin, hold Retention, +15% FTEs, 24mo.
            targetRevenue = baseRevenue * 1.20;
            targetClients = baseClients * 1.15;
            targetACV = baseACV * 1.05;
            targetTeam = targetTeam * 1.15;

            setClients = true;
            setACV = true;
            setTeam = true;
            break;

        case 'active-growth':
            // +40% AGI, +25% Clients, +10% ACV, -2% Margin, hold Retention, +30% FTEs, 24mo.
            targetRevenue = baseRevenue * 1.40;
            targetClients = baseClients * 1.25;
            targetACV = baseACV * 1.10;
            targetMarginPercent = baseMarginPercent - 2;
            targetTeam = targetTeam * 1.30;

            setClients = true;
            setACV = true;
            setTeam = true;
            break;

        case 'aggressive-scale':
            // +75% AGI, +40% Clients, +5% ACV, -5% Margin, -3% Retention, +60% FTEs, 18mo.
            targetRevenue = baseRevenue * 1.75;
            targetClients = baseClients * 1.40;
            targetACV = baseACV * 1.05;
            targetMarginPercent = baseMarginPercent - 5;
            targetRetention = Math.max(0, baseRetention - 3);
            targetTeam = targetTeam * 1.60;

            setClients = true;
            setACV = true;
            setRetention = true;
            setTeam = true;
            break;

        case 'positioning-shift':
            // +30% AGI, +5% Clients, +25% ACV, +3% Margin, hold Retention, +10% FTEs, 24mo.
            targetRevenue = baseRevenue * 1.30;
            targetClients = baseClients * 1.05;
            targetACV = baseACV * 1.25;
            targetMarginPercent = baseMarginPercent + 3;
            targetTeam = targetTeam * 1.10;

            setClients = true;
            setACV = true;
            setTeam = true;
            break;

        default:
            return {
                targetGrossRevenue: '',
                targetRevenue: '',
                targetMarginType: 'percent',
                targetMarginValue: '',
                targetTeam: '',
                targetClients: '',
                targetRetention: '',
                targetACV: ''
            };
    }

    // Helper to safely round text
    const safeFormat = (val: number) => {
        if (isNaN(val) || !isFinite(val) || val === 0) return '';
        return formatNumberWithCommas(Math.round(val));
    };

    const safePercent = (val: number) => {
        if (isNaN(val) || !isFinite(val)) return '';
        return (Math.round(val * 10) / 10).toString();
    };

    return {
        targetGrossRevenue: safeFormat(targetRevenue * 1.05), // Estimate Gross as 1.05x AGI for presets
        targetRevenue: safeFormat(targetRevenue),
        targetMarginType: 'percent',
        targetMarginValue: safePercent(targetMarginPercent),
        targetTeam: setTeam ? safeFormat(targetTeam) : '',
        targetClients: setClients ? safeFormat(targetClients) : '',
        targetRetention: setRetention || targetRetention !== baseRetention ? safePercent(targetRetention) : '',
        targetACV: setACV ? safeFormat(targetACV) : ''
    };
};
