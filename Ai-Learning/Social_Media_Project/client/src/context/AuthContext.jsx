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
import pushNotificationService from '../services/pushNotificationService';
import permissionService from '../services/permissionService';
import accountSuggestionService from '../services/accountSuggestionService';

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
    // If the browser/device is currently offline, preserve any cached user session
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const savedUser = localStorage.getItem('vibegrid_user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch {}
      }
      setLoading(false);
      return;
    }

    let timeoutId;
    try {
      if (!user) setLoading(true);

      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.data?.user) {
          setUser(data.data.user);
          try {
            localStorage.setItem('vibegrid_user', JSON.stringify(data.data.user));
          } catch {}
          accountSuggestionService.saveRememberedAccount(data.data.user);
          return;
        }
      }

      // Explicit authentication failure from server (e.g. 401 Unauthorized or 403 Forbidden)
      if (res && (res.status === 401 || res.status === 403)) {
        setUser(null);
        localStorage.removeItem('vibegrid_user');
      }
    } catch (err) {
      // Check if the failure is a network or offline error
      const isNetworkOrOfflineError =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err.name === 'AbortError' ||
        err instanceof TypeError ||
        (err.message && /network|fetch|offline|failed/i.test(err.message));

      if (isNetworkOrOfflineError) {
        // Retain current session or restore from localStorage — DO NOT wipe user on network failure!
        const savedUser = localStorage.getItem('vibegrid_user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch {}
        }
      } else {
        // Unexpected authentication failure
        setUser(null);
        localStorage.removeItem('vibegrid_user');
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const isDemoMode = Boolean(user?.is_demo_session || user?.isDemoSession || user?.sessionType === 'demo');

  // Automatically sync Web Push subscription whenever an authenticated user session is active
  useEffect(() => {
    if (user && user.id && !isDemoMode) {
      pushNotificationService.syncPushSubscription().catch(() => {});
    }
  }, [user?.id, isDemoMode]);

  // Global Join VibeGrid Auth Prompt Modal State
  const [authModalState, setAuthModalState] = useState({
    isOpen: false,
    title: 'Join VibeGrid',
    subtitle: 'Create an account to continue.',
    action: null
  });

  const openAuthModal = (actionName = 'continue', customSubtitle = null) => {
    const subtitles = {
      like: 'Create an account to like posts and comments.',
      comment: 'Create an account to share your thoughts and join the conversation.',
      follow: 'Create an account to follow creators and build your feed.',
      message: 'Create an account to send direct messages.',
      voice: 'Create an account to send voice notes.',
      call: 'Create an account to start voice and video calls.',
      create_post: 'Create an account to share your vibes with the community.',
      create_story: 'Create an account to post 24-hour stories.',
      save: 'Create an account to save and bookmark posts.',
      edit_profile: 'Create an account to customize your profile.',
      settings: 'Create an account to manage personal account settings.',
      pin: 'Create an account to pin messages.',
      star: 'Create an account to star messages.',
      report: 'Create an account to submit reports.',
      block: 'Create an account to block profiles.',
      share: 'Create an account to share and repost content.'
    };

    setAuthModalState({
      isOpen: true,
      title: 'Join VibeGrid',
      subtitle: customSubtitle || subtitles[actionName] || 'Create an account to continue.',
      action: actionName
    });
  };

  const closeAuthModal = () => {
    setAuthModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const guardDemoAction = (actionName, customSubtitle = null) => {
    if (isDemoMode) {
      openAuthModal(actionName, customSubtitle);
      return true; // Intercepted
    }
    return false; // Permitted
  };

  useEffect(() => {
    checkAuth();

    // Re-verify session in the background when connectivity is restored
    const handleOnline = () => {
      checkAuth();
    };
    window.addEventListener('online', handleOnline);

    // Listen for 401 Unauthorized broadcasts across the app to prevent stale state
    const handleSessionExpired = () => {
      setUser(null);
      try {
        localStorage.removeItem('vibegrid_user');
        sessionStorage.removeItem('vibegrid_active_tab');
        sessionStorage.removeItem('vibegrid_viewed_username');
      } catch {}
    };

    // Listen for 403 DEMO_RESTRICTED broadcasts from API client
    const handleDemoRestricted = (e) => {
      const action = e.detail?.action || 'continue';
      openAuthModal(action);
    };

    window.addEventListener('vibegrid:session-expired', handleSessionExpired);
    window.addEventListener('vibegrid:demo-restricted', handleDemoRestricted);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('vibegrid:session-expired', handleSessionExpired);
      window.removeEventListener('vibegrid:demo-restricted', handleDemoRestricted);
    };
  }, []);

  // Dedicated Demo Mode Session Starter
  const startDemoSession = async (persona = 'sophia_wander') => {
    setError(null);
    try {
      const res = await apiClient.post('/auth/demo-session', { persona });
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('vibegrid_user', JSON.stringify(res.data.user));
          sessionStorage.setItem('vibegrid_active_tab', 'feed');
          sessionStorage.removeItem('vibegrid_viewed_username');
        } catch {}
        return { success: true, user: res.data.user };
      }
      throw new Error(res.error || 'Failed to start demo session.');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Login handler
  const login = async (identifier, password, isDemoAccess = false) => {
    setError(null);
    try {
      const res = await apiClient.post('/auth/login', { identifier, password, isDemoAccess });
      if (res.success && res.data?.step === 'otp_required') {
        return {
          step: 'otp_required',
          loginToken: res.data.loginToken,
          maskedEmail: res.data.maskedEmail,
          debugOtp: res.data.debugOtp
        };
      }
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('vibegrid_user', JSON.stringify(res.data.user));
        } catch {}
        accountSuggestionService.saveRememberedAccount(res.data.user, identifier);
        return { success: true, user: res.data.user };
      }
      throw new Error(res.error || 'Login failed.');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Verify Login OTP handler (2FA)
  const verifyLoginOtp = async (loginToken, otpCode) => {
    setError(null);
    try {
      const res = await apiClient.post('/auth/verify-login-otp', { loginToken, otpCode });
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('vibegrid_user', JSON.stringify(res.data.user));
        } catch {}
        accountSuggestionService.saveRememberedAccount(res.data.user);
        return { success: true, user: res.data.user };
      }
      throw new Error(res.error || 'Verification failed.');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Resend Login OTP handler
  const resendLoginOtp = async (loginToken) => {
    try {
      const res = await apiClient.post('/auth/resend-login-otp', { loginToken });
      if (res.success) {
        return res.data;
      }
      throw new Error(res.error || 'Failed to resend OTP.');
    } catch (err) {
      throw err;
    }
  };

  // Register handler (Step 1)
  const register = async (formData) => {
    setError(null);
    try {
      const res = await apiClient.post('/auth/register', formData);
      if (res.success && res.data?.step === 'otp_required') {
        return {
          step: 'otp_required',
          registerToken: res.data.registerToken,
          maskedEmail: res.data.maskedEmail,
          debugOtp: res.data.debugOtp
        };
      }
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('vibegrid_user', JSON.stringify(res.data.user));
        } catch {}
        accountSuggestionService.saveRememberedAccount(res.data.user, formData?.username || formData?.email);
        return { success: true, user: res.data.user };
      }
      throw new Error(res.error || 'Registration failed.');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Verify Register OTP handler (Step 2)
  const verifyRegisterOtp = async (registerToken, otpCode) => {
    setError(null);
    try {
      const res = await apiClient.post('/auth/verify-register-otp', { registerToken, otpCode });
      if (res.success && res.data?.user) {
        setUser(res.data.user);
        try {
          localStorage.setItem('vibegrid_user', JSON.stringify(res.data.user));
        } catch {}
        accountSuggestionService.saveRememberedAccount(res.data.user);
        return { success: true, user: res.data.user };
      }
      throw new Error(res.error || 'Registration verification failed.');
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Resend Register OTP handler
  const resendRegisterOtp = async (registerToken) => {
    try {
      const res = await apiClient.post('/auth/resend-register-otp', { registerToken });
      if (res.success) {
        return res.data;
      }
      throw new Error(res.error || 'Failed to resend verification code.');
    } catch (err) {
      throw err;
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await pushNotificationService.unsubscribeFromPushNotifications().catch(() => {});
    } catch {}
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

  // Complete permission onboarding for current user
  const completeOnboarding = async () => {
    if (!user || !user.id) return;
    try {
      await permissionService.markOnboardingCompleted(user.id);
    } catch {}
    updateUser({ has_completed_onboarding: true });
  };

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isDemoMode,
    startDemoSession,
    authModalState,
    openAuthModal,
    closeAuthModal,
    guardDemoAction,
    login,
    verifyLoginOtp,
    resendLoginOtp,
    register,
    verifyRegisterOtp,
    resendRegisterOtp,
    logout,
    checkAuth,
    updateUser,
    completeOnboarding
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
