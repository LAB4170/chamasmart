import { formatCurrency, formatDate } from '../format';

describe('format utilities', () => {
  describe('formatCurrency', () => {
    it('formats number as KES currency by default', () => {
      expect(formatCurrency(1000)).toMatch(/^KES\s*1,000\.00$/);
    });

    it('formats number with custom currency', () => {
      expect(formatCurrency(1000, 'USD')).toMatch(/^\$\s*1,000\.00$/);
    });

    it('handles invalid amount', () => {
      expect(formatCurrency('invalid')).toBe('Invalid amount');
    });
  });

  describe('formatDate', () => {
    it('formats date string to readable format', () => {
      expect(formatDate('2023-01-01')).toBe('Jan 1, 2023');
    });

    it('returns N/A for invalid date string', () => {
      expect(formatDate('')).toBe('N/A');
      expect(formatDate(null)).toBe('N/A');
      expect(formatDate(undefined)).toBe('N/A');
    });
  });
});
