import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { Button, PageHeader, Skeleton, Dialog } from "../../../components/ui";
import { currentUserId } from "../../../utils/format";

const FREQUENCIES = [["DAILY", "Daily"], ["WEEKLY", "Weekly"], ["BIWEEKLY", "Every 2 weeks"], ["MONTHLY", "Monthly"]];
const PAY_TYPES = [["PAYBILL", "M-Pesa Paybill"], ["TILL", "M-Pesa Till"], ["POCHI", "Pochi la Biashara"], ["SEND_MONEY", "Send money to a phone"], ["BANK", "Bank transfer"]];

export default function ManageChama() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [chama, setChama] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "delete" | "cancel"
  const [errors, setErrors] = useState({});
  const [f, setF] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const c = (await chamaAPI.getById(id)).data?.data;
      setChama(c);
      const pm = c.payment_methods || {};
      setF({
        name: c.chama_name || "",
        description: c.description || "",
        amount: String(c.contribution_amount ?? ""),
        frequency: c.contribution_frequency || "MONTHLY",
        visibility: c.visibility || "PRIVATE",
        manual: !!c.accepts_manual_payment,
        payType: pm.type || "PAYBILL",
        businessNumber: pm.businessNumber || "",
        accountNumber: pm.accountNumber || "",
        tillNumber: pm.tillNumber || "",
        phoneNumber: pm.phoneNumber || "",
        recipientName: pm.recipientName || "",
        bankName: pm.bankName || "",
        bankAccount: pm.bankAccount || pm.bankAccountNumber || "",
        bankAccountName: pm.bankAccountName || "",
      });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const set = (e) => setF((x) => ({ ...x, [e.target.name]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    const er = {};
    if (f.name.trim().length < 3) er.name = "Use a name of at least 3 characters.";
    const a = Number(f.amount);
    if (!Number.isFinite(a) || a <= 0) er.amount = "Enter the contribution amount in KES.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await chamaAPI.update(id, {
        chamaName: f.name.trim(),
        description: f.description.trim(),
        contributionAmount: a,
        contributionFrequency: f.frequency,
        visibility: f.visibility,
        acceptsManualPayment: f.manual,
        paymentMethods: {
          type: f.payType,
          businessNumber: f.businessNumber.trim(), accountNumber: f.accountNumber.trim(), tillNumber: f.tillNumber.trim(),
          phoneNumber: f.phoneNumber.trim(), recipientName: f.recipientName.trim(),
          bankName: f.bankName.trim(), bankAccount: f.bankAccount.trim(), bankAccountName: f.bankAccountName.trim(),
        },
      });
      toast.success("Chama settings saved.");
      navigate(`/chamas/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't save the settings. Only the chairperson can change them.");
    } finally {
      setSaving(false);
    }
  };

  const runConfirmed = async () => {
    const action = confirm;
    setBusy(true);
    try {
      if (action === "delete") {
        const res = await chamaAPI.delete(id);
        if (res.data?.pending) { toast.info(res.data.message); await load(); } else { toast.success(res.data?.message || "Chama retired."); navigate("/chamas"); }
      } else {
        await chamaAPI.cancelDelete(id);
        toast.success("Deactivation request cancelled.");
        await load();
      }
      setConfirm(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't go through. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const text = (n, label, props = {}) => (
    <div className="cs-field">
      <label className="cs-label" htmlFor={`mc-${n}`}>{label}</label>
      <input id={`mc-${n}`} name={n} className="cs-input" value={f[n]} onChange={set} aria-invalid={errors[n] ? "true" : undefined} aria-describedby={errors[n] ? `mc-${n}-err` : undefined} {...props} />
      {errors[n] && <span className="cs-error" id={`mc-${n}-err`} role="alert">{errors[n]}</span>}
    </div>
  );

  if (loading) return <div className="cs-shell"><main className="cs-page"><div className="cs-card" aria-busy="true" aria-label="Loading settings"><Skeleton height={20} width="40%" /><Skeleton height={80} style={{ marginTop: 12 }} /></div></main></div>;
  if (failed || !f) return (
    <div className="cs-shell"><main className="cs-page">
      <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span>We couldn&apos;t load this chama&apos;s settings.</span>
        <span className="cs-actions"><Button size="sm" onClick={load}>Try again</Button><Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary cs-btn--sm">Back</Link></span>
      </div>
    </main></div>
  );

  const requestedBy = chama?.deletion_requested_by;
  const mine = requestedBy && String(requestedBy) === String(currentUserId(user));

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="Chama settings" subtitle={chama?.chama_name} actions={<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>} />

        <form className="cs-card" onSubmit={save} noValidate style={{ maxWidth: 720, marginBottom: 16 }}>
          <h2 className="cs-card-title">About the chama</h2>
          {text("name", "Name", { maxLength: 100 })}
          <div className="cs-field"><label className="cs-label" htmlFor="mc-description">Description</label><textarea id="mc-description" name="description" className="cs-textarea" rows={3} value={f.description} onChange={set} /></div>
          <div className="cs-form-grid">
            {text("amount", "Contribution (KES)", { type: "number", inputMode: "decimal", min: "1" })}
            <div className="cs-field">
              <label className="cs-label" htmlFor="mc-frequency">How often?</label>
              <select id="mc-frequency" name="frequency" className="cs-select" value={f.frequency} onChange={set}>{FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </div>
          </div>
          <div className="cs-field">
            <label className="cs-label" htmlFor="mc-visibility">Who can find it?</label>
            <select id="mc-visibility" name="visibility" className="cs-select" value={f.visibility} onChange={set}><option value="PRIVATE">Private: invite only</option><option value="PUBLIC">Public: anyone can ask to join</option></select>
          </div>

          <h2 className="cs-card-title">Where members pay</h2>
          <div className="cs-field">
            <label className="cs-label" htmlFor="mc-payType">Payment method</label>
            <select id="mc-payType" name="payType" className="cs-select" value={f.payType} onChange={set}>{PAY_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </div>
          {f.payType === "PAYBILL" && <div className="cs-form-grid">{text("businessNumber", "Business number")}{text("accountNumber", "Account number")}</div>}
          {f.payType === "TILL" && text("tillNumber", "Till number")}
          {["POCHI", "SEND_MONEY"].includes(f.payType) && <div className="cs-form-grid">{text("phoneNumber", "Phone number", { type: "tel" })}{text("recipientName", "Name on the number")}</div>}
          {f.payType === "BANK" && <><div className="cs-form-grid">{text("bankName", "Bank")}{text("bankAccount", "Account number")}</div>{text("bankAccountName", "Account name")}</>}
          <label className="cs-check" style={{ marginBottom: 16 }}>
            <input type="checkbox" name="manual" checked={f.manual} onChange={set} />
            <span>Let members report payments made outside the app<br /><span className="cs-help">An official still has to verify each one.</span></span>
          </label>
          <div className="cs-actions"><Button type="submit" loading={saving}>Save settings</Button></div>
        </form>

        <section className="cs-card" aria-label="Retire chama" style={{ maxWidth: 720 }}>
          <h2 className="cs-card-title">Retire this chama</h2>
          {requestedBy ? (
            <>
              <div className="cs-notice cs-notice--warning" role="status" style={{ marginBottom: 12 }}>
                {mine ? "You asked to retire this chama. Another official needs to confirm." : "An official asked to retire this chama. Your confirmation is needed."}
              </div>
              <div className="cs-actions">
                {mine ? <Button onClick={() => setConfirm("cancel")}>Cancel the request</Button> : <><Button variant="danger" onClick={() => setConfirm("delete")}>Confirm retirement</Button><Button onClick={() => setConfirm("cancel")}>Decline</Button></>}
              </div>
            </>
          ) : (
            <>
              <p>Two officials must agree. It only works when the group fund is empty and no loans are open. Records are kept.</p>
              <Button variant="danger" onClick={() => setConfirm("delete")}>Request retirement</Button>
            </>
          )}
        </section>

        <Dialog
          open={!!confirm}
          onClose={() => setConfirm(null)}
          title={confirm === "cancel" ? (mine ? "Cancel the request?" : "Decline the request?") : (requestedBy ? "Retire this chama?" : "Request retirement?")}
          actions={(<><Button onClick={() => setConfirm(null)}>Go back</Button><Button variant={confirm === "cancel" ? "primary" : "danger"} loading={busy} onClick={runConfirmed}>{confirm === "cancel" ? (mine ? "Cancel request" : "Decline") : (requestedBy ? "Retire chama" : "Send request")}</Button></>)}
        >
          <p>{confirm === "cancel" ? "The chama stays active." : requestedBy ? "Confirming retires the chama for everyone." : "A second official must confirm before the chama is retired."}</p>
        </Dialog>
      </main>
    </div>
  );
}
