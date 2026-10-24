
/** A single real figure. `value` must be pre-formatted from real data (see utils/format). */
export default function StatCard({ label, value, note }) {
  return (
    <div className="cs-card cs-stat">
      <span className="cs-stat-label">{label}</span>
      <span className="cs-stat-value">{value}</span>
      {note && <span className="cs-stat-note">{note}</span>}
    </div>
  );
}
