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
    <div className="page-lux-wrapper">
        <div className="chama-header-lux">
            <div className="chama-title-area">
                <h1 className="flex align-center gap-3">
                    <Save size={32} /> Bulk Entry Hub
                </h1>
                <div className="chama-badges mt-2">
                    <span className="badge-lux badge-gold">Mass Contribution</span>
                    <span className="badge-lux" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--lux-text-secondary)', border: '1px solid var(--lux-border)' }}>
                        {chama?.chama_name} • {isROSCA ? "Merry-Go-Round" : chama?.chama_type}
                    </span>
                </div>
            </div>
            <div className="flex gap-3">
                <button 
                    className="btn-lux btn-lux-outline"
                    onClick={() => navigate(`/chamas/${id}`)}
                >
                    <X size={18} /> Cancel Session
                </button>
            </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* ROSCA Cycle Status Banner */}
        {isROSCA && (
            <div className="dashboard-card-lux mb-8" style={{ 
                background: noCycle ? 'rgba(239, 68, 68, 0.05)' : 'var(--lux-bg-soft)',
                border: noCycle ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--lux-border)'
            }}>
                <div className="flex items-center gap-4">
                    <div style={{ 
                        padding: '1rem', 
                        borderRadius: '16px', 
                        background: noCycle ? '#ef4444' : '#10b981',
                        color: 'white'
                    }}>
                        {noCycle ? <AlertCircle size={28} /> : <CheckCircle2 size={28} />}
                    </div>
                    <div className="flex-1">
                        {noCycle ? (
                            <>
                                <h4 className="m-0" style={{ color: '#ef4444', fontWeight: 900 }}>No Active ROSCA Cycle</h4>
                                <p className="m-0 text-sm" style={{ color: 'var(--lux-text-secondary)' }}>{cycleWarning}</p>
                                <button className="btn-lux btn-lux-outline mt-3" onClick={() => navigate(`/chamas/${id}`)}>
                                    Initialize New Cycle
                                </button>
                            </>
                        ) : (
                            <>
                                <h4 className="m-0" style={{ color: 'var(--lux-text-primary)', fontWeight: 900 }}>Active Cycle: {activeCycle?.cycle_name}</h4>
                                <div className="flex align-center gap-3 mt-1">
                                    <span className={`status-pill-lux ${activeCycle?.status === "ACTIVE" ? "status-verified" : "status-pending"}`}>
                                        {activeCycle?.status} Protocol
                                    </span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--lux-text-secondary)', fontWeight: 600 }}>
                                        Quota: <strong style={{ color: 'var(--lux-gold)' }}>{formatCurrency(activeCycle?.contribution_amount)}</strong> per member
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Session Date Card */}
        <div className="dashboard-card-lux mb-8">
            <div className="card-header pb-4 mb-6 border-b border-white/5">
                <h3 className="card-title-lux m-0">
                    <Calendar size={20} /> Session Parameters
                </h3>
            </div>
            <div className="flex align-center gap-10 flex-wrap">
                <div className="form-group m-0" style={{ minWidth: '240px' }}>
                    <label className="form-label-lux">Official Contribution Date</label>
                    <input
                        type="date"
                        className="form-input-lux"
                        value={contributionDate}
                        onChange={e => setContributionDate(e.target.value)}
                        max={new Date().toISOString().split("T")[0]}
                        required
                    />
                </div>
                <div className="flex gap-8">
                    <div className="stat-mini">
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--lux-text-secondary)', letterSpacing: '1px' }}>Global Quota</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--lux-text-primary)' }}>{formatCurrency(expectedAmount)}</div>
                    </div>
                    <div className="stat-mini">
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--lux-text-secondary)', letterSpacing: '1px' }}>Monthly Velocity</span>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--lux-text-primary)' }}>{existingContribs.length} Recorded</div>
                    </div>
                </div>
            </div>
        </div>

        {/* Member Payments Table */}
        <div className="dashboard-card-lux">
            <div className="card-header pb-6 mb-4 border-b border-white/5 flex justify-between items-center flex-wrap gap-4">
                <h3 className="card-title-lux m-0">
                    <Save size={20} /> Batch Registry Entry
                </h3>
                <div className="flex gap-2">
                    <button type="button" className="btn-lux btn-lux-outline btn-sm py-2" style={{ fontSize: '0.75rem' }} onClick={() => handleSelectAll(true)}>
                        Select All
                    </button>
                    <button type="button" className="btn-lux btn-lux-outline btn-sm py-2" style={{ fontSize: '0.75rem' }} onClick={() => handleSelectAll(false)}>
                        Deselect
                    </button>
                    <button type="button" className="btn-lux btn-lux-primary btn-sm py-2" style={{ fontSize: '0.75rem' }} onClick={handleSelectUnpaid}>
                        Identify Unpaid
                    </button>
                </div>
            </div>
            <form onSubmit={handleSubmit}>
                <div style={{ overflowX: 'auto' }}>
                    <table className="table-lux">
                        <thead>
                            <tr>
                                <th style={{ width: "50px" }}>
                                    <input
                                        type="checkbox"
                                        onChange={e => handleSelectAll(e.target.checked)}
                                        checked={batch.length > 0 && batch.every(b => b.checked)}
                                    />
                                </th>
                                <th>Validated Member</th>
                                <th>Status</th>
                                <th>Lifetime</th>
                                <th>Amount (KES)</th>
                                <th>Method</th>
                                <th>Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                                <tr key={item.userId} className={item.checked ? "row-active-lux" : paid ? "row-verified-lux" : ""}>
                                    <td>
                                        <input
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={() => handleMemberToggle(index)}
                                        />
                                    </td>
                                    <td>
                                        <div style={{ fontWeight: 800, color: 'var(--lux-text-primary)' }}>{item.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--lux-text-secondary)' }}>{item.phone || "No Auth Device"}</div>
                                    </td>
                                    <td>
                                        {paid ? (
                                            <span className="status-pill-lux status-verified">✓ Paid {formatCurrency(monthAmount)}</span>
                                        ) : (
                                            <span className="status-pill-lux status-pending">Pending Quota</span>
                                        )}
                                    </td>
                                    <td style={{ fontWeight: 700, color: 'var(--lux-text-secondary)', fontSize: '0.85rem' }}>
                                        {formatCurrency(item.totalContributions)}
                                    </td>
                                    <td>
                                        <input
                                            type="number"
                                            className="form-input-lux py-2"
                                            style={{ width: "120px", fontSize: '0.9rem', fontWeight: 800 }}
                                            value={item.amount}
                                            min={1}
                                            step={1}
                                            onChange={e => handleBatchUpdate(index, "amount", e.target.value)}
                                            disabled={!item.checked}
                                        />
                                    </td>
                                    <td>
                                        <select
                                            className="form-select-lux py-2"
                                            style={{ width: "120px", fontSize: '0.85rem' }}
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
                                            className="form-input-lux py-2"
                                            placeholder="Audit Ref..."
                                            value={item.receiptNumber}
                                            onChange={e => handleBatchUpdate(index, "receiptNumber", e.target.value)}
                                            disabled={!item.checked}
                                            style={{ width: "130px", fontSize: '0.85rem' }}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex justify-between items-center p-8 mt-4 border-t border-white/5" style={{ background: 'var(--lux-bg-soft)', borderRadius: '0 0 24px 24px' }}>
                <div style={{ color: 'var(--lux-text-secondary)', fontSize: '0.9rem' }}>
                    <strong>{selectedBatch.length}</strong> Official Selections •{" "}
                    Batch Value: <strong style={{ color: 'var(--lux-gold)', fontSize: '1.1rem' }}>{formatCurrency(totalSelected)}</strong>
                </div>
                <button
                    type="submit"
                    className="btn-lux btn-lux-primary"
                    disabled={loading || selectedBatch.length === 0 || noCycle}
                    style={{ minWidth: '220px' }}
                >
                    {loading ? <RefreshCw className="spin" /> : <Save size={18} />}
                    {loading ? "Committing Batch..." : "Authorize & Save Batch"}
                </button>
            </div>
        </form>
    </div>
</div>
  );
};

export default BulkRecordContribution;
