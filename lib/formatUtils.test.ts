
import { describe, it, expect } from 'vitest';
import { formatNumberWithCommas, parseFormattedNumber } from './formatUtils';

describe('formatUtils', () => {
    describe('formatNumberWithCommas', () => {
        it('formats numbers with commas', () => {
            expect(formatNumberWithCommas(1000)).toBe('1,000');
            expect(formatNumberWithCommas(1000000)).toBe('1,000,000');
            expect(formatNumberWithCommas(123456789)).toBe('123,456,789');
        });

        it('formats string numbers with commas', () => {
            expect(formatNumberWithCommas('1000')).toBe('1,000');
            expect(formatNumberWithCommas('1000000')).toBe('1,000,000');
        });

        it('handles decimals correctly', () => {
            expect(formatNumberWithCommas(1234.56)).toBe('1,234.56');
            expect(formatNumberWithCommas('1234.56')).toBe('1,234.56');
            expect(formatNumberWithCommas('.56')).toBe('.56');
        });

        it('returns original if invalid number', () => {
            expect(formatNumberWithCommas('abc')).toBe('abc');
        });

        it('handle empty inputs', () => {
            expect(formatNumberWithCommas('')).toBe('');
            // @ts-ignore
            expect(formatNumberWithCommas(null)).toBe('');
            // @ts-ignore
            expect(formatNumberWithCommas(undefined)).toBe('');
        });

        it('does not double format', () => {
            expect(formatNumberWithCommas('1,000')).toBe('1,000');
        });
    });

    describe('parseFormattedNumber', () => {
        it('strips commas from string', () => {
            expect(parseFormattedNumber('1,000')).toBe('1000');
            expect(parseFormattedNumber('1,000,000.50')).toBe('1000000.50');
        });

        it('handles empty input', () => {
            expect(parseFormattedNumber('')).toBe('');
        });
    });
});
