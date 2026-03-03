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
    <div className="page">
      <div className="container">
        <div className="page-header">
          <div>
            <h1>Record Contribution</h1>
            <p className="text-muted">
              {chama?.chama_name}
              {isROSCA && <span className="badge badge-primary ml-2">Merry-Go-Round</span>}
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/chamas/${id}`)}>
            ← Back to Chama
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* ROSCA Cycle Context */}
        {isROSCA && (
          <div className={`alert ${noCycle ? "alert-error" : activeCycle?.status === "ACTIVE" ? "alert-success" : "alert-warning"} mb-4`}>
            <div className="flex items-center gap-2">
              {noCycle ? <AlertCircle size={18} /> : activeCycle?.status === "ACTIVE" ? <CheckCircle2 size={18} /> : <RefreshCw size={18} />}
              <div>
                {noCycle ? (
                  <><strong>No Active Cycle!</strong> {cycleWarning}</>
                ) : (
                  <>
                    <strong>Cycle: {activeCycle?.cycle_name}</strong>
                    <span className={`badge badge-${activeCycle?.status === "ACTIVE" ? "success" : "warning"} ml-2`}>{activeCycle?.status}</span>
                    <div className="text-sm mt-1">Expected contribution: <strong>{formatCurrency(activeCycle?.contribution_amount)}</strong> per member</div>
                    {cycleWarning && <div className="text-sm text-warning mt-1">{cycleWarning}</div>}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {!isROSCA && (
          <div className="alert alert-info mb-4">
            <strong>Recording Payment</strong> — Use this form to manually log a payment received from a member.
            It will update their contribution total and appear in reports.
          </div>
        )}

        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="card-body" style={{ padding: "1.5rem" }}>
              {/* Member selection */}
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
                      {member.first_name} {member.last_name} ({member.role}) — Paid: {formatCurrency(member.total_contributions || 0)}
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
                  {expectedAmount && (
                    <small className="text-muted">
                      {isROSCA ? `Cycle expected: ` : `Chama default: `}
                      <strong>{formatCurrency(expectedAmount)}</strong>
                    </small>
                  )}
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
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Receipt / Reference Number</label>
                  <input
                    type="text"
                    name="receiptNumber"
                    className="form-input"
                    placeholder="e.g., QBX123456"
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
                    max={new Date().toISOString().split("T")[0]}
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
                  placeholder="Any additional notes — e.g., late payment, partial payment reason..."
                  value={formData.notes}
                  onChange={handleChange}
                  rows="3"
                />
              </div>
            </div>

            <div className="card-footer form-actions">
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
                disabled={loading || noCycle}
                title={noCycle ? "Create a ROSCA cycle first" : ""}
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
