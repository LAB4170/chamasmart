import { useState, useEffect } from "react";
import { loanAPI } from "../../../services/api";
import { formatKES, formatDate } from "../../../utils/format";

// Loans with instalments past due. Loans unpaid after the grace period are marked defaulted automatically each night.
export default function ArrearsList({ chamaId }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let live = true;
    loanAPI.getArrears(chamaId).then((res) => { if (live) setRows(res.data?.data || []); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [chamaId]);

  if (rows.length === 0) return null;
  return (
    <section className="cs-card" aria-label="Loans in arrears" style={{ marginTop: 16 }}>
      <h2 className="cs-h3" style={{ marginTop: 0 }}>Loans in arrears ({rows.length})</h2>
      <ul className="cs-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.loan_id} style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--cs-border, #e5e7eb)" }}>
            <span><strong>{r.borrower_name}</strong> · loan #{r.loan_id}<br /><small>Final instalment due {formatDate(r.final_due_date)}{r.status === "DEFAULTED" ? " · defaulted" : ""}</small></span>
            <strong>{formatKES(r.overdue_amount)} overdue</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}
