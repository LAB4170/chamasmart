import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { ascaAPI } from "../../../services/api";
import { Button } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

const fail = (err) => toast.error(err.response?.data?.message || "That didn't go through. Nothing was changed.", { autoClose: 8000 });

/** Starting a cycle. There is no promised dividend: members share what the cycle actually earned when it closes. */
export function StartCycle({ chamaId, onDone }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [shares, setShares] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = name.trim() && Number(price) > 0 && Number.isInteger(Number(shares)) && Number(shares) > 0;
  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await ascaAPI.createCycle(chamaId, { cycle_name: name.trim(), share_price: Number(price), total_shares: Number(shares) });
      toast.success("Cycle started.");
      onDone();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };
  return (
    <form className="cs-card" onSubmit={submit} noValidate aria-label="Start a share cycle">
      <h2 className="cs-card-title">Start a share cycle</h2>
      <p className="cs-help">At the end of the cycle the chama&apos;s cash is shared out by shares held. No return is promised in advance.</p>
      <div className="cs-field"><label className="cs-label" htmlFor="sc-name">Cycle name</label><input id="sc-name" className="cs-input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="cs-field"><label className="cs-label" htmlFor="sc-price">Price per share (KES)</label><input id="sc-price" className="cs-input" type="number" inputMode="decimal" min="1" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
      <div className="cs-field"><label className="cs-label" htmlFor="sc-shares">Shares available</label><input id="sc-shares" className="cs-input" type="number" inputMode="numeric" min="1" value={shares} onChange={(e) => setShares(e.target.value)} /></div>
      <Button type="submit" loading={busy} disabled={!valid}>Start cycle</Button>
    </form>
  );
}

/** Large share purchases wait here for an official other than the one who recorded them. */
export function PendingShares({ cycleId, onChanged }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => { ascaAPI.getShareRequests(cycleId).then((r) => setRows(r.data?.data || [])).catch(() => setRows([])); }, [cycleId]);
  useEffect(() => { load(); }, [load]);
  const act = async (r, kind) => {
    setBusy(r.request_id);
    try {
      if (kind === "verify") await ascaAPI.verifyShareRequest(r.request_id); else await ascaAPI.rejectShareRequest(r.request_id);
      toast.success(kind === "verify" ? "Verified. Shares issued." : "Request rejected.");
      load(); onChanged();
    } catch (err) { fail(err); } finally { setBusy(null); }
  };
  if (rows.length === 0) return null;
  return (
    <section className="cs-card" aria-label="Share purchases to verify" style={{ marginBottom: 16 }}>
      <h2 className="cs-card-title">Share purchases to verify ({rows.length})</h2>
      <p className="cs-help">Confirm the money has arrived. The official who recorded a purchase cannot verify it.</p>
      <ul className="cs-list">
        {rows.map((r) => (
          <li key={r.request_id} className="cs-list-item">
            <div className="cs-list-main"><div className="cs-list-title">{r.member_name} · {r.shares} shares</div><div className="cs-list-meta">{formatKES(r.amount)}</div></div>
            <span className="cs-actions">
              <Button size="sm" disabled={busy !== null} onClick={() => act(r, "reject")}>Reject</Button>
              <Button size="sm" variant="primary" loading={busy === r.request_id} disabled={busy !== null} onClick={() => act(r, "verify")}>Verify</Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Preview of the share-out and the two-official close. */
export function ShareOut({ cycleId, userId, onChanged }) {
  const [p, setP] = useState(null);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { ascaAPI.getShareOut(cycleId).then((r) => setP(r.data?.data || null)).catch(() => setP(null)); }, [cycleId]);
  useEffect(() => { load(); }, [load]);
  if (!p) return null;
  const mineRequested = p.close_requested_by && String(p.close_requested_by) === String(userId);
  const run = async () => {
    if (!armed) { setArmed(true); return; }
    setBusy(true);
    try {
      const res = await ascaAPI.closeCycle(cycleId);
      if (res.data?.data?.status === "CLOSED") toast.success("Shared out. The cycle is closed.");
      else toast.info("Share-out requested. A different official must confirm it. No money has moved yet.", { autoClose: 8000 });
      setArmed(false); load(); onChanged();
    } catch (err) { fail(err); } finally { setBusy(false); }
  };
  const cancel = async () => { try { await ascaAPI.cancelClose(cycleId); load(); onChanged(); } catch (err) { fail(err); } };
  return (
    <section className="cs-card" aria-label="Share-out" style={{ marginBottom: 16 }}>
      <h2 className="cs-card-title">Share-out</h2>
      <p className="cs-help">If the cycle closed now, {formatKES(p.pool)} would be shared by shares held ({p.shares_issued} shares).</p>
      <ul className="cs-list">
        {p.members.map((m) => (
          <li key={m.user_id} className="cs-list-item">
            <div className="cs-list-main"><div className="cs-list-title">{m.member_name}</div><div className="cs-list-meta">{m.shares} shares · invested {formatKES(m.invested)}</div></div>
            <strong>{formatKES(m.amount)}</strong>
          </li>
        ))}
      </ul>
      {p.blockers.length > 0 && <div className="cs-notice cs-notice--warning" role="status" style={{ marginTop: 12 }}><ul style={{ margin: 0, paddingLeft: 18 }}>{p.blockers.map((b) => <li key={b}>{b}</li>)}</ul></div>}
      <div className="cs-actions" style={{ marginTop: 12 }}>
        <Button disabled={!p.can_close || mineRequested} loading={busy} onClick={run}>
          {mineRequested ? "Waiting for a different official" : armed ? "Confirm: share out and close" : p.status === "CLOSING" ? "Confirm share-out" : "Request share-out"}
        </Button>
        {p.status === "CLOSING" && <Button onClick={cancel}>Withdraw request</Button>}
      </div>
    </section>
  );
}
