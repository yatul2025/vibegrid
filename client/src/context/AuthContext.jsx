/**
 * client/src/context/AuthContext.jsx
 * ==================================
 * Global Authentication Context & Provider
 * 
 * Why Context API?
 * Context lets any component in our React tree access the current logged-in user,
 * trigger login/logout, and check authentication status without passing props down manually.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('vibegrid_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    return !localStorage.getItem('vibegrid_user');
  });
  const [error, setError] = useState(null);

  // Check if user has an active session on initial page load (via HTTP-Only cookie)
  const checkAuth = async () => {
    try {
      // Only set loading true if we don't already have a cached user
      if (!user) setLoading(true);
      const res = await apiClient.get('/auth/me');
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('vibegrid_user', JSON.stringify(res.data.user));
        } catch {}
      } else {
        setUser(null);
        localStorage.removeItem('vibegrid_user');
      }
    } catch (err) {
      // Not logged in or expired cookie
      setUser(null);
      localStorage.removeItem('vibegrid_user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Listen for 401 Unauthorized broadcasts across the app to prevent stale state
    const handleSessionExpired = () => {
      setUser(null);
      try {
        localStorage.removeItem('vibegrid_user');
        sessionStorage.removeItem('vibegrid_active_tab');
        sessionStorage.removeItem('vibegrid_viewed_username');
      } catch {}
    };

    window.addEventListener('vibegrid:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('vibegrid:session-expired', handleSessionExpired);
    };
  }, []);

  // Login handler
  const login = async (identifier, password, isDemoAccess = false) => {
    setError(null);
    try {
      const res = await apiClient.post('/auth/login', { identifier, password, isDemoAccess });
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('vibegrid_user', JSON.stringify(res.data.user));
        } catch {}
        return { success: true, user: res.data.user };
      }
      throw new Error(res.error || 'Login failed.');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Register handler
  const register = async (formData) => {
    setError(null);
    try {
      const res = await apiClient.post('/auth/register', formData);
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('vibegrid_user', JSON.stringify(res.data.user));
        } catch {}
        return { success: true, user: res.data.user };
      }
      throw new Error(res.error || 'Registration failed.');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.error('[Logout Error]', err);
    } finally {
      setUser(null);
      try {
        localStorage.removeItem('vibegrid_user');
        sessionStorage.removeItem('vibegrid_active_tab');
        sessionStorage.removeItem('vibegrid_viewed_username');
      } catch {}
    }
  };

  // Update current user state in memory & storage
  const updateUser = (updatedFields) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      try {
        localStorage.setItem('vibegrid_user', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    checkAuth,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use AuthContext conveniently
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
