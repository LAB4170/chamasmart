import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { subscriptionAPI } from "../../services/api";
import "./PendingContributions.css";

const STATUS_TEXT = {
  TRIAL: "Free trial",
  ACTIVE: "Active",
  PAST_DUE: "Payment due",
  SUSPENDED: "Paused until paid",
  CANCELLED: "Cancelled",
};

/** The chama's plan with ChamaSmart. Anyone in the chama can read it; the chairperson chooses and pays. */
const PlanModal = ({ chamaId, canManage, onClose }) => {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([subscriptionAPI.plans(chamaId), subscriptionAPI.current(chamaId)]);
      setPlans(p.data.data || []);
      setCurrent(c.data.data);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not load the plan");
    }
  }, [chamaId]);

  useEffect(() => { load(); }, [load]);

  const choose = async (code) => {
    setBusy(true);
    try {
      await subscriptionAPI.choose(chamaId, code);
      toast.success("Plan updated");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not change the plan");
    } finally {
      setBusy(false);
    }
  };

  const pay = async () => {
    setBusy(true);
    try {
      const res = await subscriptionAPI.checkout(chamaId);
      const url = res.data.data.checkout_url;
      if (!/^https:\/\//.test(url)) throw new Error("Unexpected checkout address");
      window.location.assign(url);
    } catch (e) {
      toast.error(e.response?.data?.message || e.message || "Could not open checkout");
      setBusy(false);
    }
  };

  const needsPayment = current && ["TRIAL", "PAST_DUE", "SUSPENDED"].includes(current.status) && Number(current.price) > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pending-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your plan">
        <div className="modal-header">
          <h3>Your plan</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {!current ? <p>Loading…</p> : (
          <>
            <p style={{ fontSize: 15 }}>
              <strong>{current.plan_name}</strong> · {STATUS_TEXT[current.status] || current.status}
              {current.period_end ? ` · until ${new Date(current.period_end).toLocaleDateString()}` : ""}
            </p>
            <p style={{ fontSize: 13, opacity: 0.8 }}>
              {current.members} of {current.max_members} members.
              {current.over_member_limit ? " You are over this plan's member limit." : ""}
              {current.status === "SUSPENDED" ? " New activity is paused until the plan is paid. Your records are safe and visible." : ""}
            </p>
            {needsPayment && canManage && (
              <button className="btn-lux btn-lux-primary" disabled={busy} onClick={pay}>
                Pay KES {Number(current.price).toLocaleString()} by card or M-Pesa
              </button>
            )}
            <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
              {plans.map((p) => (
                <div key={p.plan_code} style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(128,128,128,.25)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <div>
                    <strong>{p.name}</strong>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>Up to {p.max_members} members · {Number(p.price) === 0 ? "Free" : `KES ${Number(p.price).toLocaleString()} a month`}</div>
                  </div>
                  {p.plan_code === current.plan_code ? <span style={{ fontSize: 13 }}>Current plan</span>
                    : canManage ? <button className="btn-lux btn-lux-outline" disabled={busy} onClick={() => choose(p.plan_code)}>Choose</button> : null}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlanModal;
