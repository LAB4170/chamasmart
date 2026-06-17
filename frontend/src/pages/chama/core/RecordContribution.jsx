import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, contributionAPI } from "../../../services/api";
import { roscaAPI } from "../../../services/api";
import LoadingSkeleton from "../../../components/LoadingSkeleton";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

const RecordContribution = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [cycleWarning, setCycleWarning] = useState("");
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
    let isMounted = true;

    const fetchData = async () => {
      try {
        if (isMounted) setPageLoading(true);
        const [chamaRes, membersRes] = await Promise.all([
          chamaAPI.getById(id),
          chamaAPI.getMembers(id),
        ]);

        if (isMounted) {
          const chamaData = chamaRes.data.data;
          setChama(chamaData);
          setMembers(membersRes.data.data || []);

          // For ROSCA chamas, fetch the active cycle to show expected amount
          if (chamaData.chama_type === "ROSCA") {
            try {
              const cyclesRes = await roscaAPI.getCycles(id);
              const cycles = cyclesRes.data.data || [];
              const active = cycles.find(c => c.status === "ACTIVE");
              const pending = !active && cycles.find(c => c.status === "PENDING");
              const cycle = active || pending;

              if (cycle) {
                setActiveCycle(cycle);
                // Pre-fill expected amount from cycle
                setFormData(prev => ({
                  ...prev,
                  amount: cycle.contribution_amount || chamaData.contribution_amount || ""
                }));
                if (!active && pending) {
                  setCycleWarning(`Cycle "${cycle.cycle_name}" is PENDING — not yet started. Contributions will be saved against this cycle.`);
                }
              } else {
                setCycleWarning("⚠️ No active or pending cycle found. Please create a ROSCA cycle before recording contributions.");
                setFormData(prev => ({ ...prev, amount: chamaData.contribution_amount || "" }));
              }
            } catch {
              setCycleWarning("Could not load cycle data. Proceeding with chama default amount.");
              setFormData(prev => ({ ...prev, amount: chamaData.contribution_amount || "" }));
            }
          } else {
            setFormData(prev => ({ ...prev, amount: chamaData.contribution_amount || "" }));
          }
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
    return () => { isMounted = false; };
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await contributionAPI.record(id, {
        ...formData,
        userId: parseInt(formData.userId),
        amount: parseFloat(formData.amount),
      });
      const warn = res.data?.warning;
      setSuccess(`Contribution recorded successfully!${warn ? ` Note: ${warn}` : ""}`);
      setTimeout(() => {
        navigate(`/chamas/${id}`, { state: { refresh: true, tab: "contributions" } });
      }, 1800);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record contribution");
      setLoading(false);
    }
  };

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount);
  }, []);

  if (pageLoading) {
    return (
      <div className="page">
        <div className="container">
          <LoadingSkeleton type="detail" />
        </div>
      </div>
    );
  }

  const isROSCA = chama?.chama_type === "ROSCA";
  const noCycle = isROSCA && !activeCycle;
  const expectedAmount = activeCycle?.contribution_amount || chama?.contribution_amount;

  return (
    <div className="chama-details-lux-root">
      <div className="page-frame-lux">
        <div className="chama-main-frame">
          <div className="chama-header-lux">
            <div className="chama-title-area">
              <button className="btn-return-lux mb-4" onClick={() => navigate(`/chamas/${id}`)}>
                ← Return to Chama
              </button>
              <h1>Record Contribution</h1>
              <div className="chama-badges mt-2">
                <span className="badge-lux badge-gold">
                  {chama?.chama_name}
                </span>
                {isROSCA && <span className="badge-lux" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>Merry-Go-Round</span>}
              </div>
            </div>
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* ROSCA Cycle Context */}
          {isROSCA && (
            <div className={`alert ${noCycle ? "alert-error" : activeCycle?.status === "ACTIVE" ? "alert-success" : "alert-warning"} mb-6`}>
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {noCycle ? <AlertCircle size={20} /> : activeCycle?.status === "ACTIVE" ? <CheckCircle2 size={20} /> : <RefreshCw size={20} />}
                </div>
                <div>
                  {noCycle ? (
                    <><strong>No Active Cycle!</strong> <p className="m-0 text-sm mt-1">{cycleWarning}</p></>
                  ) : (
                    <>
                      <strong>Cycle: {activeCycle?.cycle_name}</strong>
                      <span className="status-pill-lux ml-3" style={{ 
                        background: activeCycle?.status === "ACTIVE" ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                        color: activeCycle?.status === "ACTIVE" ? '#10b981' : '#f59e0b',
                        border: `1px solid ${activeCycle?.status === "ACTIVE" ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`
                      }}>
                        {activeCycle?.status}
                      </span>
                      <div className="text-sm mt-2">Expected contribution: <strong>{formatCurrency(activeCycle?.contribution_amount)}</strong> per member</div>
                      {cycleWarning && <div className="text-sm text-warning mt-1">{cycleWarning}</div>}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isROSCA && (
            <div className="alert mb-6" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <strong>Recording Payment</strong> — Use this form to manually log a payment received from a member.
              It will update their contribution total and appear in reports.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4">
            <div className="form-group">
              <label className="form-label-lux">Select Member *</label>
              <select
                name="userId"
                className="form-select-lux"
                value={formData.userId}
                onChange={handleChange}
                required
              >
                <option value="">Choose a member...</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.first_name} {member.last_name} ({member.role}) — Paid: {formatCurrency(member.total_contributions || 0)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group m-0">
                <label className="form-label-lux">Amount (KES) *</label>
                <input
                  type="number"
                  name="amount"
                  className="form-input-lux"
                  min="1"
                  step="0.01"
                  value={formData.amount}
                  onChange={handleChange}
                  required
                />
                {expectedAmount && (
                  <small style={{ fontSize: '0.75rem', color: 'var(--lux-text-secondary)', marginTop: '0.5rem', display: 'block' }}>
                    {isROSCA ? `Cycle expected: ` : `Chama default: `}
                    <strong style={{ color: 'var(--gold-text)' }}>{formatCurrency(expectedAmount)}</strong>
                  </small>
                )}
              </div>

              <div className="form-group m-0">
                <label className="form-label-lux">Payment Method *</label>
                <select
                  name="paymentMethod"
                  className="form-select-lux"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  required
                >
                  <option value="MPESA">M-Pesa</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div className="form-group m-0">
                <label className="form-label-lux">Receipt / Reference Number</label>
                <input
                  type="text"
                  name="receiptNumber"
                  className="form-input-lux"
                  placeholder="e.g., QBX123456"
                  value={formData.receiptNumber}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group m-0">
                <label className="form-label-lux">Contribution Date *</label>
                <input
                  type="date"
                  name="contributionDate"
                  className="form-input-lux"
                  value={formData.contributionDate}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label-lux">Notes</label>
              <textarea
                name="notes"
                className="form-input-lux"
                style={{ resize: 'vertical', minHeight: '100px' }}
                placeholder="Any additional notes — e.g., late payment, partial payment reason..."
                value={formData.notes}
                onChange={handleChange}
                rows="3"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2.5rem', paddingTop: '2rem', borderTop: '1px solid var(--lux-border)' }}>
              <button
                type="button"
                className="btn-lux btn-lux-outline"
                onClick={() => navigate(`/chamas/${id}`)}
                style={{ flex: 1, justifyContent: 'center', padding: '1rem' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-lux btn-lux-primary"
                disabled={loading || noCycle}
                title={noCycle ? "Create a ROSCA cycle first" : ""}
                style={{ flex: 2, justifyContent: 'center', padding: '1rem', fontSize: '1rem' }}
              >
                {loading ? "Recording Transaction..." : "Confirm & Record Contribution"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RecordContribution;
