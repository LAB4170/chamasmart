// Shared formatting helpers so money and dates look identical on every screen.

const KES = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const KES_WHOLE = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** 12500 -> "KES 12,500.00". Missing or invalid values show an em dash, never "NaN". */
export const formatKES = (value, { whole = false } = {}) => {
  const n = toNumber(value);
  if (n === null) return '—';
  return (whole ? KES_WHOLE : KES).format(n).replace(/\p{Zs}/gu, ' ');
};

const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "24 Oct 2026" */
export const formatDate = (value) => {
  const d = toDate(value);
  return d ? DATE.format(d) : '—';
};

/** "24 Oct 2026, 09:43" */
export const formatDateTime = (value) => {
  const d = toDate(value);
  return d ? DATE_TIME.format(d) : '—';
};

/** Sum money safely over a list; ignores invalid entries. */
export const sumAmounts = (rows, pick = (r) => r.amount) =>
  rows.reduce((total, r) => total + (toNumber(pick(r)) ?? 0), 0);

/**
 * Map backend status text to a label and a tone. Unknown values are shown as given in a neutral pill
 * so a new backend status is never hidden or mislabelled.
 */
const STATUS_MAP = {
  COMPLETED: ['Completed', 'success'], PAID: ['Paid', 'success'], APPROVED: ['Approved', 'success'], ACTIVE: ['Active', 'success'],
  DISBURSED: ['Disbursed', 'info'], REPAID: ['Repaid', 'success'], CLOSED: ['Closed', 'neutral'],
  PENDING: ['Pending', 'warning'], PENDING_APPROVAL: ['Awaiting approval', 'warning'], PROCESSING: ['Processing', 'warning'],
  OVERDUE: ['Overdue', 'danger'], DEFAULTED: ['Defaulted', 'danger'],
  FAILED: ['Failed', 'danger'], REJECTED: ['Rejected', 'danger'], CANCELLED: ['Cancelled', 'neutral'], REVERSED: ['Reversed', 'neutral'],
};
export const statusInfo = (status) => {
  const key = String(status ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  if (!key) return ['Unknown', 'neutral'];
  if (STATUS_MAP[key]) return STATUS_MAP[key];
  const label = key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ');
  return [label, 'neutral'];
};

/** The signed-in person's id, whichever shape the user object has (login returns userId, profile returns user_id). */
export const currentUserId = (user) => user?.userId ?? user?.user_id ?? user?.id ?? null;

/** The server's message for a failed download. Blob responses hide the JSON error body, so read it out. */
export async function downloadError(e, fallback) {
  try {
    const d = e.response?.data;
    if (d instanceof Blob) { const j = JSON.parse(await d.text()); return j.message || fallback; }
    return d?.message || fallback;
  } catch { return fallback; }
}
