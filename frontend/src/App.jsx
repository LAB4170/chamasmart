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
import {
    ArrowRight, TrendingUp, Users, BarChart3, Shield, Wallet, RefreshCw,
    PiggyBank, HeartHandshake, Landmark, CheckCircle, Zap, Clock, Globe
} from "lucide-react";

// Lazy load all pages for better performance
const Login = lazy(() => import("./pages/auth/Login"));
const Register = lazy(() => import("./pages/auth/Register"));
const VerifyEmailPhone = lazy(() => import("./pages/auth/VerifyEmailPhone"));
const CompleteProfile = lazy(() => import("./pages/auth/CompleteProfile"));
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const CreateChama = lazy(() => import("./pages/chama/core/CreateChama"));
const ChamaDetails = lazy(() => import("./pages/chama/core/ChamaDetails"));
const RecordContribution = lazy(() => import("./pages/chama/core/RecordContribution"));
const SubmitContribution = lazy(() => import("./pages/chama/core/SubmitContribution"));
const BulkRecordContribution = lazy(() => import("./pages/chama/core/BulkRecordContribution"));
const ManageChama = lazy(() => import("./pages/chama/core/ManageChama"));
const AddMember = lazy(() => import("./pages/chama/members/AddMember"));
const MyChamas = lazy(() => import("./pages/chama/core/MyChamas"));
const InviteManagement = lazy(() => import("./pages/chama/members/InviteManagement"));
const JoinChama = lazy(() => import("./pages/chama/members/JoinChama"));
const LoanManagement = lazy(() => import("./pages/chama/loans/LoanManagement"));
const ApplyLoan = lazy(() => import("./pages/chama/loans/LoanApplicationWizard"));
const RepayLoan = lazy(() => import("./pages/chama/loans/RepayLoan"));
const PayoutManagement = lazy(() => import("./pages/chama/core/PayoutManagement"));
const ProcessPayout = lazy(() => import("./pages/chama/core/ProcessPayout"));
const BrowseChamas = lazy(() => import("./pages/chama/core/BrowseChamas"));
const JoinRequests = lazy(() => import("./pages/chama/members/JoinRequests"));
const MyJoinRequests = lazy(() => import("./pages/chama/members/MyJoinRequests"));
const ApplyChama = lazy(() => import("./pages/chama/members/ApplyChama"));

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
const MeetingDetails = lazy(() => import("./pages/chama/meetings/MeetingDetails"));
const MeetingMinutesHUD = lazy(() => import("./pages/chama/meetings/MeetingMinutesHUD"));
const RoscaDashboard = lazy(() => import("./pages/chama/rosca/RoscaDashboard"));
const CreateCycle = lazy(() => import("./pages/chama/rosca/CreateCycle"));
const RoscaDetails = lazy(() => import("./pages/chama/rosca/RoscaDetails"));
const AscaDashboard = lazy(() => import("./pages/chama/asca/AscaDashboard"));
const BuyShares = lazy(() => import("./pages/chama/asca/BuyShares"));
const InvestmentProposals = lazy(() => import("./pages/chama/asca/InvestmentProposals"));

const TableSessionDashboard = lazy(() => import("./pages/chama/meetings/TableSessionDashboard"));

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



    const chamaTypes = [
        {
            id: "rosca",
            name: "ROSCA",
            subtitle: "Merry-Go-Round",
            description: "Members contribute equally and take turns receiving the full pot. Perfect for rotating savings circles where each member gets a lump sum.",
            icon: <RefreshCw size={28} />,
            color: "#3b82f6",
            gradient: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
            features: ["Automated rotation scheduling", "Contribution tracking per round", "Fair turn allocation"]
        },
        {
            id: "asca",
            name: "ASCA",
            subtitle: "Investment & Lending",
            description: "Accumulating Savings & Credit Association. Pool savings, invest collectively, and lend to members with interest that grows the pool.",
            icon: <TrendingUp size={28} />,
            color: "#22c55e",
            gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
            features: ["Share-based equity tracking", "Investment proposals & voting", "Internal lending with interest"]
        },
        {
            id: "table_banking",
            name: "Table Banking",
            subtitle: "Instant Group Banking",
            description: "Bring money to the table, lend it out during meetings, and earn interest. Transparent, immediate, and managed collectively.",
            icon: <Landmark size={28} />,
            color: "#f59e0b",
            gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
            features: ["Real-time loan disbursement", "Meeting-based transactions", "Interest income distribution"]
        },
        {
            id: "welfare",
            name: "Welfare",
            subtitle: "Emergency & Support",
            description: "Benevolent fund for emergencies — bereavements, medical bills, accidents. Members contribute regularly to support each other when it matters most.",
            icon: <HeartHandshake size={28} />,
            color: "#8b5cf6",
            gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            features: ["Configurable event categories", "Claims & verification workflow", "Fund health monitoring"]
        },
    ];

    return (
        <div className="home-page">
            {/* Hero Section */}
            <section className="hero-section-redesign">
                <div className="hero-bg-pattern" />
                <div className="container">
                    <div className="hero-content-redesign">
                        <div className="hero-badge">
                            <Zap size={14} />
                            <span>Built for Kenyan Savings Groups</span>
                        </div>
                        <h1 className="hero-title-redesign">
                            Manage Your Chama
                            <span className="hero-gradient-text"> With Confidence</span>
                        </h1>
                        <p className="hero-subtitle-redesign">
                            The all-in-one platform for ROSCA, ASCA, Table Banking, and Welfare
                            chamas. Track contributions, manage loans, automate rotations, and
                            keep every shilling accounted for.
                        </p>
                        <div className="hero-actions-redesign">
                            <a href="/register" className="btn-hero-primary">
                                <span>Start Your Chama</span>
                                <ArrowRight size={18} />
                            </a>
                            <a href="/login" className="btn-hero-secondary">
                                Sign In
                            </a>
                        </div>
                        <div className="hero-trust-row">
                            <div className="trust-item">
                                <CheckCircle size={16} className="trust-icon" />
                                <span>Free to use</span>
                            </div>
                            <div className="trust-item">
                                <Shield size={16} className="trust-icon" />
                                <span>Bank-grade security</span>
                            </div>
                            <div className="trust-item">
                                <Clock size={16} className="trust-icon" />
                                <span>Set up in 2 minutes</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4 Chama Types Section */}
            <section className="chama-types-section">
                <div className="container">
                    <div className="section-header-redesign">
                        <span className="section-label">Chama Models</span>
                        <h2>One Platform, Four Chama Types</h2>
                        <p>Whether you run a merry-go-round or a welfare fund, ChamaSmart handles the complexity so you can focus on growing together.</p>
                    </div>

                    <div className="chama-types-grid">
                        {chamaTypes.map((type) => (
                            <div key={type.id} className="chama-type-card">
                                <div className="chama-type-icon" style={{ background: type.gradient }}>
                                    {type.icon}
                                </div>
                                <div className="chama-type-header">
                                    <h3>{type.name}</h3>
                                    <span className="chama-type-subtitle">{type.subtitle}</span>
                                </div>
                                <p className="chama-type-description">{type.description}</p>
                                <ul className="chama-type-features">
                                    {type.features.map((feat, i) => (
                                        <li key={i}>
                                            <CheckCircle size={14} style={{ color: type.color }} />
                                            <span>{feat}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features-section-redesign">
                <div className="container">
                    <div className="section-header-redesign">
                        <span className="section-label">Features</span>
                        <h2>Everything You Need to Run a Successful Chama</h2>
                        <p>Powerful tools designed specifically for Kenyan savings groups</p>
                    </div>

                    <div className="features-grid-redesign">
                        <div className="feature-card-redesign">
                            <div className="feature-icon-redesign green">
                                <Wallet size={24} />
                            </div>
                            <h3>Contribution Tracking</h3>
                            <p>Record and monitor member contributions in real-time. Track payment history and generate detailed financial reports.</p>
                        </div>

                        <div className="feature-card-redesign">
                            <div className="feature-icon-redesign blue">
                                <Users size={24} />
                            </div>
                            <h3>Member Management</h3>
                            <p>Add members, assign roles (Chairperson, Treasurer, Secretary), and manage invites with role-based access control.</p>
                        </div>

                        <div className="feature-card-redesign">
                            <div className="feature-icon-redesign purple">
                                <BarChart3 size={24} />
                            </div>
                            <h3>Financial Reports</h3>
                            <p>Visual dashboards with contribution trends, loan statuses, and fund balances. Export reports as PDF or Excel.</p>
                        </div>

                        <div className="feature-card-redesign">
                            <div className="feature-icon-redesign amber">
                                <PiggyBank size={24} />
                            </div>
                            <h3>Loan Management</h3>
                            <p>Apply for loans, track repayments, manage guarantors, and automate interest calculations with amortization schedules.</p>
                        </div>

                        <div className="feature-card-redesign">
                            <div className="feature-icon-redesign red">
                                <Shield size={24} />
                            </div>
                            <h3>Security & Audit</h3>
                            <p>JWT authentication, role-based permissions, comprehensive audit logs, and API security monitoring.</p>
                        </div>

                        <div className="feature-card-redesign">
                            <div className="feature-icon-redesign teal">
                                <Globe size={24} />
                            </div>
                            <h3>Browse & Join</h3>
                            <p>Discover public chamas, send join requests, and get matched with groups that align with your savings goals.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="cta-section-redesign">
                <div className="container">
                    <div className="cta-content-redesign">
                        <h2>Ready to Transform Your Chama?</h2>
                        <p>Join ChamaSmart and bring transparency, accountability, and growth to your savings group.</p>
                        <a href="/register" className="btn-hero-primary cta-btn">
                            <span>Create Your Chama Now</span>
                            <ArrowRight size={18} />
                        </a>
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
                            <Route path="/complete-profile" element={
                                <ProtectedRoute>
                                    <PageTransition><CompleteProfile /></PageTransition>
                                </ProtectedRoute>
                            } />
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
                            <Route
                                path="/chamas/:id/meetings"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><MeetingList /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/meetings/create"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><CreateMeeting /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/meetings/:meetingId"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><MeetingDetails /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/meetings/:meetingId/session"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><TableSessionDashboard /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/invites"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><InviteManagement /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/rosca"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><RoscaDashboard /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/rosca/create-cycle"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><CreateCycle /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/rosca/:cycleId"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><RoscaDetails /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/asca"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><AscaDashboard /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/asca/buy-shares"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><BuyShares /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/asca/proposals"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><InvestmentProposals /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/loans"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><LoanManagement /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/loans/apply"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><ApplyLoan /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/loans/:loanId/repay"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><RepayLoan /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/welfare"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><WelfareDashboard /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/welfare/submit-claim"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><SubmitClaim /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/welfare/admin"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><WelfareAdmin /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/manage"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><ManageChama /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/submit-contribution"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><SubmitContribution /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/record-contribution"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><RecordContribution /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/bulk-record"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><BulkRecordContribution /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/add-member"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><AddMember /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/payouts"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><PayoutManagement /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/payouts/process"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><ProcessPayout /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/join-requests"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><JoinRequests /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/apply"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><ApplyChama /></PageTransition>
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="/chamas/:id/audit-logs"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><AuditLogs /></PageTransition>
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
                                path="/my-guarantees"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><MyGuarantees /></PageTransition>
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
                            <Route
                                path="/join-chama"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><JoinChama /></PageTransition>
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
