import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, contributionAPI } from "../../services/api";
import "./Chama.css";

const RecordContribution = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [formData, setFormData] = useState({
    userId: "",
    amount: "",
    paymentMethod: "MPESA",
    receiptNumber: "",
    contributionDate: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setPageLoading(true);

      const [chamaRes, membersRes] = await Promise.all([
        chamaAPI.getById(id),
        chamaAPI.getMembers(id),
      ]);

      setChama(chamaRes.data.data);
      setMembers(membersRes.data.data);

      // Auto-fill amount with chama's contribution amount
      setFormData((prev) => ({
        ...prev,
        amount: chamaRes.data.data.contribution_amount,
      }));
    } catch (err) {
      setError("Failed to load chama data");
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await contributionAPI.record(id, formData);

      setSuccess("Contribution recorded successfully!");

      // Reset form
      setFormData({
        userId: "",
        amount: chama.contribution_amount,
        paymentMethod: "MPESA",
        receiptNumber: "",
        contributionDate: new Date().toISOString().split("T")[0],
        notes: "",
      });

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate(`/chamas/${id}`);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record contribution");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount);
  };

  if (pageLoading) {
    return (
      <div className="page">
        <div className="container">
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Record Contribution</h1>
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

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Select Member *</label>
              <select
                name="userId"
                className="form-select"
                value={formData.userId}
                onChange={handleChange}
                required
              >
                <option value="">Choose a member...</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.first_name} {member.last_name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
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
                <small className="text-muted">
                  Expected: {formatCurrency(chama?.contribution_amount || 0)}
                </small>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Method *</label>
                <select
                  name="paymentMethod"
                  className="form-select"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  required
                >
                  <option value="MPESA">M-Pesa</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Receipt Number</label>
                <input
                  type="text"
                  name="receiptNumber"
                  className="form-input"
                  placeholder="e.g., SKL123456"
                  value={formData.receiptNumber}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contribution Date *</label>
                <input
                  type="date"
                  name="contributionDate"
                  className="form-input"
                  value={formData.contributionDate}
                  onChange={handleChange}
                  required
                />
              </div>
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
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Recording..." : "Record Contribution"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RecordContribution;
