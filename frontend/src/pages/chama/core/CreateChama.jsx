import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { chamaAPI } from "../../../services/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  RefreshCw, TrendingUp, Landmark, HeartHandshake,
  Lock, Globe, MapPin, Laptop, Calendar, Clock,
  Target, Shield, ArrowRight, CheckCircle2, AlertCircle,
  Sparkles, Wallet, Users, Zap, Building2, Star,
  ArrowLeft, Phone, Smartphone, Send, Banknote, Info,
  CreditCard, ArrowUpRight
} from "lucide-react";
import "./CreateChama.css";

const HERO_IMAGE = "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=1800";

const chamaTypes = [
  {
    id: "ROSCA",
    name: "Merry-Go-Round",
    icon: RefreshCw,
    desc: "Rotating fund turns — every member gets a payout cycle.",
    color: "#3b82f6",
    img: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "ASCA",
    name: "Investment Circle",
    icon: TrendingUp,
    desc: "Buy shares, accumulate dividends, and grow your capital.",
    color: "#10b981",
    img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "TABLE_BANKING",
    name: "Table Banking",
    icon: Landmark,
    desc: "Instant micro-lending with group pooled funds.",
    color: "#f59e0b",
    img: "https://images.unsplash.com/photo-1553729459-efe14ef6055d?auto=format&fit=crop&q=80&w=800",
  },
  {
    id: "WELFARE",
    name: "Welfare Fund",
    icon: HeartHandshake,
    desc: "Emergency support and social safety net for members.",
    color: "#a855f7",
    img: "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=800",
  },
];

const meetingPatterns = [
  { id: "FIRST_SATURDAY", name: "1st Saturday" },
  { id: "LAST_SATURDAY", name: "Last Saturday" },
  { id: "FIRST_SUNDAY", name: "1st Sunday" },
  { id: "EVERY_SUNDAY", name: "Every Sunday" },
  { id: "BIWEEKLY", name: "Every 2 Weeks" },
  { id: "CUSTOM", name: "Custom Date" },
];

const STEPS = [
  { num: 1, label: "Identity", sublabel: "Name & type" },
  { num: 2, label: "Finance", sublabel: "Contributions" },
  { num: 3, label: "Logistics", sublabel: "Meetings" },
];

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
      // Paybill
      businessNumber: "",
      accountNumber: "",
      // Till
      tillNumber: "",
      // Pochi + Send Money
      phoneNumber: "",
      recipientName: "",
      // Bank
      bankName: "",
      bankAccount: "",
      bankAccountName: "",
      bankBranch: "",
    },
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
      setFormData((prev) => ({
        ...prev,
        paymentMethods: { ...prev.paymentMethods, [field]: value },
      }));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const nextStep = () => { setError(""); setStep((s) => s + 1); };
  const prevStep = () => { setError(""); setStep((s) => s - 1); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 3) return nextStep();

    setError("");
    setLoading(true);

    const dayName = meetingPatterns.find((p) => p.id === meetingPattern)?.name || "Scheduled";
    const typeLabel = meetingType === "ONLINE" ? "Online" : "Physical";
    const locationInfo = meetingLocation ? ` at ${meetingLocation}` : "";
    const finalMeetingDay = `${dayName} (${typeLabel})${locationInfo}`;

    const submissionData = {
      chama_name: formData.chamaName,
      chama_type: formData.chamaType,
      description: formData.description,
      contribution_amount: formData.contributionAmount,
      contribution_frequency: formData.contributionFrequency,
      visibility: formData.visibility,
      share_price: formData.sharePrice === "" ? null : parseFloat(formData.sharePrice),
      meeting_day: meetingPattern === "CUSTOM" ? formData.meetingDay : finalMeetingDay,
      meeting_time: formData.meetingTime || null,
      payment_methods: formData.paymentMethods
    };

    if (formData.chamaType !== "ASCA") delete submissionData.share_price;

    try {
      const response = await chamaAPI.create(submissionData);
      const newChama = response.data.data;
      navigate(`/chamas/${newChama.chama_id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create chama. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentTypeObj = chamaTypes.find((t) => t.id === formData.chamaType) || chamaTypes[0];
  const CurrentTypeIcon = currentTypeObj.icon;

  return (
    <div className="page">
      <div className="ambient-blob blob-gold" />
      <div className="ambient-blob blob-blue" />

      <div className="container">
        <div className="page-frame-lux cc-frame">

          {/* ═══════════════════════════════ HERO BANNER (inside frame) */}
          <div className="cc-hero-banner">
            <img src={HERO_IMAGE} alt="Community savings" className="cc-hero-img" />
            <div className="cc-hero-overlay" />
            <div className="cc-hero-text">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              >
                <div className="cc-hero-badge">
                  <Sparkles size={14} />
                  <span>Vault Builder</span>
                </div>
                <h1 className="cc-hero-title">
                  Launch Your <span className="cc-hero-accent">Financial Circle</span>
                </h1>
                <p className="cc-hero-subtitle">
                  Build a sovereign wealth group. Define your community, set your rules, 
                  and begin a legacy of collective prosperity.
                </p>
              </motion.div>
            </div>
          </div>

          {/* ═══════════════════════════════ WIZARD AREA */}
          <div className="cc-wizard-area">

            {/* Step Progress */}
            <div className="cc-progress-wrap">
              {STEPS.map((s, i) => (
                <div key={s.num} className="cc-step-item">
                  <div className={`cc-step-bubble ${step > s.num ? "done" : step === s.num ? "active" : ""}`}>
                    {step > s.num ? <CheckCircle2 size={16} /> : <span>{s.num}</span>}
                  </div>
                  <div className="cc-step-meta">
                    <span className="cc-step-label">{s.label}</span>
                    <span className="cc-step-sub">{s.sublabel}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="cc-step-connector">
                      <div className="cc-step-fill" style={{ width: step > s.num ? "100%" : "0%" }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Form Card */}
            <div className="cc-form-card">
              <form onSubmit={handleSubmit}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >

                    {/* ══ STEP 1: IDENTITY */}
                    {step === 1 && (
                      <div className="cc-step-body">
                        <div className="cc-step-heading">
                          <span className="cc-step-num-badge">01</span>
                          <div>
                            <h2 className="cc-step-title">Group Identity</h2>
                            <p className="cc-step-desc">What is the soul of your financial circle?</p>
                          </div>
                        </div>

                        <div className="cc-field-group">
                          <label className="cc-label"><Building2 size={13} /> Chama Name</label>
                          <input
                            type="text" name="chamaName" className="cc-input"
                            placeholder="e.g., Tumaini Savings Group"
                            value={formData.chamaName} onChange={handleChange} required autoFocus
                          />
                        </div>

                        <div className="cc-field-group">
                          <label className="cc-label"><Star size={13} /> Chama Architecture</label>
                          <div className="cc-type-grid">
                            {chamaTypes.map((type) => {
                              const isActive = formData.chamaType === type.id;
                              const Icon = type.icon;
                              return (
                                <div
                                  key={type.id}
                                  className={`cc-type-card ${isActive ? "active" : ""}`}
                                  style={{ "--tc": type.color }}
                                  onClick={() => setFormData({ ...formData, chamaType: type.id })}
                                >
                                  {/* Cover image */}
                                  <img src={type.img} alt={type.name} className="cc-type-img" />
                                  {/* Gradient overlay */}
                                  <div className="cc-type-overlay" style={{
                                    background: isActive
                                      ? `linear-gradient(to top, ${type.color}ee 0%, ${type.color}55 50%, transparent 100%)`
                                      : `linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)`
                                  }} />
                                  {/* Content */}
                                  <div className="cc-type-body">
                                    <div className="cc-type-icon-sm" style={{ background: isActive ? type.color : "rgba(255,255,255,0.15)" }}>
                                      <Icon size={16} />
                                    </div>
                                    <div className="cc-type-info">
                                      <span className="cc-type-name">{type.name}</span>
                                      <span className="cc-type-desc">{type.desc}</span>
                                    </div>
                                  </div>
                                  {/* Active tick */}
                                  {isActive && (
                                    <div className="cc-type-check">
                                      <CheckCircle2 size={18} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="cc-field-group">
                          <label className="cc-label"><Globe size={13} /> Access Control</label>
                          <div className="cc-toggle-group">
                            <button type="button" className={`cc-toggle-btn ${formData.visibility === "PUBLIC" ? "active" : ""}`}
                              onClick={() => setFormData({ ...formData, visibility: "PUBLIC" })}>
                              <Globe size={15} /> Public — Open discovery
                            </button>
                            <button type="button" className={`cc-toggle-btn ${formData.visibility === "PRIVATE" ? "active" : ""}`}
                              onClick={() => setFormData({ ...formData, visibility: "PRIVATE" })}>
                              <Lock size={15} /> Private — Invite only
                            </button>
                          </div>
                        </div>

                        <div className="cc-field-group">
                          <label className="cc-label">
                            <Target size={13} /> Mission Statement <span className="cc-optional">(optional)</span>
                          </label>
                          <textarea
                            name="description" className="cc-textarea" rows={3}
                            placeholder="Describe your chama's vision, goals, and community..."
                            value={formData.description} onChange={handleChange}
                          />
                        </div>
                      </div>
                    )}

                    {/* ══ STEP 2: FINANCE */}
                    {step === 2 && (
                      <div className="cc-step-body">
                        <div className="cc-step-heading">
                          <span className="cc-step-num-badge">02</span>
                          <div>
                            <h2 className="cc-step-title">Financial Architecture</h2>
                            <p className="cc-step-desc">Define contribution rules and payment infrastructure.</p>
                          </div>
                        </div>

                        <div className="cc-field-row">
                          <div className="cc-field-group">
                            <label className="cc-label"><Wallet size={13} /> Contribution (KES)</label>
                            <input type="number" name="contributionAmount" className="cc-input"
                              placeholder="5,000" value={formData.contributionAmount} onChange={handleChange} required min="1" />
                          </div>
                          <div className="cc-field-group">
                            <label className="cc-label"><Clock size={13} /> Cycle Frequency</label>
                            <select name="contributionFrequency" className="cc-select"
                              value={formData.contributionFrequency} onChange={handleChange}>
                              <option value="DAILY">Daily</option>
                              <option value="WEEKLY">Weekly</option>
                              <option value="BIWEEKLY">Bi-Weekly</option>
                              <option value="MONTHLY">Monthly</option>
                            </select>
                          </div>
                        </div>

                        {formData.chamaType === "ASCA" && (
                          <div className="cc-field-group cc-info-box">
                            <label className="cc-label"><TrendingUp size={13} /> Share Unit Price (KES)</label>
                            <input type="number" name="sharePrice" className="cc-input"
                              placeholder="e.g., 500" value={formData.sharePrice} onChange={handleChange} required />
                            <p className="cc-hint">Members purchase shares rather than making fixed contributions.</p>
                          </div>
                        )}

                        <div className="cc-divider"><span>Payment Collection Method</span></div>

                        {/* 5-Method Selector */}
                        <div className="cc-field-group">
                          <label className="cc-label"><Zap size={13} /> How will members send contributions?</label>
                          <div className="cc-pm5-grid">
                            {[
                              {
                                id: "PAYBILL",
                                icon: CreditCard,
                                label: "M-Pesa Paybill",
                                sub: "Pay Bill → Business No.",
                                badge: "STK-Ready",
                                badgeColor: "#10b981",
                              },
                              {
                                id: "TILL",
                                icon: Banknote,
                                label: "M-Pesa Till",
                                sub: "Buy Goods & Services",
                                badge: "STK-Ready",
                                badgeColor: "#10b981",
                              },
                              {
                                id: "POCHI",
                                icon: Smartphone,
                                label: "Pochi la Biashara",
                                sub: "Business mobile wallet",
                                badge: "Manual",
                                badgeColor: "#f59e0b",
                              },
                              {
                                id: "SEND_MONEY",
                                icon: Send,
                                label: "Send Money",
                                sub: "Direct M-Pesa transfer",
                                badge: "Manual",
                                badgeColor: "#f59e0b",
                              },
                              {
                                id: "BANK",
                                icon: Building2,
                                label: "Bank Transfer",
                                sub: "EFT / account deposit",
                                badge: "Manual",
                                badgeColor: "#3b82f6",
                              },
                            ].map((pm) => {
                              const isActive = formData.paymentMethods.type === pm.id;
                              const Icon = pm.icon;
                              return (
                                <div
                                  key={pm.id}
                                  className={`cc-pm5-card ${isActive ? "active" : ""}`}
                                  onClick={() => setFormData((prev) => ({
                                    ...prev,
                                    paymentMethods: { ...prev.paymentMethods, type: pm.id },
                                  }))}
                                >
                                  <div className="cc-pm5-icon">
                                    <Icon size={20} />
                                  </div>
                                  <div className="cc-pm5-info">
                                    <span className="cc-pm5-label">{pm.label}</span>
                                    <span className="cc-pm5-sub">{pm.sub}</span>
                                  </div>
                                  <span className="cc-pm5-badge" style={{ color: pm.badgeColor, background: `${pm.badgeColor}18`, borderColor: `${pm.badgeColor}33` }}>
                                    {pm.badge}
                                  </span>
                                  {isActive && <CheckCircle2 size={14} className="cc-pm5-check" />}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Dynamic Fields */}
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={formData.paymentMethods.type}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                            className="cc-pm-fields"
                          >
                            {formData.paymentMethods.type === "PAYBILL" && (
                              <div className="cc-field-row">
                                <div className="cc-field-group">
                                  <label className="cc-label">Business Number</label>
                                  <input type="text" name="pm_businessNumber" className="cc-input"
                                    placeholder="e.g. 247247" value={formData.paymentMethods.businessNumber} onChange={handleChange} />
                                </div>
                                <div className="cc-field-group">
                                  <label className="cc-label">Account Reference</label>
                                  <input type="text" name="pm_accountNumber" className="cc-input"
                                    placeholder="e.g. Chama Name" value={formData.paymentMethods.accountNumber} onChange={handleChange} />
                                </div>
                              </div>
                            )}
                            {formData.paymentMethods.type === "TILL" && (
                              <div className="cc-field-group">
                                <label className="cc-label">Till Number</label>
                                <input type="text" name="pm_tillNumber" className="cc-input"
                                  placeholder="e.g. 123456" value={formData.paymentMethods.tillNumber} onChange={handleChange} />
                              </div>
                            )}
                            {(formData.paymentMethods.type === "POCHI" || formData.paymentMethods.type === "SEND_MONEY") && (
                              <div className="cc-field-row">
                                <div className="cc-field-group">
                                  <label className="cc-label">
                                    {formData.paymentMethods.type === "POCHI" ? "Pochi Phone Number" : "Treasurer's Number"}
                                  </label>
                                  <input type="tel" name="pm_phoneNumber" className="cc-input"
                                    placeholder="07XX XXX XXX" value={formData.paymentMethods.phoneNumber} onChange={handleChange} />
                                </div>
                                <div className="cc-field-group">
                                  <label className="cc-label">Recipient Name <span className="cc-optional">(shown to members)</span></label>
                                  <input type="text" name="pm_recipientName" className="cc-input"
                                    placeholder="e.g. Jane Treasurer" value={formData.paymentMethods.recipientName} onChange={handleChange} />
                                </div>
                              </div>
                            )}
                            {formData.paymentMethods.type === "BANK" && (
                              <>
                                <div className="cc-field-row">
                                  <div className="cc-field-group">
                                    <label className="cc-label">Bank Name</label>
                                    <select name="pm_bankName" className="cc-select"
                                      value={formData.paymentMethods.bankName} onChange={handleChange}>
                                      <option value="">Select bank...</option>
                                      {["Equity Bank","KCB Bank","Co-operative Bank","NCBA Bank",
                                        "Absa Bank","Standard Chartered","DTB Bank","Family Bank",
                                        "I&M Bank","Stanbic Bank","Gulf African Bank","Prime Bank","Other"
                                      ].map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                  </div>
                                  <div className="cc-field-group">
                                    <label className="cc-label">Account Number</label>
                                    <input type="text" name="pm_bankAccount" className="cc-input"
                                      placeholder="e.g. 0123456789" value={formData.paymentMethods.bankAccount} onChange={handleChange} />
                                  </div>
                                </div>
                                <div className="cc-field-row">
                                  <div className="cc-field-group">
                                    <label className="cc-label">Account Name</label>
                                    <input type="text" name="pm_bankAccountName" className="cc-input"
                                      placeholder="e.g. Tumaini Savings Group" value={formData.paymentMethods.bankAccountName} onChange={handleChange} />
                                  </div>
                                  <div className="cc-field-group">
                                    <label className="cc-label">Branch <span className="cc-optional">(optional)</span></label>
                                    <input type="text" name="pm_bankBranch" className="cc-input"
                                      placeholder="e.g. Nairobi CBD" value={formData.paymentMethods.bankBranch} onChange={handleChange} />
                                  </div>
                                </div>
                              </>
                            )}

                            {/* Live Instruction Preview */}
                            {(formData.paymentMethods.type === "PAYBILL" && formData.paymentMethods.businessNumber) ||
                             (formData.paymentMethods.type === "TILL" && formData.paymentMethods.tillNumber) ||
                             ((formData.paymentMethods.type === "POCHI" || formData.paymentMethods.type === "SEND_MONEY") && formData.paymentMethods.phoneNumber) ||
                             (formData.paymentMethods.type === "BANK" && formData.paymentMethods.bankAccount)
                              ? (
                                <div className="cc-pm-preview">
                                  <div className="cc-pm-preview-header">
                                    <ArrowUpRight size={14} />
                                    <span>Member will see this instruction</span>
                                  </div>
                                  <div className="cc-pm-preview-body">
                                    {formData.paymentMethods.type === "PAYBILL" && (
                                      <>
                                        <span>M-Pesa → Lipa na M-Pesa → <strong>Pay Bill</strong></span>
                                        <span>Business No: <strong>{formData.paymentMethods.businessNumber}</strong></span>
                                        <span>Account: <strong>{formData.paymentMethods.accountNumber || "[Your Ref]"}</strong></span>
                                      </>
                                    )}
                                    {formData.paymentMethods.type === "TILL" && (
                                      <>
                                        <span>M-Pesa → Lipa na M-Pesa → <strong>Buy Goods</strong></span>
                                        <span>Till No: <strong>{formData.paymentMethods.tillNumber}</strong></span>
                                      </>
                                    )}
                                    {formData.paymentMethods.type === "POCHI" && (
                                      <>
                                        <span>M-Pesa → <strong>Send Money</strong></span>
                                        <span>To Pochi: <strong>{formData.paymentMethods.phoneNumber}</strong> {formData.paymentMethods.recipientName && `(${formData.paymentMethods.recipientName})`}</span>
                                      </>
                                    )}
                                    {formData.paymentMethods.type === "SEND_MONEY" && (
                                      <>
                                        <span>M-Pesa → <strong>Send Money</strong></span>
                                        <span>To: <strong>{formData.paymentMethods.recipientName || "Treasurer"}</strong> — {formData.paymentMethods.phoneNumber}</span>
                                      </>
                                    )}
                                    {formData.paymentMethods.type === "BANK" && (
                                      <>
                                        <span>Bank: <strong>{formData.paymentMethods.bankName}</strong></span>
                                        <span>Account: <strong>{formData.paymentMethods.bankAccount}</strong></span>
                                        <span>Name: <strong>{formData.paymentMethods.bankAccountName}</strong></span>
                                        {formData.paymentMethods.bankBranch && <span>Branch: <strong>{formData.paymentMethods.bankBranch}</strong></span>}
                                      </>
                                    )}
                                  </div>
                                </div>
                              ) : null
                            }
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    )}

                    {/* ══ STEP 3: LOGISTICS */}
                    {step === 3 && (
                      <div className="cc-step-body">
                        <div className="cc-step-heading">
                          <span className="cc-step-num-badge">03</span>
                          <div>
                            <h2 className="cc-step-title">Meeting Logistics</h2>
                            <p className="cc-step-desc">When and where does your vault convene?</p>
                          </div>
                        </div>

                        <div className="cc-field-group">
                          <label className="cc-label"><Users size={13} /> Meeting Format</label>
                          <div className="cc-toggle-group">
                            <button type="button" className={`cc-toggle-btn ${meetingType === "PHYSICAL" ? "active" : ""}`}
                              onClick={() => setMeetingType("PHYSICAL")}>
                              <MapPin size={15} /> Physical Venue
                            </button>
                            <button type="button" className={`cc-toggle-btn ${meetingType === "ONLINE" ? "active" : ""}`}
                              onClick={() => setMeetingType("ONLINE")}>
                              <Laptop size={15} /> Online Session
                            </button>
                          </div>
                        </div>

                        <div className="cc-field-row">
                          <div className="cc-field-group">
                            <label className="cc-label"><Calendar size={13} /> Recurrence Pattern</label>
                            <select className="cc-select" value={meetingPattern}
                              onChange={(e) => setMeetingPattern(e.target.value)}>
                              {meetingPatterns.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="cc-field-group">
                            <label className="cc-label"><Clock size={13} /> Start Time</label>
                            <input type="time" name="meetingTime" className="cc-input"
                              value={formData.meetingTime} onChange={handleChange} />
                          </div>
                        </div>

                        <div className="cc-field-group">
                          <label className="cc-label">
                            {meetingType === "ONLINE" ? <Laptop size={13} /> : <MapPin size={13} />}
                            {meetingType === "ONLINE" ? "Meeting Link" : "Venue Location"}
                            <span className="cc-optional">(optional)</span>
                          </label>
                          <input type="text" className="cc-input"
                            placeholder={meetingType === "ONLINE" ? "https://zoom.us/j/..." : "e.g., Nairobi CBD — Star Hub, 3rd Floor"}
                            value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} />
                        </div>

                        {/* Summary Card */}
                        <div className="cc-summary-box">
                          <div className="cc-summary-icon">
                            <CurrentTypeIcon size={26} style={{ color: currentTypeObj.color }} />
                          </div>
                          <div className="cc-summary-content">
                            <div className="cc-summary-name">{formData.chamaName || "Your Chama"}</div>
                            <div className="cc-summary-meta">
                              <span>{currentTypeObj.name}</span>
                              <span>·</span>
                              <span>KES {Number(formData.contributionAmount || 0).toLocaleString()}</span>
                              <span>·</span>
                              <span>{formData.contributionFrequency}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                  </motion.div>
                </AnimatePresence>

                {/* Error */}
                {error && (
                  <div className="cc-error">
                    <AlertCircle size={16} /> {error}
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="cc-form-nav">
                  {step > 1 && (
                    <button type="button" className="cc-btn-back" onClick={prevStep}>
                      <ArrowLeft size={17} /> Back
                    </button>
                  )}
                  <button type="submit" className="cc-btn-next" disabled={loading}>
                    {loading ? (
                      <span className="cc-loading-dots"><span /><span /><span /></span>
                    ) : step < 3 ? (
                      <>Continue <ArrowRight size={17} /></>
                    ) : (
                      <><Sparkles size={17} /> Launch My Chama</>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Trust Strip */}
            <div className="cc-trust-strip">
              <div className="cc-trust-item">
                <Shield size={15} style={{ color: "#10b981" }} />
                <span>Encrypted vault data</span>
              </div>
              <div className="cc-trust-dot" />
              <div className="cc-trust-item">
                <Star size={15} style={{ color: "#f59e0b" }} />
                <span>CBK compliant</span>
              </div>
              <div className="cc-trust-dot" />
              <div className="cc-trust-item">
                <Zap size={15} style={{ color: "#3b82f6" }} />
                <span>Goes live instantly</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateChama;
