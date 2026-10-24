import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { roscaAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader, StatusBadge, StatCard, EmptyState, Skeleton, Dialog } from "../../../components/ui";
import { formatKES, formatDate } from "../../../utils/format";

const OFFICIALS = ["CHAIRPERSON", "TREASURER", "SECRETARY"];
const LABELS = { ACTIVE: "Waiting", PAID: "Paid" };

export default function PayoutManagement() {
  const { id } = useParams();
  const [chama, setChama] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [c, r] = await Promise.all([chamaAPI.getById(id), roscaAPI.getCycles(id)]);
      setChama(c.data?.data || null);
      const raw = r.data?.data ?? [];
      setCycles(Array.isArray(raw) ? raw : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const cycle = cycles.find((c) => c.status === "ACTIVE") || cycles[0] || null;
  const roster = cycle?.roster || [];
  const next = cycle?.status === "ACTIVE" ? roster.find((r) => r.status === "ACTIVE") : null;
  const pot = cycle ? Number(cycle.contribution_amount || 0) * Number(cycle.total_members || 0) : 0;
  const isOfficial = OFFICIALS.includes((chama?.role || "").toUpperCase());
  const fund = Number(chama?.current_fund || 0);

  // The books change only after the server confirms.
  const record = async () => {
    setBusy(true);
    try {
      await roscaAPI.processPayout(cycle.cycle_id, {});
      toast.success(`Payout to ${next.member_name} recorded.`);
      setConfirming(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't record the payout. Nothing was changed.");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Payouts"
          subtitle={chama ? `Merry-go-round payouts for ${chama.chama_name}.` : "Merry-go-round payouts."}
          actions={<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>}
        />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load payouts.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-card" aria-busy="true" aria-label="Loading payouts"><Skeleton height={14} width="40%" /><Skeleton height={40} style={{ marginTop: 12 }} /></div>
        ) : !error && (!cycle ? (
          <div className="cs-card">
            <EmptyState
              title="No cycle yet"
              message={chama?.chama_type === "ROSCA" ? "Start a cycle to set the payout order." : "Payouts apply to merry-go-round (ROSCA) chamas."}
              action={chama?.chama_type === "ROSCA" && isOfficial ? <Link to={`/chamas/${id}/rosca/create-cycle`} className="cs-btn cs-btn--primary">Start a cycle</Link> : null}
            />
          </div>
        ) : (
          <>
            <div className="cs-notice cs-notice--info" style={{ marginBottom: 16 }}>
              <span>Recording a payout deducts the pot from the group fund in ChamaSmart&apos;s books. ChamaSmart doesn&apos;t send the money, so pay the recipient yourself first.</span>
            </div>
            <div className="cs-grid" style={{ marginBottom: 16 }}>
              <StatCard label="Cycle" value={cycle.cycle_name} note={cycle.status === "ACTIVE" ? "Active" : cycle.status} />
              <StatCard label="Pot per round" value={formatKES(pot)} />
              <StatCard label="Group fund" value={formatKES(fund)} note={fund < pot ? "Not enough for the next payout yet" : undefined} />
            </div>

            <section className="cs-card" aria-label="Payout order">
              <h2 className="cs-card-title">Payout order</h2>
              <ol className="cs-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {roster.map((r) => (
                  <li key={r.roster_id} className="cs-list-item">
                    <div className="cs-list-main">
                      <strong>{r.position}. {r.member_name}</strong>
                      <div className="cs-list-meta">Due {formatDate(r.payout_date)}</div>
                    </div>
                    <StatusBadge status={r.status === "PAID" ? "COMPLETED" : "PENDING"} label={LABELS[r.status] || r.status} />
                  </li>
                ))}
              </ol>
              {next && isOfficial && (
                <div className="cs-actions" style={{ marginTop: 16 }}>
                  <Button variant="primary" disabled={fund < pot} onClick={() => setConfirming(true)}>Record payout to {next.member_name}</Button>
                </div>
              )}
              {next && !isOfficial && <p className="cs-footnote">Next in line: {next.member_name}. An official records each payout.</p>}
              {cycle.status !== "ACTIVE" && <p className="cs-footnote">This cycle is {cycle.status.toLowerCase()}.</p>}
            </section>
          </>
        ))}

        <Dialog
          open={confirming}
          onClose={() => { if (!busy) setConfirming(false); }}
          title="Record this payout?"
          actions={(
            <>
              <Button onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
              <Button variant="primary" loading={busy} onClick={record}>Record payout</Button>
            </>
          )}
        >
          <p>{formatKES(pot)} goes to {next?.member_name}, and the group fund drops by the same amount. Only confirm once the money has been sent.</p>
          <p className="cs-footnote">You can&apos;t record a payout to yourself; another official must do it.</p>
        </Dialog>
      </main>
    </div>
  );
}
