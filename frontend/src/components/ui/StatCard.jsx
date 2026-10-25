/** A single real figure. `value` must be pre-formatted from real data (see utils/format). `icon` is an optional lucide element. */
export default function StatCard({ label, value, note, icon, tone }) {
  return (
    <div className="cs-card cs-stat">
      {icon && <span className="cs-stat-icon" data-tone={tone} aria-hidden="true">{icon}</span>}
      <span className="cs-stat-label">{label}</span>
      <span className="cs-stat-value">{value}</span>
      {note && <span className="cs-stat-note">{note}</span>}
    </div>
  );
}
