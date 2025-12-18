import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, memberAPI } from "../../services/api";
import "./Chama.css";

const AddMember = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chama, setChama] = useState(null);
  const [formData, setFormData] = useState({
    userId: "",
    role: "MEMBER",
  });
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchChama();
  }, [id]);

  const fetchChama = async () => {
    try {
      const response = await chamaAPI.getById(id);
      setChama(response.data.data);
    } catch (err) {
      setError("Failed to load chama details");
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

    if (!formData.userId) {
      setError("Please enter a user ID");
      return;
    }

    setLoading(true);

    try {
      await memberAPI.add(id, formData);

      setSuccess("Member added successfully!");

      // Reset form
      setFormData({
        userId: "",
        role: "MEMBER",
      });
      setUserSearch("");

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate(`/chamas/${id}`);
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Add Member</h1>
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
          <div className="alert alert-info">
            <strong>Note:</strong> You need the user's ID to add them. The user
            must have a ChamaSmart account.
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">User ID *</label>
              <input
                type="number"
                name="userId"
                className="form-input"
                placeholder="Enter user ID (e.g., 1)"
                value={formData.userId}
                onChange={handleChange}
                required
              />
              <small className="text-muted">
                Ask the member to check their profile for their user ID
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Assign Role *</label>
              <select
                name="role"
                className="form-select"
                value={formData.role}
                onChange={handleChange}
                required
              >
                <option value="MEMBER">Member</option>
                <option value="CHAIRPERSON">Chairperson</option>
                <option value="SECRETARY">Secretary</option>
                <option value="TREASURER">Treasurer</option>
              </select>
              <small className="text-muted">
                You can change roles later from the chama management page
              </small>
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
                {loading ? "Adding Member..." : "Add Member"}
              </button>
            </div>
          </form>
        </div>

        <div className="card mt-3">
          <h3>Role Descriptions</h3>
          <div className="roles-info">
            <div className="role-item">
              <strong>👑 Chairperson</strong>
              <p className="text-muted">
                Leads meetings, makes final decisions, manages group activities
              </p>
            </div>
            <div className="role-item">
              <strong>💰 Treasurer</strong>
              <p className="text-muted">
                Handles all finances, records contributions, manages bank
                account
              </p>
            </div>
            <div className="role-item">
              <strong>📝 Secretary</strong>
              <p className="text-muted">
                Takes meeting minutes, keeps records, manages communication
              </p>
            </div>
            <div className="role-item">
              <strong>👤 Member</strong>
              <p className="text-muted">
                Regular member with voting rights and participation in
                activities
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddMember;
