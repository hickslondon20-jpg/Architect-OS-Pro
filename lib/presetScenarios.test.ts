
import { describe, it, expect } from 'vitest';
import { calculatePresetTargets, CurrentStateInputs } from './presetScenarios';

const mockCurrentState: CurrentStateInputs = {
    currentRevenue: '1,000,000',
    currentMargin: '20',
    currentMarginType: 'percent',
    currentTeam: '10',
    currentClients: '50',
    currentRetention: '90',
    currentACV: '20,000',
};

describe('calculatePresetTargets', () => {
    it('calculates Modest Growth correctly', () => {
        // AGI +15%, ACV +5%, Retention +2%
        const targets = calculatePresetTargets(mockCurrentState, 'modest');
        expect(targets.targetRevenue).toBe('1,150,000');
        expect(targets.targetMarginValue).toBe('20');
        expect(targets.targetACV).toBe('21,000');
        expect(targets.targetRetention).toBe('92');
        expect(targets.targetTeam).toBe(''); // Blank
        expect(targets.targetClients).toBe(''); // Blank/implied
    });

    it('calculates Aggressive Expansion correctly', () => {
        // AGI +50%, Margin -3%, Clients +40%
        const targets = calculatePresetTargets(mockCurrentState, 'aggressive');
        expect(targets.targetRevenue).toBe('1,500,000');
        expect(targets.targetMarginValue).toBe('17');
        expect(targets.targetClients).toBe('70'); // 50 * 1.4
        expect(targets.targetTeam).toBe('');
        expect(targets.targetACV).toBe('');
    });

    it('calculates Efficiency Focused correctly', () => {
        // AGI +20%, Margin +5%, ACV +30%, Retention +5%
        const targets = calculatePresetTargets(mockCurrentState, 'efficiency');
        expect(targets.targetRevenue).toBe('1,200,000');
        expect(targets.targetMarginValue).toBe('25');
        expect(targets.targetACV).toBe('26,000');
        expect(targets.targetRetention).toBe('95');
        expect(targets.targetClients).toBe('');
    });

    it('calculates Client Retention Play correctly', () => {
        // AGI +10%, Retention +10%, ACV +8%
        const targets = calculatePresetTargets(mockCurrentState, 'retention');
        expect(targets.targetRevenue).toBe('1,100,000');
        expect(targets.targetRetention).toBe('100'); // Capped at 100
        expect(targets.targetACV).toBe('21,600');
        expect(targets.targetClients).toBe('');
    });

    it('calculates Premium Positioning correctly', () => {
        // AGI +25%, ACV +30%, Margin +4%, Clients -5%
        const targets = calculatePresetTargets(mockCurrentState, 'premium');
        expect(targets.targetRevenue).toBe('1,250,000');
        expect(targets.targetACV).toBe('26,000');
        expect(targets.targetMarginValue).toBe('24');
        expect(targets.targetClients).toBe('48'); // 50 * 0.95 = 47.5 -> 48
    });

    it('calculates Scale & Volume correctly', () => {
        // AGI +35%, Clients +40%, ACV constant, Margin -2%
        const targets = calculatePresetTargets(mockCurrentState, 'scale');
        expect(targets.targetRevenue).toBe('1,350,000');
        expect(targets.targetClients).toBe('70');
        expect(targets.targetACV).toBe('20,000');
        expect(targets.targetMarginValue).toBe('18');
    });

    it('handles dollar margin type conversion validation', () => {
        const dollarState: CurrentStateInputs = {
            ...mockCurrentState,
            currentMarginType: 'dollar',
            currentMargin: '200,000' // 20% of 1M
        };

        const targets = calculatePresetTargets(dollarState, 'modest');
        expect(targets.targetMarginValue).toBe('20'); // Should convert to %
    });
});
