import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { chamaAPI, contributionAPI, roscaAPI } from "../../../services/api";
import { Button, PageHeader, Skeleton } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

const METHODS = [
  { value: "MPESA", label: "M-Pesa" },
  { value: "CASH", label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE", label: "Cheque" },
];

export default function RecordContribution() {
  const { id } = useParams();
  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [cycleNote, setCycleNote] = useState("");
  const [form, setForm] = useState({ userId: "", amount: "", method: "MPESA", reference: "", notes: "" });
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [recorded, setRecorded] = useState(null); // set only after the server confirms

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [c, m] = await Promise.all([chamaAPI.getById(id), chamaAPI.getMembers(id)]);
      const chamaData = c.data?.data;
      setChama(chamaData);
      setMembers(m.data?.data || []);
      let amount = chamaData?.contribution_amount || "";
      if (chamaData?.chama_type === "ROSCA") {
        try {
          const cycles = (await roscaAPI.getCycles(id)).data?.data || [];
          const active = cycles.find((x) => x.status === "ACTIVE");
          const pending = !active && cycles.find((x) => x.status === "PENDING");
          const picked = active || pending || null;
          setCycle(picked);
          if (picked) amount = picked.contribution_amount || amount;
          setCycleNote(!picked ? "There is no active or pending cycle. Create a cycle before recording contributions." : !active ? `Cycle “${picked.cycle_name}” has not started yet.` : "");
        } catch {
          setCycleNote("We couldn't load the cycle, so the chama's default amount is shown.");
        }
      }
      setForm((f) => ({ ...f, amount }));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const isROSCA = chama?.chama_type === "ROSCA";
  const noCycle = isROSCA && !cycle;
  const expected = cycle?.contribution_amount || chama?.contribution_amount;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));

  const errors = {
    userId: form.userId ? "" : "Choose the member who paid.",
    amount: !form.amount || Number(form.amount) <= 0 ? "Enter an amount greater than zero." : "",
  };
  const member = members.find((m) => String(m.user_id) === String(form.userId));

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ userId: true, amount: true });
    if (errors.userId || errors.amount || busy || noCycle) return;
    setBusy(true);
    setSubmitError("");
    try {
      const notes = [`Paid by ${METHODS.find((m) => m.value === form.method)?.label}`, form.notes.trim()].filter(Boolean).join(". ");
      await contributionAPI.record(id, {
        userId: Number(form.userId),
        amount: Number(form.amount),
        paymentMethod: form.method,
        receiptNumber: form.reference.trim() || undefined,
        notes,
      });
      setRecorded({ name: member ? `${member.first_name} ${member.last_name}` : "the member", amount: Number(form.amount) });
      setForm((f) => ({ ...f, userId: "", reference: "", notes: "" }));
      setTouched({});
    } catch (err) {
      setSubmitError(err.response?.data?.message || "We couldn't record this payment. Nothing was changed, so you can try again.");
    } finally {
      setBusy(false);
    }
  };

  const back = <Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>;

  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader title="Record a payment" subtitle={chama?.chama_name} actions={back} />

        {loading && <div className="cs-card" aria-busy="true" aria-label="Loading"><Skeleton height={16} width="40%" /><Skeleton height={40} style={{ marginTop: 12 }} /></div>}
        {loadError && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load this chama.</span><Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {chama && !loading && (
          <>
            {recorded && (
              <div className="cs-notice cs-notice--success" role="status" style={{ marginBottom: 16, flexDirection: "column" }}>
                <strong>Recorded {formatKES(recorded.amount)} for {recorded.name}.</strong>
                <span>It now counts towards their total and the chama fund. You can record another payment below.</span>
              </div>
            )}
            {isROSCA && cycleNote && <div className={`cs-notice ${noCycle ? "cs-notice--danger" : "cs-notice--warning"}`} role={noCycle ? "alert" : undefined} style={{ marginBottom: 16 }}>{cycleNote}</div>}
            {isROSCA && cycle && <p className="cs-help">Cycle: {cycle.cycle_name}</p>}
            {submitError && <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16 }}>{submitError}</div>}

            <form className="cs-card" onSubmit={submit} noValidate>
              <div className="cs-field">
                <label className="cs-label" htmlFor="member">Member<span className="cs-required" aria-hidden="true">*</span></label>
                <select id="member" className="cs-input" value={form.userId} onChange={set("userId")} onBlur={blur("userId")} disabled={busy}
                  aria-invalid={Boolean(touched.userId && errors.userId)} aria-describedby="member-msg">
                  <option value="">Choose a member</option>
                  {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name} — paid so far {formatKES(m.total_contributions || 0)}</option>)}
                </select>
                <span id="member-msg" className={touched.userId && errors.userId ? "cs-error" : "cs-help"}>{touched.userId && errors.userId ? errors.userId : " "}</span>
              </div>

              <div className="cs-field" style={{ marginTop: 12 }}>
                <label className="cs-label" htmlFor="amount">Amount (KES)<span className="cs-required" aria-hidden="true">*</span></label>
                <input id="amount" className="cs-input cs-input--amount" type="number" inputMode="decimal" min="0.01" step="0.01" value={form.amount}
                  onChange={set("amount")} onBlur={blur("amount")} disabled={busy} aria-invalid={Boolean(touched.amount && errors.amount)} aria-describedby="amount-msg" />
                <span id="amount-msg" className={touched.amount && errors.amount ? "cs-error" : "cs-help"}>
                  {touched.amount && errors.amount ? errors.amount : expected ? `${isROSCA ? "Cycle amount" : "Chama default"}: ${formatKES(expected)}` : " "}
                </span>
              </div>

              <div className="cs-field" style={{ marginTop: 12 }}>
                <label className="cs-label" htmlFor="method">How was it paid?</label>
                <select id="method" className="cs-input" value={form.method} onChange={set("method")} disabled={busy}>
                  {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="cs-field" style={{ marginTop: 12 }}>
                <label className="cs-label" htmlFor="reference">Receipt or reference number</label>
                <input id="reference" className="cs-input" type="text" value={form.reference} onChange={set("reference")} disabled={busy} placeholder="e.g. QBX123456" autoComplete="off" aria-describedby="ref-msg" />
                <span id="ref-msg" className="cs-help">Each reference can only be used once. Leave blank to generate one.</span>
              </div>

              <div className="cs-field" style={{ marginTop: 12 }}>
                <label className="cs-label" htmlFor="notes">Notes</label>
                <textarea id="notes" className="cs-input" rows={3} value={form.notes} onChange={set("notes")} disabled={busy} />
              </div>

              <div className="cs-actions" style={{ marginTop: 20 }}>
                <Button type="submit" variant="primary" loading={busy} disabled={noCycle}>{busy ? "Recording…" : "Record payment"}</Button>
                <Link to={`/chamas/${id}/bulk-record`} className="cs-btn cs-btn--tertiary">Record many at once</Link>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
