import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { chamaAPI } from "../../services/api";


const CreateChama = () => {
  const [formData, setFormData] = useState({
    chamaName: "",
    chamaType: "ROSCA",
    description: "",
    contributionAmount: "",
    contributionFrequency: "MONTHLY",
    meetingDay: "",
    meetingTime: "",
    visibility: "PRIVATE",
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

  // Section 4: Meetings
  const [meetingType, setMeetingType] = useState("PHYSICAL"); // PHYSICAL or ONLINE
  const [meetingPattern, setMeetingPattern] = useState("FIRST_SATURDAY");
  const [meetingLocation, setMeetingLocation] = useState("");

  const meetingPatterns = [
    { id: "FIRST_SATURDAY", name: "1st Saturday" },
    { id: "LAST_SATURDAY", name: "Last Saturday" },
    { id: "FIRST_SUNDAY", name: "1st Sunday" },
    { id: "EVERY_SUNDAY", name: "Every Sunday" },
    { id: "BI_WEEKLY", name: "Every 2 Weeks" },
    { id: "CUSTOM", name: "Custom" },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Prepare structured meeting day string
    const dayName = meetingPatterns.find(p => p.id === meetingPattern)?.name || "Scheduled";
    const typeLabel = meetingType === "ONLINE" ? "Online" : "Physical";
    const locationInfo = meetingLocation ? ` at ${meetingLocation}` : "";

    const finalMeetingDay = `${dayName} (${typeLabel})${locationInfo}`;

    const submissionData = {
      ...formData,
      meetingDay: meetingPattern === "CUSTOM" ? formData.meetingDay : finalMeetingDay,
      meetingTime: formData.meetingTime || null // Convert empty string to null for DB
    };

    try {
      const response = await chamaAPI.create(submissionData);
      const newChama = response.data.data;
      navigate(`/chamas/${newChama.chama_id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create chama");
    } finally {
      setLoading(false);
    }
  };

  const chamaTypes = [
    { id: "ROSCA", name: "Merry-Go-Round", icon: "🔄", desc: "Members take turns receiving the pooled funds" },
    { id: "ASCA", name: "Investment", icon: "📈", desc: "Funds are invested collectively for long-term growth" },
    { id: "TABLE_BANKING", name: "Table Banking", icon: "🏦", desc: "Members can borrow from the pool with interest" },
    { id: "WELFARE", name: "Welfare", icon: "🤝", desc: "Funds support members during critical life events" },
  ];

  const visibilityOptions = [
    { id: "PRIVATE", name: "Private", icon: "🔒", desc: "Invite-only via secure codes" },
    { id: "PUBLIC", name: "Public", icon: "🌐", desc: "Discoverable by everyone" },
  ];

  return (
    <div className="page">
      <div className="container container-sm">
        <div className="page-header text-center mb-5">
          <h1 className="hero-title">
            Start Your <span className="hero-accent">Chama</span>
          </h1>
          <p className="text-muted">
            Configure your savings group and begin your financial journey.
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="card p-0 overflow-hidden">
          {/* Section 1: Basic Info */}
          <div className="form-section">
            <div className="section-header-modern">
              <span className="section-number">01</span>
              <div>
                <h3>General Details</h3>
                <p>Give your chama a name and choose the type that fits your goals.</p>
              </div>
            </div>

            <div className="form-group px-4 pt-2">
              <label className="form-label">Chama Name</label>
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

            <div className="form-group px-4 mt-4">
              <label className="form-label">Chama Type</label>
              <div className="selection-grid">
                {chamaTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`selection-card ${formData.chamaType === type.id ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, chamaType: type.id })}
                  >
                    <div className="selection-icon">{type.icon}</div>
                    <div className="selection-content">
                      <div className="selection-name">{type.name}</div>
                      <div className="selection-desc">{type.desc}</div>
                    </div>
                    {formData.chamaType === type.id && <div className="selection-badge">✓</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group px-4 mt-4">
              <label className="form-label">Description</label>
              <textarea
                name="description"
                className="form-textarea"
                placeholder="Briefly describe your chama's purpose (optional)"
                value={formData.description}
                onChange={handleChange}
                rows="3"
              />
            </div>
          </div>

          <hr className="section-divider" />

          {/* Section 2: Visibility & Access */}
          <div className="form-section">
            <div className="section-header-modern">
              <span className="section-number">02</span>
              <div>
                <h3>Access & Privacy</h3>
                <p>Control who can see and join your chama.</p>
              </div>
            </div>

            <div className="form-group px-4">
              <div className="selection-grid grid-2">
                {visibilityOptions.map((v) => (
                  <div
                    key={v.id}
                    className={`selection-card compact ${formData.visibility === v.id ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, visibility: v.id })}
                  >
                    <div className="selection-icon small">{v.icon}</div>
                    <div className="selection-content">
                      <div className="selection-name">{v.name}</div>
                      <div className="selection-desc">{v.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <hr className="section-divider" />

          {/* Section 3: Financials */}
          <div className="form-section">
            <div className="section-header-modern">
              <span className="section-number">03</span>
              <div>
                <h3>Financial Setup</h3>
                <p>Set contribution amounts and frequency.</p>
              </div>
            </div>

            <div className="form-row px-4">
              <div className="form-group">
                <label className="form-label">Contribution Amount (KES)</label>
                <div className="input-with-icon">
                  <span className="input-prefix">KES</span>
                  <input
                    type="number"
                    name="contributionAmount"
                    className="form-input pl-12"
                    placeholder="e.g., 5000"
                    min="1"
                    step="0.01"
                    value={formData.contributionAmount}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Contribution Frequency</label>
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
          </div>

          <hr className="section-divider" />

          {/* Section 4: Meetings */}
          <div className="form-section">
            <div className="section-header-modern">
              <span className="section-number">04</span>
              <div>
                <h3>Meeting Schedule</h3>
                <p>When and where does your group meet to sync up?</p>
              </div>
            </div>

            <div className="px-4">
              <div className="form-group">
                <label className="form-label">Meeting Type</label>
                <div className="meeting-type-toggle">
                  <button
                    type="button"
                    className={`toggle-btn ${meetingType === "PHYSICAL" ? "active" : ""}`}
                    onClick={() => setMeetingType("PHYSICAL")}
                  >
                    📍 Physical Meeting
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${meetingType === "ONLINE" ? "active" : ""}`}
                    onClick={() => setMeetingType("ONLINE")}
                  >
                    💻 Online / Virtual
                  </button>
                </div>
              </div>

              <div className="form-grid-3 mt-4">
                <div className="form-group">
                  <label className="form-label">Meeting Occurs</label>
                  <select
                    className="form-select"
                    value={meetingPattern}
                    onChange={(e) => setMeetingPattern(e.target.value)}
                  >
                    {meetingPatterns.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {meetingPattern === "CUSTOM" ? (
                  <div className="form-group">
                    <label className="form-label">Specify Day</label>
                    <input
                      type="text"
                      name="meetingDay"
                      className="form-input"
                      placeholder="e.g., Every 10th"
                      value={formData.meetingDay}
                      onChange={handleChange}
                    />
                  </div>
                ) : (
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
                )}

                {meetingPattern !== "CUSTOM" && (
                  <div className="form-group">
                    <label className="form-label">
                      {meetingType === "ONLINE" ? "Meeting Link" : "Venue / Location"}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={meetingType === "ONLINE" ? "zoom.us/j/..." : "e.g., Westlands Hub"}
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {meetingPattern === "CUSTOM" && (
                <div className="form-row mt-4">
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
                  <div className="form-group">
                    <label className="form-label">
                      {meetingType === "ONLINE" ? "Meeting Link" : "Venue / Location"}
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={meetingType === "ONLINE" ? "zoom.us/j/..." : "e.g., Westlands Hub"}
                      value={meetingLocation}
                      onChange={(e) => setMeetingLocation(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions-modern bg-light px-4 py-4 mt-4">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate("/dashboard")}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-sm mr-2"></span> Creating...
                </>
              ) : (
                "Create My Chama"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateChama;
