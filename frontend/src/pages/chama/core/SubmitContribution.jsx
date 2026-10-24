import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { chamaAPI, contributionAPI } from "../../../services/api";
import { Button, PageHeader, Skeleton } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

const POLL_MS = 3000;
const MAX_POLLS = 30; // about 90 seconds
const PHONE_RE = /^(\+?254|0)[17]\d{8}$/;

export default function SubmitContribution() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chama, setChama] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState({});
  // idle -> starting -> waiting -> confirmed | failed | unconfirmed
  const [stage, setStage] = useState("idle");
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState("");
  const timer = useRef(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; clearTimeout(timer.current); }, []);

  const loadChama = useCallback(async () => {
    setPageLoading(true);
    setLoadError(false);
    try {
      const res = await chamaAPI.getById(id);
      const c = res.data?.data;
      setChama(c);
      if (c?.contribution_amount) setAmount(String(Math.round(Number(c.contribution_amount))));
    } catch {
      setLoadError(true);
    } finally {
      setPageLoading(false);
    }
  }, [id]);

  useEffect(() => { loadChama(); }, [loadChama]);

  const amountError = !amount ? "Enter the amount" : !/^\d+$/.test(amount) || Number(amount) < 1 ? "Enter a whole number of shillings, at least 1" : "";
  const phoneError = !phone ? "Enter your M-Pesa number" : !PHONE_RE.test(phone.replace(/\s/g, "")) ? "Use a Safaricom number such as 0712345678" : "";
  const busy = stage === "starting" || stage === "waiting";

  // Success is shown only after the backend reports the payment as COMPLETED.
  const poll = useCallback((checkoutId, attempt) => {
    timer.current = setTimeout(async () => {
      if (!alive.current) return;
      try {
        const res = await contributionAPI.getMpesaStatus(checkoutId);
        const t = res.data?.data;
        if (t?.status === "COMPLETED") { setReceipt(t.receipt || ""); setStage("confirmed"); return; }
        if (t?.status === "FAILED" || t?.status === "CANCELLED") {
          setMessage(t.message || "The payment was cancelled or failed.");
          setStage("failed");
          return;
        }
      } catch { /* a missed poll is retried below */ }
      if (attempt >= MAX_POLLS) { setStage("unconfirmed"); return; }
      poll(checkoutId, attempt + 1);
    }, POLL_MS);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ amount: true, phone: true });
    if (busy || amountError || phoneError) return;
    setStage("starting");
    setMessage("");
    try {
      const res = await contributionAPI.initiateMpesaPayment({ chamaId: Number(id), amount: Number(amount), phoneNumber: phone.replace(/\s/g, "") });
      const checkoutId = res.data?.data?.checkout_request_id;
      if (!checkoutId) throw new Error("missing checkout id");
      setStage("waiting");
      poll(checkoutId, 1);
    } catch (err) {
      setMessage(err.response?.data?.message || "We couldn't start the payment. Please try again.");
      setStage("failed");
    }
  };

  const back = () => navigate(`/chamas/${id}`);

  if (pageLoading) {
    return <div className="cs-shell"><main className="cs-page"><Skeleton height={32} width="50%" /><div className="cs-card" style={{ marginTop: 24 }}><Skeleton height={140} /></div></main></div>;
  }

  if (loadError || !chama) {
    return (
      <div className="cs-shell"><main className="cs-page">
        <PageHeader title="Pay with M-Pesa" />
        <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <span>We couldn&apos;t load this chama.</span><Button size="sm" onClick={loadChama}>Try again</Button>
        </div>
      </main></div>
    );
  }

  if (chama.custody_type === "SELF_MANAGED") {
    return (
      <div className="cs-shell"><main className="cs-page">
        <PageHeader title="Pay your treasurer" subtitle={chama.chama_name} />
        <div className="cs-card">
          <p style={{ marginTop: 0 }}>This chama&apos;s treasurer collects contributions directly, so M-Pesa payment through ChamaSmart is switched off. Pay using the treasurer&apos;s details, then submit your receipt for verification.</p>
          <div className="cs-actions">
            <Button variant="primary" onClick={() => navigate(`/chamas/${id}`, { state: { openManualPayment: true } })}>Submit a receipt</Button>
            <Button onClick={back}>Back to chama</Button>
          </div>
        </div>
      </main></div>
    );
  }

  if (stage === "confirmed") {
    return (
      <div className="cs-shell"><main className="cs-page">
        <PageHeader title="Payment received" subtitle={chama.chama_name} />
        <div className="cs-card" role="status">
          <span className="cs-status cs-status--success">Confirmed by M-Pesa</span>
          <p className="cs-stat-value" style={{ margin: "12px 0 4px" }}>{formatKES(amount)}</p>
          {receipt && <p className="cs-help">M-Pesa receipt: <strong>{receipt}</strong></p>}
          <div className="cs-actions" style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={() => navigate(`/chamas/${id}`, { state: { refresh: true, tab: "contributions" } })}>Back to chama</Button>
          </div>
        </div>
      </main></div>
    );
  }

  return (
    <div className="cs-shell"><main className="cs-page" style={{ maxWidth: 560 }}>
      <PageHeader title="Pay with M-Pesa" subtitle={chama.chama_name} />

      {stage === "failed" && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16 }}>{message}</div>}
      {stage === "unconfirmed" && (
        <div className="cs-notice cs-notice--warning" role="status" style={{ marginBottom: 16 }}>
          <span>We haven&apos;t received confirmation yet. If you entered your PIN, the payment may still arrive. Check <Link className="cs-link" to={`/chamas/${id}`}>the chama&apos;s contributions</Link> before paying again.</span>
        </div>
      )}

      <form className="cs-card" onSubmit={submit} noValidate>
        <div className="cs-field">
          <label className="cs-label" htmlFor="phone">M-Pesa phone number<span className="cs-required" aria-hidden="true">*</span></label>
          <input id="phone" className="cs-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678" value={phone} disabled={busy}
                 onChange={(e) => setPhone(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                 aria-invalid={Boolean(touched.phone && phoneError)} aria-describedby="phone-msg" />
          <span id="phone-msg" className={touched.phone && phoneError ? "cs-error" : "cs-help"}>{touched.phone && phoneError ? phoneError : "An M-Pesa prompt will be sent to this number."}</span>
        </div>
        <div className="cs-field">
          <label className="cs-label" htmlFor="amount">Amount (KES)<span className="cs-required" aria-hidden="true">*</span></label>
          <input id="amount" className="cs-input cs-input--amount" type="text" inputMode="numeric" value={amount} disabled={busy}
                 onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                 aria-invalid={Boolean(touched.amount && amountError)} aria-describedby="amount-msg" />
          <span id="amount-msg" className={touched.amount && amountError ? "cs-error" : "cs-help"}>
            {touched.amount && amountError ? amountError : chama.contribution_amount ? `Regular contribution: ${formatKES(chama.contribution_amount, { whole: true })}` : "Whole shillings only."}
          </span>
        </div>

        {stage === "waiting" && (
          <div className="cs-notice cs-notice--info" role="status" style={{ marginBottom: 16 }}>
            <span className="cs-spinner" aria-hidden="true" />
            <span>Check your phone and enter your M-Pesa PIN. This page updates when the payment is confirmed.</span>
          </div>
        )}

        <div className="cs-actions">
          <Button type="submit" variant="primary" block loading={busy}>{stage === "waiting" ? "Waiting for confirmation" : stage === "starting" ? "Sending prompt" : stage === "unconfirmed" ? "Try again" : "Pay with M-Pesa"}</Button>
          {!busy && <Button block onClick={back}>Cancel</Button>}
        </div>
      </form>
    </main></div>
  );
}
