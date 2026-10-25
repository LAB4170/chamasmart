import { Link } from "react-router-dom";
import { Users, Sprout, Repeat, PiggyBank, HeartHandshake, ChevronRight } from "lucide-react";
import { StatusBadge } from "./ui";
import { formatKES } from "../utils/format";

const TYPE_LABELS = { ROSCA: "Merry-go-round", ASCA: "Investment", TABLE_BANKING: "Table banking", WELFARE: "Welfare" };
const typeLabel = (t) => TYPE_LABELS[t] || (t ? String(t).replace(/_/g, " ").toLowerCase() : "Chama");
const FREQ_LABELS = { WEEKLY: "week", MONTHLY: "month", DAILY: "day", BIWEEKLY: "2 weeks", QUARTERLY: "quarter" };

const TYPE_STYLE = {
  ROSCA: { tone: "teal", Icon: Repeat },
  ASCA: { tone: "indigo", Icon: Sprout },
  TABLE_BANKING: { tone: "amber", Icon: PiggyBank },
  WELFARE: { tone: "rose", Icon: HeartHandshake },
};
export default function ChamaCard({ c }) {
  const { tone, Icon } = TYPE_STYLE[String(c.chama_type).toUpperCase()] || { tone: "indigo", Icon: Users };
  const freq = FREQ_LABELS[String(c.contribution_frequency).toUpperCase()];
  const n = Number(c.total_members) || 0;
  const role = c.role ? c.role.charAt(0) + c.role.slice(1).toLowerCase() : "Member";
  return (
    <Link to={`/chamas/${c.chama_id}`} className="cs-card cs-chama">
      <div className="cs-chama-top">
        <span className="cs-chama-icon" data-tone={tone} aria-hidden="true"><Icon size={22} strokeWidth={2} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 className="cs-chama-name">{c.chama_name}</h3>
          <p className="cs-chama-sub">{typeLabel(c.chama_type)} · {role}</p>
        </div>
        <ChevronRight size={18} className="cs-chevron" aria-hidden="true" />
      </div>
      <div className="cs-chama-fund">
        <div>
          <span className="cs-chama-fund-label">Group fund</span>
          <span className="cs-chama-fund-amount">{formatKES(c.current_fund, { whole: true })}</span>
        </div>
        <StatusBadge status="ACTIVE" label={c.contribution_amount ? `${formatKES(c.contribution_amount, { whole: true })}${freq ? ` / ${freq}` : ""}` : "Active"} />
      </div>
      <div className="cs-chama-foot">
        <span className="cs-chama-members"><Users size={15} aria-hidden="true" />{n} member{n === 1 ? "" : "s"}</span>
        <span className="cs-chama-open">Open</span>
      </div>
    </Link>
  );
}

