import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { roscaAPI, chamaAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { Button, PageHeader, StatCard, StatusBadge, EmptyState, Skeleton, Dialog, DataTable } from "../../../components/ui";
import { formatKES, formatDate, formatDateTime } from "../../../utils/format";

const OFFICIALS = ["CHAIRPERSON", "SECRETARY", "TREASURER"];

export default function RoscaDetails() {
  const { id, cycleId } = useParams();
  const { user } = useAuth();
  const [cycle, setCycle] = useState(null);
  const [roster, setRoster] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "payout" | "cancel"

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const [c, r, k, ch] = await Promise.all([
        roscaAPI.getCycle(cycleId),
        roscaAPI.getRoster(cycleId),
        roscaAPI.getContributions(cycleId),
        chamaAPI.getById(id),
      ]);
      setCycle(c.data?.data ?? null);
      const rs = r.data?.data ?? [];
      setRoster(Array.isArray(rs) ? rs : []);
      const ks = k.data?.data ?? [];
      setContributions(Array.isArray(ks) ? ks : []);
      setRole((ch.data?.data?.role || "").toUpperCase());
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [cycleId, id]);

  useEffect(() => { load(); }, [load]);

  const next = roster.find((r) => r.status === "ACTIVE");
  const paid = roster.filter((r) => r.status === "PAID").length;
  const isOfficial = OFFICIALS.includes(role);
  const isActive = cycle?.status === "ACTIVE";
  const pot = Number(cycle?.contribution_amount || 0) * (cycle?.total_members || roster.length);
  const verified = contributions.filter((c) => c.status === "COMPLETED");

  const run = async () => {
    setBusy(true);
    try {
      if (confirm === "payout") {
        await roscaAPI.processPayout(cycleId, {});
        toast.success("Payout recorded.");
      } else {
        await roscaAPI.cancelCycle(cycleId);
        toast.success("Cycle cancelled.");
      }
      setConfirm(null);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't go through. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: "contribution_date", header: "Date", sortValue: (r) => new Date(r.contribution_date).getTime(), render: (r) => formatDateTime(r.contribution_date) },
    { key: "member_name", header: "Member" },
    { key: "amount", header: "Amount", align: "num", sortValue: (r) => Number(r.amount), render: (r) => formatKES(r.amount) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (loading) return <div className="cs-shell"><main className="cs-page"><div className="cs-card" aria-busy="true" aria-label="Loading cycle"><Skeleton height={20} width="50%" /><Skeleton height={80} style={{ marginTop: 12 }} /></div></main></div>;
  if (failed || !cycle) return (
    <div className="cs-shell"><main className="cs-page">
      <div className="cs-notice cs-notice--danger" role="alert" style={{ alignItems: "center", justifyContent: "space-between" }}>
        <span>We couldn&apos;t load this cycle.</span>
        <span className="cs-actions"><Button size="sm" onClick={load}>Try again</Button><Link to={`/chamas/${id}/rosca`} className="cs-btn cs-btn--secondary cs-btn--sm">Back</Link></span>
      </div>
    </main></div>
  );

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title={cycle.cycle_name}
          subtitle={`${formatDate(cycle.start_date)} to ${formatDate(cycle.end_date)}`}
          actions={(
            <>
              <StatusBadge status={cycle.status} />
              <Link to={`/chamas/${id}/rosca`} className="cs-btn cs-btn--secondary">All rounds</Link>
              {isOfficial && isActive && paid === 0 && <Button variant="danger" onClick={() => setConfirm("cancel")}>Cancel cycle</Button>}
            </>
          )}
        />

        <div className="cs-grid" style={{ marginBottom: 16 }}>
          <StatCard label="Each pays" value={formatKES(cycle.contribution_amount)} />
          <StatCard label="Pot per round" value={formatKES(pot)} note={`${cycle.total_members ?? roster.length} members`} />
          <StatCard label="Paid out" value={`${paid} of ${roster.length}`} note="Rounds recorded as paid" />
        </div>

        <section className="cs-card" aria-label="Payout order" style={{ marginBottom: 16 }}>
          <h2 className="cs-card-title">Payout order</h2>
          {roster.length === 0 ? <EmptyState title="No members in this cycle" /> : (
            <ol className="cs-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {roster.map((r) => (
                <li key={r.roster_id} className="cs-list-item">
                  <div className="cs-list-main">
                    <div className="cs-list-title">{r.position}. {r.member_name}{String(r.user_id) === String(user?.user_id) ? " (you)" : ""}</div>
                    <div className="cs-list-meta">{r.status === "PAID" ? `Paid ${r.payout_date ? formatDate(r.payout_date) : ""}` : r === next ? "Next to receive" : "Waiting"}</div>
                  </div>
                  <StatusBadge status={r.status === "PAID" ? "PAID" : r === next ? "ACTIVE" : "PENDING"} label={r.status === "PAID" ? "Paid" : r === next ? "Next" : "Waiting"} />
                </li>
              ))}
            </ol>
          )}
          {isOfficial && isActive && next && (
            <div className="cs-actions" style={{ marginTop: 12 }}>
              <Button onClick={() => setConfirm("payout")}>Record payout to {next.member_name}</Button>
            </div>
          )}
        </section>

        <section className="cs-card" aria-label="Contributions">
          <h2 className="cs-card-title">Contributions</h2>
          <DataTable
            columns={columns}
            rows={contributions}
            rowKey={(r) => r.contribution_id}
            caption="Contributions to this cycle"
            emptyMessage="No contributions have been recorded for this cycle yet."
            summarize={(rs) => `${rs.length} shown · ${formatKES(rs.reduce((t, r) => t + Number(r.amount || 0), 0))} submitted · ${verified.length} verified in total`}
          />
        </section>
        <p className="cs-footnote">ChamaSmart keeps the books only. Paying the recipient happens outside the app; recording it here updates the chama&apos;s fund. Position swaps aren&apos;t available yet.</p>

        <Dialog
          open={!!confirm}
          onClose={() => setConfirm(null)}
          title={confirm === "cancel" ? "Cancel this cycle?" : "Record this payout?"}
          actions={(<><Button onClick={() => setConfirm(null)}>Go back</Button><Button variant={confirm === "cancel" ? "danger" : "primary"} loading={busy} onClick={run}>{confirm === "cancel" ? "Cancel cycle" : "Record payout"}</Button></>)}
        >
          <p>{confirm === "cancel"
            ? "No payouts have been made, so the cycle will be closed. Members can't contribute to it afterwards."
            : `This records that ${next?.member_name || "the recipient"} has been paid ${formatKES(pot)} and deducts it from the chama fund. Only record it once the money has actually been sent. A different official must record it if you are the recipient.`}</p>
        </Dialog>
      </main>
    </div>
  );
}
