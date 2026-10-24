import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { Button } from "../../../components/ui";
import { loanAPI } from "../../../services/api";
import { formatKES, formatDate } from "../../../utils/format";

// Loans with instalments past due. Loans unpaid after the grace period are marked defaulted automatically each night.
export default function ArrearsList({ chamaId }) {
  const [rows, setRows] = useState([]);
  const [armed, setArmed] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    loanAPI.getArrears(chamaId).then((res) => setRows(res.data?.data || [])).catch(() => setRows([]));
  }, [chamaId]);

  useEffect(() => { load(); }, [load]);

  const call = async (row) => {
    if (armed !== row.loan_id) { setArmed(row.loan_id); return; }
    setBusy(row.loan_id);
    try {
      const res = await loanAPI.callGuarantees(chamaId, row.loan_id);
      if (res.data?.data?.status === "AWAITING_SECOND_OFFICIAL") toast.info("Request recorded. A different official must confirm it. Nothing has moved yet.", { autoClose: 8000 });
      else toast.success("Guarantors' savings were applied to the loan.");
      setArmed(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't go through. Nothing was changed.", { autoClose: 8000 });
    } finally { setBusy(null); }
  };

  if (rows.length === 0) return null;
  return (
    <section className="cs-card" aria-label="Loans in arrears" style={{ marginTop: 16 }}>
      <h2 className="cs-h3" style={{ marginTop: 0 }}>Loans in arrears ({rows.length})</h2>
      <ul className="cs-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.loan_id} style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--cs-border, #e5e7eb)" }}>
            <span><strong>{r.borrower_name}</strong> · loan #{r.loan_id}<br /><small>Final instalment due {formatDate(r.final_due_date)}{r.status === "DEFAULTED" ? " · defaulted" : ""}</small></span>
            <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{formatKES(r.overdue_amount)} overdue</strong>
              {r.status === "DEFAULTED" && (
                <Button size="sm" loading={busy === r.loan_id} onClick={() => call(r)}>
                  {armed === r.loan_id ? "Confirm: use guarantors' savings" : "Call guarantees"}
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
