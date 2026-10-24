/**
 * Mirrors the backend LoanCalculator so the preview a member sees equals what is recorded.
 * Rates are annual percentages. FLAT: P*r*n/1200. REDUCING_BALANCE: equal principal, interest on the remaining balance.
 */
export const totalInterest = (principal, annualRate, months, type) => {
  const p = Number(principal) || 0;
  const r = Number(annualRate) || 0;
  const n = Math.max(0, Math.floor(Number(months) || 0));
  const factor = type === 'REDUCING_BALANCE' ? (n + 1) / 2 : n;
  return Math.round(((p * r) / 1200) * factor * 100) / 100;
};

export const loanQuote = (principal, annualRate, months, type) => {
  const p = Number(principal) || 0;
  const interest = totalInterest(p, annualRate, months, type);
  const total = Math.round((p + interest) * 100) / 100;
  const n = Math.max(1, Math.floor(Number(months) || 1));
  return { principal: p, interest, total, monthly: Math.round((total / n) * 100) / 100 };
};
