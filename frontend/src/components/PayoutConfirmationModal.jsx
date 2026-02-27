import React, { useState } from 'react';
import { CreditCard, X, Target, Info, AlertTriangle } from 'lucide-react';
import { roscaAPI } from '../services/api';
import { toast } from 'react-toastify';

const PayoutConfirmationModal = ({ cycle, recipient, onClose, onSuccess, formatCurrency }) => {
  const [referenceId, setReferenceId] = useState('');
  const [paymentProof, setPaymentProof] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!referenceId) {
      toast.warning("Reference ID is required");
      return;
    }

    try {
      setLoading(true);
      await roscaAPI.processPayout(cycle.cycle_id, {
        position: recipient.position,
        reference_id: referenceId,
        payment_proof: paymentProof
      });
      toast.success(`Disbursement to ${recipient.user_id} confirmed!`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to process payout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content max-w-md">
        <div className="modal-header flex-between">
          <h3 className="flex items-center gap-2">
            <CreditCard size={20} className="text-primary" />
            Confirm Disbursement
          </h3>
          <button onClick={onClose} className="btn-close"><X size={20} /></button>
        </div>

        <div className="modal-body p-6">
          <div className="recipient-summary mb-6 p-4 bg-primary-light rounded-xl border border-primary-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-primary-700 font-medium">Recipient</span>
              <span className="font-bold text-primary-900">{recipient.first_name} {recipient.last_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-primary-700 font-medium">Payout Amount</span>
              <span className="text-lg font-black text-primary-900">{formatCurrency(cycle.contribution_amount * cycle.members_count || 0)}</span>
            </div>
            <div className="mt-2 pt-2 border-t border-primary-200 text-[10px] text-primary-600 uppercase tracking-widest font-bold">
              Position {recipient.position} • Round {recipient.position}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Transaction Reference ID (Required)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. MPESA-ABC1234567"
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                required
              />
              <small className="text-muted flex items-start gap-1 mt-1">
                <Info size={12} className="mt-0.5" />
                This ID will be used for audit trail and transparency.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Proof (Optional URL/Note)</label>
              <textarea
                className="form-input"
                placeholder="Paste transaction link or additional notes..."
                rows="2"
                value={paymentProof}
                onChange={(e) => setPaymentProof(e.target.value)}
              ></textarea>
            </div>

            <div className="p-3 bg-amber-50 rounded-lg flex gap-3 border border-amber-100">
              <AlertTriangle size={18} className="text-amber-600 shrink-0" />
              <p className="text-[11px] text-amber-900 leading-relaxed">
                <strong>Attention:</strong> Ensure you have already disbursed funds before confirming here. This action updates the cycle state and logs the transaction.
              </p>
            </div>

            <div className="modal-actions pt-4">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1" disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                {loading ? 'Processing...' : 'Confirm Disburse'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PayoutConfirmationModal;
