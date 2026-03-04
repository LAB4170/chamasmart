import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chamaAPI, contributionAPI, roscaAPI } from "../../../services/api";
import LoadingSkeleton from "../../../components/LoadingSkeleton";
import { Save, X, Calendar, AlertCircle, CheckCircle2, RefreshCw, ArrowLeft } from "lucide-react";

const BulkRecordContribution = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [chama, setChama] = useState(null);
  const [members, setMembers] = useState([]);
  const [batch, setBatch] = useState([]);
  const [existingContribs, setExistingContribs] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [cycleWarning, setCycleWarning] = useState("");
  const [contributionDate, setContributionDate] = useState(new Date().toISOString().split("T")[0]);
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

        const chamaData = chamaRes.data.data;
        const membersData = membersRes.data.data || [];

        // Fetch this month's contributions (optional, non-blocking)
        const contribRes = await contributionAPI.getAll(id, {
          startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString().split("T")[0],
          endDate: new Date().toISOString().split("T")[0]
        }).catch(() => ({ data: { data: [] } }));

        const contribData = contribRes.data.data || [];

        // Resolve ROSCA cycle context
        let cycle = null;
        let warning = "";
        if (chamaData.chama_type === "ROSCA") {
          try {
            const cyclesRes = await roscaAPI.getCycles(id);
            const cycles = cyclesRes.data.data || [];
            const active = cycles.find(c => c.status === "ACTIVE");
            const pending = !active && cycles.find(c => c.status === "PENDING");
            cycle = active || pending;

            if (!cycle) {
              warning = "⚠️ No active or pending ROSCA cycle found. Please create a cycle before recording contributions.";
            } else if (!active && pending) {
              warning = `Cycle "${cycle.cycle_name}" is PENDING — recording will be linked to this cycle.`;
            }
          } catch {
            warning = "Could not load ROSCA cycle data.";
          }
        }

        if (!isMounted) return;

        setChama(chamaData);
        setMembers(membersData);
        setExistingContribs(contribData);
        setActiveCycle(cycle);
        setCycleWarning(warning);

        // Determine expected amount: ROSCA cycle > chama default
        const expectedAmount = (cycle?.contribution_amount) || chamaData.contribution_amount || 0;

        setBatch(membersData.map(m => ({
          userId: m.user_id,
          name: `${m.first_name} ${m.last_name}`,
          phone: m.phone_number || "",
          totalContributions: m.total_contributions || 0,
          amount: expectedAmount,
          paymentMethod: "CASH",
          receiptNumber: "",
          notes: "",
          checked: false
        })));
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

  const hasContributedThisMonth = useCallback((userId) => {
    return existingContribs.some(c => c.user_id === userId);
  }, [existingContribs]);

  const getMonthlyContribAmount = useCallback((userId) => {
    return existingContribs
      .filter(c => c.user_id === userId)
      .reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
  }, [existingContribs]);

  const handleMemberToggle = (index) => {
    const newBatch = [...batch];
    newBatch[index].checked = !newBatch[index].checked;
    setBatch(newBatch);
  };

  const handleBatchUpdate = (index, field, value) => {
    const newBatch = [...batch];
    newBatch[index][field] = value;
    setBatch(newBatch);
  };

  const handleSelectAll = (checked) => {
    setBatch(batch.map(b => ({ ...b, checked })));
  };

  const handleSelectUnpaid = () => {
    setBatch(batch.map(b => ({ ...b, checked: !hasContributedThisMonth(b.userId) })));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const toSubmit = batch.filter(b => b.checked);
    if (toSubmit.length === 0) {
      setError("Please select at least one member to record contributions for.");
      return;
    }

    if (!contributionDate) {
      setError("Please select a contribution date.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const payload = {
        contributions: toSubmit.map(b => ({
          userId: b.userId,
          amount: parseFloat(b.amount),
          paymentMethod: b.paymentMethod,
          receiptNumber: b.receiptNumber || undefined,
          notes: b.notes || undefined,
          contributionDate,
          verificationStatus: "VERIFIED"
        }))
      };

      const res = await contributionAPI.bulkRecord(id, payload);
      const warn = res.data?.warning;
      const cycleName = res.data?.data?.cycleName;

      setSuccess(
        `Successfully recorded ${toSubmit.length} contribution${toSubmit.length > 1 ? "s" : ""}` +
        (cycleName ? ` against cycle: ${cycleName}` : "") +
        (warn ? `. Note: ${warn}` : "") +
        "!"
      );
      setTimeout(() => {
        navigate(`/chamas/${id}`, { state: { refresh: true, tab: "contributions" } });
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record bulk contributions");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = useCallback((amount) => {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(amount || 0);
  }, []);

  if (pageLoading) return (
    <div className="page"><div className="container"><LoadingSkeleton type="table" /></div></div>
  );

  const isROSCA = chama?.chama_type === "ROSCA";
  const noCycle = isROSCA && !activeCycle;
  const expectedAmount = activeCycle?.contribution_amount || chama?.contribution_amount;
  const selectedBatch = batch.filter(b => b.checked);
  const totalSelected = selectedBatch.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);

  return (
    <div className="page">
      <div className="container">
        <div className="page-header" style={{ alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => navigate(`/chamas/${id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.75rem',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              aria-label="Back to Chama Details"
              onMouseOver={(e) => { e.currentTarget.style.background = 'var(--surface-3)'; e.currentTarget.style.color = 'var(--primary)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 style={{ margin: 0 }}>Bulk Record Contributions</h1>
              <p className="text-muted" style={{ margin: 0 }}>
                {chama?.chama_name} •{" "}
                <span>{isROSCA ? "Merry-Go-Round" : chama?.chama_type}</span>
              </p>
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate(`/chamas/${id}`)}>
            <X size={16} className="mr-1" /> Cancel
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* ROSCA Cycle Status Banner */}
        {isROSCA && (
          <div className={`alert ${noCycle ? "alert-error" : activeCycle?.status === "ACTIVE" ? "alert-success" : "alert-warning"} mb-4`}>
            <div className="flex items-center gap-2">
              {noCycle ? <AlertCircle size={18} /> : activeCycle?.status === "ACTIVE" ? <CheckCircle2 size={18} /> : <RefreshCw size={18} />}
              <div>
                {noCycle ? (
                  <>
                    <strong>No ROSCA Cycle!</strong> {cycleWarning}
                    <div className="mt-1">
                      <button className="btn btn-sm btn-outline" onClick={() => navigate(`/chamas/${id}`)}>
                        Go Back & Create a Cycle
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>Cycle: {activeCycle?.cycle_name}</strong>
                    <span className={`badge badge-${activeCycle?.status === "ACTIVE" ? "success" : "warning"} ml-2`}>{activeCycle?.status}</span>
                    <div className="text-sm mt-1">
                      Expected: <strong>{formatCurrency(activeCycle?.contribution_amount)}</strong> per member
                    </div>
                    {cycleWarning && <div className="text-sm text-warning mt-1">{cycleWarning}</div>}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Session Date Card */}
        <div className="card mb-4">
          <div className="card-header">
            <h3 className="card-title flex items-center gap-2">
              <Calendar size={16} /> Session Date
            </h3>
          </div>
          <div className="card-body" style={{ padding: "1rem 1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
              <div>
                <label className="form-label text-sm">Contribution Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={contributionDate}
                  onChange={e => setContributionDate(e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  required
                />
              </div>
              <div className="text-muted text-sm" style={{ marginTop: "1.5rem" }}>
                Expected per member:{" "}
                <strong>{formatCurrency(expectedAmount)}</strong>
                {isROSCA && activeCycle && (
                  <span className="ml-2 text-xs text-muted">(from cycle: {activeCycle.cycle_name})</span>
                )}
              </div>
              <div className="text-muted text-sm" style={{ marginTop: "1.5rem" }}>
                Recorded this month:{" "}
                <strong>{existingContribs.length} payments</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Member Payments Table */}
        <div className="card">
          <div className="card-header" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <h3 className="card-title">Member Payments</h3>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-outline" onClick={() => handleSelectAll(true)}>
                Select All
              </button>
              <button className="btn btn-sm btn-outline" onClick={() => handleSelectAll(false)}>
                Deselect All
              </button>
              <button className="btn btn-sm btn-primary" onClick={handleSelectUnpaid}>
                Select Unpaid This Month
              </button>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>
                      <input
                        type="checkbox"
                        onChange={e => handleSelectAll(e.target.checked)}
                        checked={batch.length > 0 && batch.every(b => b.checked)}
                        title="Select all"
                      />
                    </th>
                    <th>Member</th>
                    <th>This Month</th>
                    <th>Total Paid</th>
                    <th>Amount (KES)</th>
                    <th>Method</th>
                    <th>Receipt Ref</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.map((item, index) => {
                    const paid = hasContributedThisMonth(item.userId);
                    const monthAmount = getMonthlyContribAmount(item.userId);
                    return (
                      <tr key={item.userId} className={item.checked ? "table-active" : paid ? "table-success-light" : ""}>
                        <td>
                          <input
                            type="checkbox"
                            checked={item.checked}
                            onChange={() => handleMemberToggle(index)}
                          />
                        </td>
                        <td>
                          <div className="font-medium">{item.name}</div>
                          {item.phone && <div className="text-xs text-muted">{item.phone}</div>}
                        </td>
                        <td>
                          {paid ? (
                            <div>
                              <span className="badge badge-success text-xs">✓ Paid</span>
                              <div className="text-xs text-muted mt-1">{formatCurrency(monthAmount)}</div>
                            </div>
                          ) : (
                            <span className="badge badge-warning text-xs">Unpaid</span>
                          )}
                        </td>
                        <td>
                          <span className="text-sm font-medium">{formatCurrency(item.totalContributions)}</span>
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input form-input-sm"
                            style={{ width: "110px" }}
                            value={item.amount}
                            min={1}
                            step={1}
                            onChange={e => handleBatchUpdate(index, "amount", e.target.value)}
                            disabled={!item.checked}
                          />
                        </td>
                        <td>
                          <select
                            className="form-select form-select-sm"
                            value={item.paymentMethod}
                            onChange={e => handleBatchUpdate(index, "paymentMethod", e.target.value)}
                            disabled={!item.checked}
                          >
                            <option value="CASH">Cash</option>
                            <option value="MPESA">M-Pesa</option>
                            <option value="BANK_TRANSFER">Bank</option>
                            <option value="CHEQUE">Cheque</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="Ref no..."
                            value={item.receiptNumber}
                            onChange={e => handleBatchUpdate(index, "receiptNumber", e.target.value)}
                            disabled={!item.checked}
                            style={{ width: "120px" }}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-input form-input-sm"
                            placeholder="Note..."
                            value={item.notes}
                            onChange={e => handleBatchUpdate(index, "notes", e.target.value)}
                            disabled={!item.checked}
                            style={{ width: "110px" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="card-footer form-actions">
              <div className="text-muted small">
                <strong>{selectedBatch.length}</strong> members selected •{" "}
                Total: <strong>{formatCurrency(totalSelected)}</strong>
                {isROSCA && activeCycle && (
                  <span className="ml-2 text-xs text-muted">→ Cycle: {activeCycle.cycle_name}</span>
                )}
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || selectedBatch.length === 0 || noCycle}
                title={noCycle ? "Create a ROSCA cycle first" : ""}
              >
                {loading ? "Saving Batch..." : <><Save size={18} className="mr-1" /> Save Batch</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BulkRecordContribution;
