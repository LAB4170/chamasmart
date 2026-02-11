import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import Navbar from "./components/layout/Navbar";
import ErrorBoundary from "./components/ErrorBoundary";
import RoleRoute from "./components/auth/RoleRoute";

// Lazy load all pages for better performance
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const VerifyEmailPhone = lazy(() => import("./pages/auth/VerifyEmailPhone"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const CreateChama = lazy(() => import("./pages/chama/core/CreateChama"));
const ChamaDetails = lazy(() => import("./pages/chama/core/ChamaDetails"));
const RecordContribution = lazy(() => import("./pages/chama/core/RecordContribution"));
const ManageChama = lazy(() => import("./pages/chama/core/ManageChama"));
const AddMember = lazy(() => import("./pages/chama/members/AddMember"));
const MyChamas = lazy(() => import("./pages/chama/core/MyChamas"));
const InviteManagement = lazy(() => import("./pages/chama/members/InviteManagement"));
const JoinChama = lazy(() => import("./pages/chama/members/JoinChama"));
const LoanManagement = lazy(() => import("./pages/chama/loans/LoanManagement"));
const ApplyLoan = lazy(() => import("./pages/chama/loans/ApplyLoan"));
const RepayLoan = lazy(() => import("./pages/chama/loans/RepayLoan"));
const PayoutManagement = lazy(() => import("./pages/chama/core/PayoutManagement"));
const ProcessPayout = lazy(() => import("./pages/chama/core/ProcessPayout"));
const BrowseChamas = lazy(() => import("./pages/chama/core/BrowseChamas"));
const JoinRequests = lazy(() => import("./pages/chama/members/JoinRequests"));
const MyJoinRequests = lazy(() => import("./pages/chama/members/MyJoinRequests"));

const MyGuarantees = lazy(() => import("./pages/loans/MyGuarantees"));
const WelfareDashboard = lazy(() => import("./pages/chama/welfare/WelfareDashboard"));
const SubmitClaim = lazy(() => import("./pages/chama/welfare/SubmitClaim"));
const WelfareAdmin = lazy(() => import("./pages/chama/welfare/WelfareAdmin"));
const AuditLogs = lazy(() => import("./pages/chama/core/AuditLogs"));
const SecurityMonitor = lazy(() => import("./pages/dashboard/SecurityMonitor"));
const ApiKeyManagement = lazy(() => import("./pages/dashboard/ApiKeyManagement"));
const UserProfile = lazy(() => import("./pages/user/UserProfile"));
const MeetingList = lazy(() => import("./pages/chama/meetings/MeetingList"));
const CreateMeeting = lazy(() => import("./pages/chama/meetings/CreateMeeting"));
const RoscaDashboard = lazy(() => import("./pages/chama/rosca/RoscaDashboard"));
const CreateCycle = lazy(() => import("./pages/chama/rosca/CreateCycle"));
const RoscaDetails = lazy(() => import("./pages/chama/rosca/RoscaDetails"));
const AscaDashboard = lazy(() => import("./pages/chama/asca/AscaDashboard"));
const BuyShares = lazy(() => import("./pages/chama/asca/BuyShares"));
const InvestmentProposals = lazy(() => import("./pages/chama/asca/InvestmentProposals"));

// Loading component
import LoadingSpinner from "./components/LoadingSpinner";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


// Page Transition Wrapper
const PageTransition = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
};

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Home page component
const Home = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-title">
                Smart Chama Management
                <span className="hero-accent">Made Simple</span>
              </h1>
              <p className="hero-subtitle">
                Transform your savings group with powerful tools for tracking
                contributions, managing members, and organizing meetings. Join
                thousands of successful chamas already using ChamaSmart.
              </p>
              <div className="hero-actions">
                <a href="/register" className="btn btn-primary btn-lg">
                  Start Your Chama
                  <span className="btn-icon">→</span>
                </a>
                <a href="/login" className="btn btn-outline btn-lg">
                  Sign In
                </a>
              </div>
              <div className="hero-stats">
                <div className="stat-item">
                  <div className="stat-number">10K+</div>
                  <div className="stat-label">Active Chamas</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">$2M+</div>
                  <div className="stat-label">Contributions Tracked</div>
                </div>
                <div className="stat-item">
                  <div className="stat-number">50K+</div>
                  <div className="stat-label">Happy Members</div>
                </div>
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-card">
                <div className="card-icon">📊</div>
                <h3>Real-time Analytics</h3>
                <p>Monitor your chama's performance with detailed insights</p>
              </div>
              <div className="hero-card">
                <div className="card-icon">💳</div>
                <h3>Easy Contributions</h3>
                <p>
                  Record payments and track member participation effortlessly
                </p>
              </div>
              <div className="hero-card">
                <div className="card-icon">📅</div>
                <h3>Meeting Management</h3>
                <p>Schedule meetings and track attendance automatically</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="section-header">
            <h2>Everything You Need for Chama Success</h2>
            <p>Powerful features designed specifically for savings groups</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">💰</div>
              <h3>Contribution Tracking</h3>
              <p>
                Easily record and monitor member contributions in real-time. Set
                contribution amounts, track payment history, and generate
                detailed financial reports.
              </p>
              <ul className="feature-list">
                <li>Automated contribution reminders</li>
                <li>Payment history tracking</li>
                <li>Financial reporting</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">👥</div>
              <h3>Member Management</h3>
              <p>
                Add members, assign roles, and track participation. Manage
                permissions and keep everyone informed about chama activities.
              </p>
              <ul className="feature-list">
                <li>Role-based access control</li>
                <li>Member communication tools</li>
                <li>Participation analytics</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Advanced Analytics</h3>
              <p>
                Get insights with detailed financial reports and analytics. Make
                data-driven decisions to grow your chama successfully.
              </p>
              <ul className="feature-list">
                <li>Performance dashboards</li>
                <li>Growth tracking</li>
                <li>Custom reports</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Optimized</h3>
              <p>
                Access your chama data anywhere, anytime. Our responsive design
                works perfectly on all devices.
              </p>
              <ul className="feature-list">
                <li>Responsive design</li>
                <li>Offline capabilities</li>
                <li>Push notifications</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Strong Security Practices</h3>
              <p>
                Your financial data is protected with secure authentication,
                role-based access control, and detailed logging and monitoring.
              </p>
              <ul className="feature-list">
                <li>JWT-based authentication</li>
                <li>Role-based access control</li>
                <li>Sanitized logging and metrics</li>
              </ul>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🤝</div>
              <h3>Community Support</h3>
              <p>
                Join a thriving community of chama leaders. Get support, share
                experiences, and learn from successful chamas.
              </p>
              <ul className="feature-list">
                <li>Community forums</li>
                <li>Expert guidance</li>
                <li>Success stories</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container text-center">
          <h2>Ready to Transform Your Chama?</h2>
          <p>Join thousands of successful chamas already using ChamaSmart</p>
          <div className="cta-actions">
            <a href="/register" className="btn btn-primary btn-xl">
              Get Started Free
              <span className="btn-icon">🚀</span>
            </a>
            <p className="cta-note">
              No credit card required • 14-day free trial
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

function AppContent() {
  const location = useLocation();

  return (
    <div className="app">
      <Navbar />
      <ToastContainer position="top-right" autoClose={3000} />
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageTransition><Home /></PageTransition>} />
              <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
              <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
              <Route path="/verify-account" element={<PageTransition><VerifyEmailPhone /></PageTransition>} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <PageTransition><Dashboard /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chamas"
                element={
                  <ProtectedRoute>
                    <PageTransition><MyChamas /></PageTransition>
                  </ProtectedRoute>
                }
              />
              {/* Other routes wrapped in PageTransition */}
              <Route
                path="/chamas/create"
                element={
                  <ProtectedRoute>
                    <PageTransition><CreateChama /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chamas/:id"
                element={
                  <ProtectedRoute>
                    <PageTransition><ChamaDetails /></PageTransition>
                  </ProtectedRoute>
                }
              />
              {/* ... wrapping a few more key ones ... */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <PageTransition><UserProfile /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/browse-chamas"
                element={
                  <ProtectedRoute>
                    <PageTransition><BrowseChamas /></PageTransition>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <AppContent />
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
