import { useState, useEffect } from "react";
import { X, Copy } from "lucide-react";
import { toast } from "react-toastify";
import { paymentAPI } from "../../services/api";
import "./PendingContributions.css";

/** The member's own account number for this chama. Paying it into the chama's paybill credits them automatically. */
const MyPaymentAccount = ({ chamaId, onClose }) => {
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    paymentAPI.myAccount(chamaId).then((r) => setInfo(r.data.data)).catch((e) => setError(e.response?.data?.message || "Could not load your account number"));
  }, [chamaId]);

  const copy = (text) => navigator.clipboard?.writeText(text).then(() => toast.success("Copied"), () => toast.error("Copy failed"));
  const pretty = info ? info.account_number.replace(/(\d{6})(\d{4})(\d)/, "$1 $2 $3") : "";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="pending-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Your payment account">
        <div className="modal-header">
          <h3>Your payment account</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>
        {error ? <p>{error}</p> : !info ? <p>Loading…</p> : (
          <div>
            <p style={{ opacity: 0.8, fontSize: 14 }}>This number is yours in this chama only. Use it as the account number when you pay by M-Pesa, and your payment is credited to you automatically.</p>
            <div style={{ fontSize: 28, fontFamily: "monospace", letterSpacing: 1, margin: "12px 0" }}>{pretty}</div>
            <button className="btn-lux btn-lux-outline" onClick={() => copy(info.account_number)}><Copy size={14} /> Copy number</button>
            {info.paybill ? (
              <p style={{ marginTop: 16, fontSize: 14 }}>M-Pesa: Lipa na M-Pesa, Pay Bill, business number <strong>{info.paybill}</strong>, account number as above.</p>
            ) : (
              <p style={{ marginTop: 16, fontSize: 14, opacity: 0.8 }}>Your officials have not set up the chama's paybill yet. Until then, pay the way they have told you and submit the reference.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyPaymentAccount;
