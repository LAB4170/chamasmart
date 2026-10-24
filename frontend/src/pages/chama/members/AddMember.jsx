import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { userAPI, memberAPI, chamaAPI } from "../../../services/api";
import { Button, PageHeader } from "../../../components/ui";

export default function AddMember() {
  const { id } = useParams();
  const [chama, setChama] = useState(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [role, setRole] = useState("MEMBER");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    chamaAPI.getById(id).then((r) => setChama(r.data?.data || null)).catch(() => {});
  }, [id]);

  const isChair = (chama?.role || "").toUpperCase() === "CHAIRPERSON";

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setFound(null);
    setNotFound(false);
    try {
      const res = await userAPI.search(query.trim());
      const list = res.data?.data;
      const first = Array.isArray(list) ? list[0] : null;
      if (first) setFound(first); else setNotFound(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't search right now.");
    } finally {
      setSearching(false);
    }
  };

  // Confirmation comes from the server; the form clears only after it succeeds.
  const add = async () => {
    setAdding(true);
    try {
      await memberAPI.add(id, { userId: found.user_id, role });
      toast.success(`${found.first_name} was added to the chama.`);
      setFound(null);
      setQuery("");
      setRole("MEMBER");
    } catch (err) {
      toast.error(err.response?.data?.message || "We couldn't add this person.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="cs-shell">
      <main className="cs-page cs-page--narrow">
        <PageHeader
          title="Add a member"
          subtitle={chama ? `Add someone who already has a ChamaSmart account to ${chama.chama_name}.` : "Add someone who already has a ChamaSmart account."}
          actions={<Link to={`/chamas/${id}`} className="cs-btn cs-btn--secondary">Back to chama</Link>}
        />

        <form className="cs-card" onSubmit={search} style={{ marginBottom: 16 }}>
          <div className="cs-field">
            <label className="cs-label" htmlFor="am-query">Their full email or phone number</label>
            <input id="am-query" className="cs-input" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" inputMode="email" />
          </div>
          <div className="cs-actions"><Button type="submit" variant="primary" loading={searching}>Find person</Button></div>
        </form>

        {notFound && (
          <div className="cs-notice cs-notice--info" role="status" style={{ marginBottom: 16 }}>
            <span>No account matches that. Ask them to sign up, or <Link to={`/chamas/${id}/invites`}>create an invitation code</Link> for them.</span>
          </div>
        )}

        {found && (
          <section className="cs-card" aria-label="Person found">
            <h2 className="cs-card-title">{found.first_name} {found.last_name}</h2>
            <p className="cs-list-meta">{found.email}</p>
            <div className="cs-field">
              <label className="cs-label" htmlFor="am-role">Role</label>
              <select id="am-role" className="cs-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="MEMBER">Member</option>
                {isChair && <option value="TREASURER">Treasurer</option>}
                {isChair && <option value="SECRETARY">Secretary</option>}
              </select>
            </div>
            <div className="cs-actions"><Button variant="primary" loading={adding} onClick={add}>Add to chama</Button></div>
          </section>
        )}

        <p className="cs-footnote">Prefer to let them accept? <Link to={`/chamas/${id}/invites`}>Create an invitation</Link>.</p>
      </main>
    </div>
  );
}
