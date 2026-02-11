import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState, useEffect } from "react";
import NotificationBell from "../NotificationBell";


const Navbar = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link to="/" className="navbar-brand">
          <h2>ChamaSmart</h2>
        </Link>

        <div className="navbar-links">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="nav-link">
                Dashboard
              </Link>
              <Link to="/chamas" className="nav-link">
                My Chamas
              </Link>
              <Link to="/browse-chamas" className="nav-link">
                Browse Chamas
              </Link>
              <Link to="/join-chama" className="nav-link">
                Join Chama
              </Link>
              <Link to="/my-guarantees" className="nav-link">
                My Guarantees
              </Link>
              <NotificationBell />
              <button
                onClick={toggleTheme}
                className="btn btn-sm btn-outline"
                style={{ marginRight: '1rem' }}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <div className="navbar-user">
                <Link to="/profile" className="user-name">
                  {user?.firstName} {user?.lastName}
                </Link>
                <button
                  onClick={handleLogout}
                  className="btn btn-sm btn-outline"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">
                Login
              </Link>
              <Link to="/register" className="btn btn-sm btn-primary">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
