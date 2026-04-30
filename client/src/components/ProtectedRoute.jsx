import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * A wrapper component to protect routes that require authentication and specific roles.
 * 
 * @param {Array<String>} allowedRoles - Roles permitted to access the route (e.g., ['Admin', 'Doctor'])
 */
const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login while saving the attempted url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role-based access control (RBAC)
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // User is authenticated but lacks required role
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />; // Render the child routes
};

export default ProtectedRoute;
