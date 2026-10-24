import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { chamaAPI, contributionAPI, roscaAPI } from "../../../services/api";
import { Button, PageHeader, Skeleton } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

const METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "MPESA", label: "M-Pesa" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
];
const iso = (d) => d.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export default function BulkRecordContribution() {
  const { id } = useParams();
  const [chama, setChama] = useState(null);
  const [rows, setRows] = useState([]);
  const [paid, setPaid] = useState({}); // userId -> amount already completed this month
  const [cycle, setCycle] = useState(null);
  const [cycleNote, setCycleNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [c, m] = await Promise.all([chamaAPI.getById(id), chamaAPI.getMembers(id)]);
      const chamaData = c.data?.data;
      const members = m.data?.data || [];
      const now = new Date();
      const month = await contributionAPI.getAll(id, { startDate: iso(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: iso(now) })
        .then((r) => r.data?.data || []).catch(() => []);
      const totals = {};
      month.filter((x) => x.status === "COMPLETED").forEach((x) => { totals[x.user_id] = (totals[x.user_id] || 0) + num(x.amount); });

      let picked = null;
      let note = "";
      if (chamaData?.chama_type === "ROSCA") {
        try {
          const cycles = (await roscaAPI.getCycles(id)).data?.data || [];
          const active = cycles.find((x) => x.status === "ACTIVE");
          const pending = !active && cycles.find((x) => x.status === "PENDING");
          picked = active || pending || null;
          note = !picked ? "There is no active or pending cycle. Create a cycle before recording contributions." : !active ? `Cycle “${picked.cycle_name}” has not started yet.` : "";
        } catch { note = "We couldn't load the cycle."; }
      }
      const expected = picked?.contribution_amount || chamaData?.contribution_amount || "";
      setChama(chamaData); setPaid(totals); setCycle(picked); setCycleNote(note);
      setRows(members.map((x) => ({ userId: x.user_id, name: `${x.first_name} ${x.last_name}`, total: num(x.total_contributions), amount: expected, method: "CASH", reference: "", checked: false })));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const update = (userId, patch) => setRows((rs) => rs.map((r) => (r.userId === userId ? { ...r, ...patch } : r)));
  const selected = rows.filter((r) => r.checked);
  const total = selected.reduce((s, r) => s + num(r.amount), 0);
  const invalid = selected.filter((r) => num(r.amount) <= 0);
  const refs = selected.map((r) => r.reference.trim()).filter(Boolean);
  const dupRef = refs.find((r, i) => refs.indexOf(r) !== i);
  const isROSCA = chama?.chama_type === "ROSCA";
  const noCycle = isROSCA && !cycle;
  const problem = selected.length === 0 ? "Tick at least one member." : invalid.length ? `Enter an amount for ${invalid.map((r) => r.name).join(", ")}.` : dupRef ? `Reference ${dupRef} is used more than once.` : "";
  const unpaidCount = useMemo(() => rows.filter((r) => !paid[r.userId]).length, [rows, paid]);

  const submit = async (e) => {
    e.preventDefault();
    if (problem || busy || noCycle) return;
    setBusy(true);
    setSubmitError("");
    try {
      const res = await contributionAPI.bulkRecord(id, {
        contributions: selected.map((r) => ({
          userId: r.userId,
          amount: num(r.amount),
          paymentMethod: r.method,
          receiptNumber: r.reference.trim() || undefined,
          notes: `Paid by ${METHODS.find((m) => m.value === r.method)?.label}`,
        })),
      });
      const saved = Array.isArray(res.data?.data) ? res.data.data : [];
      const waiting = saved.filter((x) => String(x.status || "").toUpperCase() === "PENDING");
      setDone({ count: selected.length - waiting.length, total: total - waiting.reduce((s2, x) => s2 + num(x.amount), 0), waiting: waiting.length });
      await load();
    } catch (err) {
      setSubmitError((err.response?.data?.message || "We couldn't record this batch.") + " Nothing was recorded, so you can fix it and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Record many payments" subtitle={chama?.chama_name} actions={<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>} />

        {loading && <div className="cs-card" aria-busy="true" aria-label="Loading members"><Skeleton height={20} /><Skeleton height={20} style={{ marginTop: 12 }} /></div>}
        {loadError && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load the members.</span><Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {!loading && !loadError && (
          <form onSubmit={submit} noValidate>
            {done && <div className="cs-notice cs-notice--success" role="status" style={{ marginBottom: 16 }}>Recorded {done.count} {done.count === 1 ? "payment" : "payments"} totalling {formatKES(done.total)}.{done.waiting > 0 && ` ${done.waiting} more ${done.waiting === 1 ? "is" : "are"} waiting for a second official to verify (your own payments and amounts of KES 10,000 or more). They are not in the fund yet.`}</div>}
            {cycleNote && <div className={`cs-notice ${noCycle ? "cs-notice--danger" : "cs-notice--warning"}`} style={{ marginBottom: 16 }}>{cycleNote}</div>}
            {submitError && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16 }}>{submitError}</div>}

            <div className="cs-chips" role="group" aria-label="Quick selection" style={{ marginBottom: 12 }}>
              <button type="button" className="cs-chip" aria-pressed="false" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, checked: true })))}>Select all</button>
              <button type="button" className="cs-chip" aria-pressed="false" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, checked: !paid[r.userId] })))}>Not yet paid this month ({unpaidCount})</button>
              <button type="button" className="cs-chip" aria-pressed="false" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, checked: false })))}>Clear</button>
            </div>

            <div className="cs-card cs-card--flush">
              <div className="cs-table-wrap">
                <table className="cs-table cs-table--records">
                  <caption className="cs-sr-only">Members and the payment to record for each</caption>
                  <thead><tr><th scope="col">Record</th><th scope="col">Member</th><th scope="col" className="cs-num">Paid this month</th><th scope="col">Amount (KES)</th><th scope="col">Method</th><th scope="col">Reference</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.userId}>
                        <td data-label="Record"><input type="checkbox" checked={r.checked} onChange={(e) => update(r.userId, { checked: e.target.checked })} aria-label={`Record a payment for ${r.name}`} /></td>
                        <td data-label="Member"><strong>{r.name}</strong></td>
                        <td data-label="Paid this month" className="cs-num">{paid[r.userId] ? formatKES(paid[r.userId]) : "Not yet"}</td>
                        <td data-label="Amount (KES)"><input className="cs-input cs-input--amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={r.amount} onChange={(e) => update(r.userId, { amount: e.target.value })} aria-label={`Amount for ${r.name}`} disabled={busy} /></td>
                        <td data-label="Method"><select className="cs-input" value={r.method} onChange={(e) => update(r.userId, { method: e.target.value })} aria-label={`Payment method for ${r.name}`} disabled={busy}>{METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></td>
                        <td data-label="Reference"><input className="cs-input" type="text" value={r.reference} onChange={(e) => update(r.userId, { reference: e.target.value })} aria-label={`Receipt reference for ${r.name}`} placeholder="Optional" autoComplete="off" disabled={busy} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="cs-table-foot">
                <span>{selected.length} selected · <span className="cs-totals">Total {formatKES(total)}</span></span>
              </div>
            </div>

            <div className="cs-actions" style={{ marginTop: 16, alignItems: "center" }}>
              <Button type="submit" variant="primary" loading={busy} disabled={Boolean(problem) || noCycle}>{busy ? "Recording…" : `Record ${selected.length || ""} ${selected.length === 1 ? "payment" : "payments"}`}</Button>
              {problem && selected.length > 0 && <span className="cs-error" role="alert">{problem}</span>}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
