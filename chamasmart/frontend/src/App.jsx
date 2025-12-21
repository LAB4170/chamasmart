import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { lazy, Suspense } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import Navbar from "./components/layout/Navbar";

// Lazy load all pages for better performance
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const CreateChama = lazy(() => import("./pages/chama/CreateChama"));
const ChamaDetails = lazy(() => import("./pages/chama/ChamaDetails"));
const RecordContribution = lazy(() => import("./pages/chama/RecordContribution"));
const AddMember = lazy(() => import("./pages/chama/AddMember"));
const MyChamas = lazy(() => import("./pages/chama/MyChamas"));
const InviteManagement = lazy(() => import("./pages/chama/InviteManagement"));
const JoinChama = lazy(() => import("./pages/chama/JoinChama"));
const LoanManagement = lazy(() => import("./pages/chama/LoanManagement"));
const ApplyLoan = lazy(() => import("./pages/chama/ApplyLoan"));
const RepayLoan = lazy(() => import("./pages/chama/RepayLoan"));
const PayoutManagement = lazy(() => import("./pages/chama/PayoutManagement"));
const ProcessPayout = lazy(() => import("./pages/chama/ProcessPayout"));
const BrowseChamas = lazy(() => import("./pages/chama/BrowseChamas"));
const JoinRequests = lazy(() => import("./pages/chama/JoinRequests"));
const MyJoinRequests = lazy(() => import("./pages/chama/MyJoinRequests"));

// Loading component
import LoadingSpinner from "./components/LoadingSpinner";

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
              <h3>Bank-Level Security</h3>
              <p>
                Your financial data is protected with enterprise-grade security.
                Rest assured that your chama's information is safe and secure.
              </p>
              <ul className="feature-list">
                <li>End-to-end encryption</li>
                <li>Secure data storage</li>
                <li>Regular security audits</li>
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

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div className="app">
            <Navbar />
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas"
                  element={
                    <ProtectedRoute>
                      <MyChamas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/create"
                  element={
                    <ProtectedRoute>
                      <CreateChama />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id"
                  element={
                    <ProtectedRoute>
                      <ChamaDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/record-contribution"
                  element={
                    <ProtectedRoute>
                      <RecordContribution />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/add-member"
                  element={
                    <ProtectedRoute>
                      <AddMember />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/invites"
                  element={
                    <ProtectedRoute>
                      <InviteManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/join-chama"
                  element={
                    <ProtectedRoute>
                      <JoinChama />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/loans"
                  element={
                    <ProtectedRoute>
                      <LoanManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/loans/apply"
                  element={
                    <ProtectedRoute>
                      <ApplyLoan />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/loans/:loanId/repay"
                  element={
                    <ProtectedRoute>
                      <RepayLoan />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/payouts"
                  element={
                    <ProtectedRoute>
                      <PayoutManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/payouts/process"
                  element={
                    <ProtectedRoute>
                      <ProcessPayout />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/browse-chamas"
                  element={
                    <ProtectedRoute>
                      <BrowseChamas />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chamas/:id/join-requests"
                  element={
                    <ProtectedRoute>
                      <JoinRequests />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my-join-requests"
                  element={
                    <ProtectedRoute>
                      <MyJoinRequests />
                    </ProtectedRoute>
                  }
                />

                {/* Fallback route */}
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
