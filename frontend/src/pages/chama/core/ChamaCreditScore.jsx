import { useState, useEffect, useCallback } from "react";
import { scoreAPI } from "../../../services/utils.service";
import { Button, StatusBadge, Skeleton } from "../../../components/ui";
import { formatDateTime } from "../../../utils/format";

const TIERS = {
  EXCELLENT: { label: "Excellent", status: "COMPLETED" },
  GOOD: { label: "Good", status: "DISBURSED" },
  FAIR: { label: "Fair", status: "PENDING" },
  AT_RISK: { label: "At risk", status: "DEFAULTED" },
};

/** An indicative health score worked out from savings, loan repayments and meetings held. Members only. */
export default function ChamaCreditScore({ chamaId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await scoreAPI.getScore(chamaId);
      setData(res.data?.data ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [chamaId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <section className="cs-card" aria-busy="true" aria-label="Loading health score"><Skeleton height={20} width="40%" /><Skeleton height={48} style={{ marginTop: 12 }} /></section>;
  if (failed) return (
    <section className="cs-card" aria-label="Chama health score">
      <h2 className="cs-card-title">Chama health score</h2>
      <p className="cs-help">We couldn&apos;t work out the score right now.</p>
      <Button size="sm" onClick={load}>Try again</Button>
    </section>
  );
  if (!data) return null;

  const tier = TIERS[data.tier] || TIERS.FAIR;
  const dims = Object.values(data.breakdown || {});

  return (
    <section className="cs-card" aria-label="Chama health score">
      <header className="cs-loan-head">
        <div className="cs-list-main">
          <h2 className="cs-card-title" style={{ marginBottom: 0 }}>Chama health score</h2>
          <div className="cs-list-meta">Indicative only · updated {formatDateTime(data.computedAt)}</div>
        </div>
        <StatusBadge status={tier.status} label={tier.label} />
      </header>
      <p style={{ fontSize: "2.25rem", fontWeight: 700, margin: "8px 0" }} aria-label={`Score ${data.compositeScore} out of 100`}>{data.compositeScore}<span className="cs-list-meta"> / 100</span></p>
      <dl className="cs-kv">
        {dims.map((d) => (
          <div key={d.label}><dt>{d.label} ({Math.round(d.weight * 100)}%)</dt><dd>{d.score}%</dd></div>
        ))}
      </dl>
    </section>
  );
}
