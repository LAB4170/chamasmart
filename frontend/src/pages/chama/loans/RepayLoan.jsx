import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { loanAPI } from "../../../services/api";
import { Button, PageHeader, Skeleton } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export default function RepayLoan() {
  const { id, loanId } = useParams();
  const [loan, setLoan] = useState(null);
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null); // set only after the server confirms the repayment

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await loanAPI.getLoanById(id, loanId);
      const l = res.data?.data?.loan;
      if (!l) throw new Error("missing");
      setLoan(l);
      const remaining = Math.max(0, num(l.total_repayable) - num(l.amount_paid));
      setAmount(remaining > 0 ? remaining.toFixed(2) : "");
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id, loanId]);

  useEffect(() => { load(); }, [load]);

  const remaining = loan ? Math.max(0, num(loan.total_repayable) - num(loan.amount_paid)) : 0;
  const paid = loan ? num(loan.amount_paid) : 0;
  const pct = loan && num(loan.total_repayable) > 0 ? Math.min(100, Math.round((paid / num(loan.total_repayable)) * 100)) : 0;
  const value = Number(amount);
  const amountError = !amount ? "Enter an amount." : !Number.isFinite(value) || value <= 0 ? "Enter an amount greater than zero." : value > remaining + 0.005 ? `The most you can repay is ${formatKES(remaining)}.` : "";

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (amountError || busy) return;
    setBusy(true);
    setSubmitError("");
    try {
      const res = await loanAPI.repay(id, loanId, { amount: value });
      setResult({ status: res.data?.status || res.data?.loanStatus, components: res.data?.components || {} });
    } catch (err) {
      setSubmitError(err.response?.data?.message || "We couldn't record your repayment. Nothing was changed, so you can try again.");
    } finally {
      setBusy(false);
    }
  };

  const back = <Link to={`/chamas/${id}/loans`} className="cs-btn cs-btn--secondary">Back to loans</Link>;

  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader title="Repay loan" subtitle={loan ? `Loan #${loan.loan_id}` : undefined} actions={back} />

        {loading && <div className="cs-card" aria-busy="true" aria-label="Loading loan"><Skeleton height={16} width="40%" /><Skeleton height={36} style={{ marginTop: 12 }} /></div>}

        {loadError && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load this loan.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loan && !loading && (
          <>
            <section className="cs-card" aria-label="Loan summary" style={{ marginBottom: 16 }}>
              <dl className="cs-kv">
                <div><dt>Borrowed</dt><dd>{formatKES(loan.loan_amount)}</dd></div>
                <div><dt>Interest rate</dt><dd>{loan.interest_rate != null ? `${num(loan.interest_rate)}%` : "—"}</dd></div>
                <div><dt>Total repayable</dt><dd>{formatKES(loan.total_repayable)}</dd></div>
                <div><dt>Paid so far</dt><dd>{formatKES(paid)}</dd></div>
                <div><dt>Left to repay</dt><dd>{formatKES(remaining)}</dd></div>
                <div><dt>Due date</dt><dd>{formatDate(loan.due_date)}</dd></div>
              </dl>
              <div style={{ marginTop: 16 }}>
                <div className="cs-progress-label"><span>Repaid</span><span>{pct}%</span></div>
                <div className="cs-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Repayment progress"><span style={{ width: `${pct}%` }} /></div>
              </div>
            </section>

            {result ? (
              <div className="cs-notice cs-notice--success" role="status" style={{ flexDirection: "column" }}>
                <strong>Repayment recorded.</strong>
                {result.status && <span>Loan status: {String(result.status).replace(/_/g, " ").toLowerCase()}.</span>}
                {(result.components.principal || result.components.interest || result.components.penalty) ? (
                  <span>Applied to principal {formatKES(result.components.principal || 0)}, interest {formatKES(result.components.interest || 0)}, penalty {formatKES(result.components.penalty || 0)}.</span>
                ) : null}
                <div className="cs-actions">{back}</div>
              </div>
            ) : remaining > 0 ? (
              <form className="cs-card" onSubmit={submit} noValidate>
                {submitError && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16 }}>{submitError}</div>}
                <div className="cs-field">
                  <label className="cs-label" htmlFor="repay-amount">Repayment amount (KES)<span className="cs-required" aria-hidden="true">*</span></label>
                  <input id="repay-amount" className="cs-input cs-input--amount" type="number" inputMode="decimal" min="0.01" step="0.01" max={remaining}
                    value={amount} disabled={busy} onChange={(e) => setAmount(e.target.value)} onBlur={() => setTouched(true)}
                    aria-invalid={touched && Boolean(amountError)} aria-describedby="repay-msg" />
                  <span id="repay-msg" className={touched && amountError ? "cs-error" : "cs-help"}>
                    {touched && amountError ? amountError : `Up to ${formatKES(remaining)}. Payments cover penalties first, then interest, then principal.`}
                  </span>
                </div>
                <div className="cs-actions" style={{ marginTop: 16 }}>
                  <Button type="submit" variant="primary" loading={busy}>{busy ? "Recording…" : "Record repayment"}</Button>
                </div>
              </form>
            ) : (
              <div className="cs-card cs-empty">
                <h3>This loan is fully repaid</h3>
                <p>No further repayments are required.</p>
                {back}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
