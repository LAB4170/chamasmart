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
import AIBotWidget from "./components/chat/AIBotWidget";
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

import MyGuarantees from "./pages/loans/MyGuarantees";
import MyLoans from "./pages/loans/MyLoans";
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

import LandingPage from "./pages/LandingPage";

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


function AppContent() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();

    return (
        <div className="app">
            <Navbar />
            {isAuthenticated && <AIBotWidget />}
            <ToastContainer position="top-right" autoClose={3000} />
            <ErrorBoundary>
                <Suspense fallback={<LoadingSpinner />}>
                    <AnimatePresence mode="wait">
                        <Routes location={location} key={location.pathname}>
                            <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
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
                                path="/join-chama"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><JoinChama /></PageTransition>
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
                                path="/my-join-requests"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><MyJoinRequests /></PageTransition>
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
                                path="/loans"
                                element={
                                    <ProtectedRoute>
                                        <PageTransition><MyLoans /></PageTransition>
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
