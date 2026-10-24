import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { chamaAPI, joinRequestAPI } from "../../../services/api";
import { useAuth } from "../../../context/AuthContext";
import { Button, PageHeader, StatusBadge, EmptyState, Skeleton } from "../../../components/ui";
import { formatKES } from "../../../utils/format";

const TYPES = [
  { id: "", label: "All" },
  { id: "ROSCA", label: "Merry-go-round" },
  { id: "ASCA", label: "Investment" },
  { id: "TABLE_BANKING", label: "Table banking" },
  { id: "WELFARE", label: "Welfare" },
];
const TYPE_LABEL = Object.fromEntries(TYPES.filter((t) => t.id).map((t) => [t.id, t.label]));
const FREQ = { WEEKLY: "week", BIWEEKLY: "2 weeks", MONTHLY: "month", QUARTERLY: "quarter", ANNUALLY: "year" };

export default function BrowseChamas() {
  const { user } = useAuth();
  const [chamas, setChamas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [chamaType, setChamaType] = useState("");
  const [pending, setPending] = useState(new Set());
  const [joined, setJoined] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (chamaType) params.chamaType = chamaType;
      const [pub, reqs, mine] = await Promise.all([
        chamaAPI.getPublicChamas(params),
        user ? joinRequestAPI.getMyRequests() : Promise.resolve(null),
        user ? chamaAPI.getMyChamas() : Promise.resolve(null),
      ]);
      const list = pub.data?.data;
      setChamas(Array.isArray(list) ? list : []);
      const r = reqs?.data?.data;
      setPending(new Set((Array.isArray(r) ? r : []).filter((x) => x.status === "PENDING").map((x) => String(x.chama_id))));
      const m = mine?.data?.data;
      setJoined(new Set((Array.isArray(m) ? m : []).map((c) => String(c.chama_id))));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [search, chamaType, user]);

  useEffect(() => {
    const t = setTimeout(load, 350);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader
          title="Find a chama"
          subtitle="Public savings groups you can ask to join."
          actions={(
            <>
              <Link to="/my-join-requests" className="cs-btn cs-btn--secondary">My requests</Link>
              <Link to="/chamas/create" className="cs-btn cs-btn--primary">Start a chama</Link>
            </>
          )}
        />

        <div className="cs-field">
          <label className="cs-label" htmlFor="chama-search">Search</label>
          <input id="chama-search" type="search" className="cs-input" placeholder="Name or description" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="cs-chips" role="group" aria-label="Filter by type" style={{ marginBottom: 16 }}>
          {TYPES.map((t) => (
            <button key={t.id || "all"} type="button" className="cs-chip" aria-pressed={chamaType === t.id} onClick={() => setChamaType(t.id)}>{t.label}</button>
          ))}
        </div>

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load public chamas.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-grid" aria-busy="true" aria-label="Loading chamas">
            {[0, 1, 2].map((i) => <div key={i} className="cs-card"><Skeleton height={14} width="50%" /><Skeleton height={30} style={{ marginTop: 12 }} /></div>)}
          </div>
        ) : !error && (chamas.length === 0 ? (
          <div className="cs-card"><EmptyState title="No chamas found" message="Try a different search or filter." /></div>
        ) : (
          <section aria-label="Public chamas">
            <div className="cs-loan-grid">
              {chamas.map((c) => {
                const key = String(c.chama_id);
                const isMember = joined.has(key);
                const isPending = pending.has(key);
                return (
                  <article key={c.chama_id} className="cs-card cs-loan">
                    <header className="cs-loan-head">
                      <div className="cs-list-main">
                        <h3 className="cs-loan-title">{c.chama_name}</h3>
                        <div className="cs-list-meta">{TYPE_LABEL[c.chama_type] || c.chama_type}</div>
                      </div>
                      {isMember && <StatusBadge status="ACTIVE" label="You're a member" />}
                      {!isMember && isPending && <StatusBadge status="PENDING" label="Request sent" />}
                    </header>
                    {c.description && <p className="cs-list-meta" style={{ margin: 0 }}>{c.description}</p>}
                    <dl className="cs-kv">
                      <div><dt>Contribution</dt><dd>{formatKES(c.contribution_amount)} / {FREQ[c.contribution_frequency] || (c.contribution_frequency || "").toLowerCase()}</dd></div>
                      <div><dt>Members</dt><dd>{c.total_members ?? 0}</dd></div>
                    </dl>
                    <footer className="cs-actions">
                      {isMember ? (
                        <Link to={`/chamas/${c.chama_id}`} className="cs-btn cs-btn--primary cs-btn--sm">Open</Link>
                      ) : isPending ? (
                        <Link to="/my-join-requests" className="cs-btn cs-btn--secondary cs-btn--sm">View request</Link>
                      ) : (
                        <Link to={`/chamas/${c.chama_id}/apply`} className="cs-btn cs-btn--primary cs-btn--sm">Request to join</Link>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
            <p className="cs-footnote">{chamas.length} {chamas.length === 1 ? "chama" : "chamas"}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
