import { useState, useEffect, createContext, useContext } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check auth status on initial load by hitting the "Me" route
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // The interceptor will handle token refresh if necessary
        const response = await api.get('/auth/me');
        if (response.success) {
          setUser(response.data); // Expecting { id, name, role, ... }
          setIsAuthenticated(true);
        }
      } catch (error) {
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.success) {
      setUser(response.data.user);
      setIsAuthenticated(true);
    }
    return response;
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
