import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

/**
 * Mock representation of an Auth Context or Redux store hook.
 * In a real application, replace this with your actual authentication hook 
 * (e.g. `const { user, isAuthenticated } = useAuth()`).
 */
const useAuth = () => {
  // Example dummy state. Replace with context/store reading.
  const authState = {
    isAuthenticated: true, // Replace with token validation
    user: {
      role: 'Pharmacist' // Replace with actual decoded JWT role
    }
  };
  return authState;
};

interface RequireAuthProps {
  allowedRoles?: string[];
}

/**
 * High-Order Component (Wrapper) to protect routes based on Roles.
 * Redirects unauthenticated users to `/login`.
 * Redirects authenticated but unauthorized users to an `/unauthorized` or `/` page.
 */
const RequireAuth: React.FC<RequireAuthProps> = ({ allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // User is not logged in
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user?.role) {
    // Check if the user's role is in the allowed string array
    const hasRequiredRole = allowedRoles.some(
      (role) => role.toLowerCase() === user.role.toLowerCase()
    );

    if (!hasRequiredRole) {
      // User is logged in but doesn't have the appropriate role
      return <Navigate to="/unauthorized" replace />;
    }
  }

  // All checks pass - render the child routes
  return <Outlet />;
};

export default RequireAuth;
