import { useState } from "react";
import { X, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { contributionAPI } from "../../services/api";
import { uploadMediaToFirebase } from "../../services/firebaseStorage";
import { toast } from "react-toastify";
import "./ManualPaymentModal.css";

const ManualPaymentModal = ({ chama, onClose, onSuccess }) => {
  const [amount, setAmount] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pm = chama?.payment_methods || {};
  const paymentType = pm.type || "PAYBILL";
  const businessNumber = pm.businessNumber || pm.tillNumber || "";
  const accountName = pm.accountName || chama?.name || "";

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("Screenshot must be under 5MB");
      return;
    }
    setProofFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      return toast.error("Enter a valid amount");
    }
    if (!receiptNumber.trim()) {
      return toast.error("M-Pesa receipt number is required");
    }

    setSubmitting(true);
    try {
      let paymentProof = null;
      if (proofFile) {
        setUploading(true);
        paymentProof = await uploadMediaToFirebase(proofFile, "payment-proofs");
        setUploading(false);
      }

      await contributionAPI.submit(chama.chama_id, {
        amount: parseFloat(amount),
        paymentMethod: "MPESA",
        receiptNumber: receiptNumber.trim(),
        paymentProof,
        notes: `Manual payment via ${paymentType}`,
        verificationStatus: "PENDING",
      });

      toast.success("Receipt submitted! Awaiting admin verification.");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit receipt");
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="manual-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Submit Manual Payment</h3>
          <button className="modal-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Payment Instructions */}
        <div className="payment-instructions">
          <div className="instruction-badge">
            <span className="step-num">1</span>
            <div>
              <p className="instruction-title">Pay to this number on M-Pesa</p>
              {paymentType === "PAYBILL" && (
                <>
                  <p className="instruction-detail">
                    Paybill: <strong>{businessNumber}</strong>
                  </p>
                  <p className="instruction-detail">
                    Account: <strong>{accountName}</strong>
                  </p>
                </>
              )}
              {paymentType === "TILL" && (
                <p className="instruction-detail">
                  Buy Goods Till: <strong>{businessNumber}</strong>
                </p>
              )}
              {paymentType === "POCHI" && (
                <p className="instruction-detail">
                  Pochi la Biashara: <strong>{businessNumber}</strong>
                </p>
              )}
            </div>
          </div>
          <div className="instruction-badge">
            <span className="step-num">2</span>
            <p className="instruction-title">Then fill in the form below</p>
          </div>
        </div>

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="manual-payment-form">
          <div className="form-group">
            <label>Amount Paid (KES)</label>
            <input
              type="number"
              className="form-input"
              placeholder="e.g. 500"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="1"
              required
            />
          </div>

          <div className="form-group">
            <label>M-Pesa Receipt Number</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. RCA1X3DE5Y"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value.toUpperCase())}
              maxLength={20}
              required
            />
            <p className="form-hint">Found in your M-Pesa SMS confirmation</p>
          </div>

          <div className="form-group">
            <label>Screenshot (Optional)</label>
            <label className="upload-zone">
              <Upload size={18} />
              <span>{proofFile ? proofFile.name : "Upload M-Pesa screenshot"}</span>
              <input type="file" accept="image/*" onChange={handleFileChange} hidden />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {uploading ? "Uploading..." : submitting ? "Submitting..." : "Submit Receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManualPaymentModal;
