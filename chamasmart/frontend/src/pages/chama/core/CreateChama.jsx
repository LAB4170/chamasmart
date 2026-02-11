import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import { motion, AnimatePresence } from "framer-motion";

const CreateChama = () => {
  const [step, setStep] = useState(1);
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
  const [meetingType, setMeetingType] = useState("PHYSICAL");
  const [meetingPattern, setMeetingPattern] = useState("FIRST_SATURDAY");
  const [meetingLocation, setMeetingLocation] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

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
    if (step < 3) return nextStep();

    setError("");
    setLoading(true);

    const dayName = meetingPatterns.find(p => p.id === meetingPattern)?.name || "Scheduled";
    const typeLabel = meetingType === "ONLINE" ? "Online" : "Physical";
    const locationInfo = meetingLocation ? ` at ${meetingLocation}` : "";
    const finalMeetingDay = `${dayName} (${typeLabel})${locationInfo}`;

    const submissionData = {
      ...formData,
      meetingDay: meetingPattern === "CUSTOM" ? formData.meetingDay : finalMeetingDay,
      meetingTime: formData.meetingTime || null
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
    { id: "ROSCA", name: "Merry-Go-Round", icon: "🔄", desc: "Turns to receive fund" },
    { id: "ASCA", name: "Investment", icon: "📈", desc: "In-house lending & growth" },
    { id: "TABLE_BANKING", name: "Table Banking", icon: "🏦", desc: "Instant group banking" },
    { id: "WELFARE", name: "Welfare", icon: "🤝", desc: "Emergency & support" },
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount || 0);
  };

  return (
    <div className="page">
      <div className="container" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) 1fr', gap: '3rem', alignItems: 'start' }}>

        {/* Left Side: Form Wizard */}
        <div>
          <div className="page-header mb-5">
            <h1 className="hero-title">Start Your <span className="hero-accent">Chama</span></h1>
            <p className="text-muted">Step {step} of 3: {step === 1 ? 'Identity' : step === 2 ? 'Finance & Privacy' : 'Logistics'}</p>
          </div>

          <form onSubmit={handleSubmit} className="card p-0 overflow-hidden" style={{ border: 'none', boxShadow: 'var(--shadow-xl)', borderRadius: '16px' }}>
            <div className="wizard-progress" style={{ height: '4px', background: 'var(--border)', display: 'flex' }}>
              <div style={{ width: `${(step / 3) * 100}%`, background: 'var(--primary)', transition: 'width 0.4s ease' }}></div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="form-section p-6"
              >
                {step === 1 && (
                  <>
                    <div className="section-header-modern mb-4">
                      <span className="section-number">01</span>
                      <div>
                        <h3>General Details</h3>
                        <p>What should we call your group?</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Chama Name</label>
                      <input type="text" name="chamaName" className="form-input" placeholder="e.g., Tumaini Savings Group" value={formData.chamaName} onChange={handleChange} required />
                    </div>

                    <div className="form-group mt-4">
                      <label className="form-label">Chama Type</label>
                      <div className="selection-grid grid-2">
                        {chamaTypes.map((type) => (
                          <div key={type.id} className={`selection-card compact ${formData.chamaType === type.id ? 'active' : ''}`} onClick={() => setFormData({ ...formData, chamaType: type.id })}>
                            <div className="selection-icon small">{type.icon}</div>
                            <div className="selection-content">
                              <div className="selection-name">{type.name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="form-group mt-4">
                      <label className="form-label">Description</label>
                      <textarea name="description" className="form-textarea" placeholder="Briefly describe your chama's purpose" value={formData.description} onChange={handleChange} rows="3" />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="section-header-modern mb-4">
                      <span className="section-number">02</span>
                      <div>
                        <h3>Finance & Privacy</h3>
                        <p>Set the rules for funds and access.</p>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Contribution (KES)</label>
                        <input type="number" name="contributionAmount" className="form-input" placeholder="5000" value={formData.contributionAmount} onChange={handleChange} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Frequency</label>
                        <select name="contributionFrequency" className="form-select" value={formData.contributionFrequency} onChange={handleChange}>
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-group mt-4">
                      <label className="form-label">Visibility</label>
                      <div className="selection-grid grid-2">
                        <div className={`selection-card compact ${formData.visibility === 'PRIVATE' ? 'active' : ''}`} onClick={() => setFormData({ ...formData, visibility: 'PRIVATE' })}>
                          <div className="selection-icon small">🔒</div>
                          <div className="selection-name">Private</div>
                        </div>
                        <div className={`selection-card compact ${formData.visibility === 'PUBLIC' ? 'active' : ''}`} onClick={() => setFormData({ ...formData, visibility: 'PUBLIC' })}>
                          <div className="selection-icon small">🌐</div>
                          <div className="selection-name">Public</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className="section-header-modern mb-4">
                      <span className="section-number">03</span>
                      <div>
                        <h3>Meetings & Logistics</h3>
                        <p>When and where will you meet?</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="meeting-type-toggle" style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '4px' }}>
                        <button type="button" className={`btn btn-sm ${meetingType === 'PHYSICAL' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMeetingType("PHYSICAL")} style={{ flex: 1, border: 'none' }}>📍 Physical</button>
                        <button type="button" className={`btn btn-sm ${meetingType === 'ONLINE' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMeetingType("ONLINE")} style={{ flex: 1, border: 'none' }}>💻 Online</button>
                      </div>
                    </div>

                    <div className="form-row mt-4">
                      <div className="form-group">
                        <label className="form-label">Occurs</label>
                        <select className="form-select" value={meetingPattern} onChange={(e) => setMeetingPattern(e.target.value)}>
                          {meetingPatterns.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Time</label>
                        <input type="time" name="meetingTime" className="form-input" value={formData.meetingTime} onChange={handleChange} />
                      </div>
                    </div>

                    <div className="form-group mt-4">
                      <label className="form-label">{meetingType === "ONLINE" ? "Meeting Link" : "Venue Location"}</label>
                      <input type="text" className="form-input" placeholder={meetingType === "ONLINE" ? "zoom.us/..." : "e.g., Star Hub"} value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} />
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <div className="form-actions p-6 bg-light d-flex gap-3" style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border)' }}>
              {step > 1 && (
                <button type="button" className="btn btn-outline" onClick={prevStep} style={{ flex: 1 }}>Back</button>
              )}
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2 }}>
                {loading ? 'Creating...' : step < 3 ? 'Continue →' : 'Launch My Chama 🚀'}
              </button>
            </div>
          </form>
          {error && <div className="alert alert-error mt-4">{error}</div>}
        </div>

        {/* Right Side: Live Preview */}
        <div style={{ position: 'sticky', top: '2rem' }}>
          <div className="p-4" style={{ background: 'var(--primary-light)', borderRadius: '16px', border: '1px dashed var(--primary)' }}>
            <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>✨</span> Live Card Preview
            </h4>

            <div className="chama-card" style={{ boxShadow: 'var(--shadow-xl)', pointerEvents: 'none' }}>
              <div className="chama-card-header">
                <div className="chama-type-badge">{formData.chamaType}</div>
                <h3>{formData.chamaName || "Your Chama Name"}</h3>
              </div>
              <div className="chama-card-body">
                <p className="chama-description text-muted">
                  {formData.description || "Describe your vision here..."}
                </p>
                <div className="chama-info">
                  <span className="info-label">Membership</span>
                  <span className="info-value">{formData.visibility}</span>
                </div>
                <div className="chama-info">
                  <span className="info-label">Contribution</span>
                  <span className="info-value text-success">{formatCurrency(formData.contributionAmount)}</span>
                </div>
                <div className="chama-info">
                  <span className="info-label">Meeting</span>
                  <span className="info-value">{meetingPattern.replace('_', ' ')}</span>
                </div>
              </div>
              <div className="chama-card-footer">
                Pending Creation...
              </div>
            </div>

            <div className="mt-4 p-3 tip-card">
              💡 <strong>Senior Tip:</strong> Chamas with clear descriptions and regular meeting schedules have 40% higher engagement.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CreateChama;
