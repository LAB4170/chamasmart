import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState, useEffect, useRef } from "react";
import NotificationBell from "../NotificationBell";
import {
  LayoutDashboard,
  Users,
  Search,
  Shield,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import "./Navbar.css";

const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [navigate]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar-redesigned">
      <div className="navbar-inner">
        {/* Brand */}
        <Link to="/" className="navbar-brand-new">
          <div className="brand-logo">CS</div>
          <span className="brand-text">ChamaSmart</span>
        </Link>

        {/* Desktop Nav Links */}
        {isAuthenticated && (
          <div className={`navbar-nav ${mobileOpen ? "nav-open" : ""}`}>
            <NavLink to="/dashboard" className="navbar-nav-link" onClick={() => setMobileOpen(false)}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink to="/chamas" className="navbar-nav-link" onClick={() => setMobileOpen(false)}>
              <Users size={18} />
              <span>My Chamas</span>
            </NavLink>
            <NavLink to="/browse-chamas" className="navbar-nav-link" onClick={() => setMobileOpen(false)}>
              <Search size={18} />
              <span>Browse</span>
            </NavLink>
            <NavLink to="/my-guarantees" className="navbar-nav-link" onClick={() => setMobileOpen(false)}>
              <Shield size={18} />
              <span>Guarantees</span>
            </NavLink>
          </div>
        )}

        {/* Right side */}
        <div className="navbar-actions">
          {/* Theme Toggle */}
          <button
            className="theme-toggle-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            aria-label="Toggle theme"
          >
            <div className="theme-toggle-track">
              <Sun size={14} className="theme-icon sun-icon" />
              <Moon size={14} className="theme-icon moon-icon" />
              <div className={`theme-toggle-thumb ${theme === "dark" ? "dark" : ""}`} />
            </div>
          </button>

          {isAuthenticated ? (
            <>
              <NotificationBell />

              {/* Profile Dropdown */}
              <div className="profile-dropdown" ref={profileRef}>
                <button
                  className="profile-trigger"
                  onClick={() => setProfileOpen(!profileOpen)}
                >
                  <div className="profile-avatar">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </div>
                  <span className="profile-name">
                    {user?.firstName}
                  </span>
                  <ChevronDown size={16} className={`chevron ${profileOpen ? "open" : ""}`} />
                </button>

                {profileOpen && (
                  <div className="profile-menu">
                    <div className="profile-menu-header">
                      <div className="profile-avatar-lg">
                        {user?.firstName?.[0]}{user?.lastName?.[0]}
                      </div>
                      <div>
                        <div className="profile-fullname">{user?.firstName} {user?.lastName}</div>
                        <div className="profile-email">{user?.email}</div>
                      </div>
                    </div>
                    <div className="profile-menu-divider" />
                    <Link to="/profile" className="profile-menu-item" onClick={() => setProfileOpen(false)}>
                      <User size={16} />
                      <span>My Profile</span>
                    </Link>
                    <button className="profile-menu-item danger" onClick={handleLogout}>
                      <LogOut size={16} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </>
          ) : (
            <div className="auth-actions">
              <Link to="/login" className="btn-nav-login">Sign In</Link>
              <Link to="/register" className="btn-nav-register">Get Started</Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
    </nav>
  );
};

export default Navbar;
