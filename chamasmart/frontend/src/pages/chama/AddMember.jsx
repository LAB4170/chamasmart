import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, memberAPI, userAPI } from "../../services/api";


const AddMember = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chama, setChama] = useState(null);
  const [formData, setFormData] = useState({
    userId: "",
    role: "MEMBER",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [foundUser, setFoundUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchError, setSearchError] = useState("");

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

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchError("");
    setFoundUser(null);
    setFormData(prev => ({ ...prev, userId: "" }));

    try {
      const response = await userAPI.search(searchQuery);
      setFoundUser(response.data.data);
      setFormData(prev => ({ ...prev, userId: response.data.data.user_id }));
    } catch (err) {
      const msg = err.response?.status === 404
        ? "User not found. Ensure they have registered with ChamaSmart."
        : "Error searching user.";
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.userId) {
      setError("Please search and select a user first");
      return;
    }

    setLoading(true);

    try {
      await memberAPI.add(id, formData);

      setSuccess(`Successfully added ${foundUser.first_name} to the chama!`);

      // Reset form
      setFormData({ userId: "", role: "MEMBER" });
      setSearchQuery("");
      setFoundUser(null);

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
            <strong>Check User:</strong> Search for the user by email or phone number to verify their identity before adding.
          </div>

          <div className="form-group mb-4">
            <label className="form-label">Find User (Email or Phone)</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Enter email e.g. john@example.com"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSearch}
                disabled={searching || !searchQuery}
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
            {searchError && <small className="text-danger">{searchError}</small>}
          </div>

          {foundUser && (
            <div className="user-card-preview p-3 mb-4" style={{ background: '#f8f9fa', borderRadius: '8px', border: '1px solid #e9ecef' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div className="avatar-placeholder" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {foundUser.first_name[0]}{foundUser.last_name[0]}
                </div>
                <div>
                  <h4 style={{ margin: 0 }}>{foundUser.first_name} {foundUser.last_name}</h4>
                  <small className="text-muted">{foundUser.email} • {foundUser.phone_number}</small>
                </div>
                <div style={{ marginLeft: 'auto', color: 'green', fontWeight: 'bold' }}>
                  ✓ Verified
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
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
                type="submit" // Form submit triggers handleSubmit which calls memberAPI.add
                className="btn btn-primary"
                disabled={loading || !formData.userId}
              >
                {loading ? "Adding..." : "Add Member"}
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
