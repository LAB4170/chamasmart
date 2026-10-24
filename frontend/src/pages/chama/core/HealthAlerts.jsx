import { useState, useEffect } from "react";
import { scoreAPI } from "../../../services/utils.service";
import { StatusBadge } from "../../../components/ui";

const SEVERITY = { CRITICAL: { status: "DEFAULTED", label: "Critical" }, WARNING: { status: "PENDING", label: "Warning" }, TIP: { status: "DISBURSED", label: "Suggestion" } };

/** Suggestions drawn from the chama's loan and savings totals. They are prompts to look closer, not findings. */
export default function HealthAlerts({ chamaId }) {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let live = true;
    scoreAPI.getAlerts(chamaId)
      .then((res) => { const list = res.data?.data; if (live) setAlerts(Array.isArray(list) ? list : []); })
      .catch(() => { if (live) setAlerts([]); });
    return () => { live = false; };
  }, [chamaId]);

  if (alerts.length === 0) return null;

  return (
    <section className="cs-card" aria-label="Things to look at">
      <h2 className="cs-card-title">Things to look at</h2>
      <ul className="cs-list">
        {alerts.map((a) => {
          const sev = SEVERITY[a.severity] || SEVERITY.TIP;
          const expanded = open === a.id;
          return (
            <li key={a.id} className="cs-list-item" style={{ display: "block" }}>
              <button type="button" className="cs-btn cs-btn--tertiary" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : a.id)} style={{ width: "100%", justifyContent: "space-between", textAlign: "left" }}>
                <span className="cs-list-title">{a.title}</span>
                <StatusBadge status={sev.status} label={sev.label} />
              </button>
              {expanded && (
                <div style={{ padding: "8px 12px" }}>
                  <p style={{ marginTop: 0 }}>{a.detail}</p>
                  <p className="cs-list-meta" style={{ marginBottom: 0 }}><strong>Suggested step:</strong> {a.action}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
