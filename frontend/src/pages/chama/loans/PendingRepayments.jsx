import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { loanAPI } from "../../../services/api";
import { Button } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

// Repayments members have reported. Nothing is credited until an official other than the payer confirms it.
export default function PendingRepayments({ chamaId, onVerified }) {
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await loanAPI.getPendingRepayments(chamaId);
      setRows(res.data?.data || []);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [chamaId]);

  useEffect(() => { load(); }, [load]);

  const act = async (row, kind) => {
    setBusy(row.repayment_id);
    try {
      if (kind === "verify") await loanAPI.verifyRepayment(chamaId, row.repayment_id);
      else await loanAPI.rejectRepayment(chamaId, row.repayment_id, "Payment not received");
      toast.success(kind === "verify" ? "Repayment verified." : "Repayment rejected.");
      await load();
      if (onVerified) onVerified();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't update this repayment. Nothing was changed.", { autoClose: 6000 });
    } finally {
      setBusy(null);
    }
  };

  if (failed) return <div className="cs-notice cs-notice--danger" role="alert" style={{ marginTop: 16 }}>We couldn&apos;t load pending repayments. <Button size="sm" onClick={load}>Try again</Button></div>;
  if (!rows || rows.length === 0) return null;

  return (
    <section className="cs-card" aria-label="Repayments waiting for verification" style={{ marginTop: 16 }}>
      <h2 className="cs-h3" style={{ marginTop: 0 }}>Repayments to verify ({rows.length})</h2>
      <p className="cs-help">Confirm the money has arrived before you verify. Your own repayments need another official.</p>
      <ul className="cs-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.repayment_id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--cs-border, #e5e7eb)" }}>
            <span><strong>{r.payer_name}</strong> reports {formatKES(r.amount)} on loan #{r.loan_id}<br /><small>{formatDate(r.created_at)}</small></span>
            <span style={{ display: "flex", gap: 8 }}>
              {r.own ? <small>Waiting for another official</small> : (
                <>
                  <Button size="sm" disabled={busy !== null} onClick={() => act(r, "reject")}>Reject</Button>
                  <Button size="sm" variant="primary" loading={busy === r.repayment_id} disabled={busy !== null} onClick={() => act(r, "verify")}>Verify</Button>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
