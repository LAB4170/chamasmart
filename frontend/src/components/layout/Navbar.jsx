import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { LayoutDashboard, Users, Search, Shield, Sun, Moon, LogOut, User, Banknote, Bell, ChevronDown, CircleUser } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import NotificationBell from "../NotificationBell";
import "./Navbar.css";

// Desktop top navigation (≥ 769px)
const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/chamas", label: "My chamas", Icon: Users },
  { to: "/portfolio", label: "Portfolio", Icon: LayoutDashboard },
  { to: "/loans", label: "Loans", Icon: Banknote },
  { to: "/my-guarantees", label: "Guarantees", Icon: Shield },
  { to: "/browse-chamas", label: "Browse chamas", Icon: Search },
];

// Phone bottom tab bar (≤ 768px): the four everyday destinations plus Account
const TAB_ITEMS = [
  { to: "/dashboard", label: "Home", Icon: LayoutDashboard },
  { to: "/chamas", label: "Chamas", Icon: Users },
  { to: "/loans", label: "Loans", Icon: Banknote },
  { to: "/browse-chamas", label: "Discover", Icon: Search },
];

const readTheme = () => {
  try { return localStorage.getItem("theme") || "light"; } catch { return "light"; }
};

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(readTheme);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch { /* storage unavailable */ }
  }, [theme]);

  // Reserve room for the bottom tab bar on phones only while signed in
  useEffect(() => {
    document.body.classList.toggle("cs-has-tabbar", Boolean(isAuthenticated));
    return () => document.body.classList.remove("cs-has-tabbar");
  }, [isAuthenticated]);

  // Close the account menu whenever the page changes (state reset during render, not in an effect)
  const [lastPath, setLastPath] = useState(location.pathname);
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname);
    setProfileOpen(false);
  }

  // Close on outside tap or Escape
  useEffect(() => {
    const onPointer = (e) => {
      if (e.target.closest?.("[data-account-toggle]")) return;
      if (menuRef.current && !menuRef.current.contains(e.target)) setProfileOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setProfileOpen(false); };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
  }, []);

  const handleLogout = () => { logout(); navigate("/"); };
  const initials = `${user?.firstName?.[0] || ""}${user?.lastName?.[0] || ""}` || "?";
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");

  return (
    <>
      <header className="cs-nav">
        <div className="cs-nav-inner">
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="cs-nav-brand" aria-label="ChamaSmart home">
            <span className="cs-nav-logo" aria-hidden="true">CS</span>
            <span className="cs-nav-brand-text">ChamaSmart</span>
          </Link>

          {isAuthenticated && (
            <nav aria-label="Main" className="cs-nav-links">
              {(user?.role === "ADMIN" ? [{ to: "/admin", label: "Admin console", Icon: Shield }, ...NAV_ITEMS.filter((i) => ["/dashboard", "/chamas", "/loans", "/browse-chamas"].includes(i.to))] : NAV_ITEMS).map((item) => {
                const Icon = item.Icon;
                return (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => `cs-nav-link${isActive ? " is-active" : ""}`}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          )}

          <div className="cs-nav-actions">
            <button type="button" className="cs-icon-btn" onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
                    aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}>
              {theme === "light" ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
            </button>

            {isAuthenticated ? (
              <>
                <NotificationBell />
                <div className="cs-profile">
                  <button type="button" className="cs-profile-trigger" data-account-toggle aria-haspopup="menu" aria-expanded={profileOpen}
                          aria-label="Account menu" onClick={() => setProfileOpen((o) => !o)}>
                    <span className="cs-avatar" aria-hidden="true">{initials}</span>
                    <span className="cs-profile-name">{user?.firstName}</span>
                    <ChevronDown size={16} aria-hidden="true" className={profileOpen ? "is-open" : ""} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" className="cs-btn cs-btn--tertiary cs-btn--sm">Sign in</Link>
                <Link to="/register" className="cs-btn cs-btn--primary cs-btn--sm cs-nav-cta">Get started</Link>
              </>
            )}
          </div>
        </div>
      </header>

      {profileOpen && (
      <div className="cs-menu" role="menu" ref={menuRef}>
        <span className="cs-menu-grabber" aria-hidden="true" />
        <div className="cs-menu-head">
          <span className="cs-avatar cs-avatar--lg" aria-hidden="true">{initials}</span>
          <div>
            <div className="cs-menu-name">{fullName}</div>
            <div className="cs-menu-email">{user?.email}</div>
          </div>
        </div>
        <div className="cs-menu-group">
          <Link to="/profile" role="menuitem" className="cs-menu-item"><User size={18} aria-hidden="true" />My profile</Link>
          <Link to="/my-guarantees" role="menuitem" className="cs-menu-item cs-only-mobile"><Shield size={18} aria-hidden="true" />My guarantees</Link>
          <Link to="/my-join-requests" role="menuitem" className="cs-menu-item"><Bell size={18} aria-hidden="true" />My join requests</Link>
          {user?.role === "ADMIN" && <Link to="/admin" role="menuitem" className="cs-menu-item"><Shield size={18} aria-hidden="true" />Admin console</Link>}
        </div>
        <div className="cs-menu-group">
          <button type="button" role="menuitem" className="cs-menu-item is-danger" onClick={handleLogout}><LogOut size={18} aria-hidden="true" />Sign out</button>
        </div>
      </div>
    )}

      {isAuthenticated && profileOpen && <button type="button" className="cs-sheet-scrim" aria-label="Close menu" onClick={() => setProfileOpen(false)} />}

      {isAuthenticated && (
        <nav className="cs-tabbar" aria-label="Main">
          {(user?.role === "ADMIN" ? [{ to: "/admin", label: "Admin", Icon: Shield }, ...TAB_ITEMS.slice(0, 3)] : TAB_ITEMS).map((item) => {
            const Icon = item.Icon;
            return (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `cs-tab${isActive ? " is-active" : ""}`}>
                <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <button type="button" data-account-toggle className={`cs-tab${profileOpen ? " is-active" : ""}`} aria-haspopup="menu" aria-expanded={profileOpen}
                  onClick={() => setProfileOpen((o) => !o)}>
            <CircleUser size={24} strokeWidth={1.75} aria-hidden="true" />
            <span>Account</span>
          </button>
        </nav>
      )}
    </>
  );
}
