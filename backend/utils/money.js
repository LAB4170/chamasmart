/**
 * Money utility — shared financial calculations.
 * Use these methods for all monetary operations to ensure consistent precision.
 */
class Money {
  /**
   * Convert a decimal amount to integer cents (avoids floating point drift).
   * Throws on null, undefined, negative, or NaN values.
   */
  static toCents(amount) {
    if (amount === null || amount === undefined) {
      throw new Error('Money.toCents: amount is required');
    }
    if (typeof amount === 'string') amount = parseFloat(amount);
    if (isNaN(amount) || amount < 0) {
      throw new Error(`Money.toCents: invalid amount "${amount}"`);
    }
    return Math.round(amount * 100);
  }

  /**
   * Convert integer cents back to decimal amount.
   */
  static fromCents(cents) {
    return cents / 100;
  }

  /**
   * Format an amount as a human-readable currency string.
   * @param {number} amount - Decimal amount
   * @param {string} currency - Currency code (default: 'KES')
   */
  static format(amount, currency = 'KES') {
    return `${currency} ${parseFloat(amount).toFixed(2)}`;
  }
}

module.exports = Money;
