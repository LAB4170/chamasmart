import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useEffect, useState } from "react";
import { chamaAPI } from "../../services/api";

const RoleRoute = ({ allowedRoles = [], children }) => {
  const { id: chamaId } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchUserRole = async () => {
      // If no chamaId, we can't check chama-specific roles here
      if (!isAuthenticated || !chamaId) {
        setLoading(false);
        return;
      }

      try {
        // Optimized: In a real app, we'd have a specific /chamas/:id/role endpoint
        // For now, we still fetch chamas but with a local cache check could be added
        const response = await chamaAPI.getMyChamas();
        const chama = response.data.data.find(
          (c) => c.chama_id === parseInt(chamaId)
        );

        if (isMounted) {
          if (chama) {
            setUserRole(chama.role?.toLowerCase());
          }
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        if (isMounted) setLoading(false);
      }
    };

    fetchUserRole();
    return () => { isMounted = false; };
  }, [isAuthenticated, chamaId]);

  // Show loading state while checking role
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Verifying permissions...</p>
      </div>
    );
  }

  // Check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If no specific roles required, just check authentication
  if (allowedRoles.length === 0) {
    return children;
  }

  // Check if user has required role
  const hasRequiredRole = allowedRoles.some(
    (role) => userRole === role.toLowerCase()
  );

  if (!hasRequiredRole) {
    return (
      <div className="page">
        <div className="container">
          <div className="card text-center">
            <h2>🔒 Access Denied</h2>
            <p className="text-muted">
              You don't have permission to access this page.
            </p>
            <p className="text-muted">
              Required role: <strong>{allowedRoles.join(" or ")}</strong>
            </p>
            <p className="text-muted">
              Your role: <strong>{userRole || "member"}</strong>
            </p>
            <button
              onClick={() => window.history.back()}
              className="btn btn-primary mt-3"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default RoleRoute;
