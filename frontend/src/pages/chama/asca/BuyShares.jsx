import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { ascaAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader, Skeleton } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

const OFFICIALS = ["CHAIRPERSON", "TREASURER"];

/** Share purchases are recorded by an official once the member's payment has actually been received. */
export default function BuyShares() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [chama, setChama] = useState(null);
  const [cycle, setCycle] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [memberId, setMemberId] = useState("");
  const [shares, setShares] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [c, cy, m] = await Promise.all([chamaAPI.getById(id), ascaAPI.getEquity(id), chamaAPI.getMembers(id)]);
        if (!live) return;
        setChama(c.data?.data || null);
        const list = cy.data?.data ?? [];
        setCycle((Array.isArray(list) ? list : []).find((x) => x.status === "ACTIVE") || null);
        const ms = m.data?.data ?? [];
        setMembers(Array.isArray(ms) ? ms : []);
      } catch {
        if (live) setLoadError("We couldn't load this chama's share cycle.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [id]);

  const isOfficial = OFFICIALS.includes((chama?.role || "").toUpperCase());
  const count = parseInt(shares, 10);
  const price = Number(cycle?.share_price || 0);
  const total = Number.isInteger(count) && count > 0 ? count * price : 0;
  const available = cycle?.available_shares ?? 0;
  const valid = memberId && Number.isInteger(count) && count > 0 && count <= available;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    try {
      await ascaAPI.buyShares(id, { cycleId: cycle.cycle_id, shares: count, user_id: Number(memberId) });
      toast.success(`${count} ${count === 1 ? "share" : "shares"} recorded.`);
      navigate(`/chamas/${id}/asca`);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't record the purchase. Nothing was changed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader title="Record a share purchase" subtitle="Record shares once the member's payment has been received." actions={<Link to={`/chamas/${id}/asca`} className="cs-btn cs-btn--secondary">Back</Link>} />

        {loading && <div className="cs-card" aria-busy="true"><Skeleton height={14} width="50%" /><Skeleton height={30} style={{ marginTop: 12 }} /></div>}
        {loadError && <div className="cs-notice cs-notice--danger" role="alert"><span>{loadError}</span></div>}

        {!loading && !loadError && !isOfficial && (
          <div className="cs-notice cs-notice--info"><span>Share purchases are recorded by the chairperson or treasurer after your payment is received. Pay them, then ask them to record it.</span></div>
        )}
        {!loading && !loadError && isOfficial && !cycle && (
          <div className="cs-notice cs-notice--warning"><span>There is no active share cycle yet. Start one first.</span></div>
        )}

        {!loading && isOfficial && cycle && (
          <form className="cs-card" onSubmit={submit}>
            <dl className="cs-kv" style={{ marginBottom: 16 }}>
              <div><dt>Cycle</dt><dd>{cycle.cycle_name}</dd></div>
              <div><dt>Price per share</dt><dd>{formatKES(price)}</dd></div>
              <div><dt>Shares left</dt><dd>{available}</dd></div>
            </dl>
            <div className="cs-field">
              <label className="cs-label" htmlFor="bs-member">Member</label>
              <select id="bs-member" className="cs-select" value={memberId} onChange={(e) => setMemberId(e.target.value)} required>
                <option value="">Choose a member</option>
                {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.first_name} {m.last_name}</option>)}
              </select>
            </div>
            <div className="cs-field">
              <label className="cs-label" htmlFor="bs-shares">Number of shares</label>
              <input id="bs-shares" type="number" min="1" max={available} step="1" inputMode="numeric" className="cs-input" value={shares} onChange={(e) => setShares(e.target.value)} required />
            </div>
            <p className="cs-footnote" aria-live="polite">{total > 0 ? `Total received should be ${formatKES(total)}.` : ""}</p>
            <div className="cs-actions"><Button type="submit" variant="primary" loading={submitting} disabled={!valid}>Record purchase</Button></div>
          </form>
        )}
      </main>
    </div>
  );
}
