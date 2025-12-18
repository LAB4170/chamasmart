import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { chamaAPI } from "../../services/api";
import "./Chama.css";

const CreateChama = () => {
  const [formData, setFormData] = useState({
    chamaName: "",
    chamaType: "ROSCA",
    description: "",
    contributionAmount: "",
    contributionFrequency: "MONTHLY",
    meetingDay: "",
    meetingTime: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await chamaAPI.create(formData);
      const newChama = response.data.data;

      // Navigate to the new chama's detail page
      navigate(`/chamas/${newChama.chama_id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create chama");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <h1>Create New Chama</h1>
          <p className="text-muted">
            Set up your chama group and invite members
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Chama Name *</label>
              <input
                type="text"
                name="chamaName"
                className="form-input"
                placeholder="e.g., Tumaini Savings Group"
                value={formData.chamaName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Chama Type *</label>
              <select
                name="chamaType"
                className="form-select"
                value={formData.chamaType}
                onChange={handleChange}
                required
              >
                <option value="ROSCA">Merry-Go-Round (ROSCA)</option>
                <option value="ASCA">Investment Chama (ASCA)</option>
                <option value="TABLE_BANKING">Table Banking</option>
                <option value="WELFARE">Welfare Chama</option>
              </select>
              <small className="text-muted">
                {formData.chamaType === "ROSCA" &&
                  "Members take turns receiving the pooled funds"}
                {formData.chamaType === "ASCA" &&
                  "Funds are invested collectively for long-term wealth"}
                {formData.chamaType === "TABLE_BANKING" &&
                  "Members can borrow from the pool with interest"}
                {formData.chamaType === "WELFARE" &&
                  "Funds support members during life events"}
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-textarea"
                placeholder="Brief description of your chama's purpose and goals"
                value={formData.description}
                onChange={handleChange}
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">
                  Contribution Amount (KES) *
                </label>
                <input
                  type="number"
                  name="contributionAmount"
                  className="form-input"
                  placeholder="5000"
                  min="1"
                  step="0.01"
                  value={formData.contributionAmount}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contribution Frequency *</label>
                <select
                  name="contributionFrequency"
                  className="form-select"
                  value={formData.contributionFrequency}
                  onChange={handleChange}
                  required
                >
                  <option value="WEEKLY">Weekly</option>
                  <option value="BI_WEEKLY">Bi-Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Meeting Day</label>
                <input
                  type="text"
                  name="meetingDay"
                  className="form-input"
                  placeholder="e.g., First Saturday"
                  value={formData.meetingDay}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Meeting Time</label>
                <input
                  type="time"
                  name="meetingTime"
                  className="form-input"
                  value={formData.meetingTime}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate("/dashboard")}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Chama"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateChama;
