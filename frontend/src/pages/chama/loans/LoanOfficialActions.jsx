import { useState } from "react";
import { toast } from "react-toastify";
import { loanAPI } from "../../../services/api";
import { Button } from "../../../components/ui";

// Reschedule an unsettled loan, or write off a defaulted one. Both need two different officials.
export default function LoanOfficialActions({ chamaId, loan, onDone }) {
  const [months, setMonths] = useState("");
  const [armed, setArmed] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (kind) => {
    if (armed !== kind) { setArmed(kind); return; }
    setBusy(true);
    try {
      const res = kind === "reschedule" ? await loanAPI.rescheduleLoan(chamaId, loan.loan_id, Number(months)) : await loanAPI.writeOffLoan(chamaId, loan.loan_id);
      if (res.data?.data?.status === "DONE") toast.success(kind === "reschedule" ? "Loan rescheduled." : "Loan written off.");
      else toast.info("Request recorded. A different official must confirm it. Nothing has changed yet.", { autoClose: 8000 });
      setArmed(null);
      await onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't go through. Nothing was changed.", { autoClose: 8000 });
    } finally { setBusy(false); }
  };

  const monthsOk = Number.isInteger(Number(months)) && Number(months) > 0;
  return (
    <section style={{ marginTop: 16 }} aria-label="Official actions">
      <h3 className="cs-section-title">Official actions</h3>
      <p className="cs-help">Each needs a second official to confirm. Click once to choose, again to confirm.</p>
      <div className="cs-actions" style={{ flexWrap: "wrap" }}>
        <label className="cs-label" htmlFor="la-months" style={{ margin: 0 }}>Spread what is left over (months)</label>
        <input id="la-months" className="cs-input" style={{ width: 90 }} type="number" inputMode="numeric" min="1" value={months} onChange={(e) => { setMonths(e.target.value); setArmed(null); }} />
        <Button size="sm" disabled={!monthsOk || busy} loading={busy && armed === "reschedule"} onClick={() => run("reschedule")}>{armed === "reschedule" ? "Confirm reschedule" : "Reschedule"}</Button>
        {loan.status === "DEFAULTED" && <Button size="sm" variant="danger" disabled={busy} loading={busy && armed === "writeoff"} onClick={() => run("writeoff")}>{armed === "writeoff" ? "Confirm write-off" : "Write off"}</Button>}
      </div>
    </section>
  );
}
