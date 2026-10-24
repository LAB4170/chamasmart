import { statusInfo } from '../../utils/format';

/** Status is always a text label with a dot, so it never depends on colour alone. */
export default function StatusBadge({ status, label }) {
  const [defaultLabel, tone] = statusInfo(status);
  return <span className={`cs-status cs-status--${tone}`}>{label || defaultLabel}</span>;
}
