import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, TrendingUp, Landmark, HeartHandshake,
  Lock, Globe, MapPin, Laptop, Calendar, Clock,
  Target, Shield, ArrowRight, CheckCircle2, AlertCircle
} from "lucide-react";

const CreateChama = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    chamaName: "",
    chamaType: "ROSCA",
    description: "",
    contributionAmount: "",
    contributionFrequency: "MONTHLY",
    sharePrice: "",
    meetingDay: "",
    meetingTime: "",
    visibility: "PRIVATE",
    paymentMethods: {
      type: "PAYBILL",
      businessNumber: "",
      accountNumber: "",
      tillNumber: "",
      phoneNumber: ""
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [meetingType, setMeetingType] = useState("PHYSICAL");
  const [meetingPattern, setMeetingPattern] = useState("FIRST_SATURDAY");
  const [meetingLocation, setMeetingLocation] = useState("");

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("pm_")) {
      const field = name.replace("pm_", "");
      setFormData(prev => ({
        ...prev,
        paymentMethods: {
          ...prev.paymentMethods,
          [field]: value
        }
      }));
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const meetingPatterns = [
    { id: "FIRST_SATURDAY", name: "1st Saturday" },
    { id: "LAST_SATURDAY", name: "Last Saturday" },
    { id: "FIRST_SUNDAY", name: "1st Sunday" },
    { id: "EVERY_SUNDAY", name: "Every Sunday" },
    { id: "BIWEEKLY", name: "Every 2 Weeks" },
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
      sharePrice: formData.sharePrice === "" ? null : parseFloat(formData.sharePrice),
      meetingDay: meetingPattern === "CUSTOM" ? formData.meetingDay : finalMeetingDay,
      meetingTime: formData.meetingTime || null
    };

    // Only include sharePrice for ASCA to keep payload clean
    if (formData.chamaType !== 'ASCA') {
      delete submissionData.sharePrice;
    }

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
    { id: "ROSCA", name: "Merry-Go-Round", icon: RefreshCw, desc: "Turns to receive fund", color: "blue" },
    { id: "ASCA", name: "Investment", icon: TrendingUp, desc: "In-house lending & growth", color: "green" },
    { id: "TABLE_BANKING", name: "Table Banking", icon: Landmark, desc: "Instant group banking", color: "amber" },
    { id: "WELFARE", name: "Welfare", icon: HeartHandshake, desc: "Emergency & support", color: "purple" },
  ];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: "KES",
    }).format(amount || 0);
  };

  // Get current type object for preview
  const currentType = chamaTypes.find(t => t.id === formData.chamaType) || chamaTypes[0];
  const TypeIcon = currentType.icon;

  return (
    <div className="page">
      <div className="container create-chama-layout">

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
                          <div
                            key={type.id}
                            className={`selection-card compact ${formData.chamaType === type.id ? 'active' : ''}`}
                            onClick={() => setFormData({ ...formData, chamaType: type.id })}
                          >
                            <div className={`selection-icon small ${type.color}`}>
                              <type.icon size={20} />
                            </div>
                            <div className="selection-content">
                              <div className="selection-name">{type.name}</div>
                            </div>
                            {formData.chamaType === type.id && <div className="selection-check"><CheckCircle2 size={16} /></div>}
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
                          <option value="BIWEEKLY">Bi-Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                        </select>
                      </div>
                    </div>

                    {formData.chamaType === 'ASCA' && (
                      <div className="form-group mt-4">
                        <label className="form-label">Share Price (KES)</label>
                        <input 
                          type="number" 
                          name="sharePrice" 
                          className="form-input" 
                          placeholder="e.g., 500" 
                          value={formData.sharePrice} 
                          onChange={handleChange} 
                          required 
                        />
                        <p className="text-muted small mt-1">For ASCA, members buy shares instead of fixed contributions.</p>
                      </div>
                    )}


              <div className="section-divider my-4"></div>
              <div className="section-header-modern mb-4">
                <span className="section-number">02B</span>
                <div>
                  <h3>Payment Details</h3>
                  <p>How members will send contributions.</p>
                </div>
              </div>

              <div className="form-group mb-4">
                <label className="form-label">Collection Method</label>
                <div className="selection-grid grid-3">
                  <div className={`selection-card compact ${formData.paymentMethods.type === 'PAYBILL' ? 'active' : ''}`} onClick={() => setFormData(prev => ({ ...prev, paymentMethods: { ...prev.paymentMethods, type: 'PAYBILL' } }))}>
                    <div className="selection-name">Paybill</div>
                  </div>
                  <div className={`selection-card compact ${formData.paymentMethods.type === 'TILL' ? 'active' : ''}`} onClick={() => setFormData(prev => ({ ...prev, paymentMethods: { ...prev.paymentMethods, type: 'TILL' } }))}>
                    <div className="selection-name">Till (Buy Goods)</div>
                  </div>
                  <div className={`selection-card compact ${formData.paymentMethods.type === 'POCHI' ? 'active' : ''}`} onClick={() => setFormData(prev => ({ ...prev, paymentMethods: { ...prev.paymentMethods, type: 'POCHI' } }))}>
                    <div className="selection-name">Pochi</div>
                  </div>
                </div>
              </div>

              <div className="form-row">
                {formData.paymentMethods.type === "PAYBILL" && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Business No.</label>
                      <input type="text" name="pm_businessNumber" className="form-input" placeholder="247247" value={formData.paymentMethods.businessNumber} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Account</label>
                      <input type="text" name="pm_accountNumber" className="form-input" placeholder="Chama Name" value={formData.paymentMethods.accountNumber} onChange={handleChange} />
                    </div>
                  </>
                )}
                {formData.paymentMethods.type === "TILL" && (
                  <div className="form-group">
                    <label className="form-label">Till Number</label>
                    <input type="text" name="pm_tillNumber" className="form-input" placeholder="123456" value={formData.paymentMethods.tillNumber} onChange={handleChange} />
                  </div>
                )}
                {formData.paymentMethods.type === "POCHI" && (
                  <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input type="text" name="pm_phoneNumber" className="form-input" placeholder="0712345678" value={formData.paymentMethods.phoneNumber} onChange={handleChange} />
                  </div>
                )}
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
                    <button type="button" className={`btn btn-sm ${meetingType === 'PHYSICAL' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMeetingType("PHYSICAL")} style={{ flex: 1, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <MapPin size={16} /> Physical
                    </button>
                    <button type="button" className={`btn btn-sm ${meetingType === 'ONLINE' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMeetingType("ONLINE")} style={{ flex: 1, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Laptop size={16} /> Online
                    </button>
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
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {loading ? 'Creating...' : step < 3 ? <>Continue <ArrowRight size={16} /></> : 'Launch My Chama 🚀'}
          </button>
        </div>
      </form>
      {error && <div className="alert alert-error mt-4"><AlertCircle size={16} /> {error}</div>}
    </div>

        {/* Right Side: Live Preview */ }
  <div style={{ position: 'sticky', top: '2rem' }}>
    <div className="p-4" style={{ background: 'var(--primary-light)', borderRadius: '16px', border: '1px dashed var(--primary)' }}>
      <h4 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Target size={18} /> Live Card Preview
      </h4>

      <div className="chama-card" style={{ boxShadow: 'var(--shadow-xl)', pointerEvents: 'none' }}>
        <div className="chama-card-header">
          <div className={`chama-type-badge ${currentType.color} flex items-center gap-1`}>
            <TypeIcon size={14} /> {formData.chamaType}
          </div>
          <h3>{formData.chamaName || "Your Chama Name"}</h3>
        </div>
        <div className="chama-card-body">
          <p className="chama-description text-muted">
            {formData.description || "Describe your vision here..."}
          </p>
          <div className="chama-info">
            <span className="info-label"><Globe size={14} /> Membership</span>
            <span className="info-value">{formData.visibility}</span>
          </div>
          <div className="chama-info">
            <span className="info-label"><Target size={14} /> Contribution</span>
            <span className="info-value text-success">{formatCurrency(formData.contributionAmount)}</span>
          </div>
          <div className="chama-info">
            <span className="info-label"><Calendar size={14} /> Meeting</span>
            <span className="info-value">{meetingPattern.replace('_', ' ')}</span>
          </div>
        </div>
        <div className="chama-card-footer">
          Pending Creation...
        </div>
      </div>

      <div className="mt-4 p-3 tip-card">
        <span className="tip-icon"><Shield size={16} /></span> <strong>Senior Tip:</strong> Chamas with clear descriptions and regular meeting schedules have 40% higher engagement.
      </div>
    </div>
  </div>

      </div >
    </div >
  );
};

export default CreateChama;
