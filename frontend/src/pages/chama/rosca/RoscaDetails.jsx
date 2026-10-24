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
  const [round, setRound] = useState(null);
  const [contributions, setContributions] = useState([]);
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "payout" | "cancel"
  const [swaps, setSwaps] = useState([]);
  const [swapWith, setSwapWith] = useState(null); // roster row
  const [swapReason, setSwapReason] = useState("");
  const myId = user?.id ?? user?.user_id ?? user?.userId;

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
      try { setRound((await roscaAPI.getRound(cycleId)).data?.data ?? null); } catch { setRound(null); }
      try { setSwaps(((await roscaAPI.getSwapRequests()).data?.data ?? []).filter((x) => String(x.cycle_id) === String(cycleId))); } catch { setSwaps([]); }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [cycleId, id]);

  useEffect(() => { load(); }, [load]);

  const next = roster.find((r) => r.status === "ACTIVE" || r.status === "PAYOUT_PENDING");
  const paid = roster.filter((r) => r.status === "PAID").length;
  const isOfficial = OFFICIALS.includes(role);
  const isActive = cycle?.status === "ACTIVE";
  const myPending = swaps.filter((x) => x.status === "PENDING");
  const mySlot = roster.find((r) => String(r.user_id) === String(myId));
  const canAskSwap = isActive && mySlot?.status === "ACTIVE" && !myPending.some((x) => String(x.requester_id) === String(myId) || String(x.target_id) === String(myId));
  const pot = Number(cycle?.contribution_amount || 0) * (cycle?.total_members || roster.length);
  const verified = contributions.filter((c) => c.status === "COMPLETED");

  const run = async () => {
    setBusy(true);
    try {
      if (confirm === "payout") {
        const res = await roscaAPI.processPayout(cycleId, {});
        if (res.data?.data?.status === "AWAITING_SECOND_OFFICIAL") toast.info("Payout requested. A different official must release it. No money has moved yet.", { autoClose: 8000 });
        else toast.success("Payout recorded.");
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

  const answerSwap = async (swap, action) => {
    setBusy(true);
    try {
      await roscaAPI.respondToSwap(swap.swap_id, action);
      toast.success(action === "ACCEPT" ? "Turns swapped." : action === "CANCEL" ? "Request cancelled." : "Request declined.");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "That didn't go through. Nothing was changed.");
    } finally { setBusy(false); }
  };

  const sendSwap = async () => {
    setBusy(true);
    try {
      await roscaAPI.requestSwap(cycleId, { target_user_id: swapWith.user_id, reason: swapReason.trim() });
      toast.success("Request sent. Your turns change only if they accept.");
      setSwapWith(null); setSwapReason("");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't send the request.");
    } finally { setBusy(false); }
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

        {round && isActive && (
          <section className="cs-card" aria-label="This round" style={{ marginBottom: 16 }}>
            <h2 className="cs-card-title">Round {round.round_number} of {round.total_rounds}</h2>
            <p className="cs-help">{formatKES(round.available)} of {formatKES(round.pot)} collected for this pot. Only verified payments count.</p>
            <progress max={Number(round.pot) || 1} value={Math.min(Number(round.available), Number(round.pot))} aria-label="Pot collected" style={{ width: "100%" }} />
            {Number(round.days_overdue) > 0 && (
              <div className="cs-notice cs-notice--warning" role="status" style={{ margin: "8px 0" }}>
                {round.recipient_name}&apos;s turn was due on {formatDate(round.due_date)}, {round.days_overdue} day{Number(round.days_overdue) === 1 ? "" : "s"} ago.
              </div>
            )}
            {(round.waiting_for_next_cycle || []).length > 0 && (
              <p className="cs-help">Joined after this cycle began and will take part from the next one: {round.waiting_for_next_cycle.join(", ")}.</p>
            )}
            {round.members.some((m) => Number(m.arrears) > 0) ? (
              <ul className="cs-list" style={{ listStyle: "none", padding: 0, margin: "12px 0 0" }}>
                {round.members.filter((m) => Number(m.arrears) > 0).map((m) => (
                  <li key={m.user_id} className="cs-list-item">
                    <div className="cs-list-main"><div className="cs-list-title">{m.member_name}</div><div className="cs-list-meta">Paid {formatKES(m.paid)} of {formatKES(m.expected)}</div></div>
                    <strong>{formatKES(m.arrears)} behind</strong>
                  </li>
                ))}
              </ul>
            ) : <p className="cs-help">Everyone is up to date for this round.</p>}
          </section>
        )}

        <section className="cs-card" aria-label="Payout order" style={{ marginBottom: 16 }}>
          <h2 className="cs-card-title">Payout order</h2>
          {roster.length === 0 ? <EmptyState title="No members in this cycle" /> : (
            <ol className="cs-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {roster.map((r) => (
                <li key={r.roster_id} className="cs-list-item">
                  <div className="cs-list-main">
                    <div className="cs-list-title">{r.position}. {r.member_name}{String(r.user_id) === String(myId) ? " (you)" : ""}</div>
                    <div className="cs-list-meta">{r.status === "PAID" ? `Paid ${r.paid_at ? formatDate(r.paid_at) : ""}` : r.status === "ACTIVE" && r.payout_date ? `Due ${formatDate(r.payout_date)}` + (r === next ? " · next to receive" : "") : r === next && r.status === "PAYOUT_PENDING" ? "Next to receive, waiting for a second official" : r.status === "SKIPPED" ? "Skipped, no longer in the chama" : "Waiting"}</div>
                  </div>
                  <span className="cs-actions">
                    {canAskSwap && r.status === "ACTIVE" && String(r.user_id) !== String(myId) && (
                      <Button size="sm" variant="secondary" aria-label={`Ask ${r.member_name} to swap turns`} onClick={() => setSwapWith(r)}>Swap turns</Button>
                    )}
                    <StatusBadge status={r.status === "PAID" ? "PAID" : r === next ? "ACTIVE" : "PENDING"} label={r.status === "PAID" ? "Paid" : r === next ? "Next" : "Waiting"} />
                  </span>
                </li>
              ))}
            </ol>
          )}
          {isOfficial && isActive && next && (
            <div className="cs-actions" style={{ marginTop: 12 }}>
              <Button disabled={round ? !round.ready && next.status !== "PAYOUT_PENDING" : false} onClick={() => setConfirm("payout")}>Record payout to {next.member_name}</Button>
              {round && !round.ready && next.status !== "PAYOUT_PENDING" && <span className="cs-help">The pot can be paid once this round&apos;s contributions are verified.</span>}
            </div>
          )}
        </section>

        {myPending.some((x) => String(x.requester_id) === String(myId) || String(x.target_id) === String(myId)) && (
          <section className="cs-card" aria-label="Swap requests" style={{ marginBottom: 16 }}>
            <h2 className="cs-card-title">Swap requests</h2>
            <ul className="cs-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {myPending.filter((x) => String(x.requester_id) === String(myId) || String(x.target_id) === String(myId)).map((x) => (
                <li key={x.swap_id} className="cs-list-item">
                  <div className="cs-list-main">
                    <div className="cs-list-title">{String(x.target_id) === String(myId) ? `${x.requester_name} asks to swap turns with you` : `You asked ${x.target_name} to swap turns`}</div>
                    {x.reason && <div className="cs-list-meta">{x.reason}</div>}
                  </div>
                  <span className="cs-actions">
                    {String(x.target_id) === String(myId) ? (<>
                      <Button size="sm" loading={busy} onClick={() => answerSwap(x, "ACCEPT")}>Accept</Button>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => answerSwap(x, "DECLINE")}>Decline</Button>
                    </>) : <Button size="sm" variant="secondary" disabled={busy} onClick={() => answerSwap(x, "CANCEL")}>Cancel request</Button>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

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
        <p className="cs-footnote">ChamaSmart keeps the books only. Paying the recipient happens outside the app; recording it here updates the chama&apos;s fund.</p>

        <Dialog
          open={!!swapWith}
          onClose={() => { if (!busy) setSwapWith(null); }}
          title="Ask to swap turns?"
          actions={(<><Button onClick={() => setSwapWith(null)} disabled={busy}>Go back</Button><Button loading={busy} onClick={sendSwap}>Send request</Button></>)}
        >
          <p>You would take turn {swapWith?.position} ({swapWith?.member_name}&apos;s turn) and they would take yours. Nothing changes unless they accept.</p>
          <label className="cs-label" htmlFor="sw-reason">Why? (optional)</label>
          <textarea id="sw-reason" className="cs-textarea" rows={2} maxLength={300} value={swapReason} onChange={(e) => setSwapReason(e.target.value)} />
        </Dialog>

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
