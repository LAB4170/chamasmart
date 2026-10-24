import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { roscaAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader, StatCard, StatusBadge, EmptyState, Skeleton, Dialog } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

const OFFICIALS = ["CHAIRPERSON", "SECRETARY", "TREASURER"];
const CHANNEL = { PAYBILL: "M-Pesa Paybill", TILL: "Buy Goods Till", POCHI: "Pochi la Biashara" };

function PaymentDetails({ methods }) {
  if (!methods?.type) return null;
  const d = methods.details || {};
  const number = d.businessNumber || d.tillNumber || d.phoneNumber;
  if (!number) return null;
  return (
    <section className="cs-card" aria-label="Where to pay" style={{ marginBottom: 16 }}>
      <h2 className="cs-card-title">Where to pay</h2>
      <dl className="cs-kv">
        <div><dt>Channel</dt><dd>{CHANNEL[methods.type] || methods.type}</dd></div>
        <div><dt>{methods.type === "PAYBILL" ? "Business number" : methods.type === "TILL" ? "Till number" : "Phone number"}</dt><dd>{number}</dd></div>
        {methods.type === "PAYBILL" && d.accountNumber && <div><dt>Account</dt><dd>{d.accountNumber}</dd></div>}
      </dl>
      <p className="cs-help" style={{ marginBottom: 0 }}>Pay outside the app, then record it here so an official can verify it.</p>
    </section>
  );
}

export default function RoscaDashboard() {
  const { id } = useParams();
  const [cycles, setCycles] = useState([]);
  const [chama, setChama] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paying, setPaying] = useState(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [cy, ch] = await Promise.all([roscaAPI.getCycles(id), chamaAPI.getById(id)]);
      const list = cy.data?.data ?? [];
      setCycles(Array.isArray(list) ? list : []);
      setChama(ch.data?.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openPay = (cycle) => {
    setPaying(cycle);
    setAmount(String(cycle.contribution_amount ?? ""));
    setReference("");
    setFormError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setFormError("Enter an amount greater than zero.");
    setSaving(true);
    try {
      await roscaAPI.makeContribution(id, paying.cycle_id, { amount: value, reference: reference.trim() || undefined });
      toast.info("Submitted. It counts toward the pot once an official verifies your payment.");
      setPaying(null);
      await load();
    } catch (err) {
      setFormError(err.response?.data?.message || "We couldn't submit your contribution.");
    } finally {
      setSaving(false);
    }
  };

  const role = (chama?.role || "").toUpperCase();
  const canManage = OFFICIALS.includes(role);
  const active = cycles.filter((c) => c.status === "ACTIVE");
  const past = cycles.filter((c) => c.status !== "ACTIVE");

  const card = (c) => (
    <article key={c.cycle_id} className="cs-card cs-loan">
      <header className="cs-loan-head">
        <div className="cs-list-main">
          <h3 className="cs-loan-title">{c.cycle_name}</h3>
          <div className="cs-list-meta">{formatDate(c.start_date)} to {formatDate(c.end_date)}</div>
        </div>
        <StatusBadge status={c.status} />
      </header>
      <dl className="cs-kv">
        <div><dt>Each pays</dt><dd>{formatKES(c.contribution_amount)}</dd></div>
        <div><dt>Members</dt><dd>{c.total_members ?? 0}</dd></div>
      </dl>
      <footer className="cs-actions">
        <Link to={`/chamas/${id}/rosca/${c.cycle_id}`} className="cs-btn cs-btn--secondary cs-btn--sm">Open</Link>
        {c.status === "ACTIVE" && <Button size="sm" onClick={() => openPay(c)}>Record my payment</Button>}
      </footer>
    </article>
  );

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Merry-go-round"
          subtitle="Members take turns receiving the pot."
          actions={(
            <>
              <Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>
              {canManage && <Link to={`/chamas/${id}/rosca/create-cycle`} className="cs-btn cs-btn--primary">Start a new round</Link>}
            </>
          )}
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load the rounds.</span><Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading rounds"><Skeleton height={20} width="40%" /><Skeleton height={60} style={{ marginTop: 12 }} /></div>
        ) : !error && (cycles.length === 0 ? (
          <div className="cs-card"><EmptyState title="No rounds yet" message={canManage ? "Start the first round to set the payout order." : "An official hasn't started a round yet."} /></div>
        ) : (
          <>
            <div className="cs-grid" style={{ marginBottom: 16 }}>
              <StatCard label="Active rounds" value={String(active.length)} />
              <StatCard label="All rounds" value={String(cycles.length)} />
            </div>
            <PaymentDetails methods={chama?.payment_methods} />
            {active.length > 0 && <><h2 className="cs-card-title">Active</h2><div className="cs-loan-grid" style={{ marginBottom: 16 }}>{active.map(card)}</div></>}
            {past.length > 0 && <><h2 className="cs-card-title">Finished or cancelled</h2><div className="cs-loan-grid">{past.map(card)}</div></>}
          </>
        ))}

        <Dialog
          open={!!paying}
          onClose={() => setPaying(null)}
          title={paying ? `Record payment: ${paying.cycle_name}` : ""}
          actions={(<><Button onClick={() => setPaying(null)}>Cancel</Button><Button type="submit" form="rosca-pay" loading={saving}>Submit</Button></>)}
        >
          <form id="rosca-pay" onSubmit={submit} noValidate>
            {formError && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 12 }}>{formError}</div>}
            <div className="cs-field"><label className="cs-label" htmlFor="rp-amount">Amount (KES)</label><input id="rp-amount" className="cs-input" type="number" inputMode="decimal" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="cs-field"><label className="cs-label" htmlFor="rp-ref">Payment reference (optional)</label><input id="rp-ref" className="cs-input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="M-Pesa code" /><span className="cs-help">ChamaSmart doesn&apos;t move money. Pay first, then record it. An official confirms it.</span></div>
          </form>
        </Dialog>
      </main>
    </div>
  );
}
