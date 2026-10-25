import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import ChamaCard from "../../../components/ChamaCard";
import { chamaAPI } from "../../../services/api";
import { Button, PageHeader, EmptyState, Skeleton } from "../../../components/ui";

const FILTERS = [
  { id: "ALL", label: "All" },
  { id: "ROSCA", label: "Merry-go-round" },
  { id: "ASCA", label: "Investment" },
  { id: "TABLE_BANKING", label: "Table banking" },
  { id: "WELFARE", label: "Welfare" },
];

export default function MyChamas() {
  const [chamas, setChamas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await chamaAPI.getMyChamas();
      setChamas(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chamas.filter((c) => (filter === "ALL" || c.chama_type === filter) && (!q || String(c.chama_name || "").toLowerCase().includes(q)));
  }, [chamas, filter, query]);

  // Only offer filters that match something the member actually has
  const available = useMemo(() => FILTERS.filter((f) => f.id === "ALL" || chamas.some((c) => c.chama_type === f.id)), [chamas]);

  const actions = (
    <>
      <Link to="/join-chama" className="cs-btn cs-btn--secondary">Join with a code</Link>
      <Link to="/chamas/create" className="cs-btn cs-btn--primary">Create a chama</Link>
    </>
  );

  return (
    <div className="cs-shell">
      <main className="cs-page">
        <PageHeader title="My chamas" subtitle="The groups you belong to." actions={actions} />

        {error && (
          <div className="cs-notice cs-notice--danger" role="alert" style={{ marginBottom: 16, alignItems: "center", justifyContent: "space-between" }}>
            <span>We couldn&apos;t load your chamas.</span>
            <Button size="sm" onClick={load}>Try again</Button>
          </div>
        )}

        {loading ? (
          <div className="cs-card cs-card--flush" aria-busy="true" aria-label="Loading your chamas">
            {[0, 1, 2].map((i) => <div key={i} className="cs-list-item"><div style={{ flex: 1 }}><Skeleton height={16} width="45%" /><Skeleton height={12} width="70%" style={{ marginTop: 8 }} /></div></div>)}
          </div>
        ) : chamas.length === 0 && !error ? (
          <div className="cs-card">
            <EmptyState title="You're not in a chama yet" message="Create a group for your members, join one with a code, or browse public chamas."
              action={<div className="cs-actions" style={{ justifyContent: "center" }}>
                <Link to="/chamas/create" className="cs-btn cs-btn--primary">Create a chama</Link>
                <Link to="/browse-chamas" className="cs-btn cs-btn--secondary">Browse chamas</Link>
                <Link to="/my-join-requests" className="cs-btn cs-btn--tertiary">My join requests</Link>
              </div>} />
          </div>
        ) : chamas.length > 0 && (
          <>
            {(available.length > 2 || chamas.length > 8) && (
              <div className="cs-controls">
                {available.length > 2 && (
                  <div className="cs-chips" role="group" aria-label="Filter by type">
                    {available.map((f) => (
                      <button key={f.id} type="button" className="cs-chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>
                    ))}
                  </div>
                )}
                {chamas.length > 8 && (
                  <>
                    <label className="cs-sr-only" htmlFor="chama-search">Search your chamas</label>
                    <input id="chama-search" type="search" className="cs-input" placeholder="Search your chamas" value={query} onChange={(e) => setQuery(e.target.value)} />
                  </>
                )}
              </div>
            )}

            {visible.length === 0 ? (
              <div className="cs-card"><EmptyState title="No matches" message="No chama matches this filter."
                action={<Button onClick={() => { setFilter("ALL"); setQuery(""); }}>Clear filters</Button>} /></div>
            ) : (
              <div className="cs-chama-grid">{visible.map((c) => <ChamaCard key={c.chama_id} c={c} />)}</div>
            )}
            <p className="cs-footnote">{visible.length} of {chamas.length} {chamas.length === 1 ? "chama" : "chamas"}</p>
          </>
        )}
      </main>
    </div>
  );
}
