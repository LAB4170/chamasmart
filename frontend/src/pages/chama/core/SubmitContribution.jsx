import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, contributionAPI } from "../../../services/api";
import LoadingSkeleton from "../../../components/LoadingSkeleton";
import { useSocket } from "../../../context/SocketContext";

const SubmitContribution = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chama, setChama] = useState(null);
  const [formData, setFormData] = useState({
    amount: "",
    phoneNumber: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const socket = useSocket();
  const [paymentStage, setPaymentStage] = useState("idle"); // idle, initiating, waiting, confirmed, failed

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (isMounted) setPageLoading(true);
        const chamaRes = await chamaAPI.getById(id);

        if (isMounted) {
          const chamaData = chamaRes.data.data;
          setChama(chamaData);

          setFormData((prev) => ({
            ...prev,
            amount: chamaData.contribution_amount,
          }));
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load chama data");
          console.error(err);
        }
      } finally {
        if (isMounted) setPageLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (!socket) return;

    const handleSuccess = (data) => {
      // Check if it's our payment (approximate check since we don't have txId in the event yet)
      // Ideally we'd match the checkoutRequestId
      setPaymentStage("confirmed");
      setSuccess(`Payment of KES ${data.amount} received successfully!`);
      
      setTimeout(() => {
        navigate(`/chamas/${id}`, { state: { refresh: true, tab: 'contributions' } });
      }, 3000);
    };

    const handleFailure = (data) => {
      setPaymentStage("failed");
      setError(`Payment failed: ${data.message}`);
      setLoading(false);
    };

    socket.on("contribution_recorded", handleSuccess);
    socket.on("payment_failed", handleFailure);

    return () => {
      socket.off("contribution_recorded", handleSuccess);
      socket.off("payment_failed", handleFailure);
    };
  }, [socket, id, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    setPaymentStage("initiating");

    try {
      const res = await contributionAPI.initiateMpesaPayment({
        chamaId: parseInt(id),
        amount: parseFloat(formData.amount),
        phoneNumber: formData.phoneNumber,
        notes: formData.notes
      });
      
      setPaymentStage("waiting");
      setSuccess("STK Push initiated. Please enter your PIN on your phone.");

      // Set a safety timeout for 60 seconds
      setTimeout(() => {
        if (paymentStage === "waiting") {
          setPaymentStage("idle");
          setLoading(false);
          setError("Payment confirmation timed out. Please check your transaction history in a few moments.");
        }
      }, 60000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to initiate M-Pesa payment");
      setLoading(false);
      setPaymentStage("failed");
    }
  };

  if (pageLoading) {
    return (
      <div className="page">
        <div className="container">
          <LoadingSkeleton type="detail" />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Pay with M-Pesa</h1>
            <p className="text-muted">{chama?.chama_name}</p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate(`/chamas/${id}`)}
          >
            ← Back to Chama
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="alert alert-info mb-4">
          <strong>How this works:</strong> Enter your M-Pesa phone number and the amount. An STK Push prompt will appear on your phone. Enter your PIN to complete the payment.
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                type="tel"
                name="phoneNumber"
                className="form-input"
                placeholder="07XXXXXXXX or 2547XXXXXXXX"
                value={formData.phoneNumber}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Amount (KES) *</label>
              <input
                type="number"
                name="amount"
                className="form-input"
                min="1"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                name="notes"
                className="form-textarea"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={handleChange}
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate(`/chamas/${id}`)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={`btn ${paymentStage === 'confirmed' ? 'btn-success' : 'btn-primary'}`}
                disabled={loading || paymentStage === 'waiting' || paymentStage === 'confirmed'}
              >
                {paymentStage === 'initiating' ? "Initiating..." : 
                 paymentStage === 'waiting' ? "Waiting for PIN..." : 
                 paymentStage === 'confirmed' ? "Payment Confirmed!" :
                 "Initiate Payment"}
              </button>
            </div>
          </form>
          {paymentStage === 'waiting' && (
            <div className="card-footer bg-light text-center py-4">
              <div className="spinner-border text-primary mb-3" role="status"></div>
              <p className="mb-0">Waiting for M-Pesa confirmation...</p>
              <p className="text-muted small">Please do not refresh this page.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmitContribution;
