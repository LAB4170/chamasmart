import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, contributionAPI } from "../../../services/api";
import LoadingSkeleton from "../../../components/LoadingSkeleton";


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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await contributionAPI.initiateMpesaPayment({
        chamaId: parseInt(id),
        amount: parseFloat(formData.amount),
        phoneNumber: formData.phoneNumber,
        notes: formData.notes
      });
      
      setSuccess("STK Push initiated successfully. Please check your phone and enter your M-Pesa PIN.");

      // After 5 seconds, navigate back to chama details so they can see the payment once recorded.
      setTimeout(() => {
        navigate(`/chamas/${id}`, { state: { refresh: true, tab: 'contributions' } });
      }, 5000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to initiate M-Pesa payment");
      setLoading(false);
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
                className="btn btn-success"
                disabled={loading}
              >
                {loading ? "Initiating..." : "Initiate Payment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SubmitContribution;
