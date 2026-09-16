import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import apiClient from './api/client';
import StatusDashboard from './components/StatusDashboard';
import AuthPage from './pages/AuthPage';
import ProfilePage from './pages/ProfilePage';
import FeedPage from './pages/FeedPage';
import ExplorePage from './pages/ExplorePage';
import CreatePostModal from './components/CreatePostModal';
import NotificationsModal from './components/NotificationsModal';
import MessagesPage from './pages/MessagesPage';
import SettingsPage from './pages/SettingsPage';
import ErrorBoundary from './components/ErrorBoundary';
import CallModal from './components/CallModal';
import socketService from './services/socketService';
import e2eeService from './services/crypto/e2eeService';
import AuthPromptModal from './components/AuthPromptModal';
import DemoModeIndicator from './components/DemoModeIndicator';
import { usePWA } from './services/pwaManager';
import VibiMascotGreeting from './components/VibiMascotGreeting';
import {
  Home,
  Compass,
  PlusSquare,
  Bell,
  MessageSquare,
  User,
  Settings,
  Activity,
  Sun,
  Moon,
  Smartphone,
  LogOut,
  ChevronDown,
  ChevronUp,
  WifiOff,
  Sparkles
} from 'lucide-react';

function AppContent() {
  const { user, loading, logout, isDemoMode, authModalState, closeAuthModal, guardDemoAction } = useAuth();
  const { isInstallable, isInstalled, isOffline, hasUpdate, promptInstall, applyUpdate } = usePWA();
  const [authPageTab, setAuthPageTab] = useState('login');
  const [currentTab, setCurrentTab] = useState(() => {
    return sessionStorage.getItem('vibegrid_active_tab') || 'feed';
  });
  const [viewedUsername, setViewedUsername] = useState(() => {
    return sessionStorage.getItem('vibegrid_viewed_username') || null;
  });
  const [directMessageTarget, setDirectMessageTarget] = useState(null);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('vibegrid_theme') || 'light';
  });
  const [settingsSection, setSettingsSection] = useState('privacy');
  const [slideDirection, setSlideDirection] = useState(null);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0, isIgnored: false });
  const [a11yStatus, setA11yStatus] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  // Announce view changes to assistive technologies
  useEffect(() => {
    if (currentTab) {
      const tabNames = {
        feed: 'Home Feed',
        explore: 'Explore & Search',
        messages: 'Direct Messages',
        profile: 'User Profile',
        settings: 'Settings & Privacy',
        auth: 'Sign In and Registration',
        status: 'System Status Dashboard'
      };
      setA11yStatus(`Viewing ${tabNames[currentTab] || currentTab}`);
    }
  }, [currentTab]);

  // "System Status" is strictly visible ONLY to user IDs 1, 2, 3, 4 (test profiles with test = 1). All other users cannot see it.
  const isTestUser = Boolean(
    user && [1, 2, 3, 4].includes(Number(user.id)) && (Number(user.test) === 1 || user.test === undefined || user.test === 1)
  );

  // If user is on 'status' tab but is not a test user, redirect to 'feed'
  useEffect(() => {
    if (currentTab === 'status' && !isTestUser && !loading) {
      setCurrentTab('feed');
      sessionStorage.setItem('vibegrid_active_tab', 'feed');
    }
  }, [currentTab, isTestUser, loading]);

  // Demo Mode -> Real Auth navigation handlers
  const handleNavigateToSignup = async () => {
    closeAuthModal();
    if (isDemoMode) {
      await logout();
    }
    setAuthPageTab('register');
    setCurrentTab('auth');
  };

  const handleNavigateToLogin = async () => {
    closeAuthModal();
    if (isDemoMode) {
      await logout();
    }
    setAuthPageTab('login');
    setCurrentTab('auth');
  };

  const lastBackPressTimeRef = useRef(0);
  const [showExitToast, setShowExitToast] = useState(false);
  const exitToastTimeoutRef = useRef(null);

  // Centralized Navigation with Browser History integration
  const navigateToTab = (newTab, options = {}) => {
    const { viewedUser = null, replace = false, targetDM = null, force = false, section = null, subSection = null } = options;
    if (!force && newTab === currentTab && viewedUser === viewedUsername && targetDM === directMessageTarget && (!section || section === settingsSection)) {
      return;
    }
    setCurrentTab(newTab);
    setViewedUsername(viewedUser);
    setDirectMessageTarget(targetDM);
    if (section) {
      setSettingsSection(section);
    }
    if (typeof window !== 'undefined' && window.history) {
      const stateObj = {
        tab: newTab,
        viewedUsername: viewedUser,
        targetDM,
        section: section || (newTab === 'settings' ? (options.section !== undefined ? options.section : settingsSection) : null),
        subSection: subSection !== null ? subSection : (newTab === 'settings' && section && !['privacy', 'overview'].includes(section))
      };
      if (replace) {
        window.history.replaceState(stateObj, '');
      } else {
        window.history.pushState(stateObj, '');
      }
    }
  };

  // Open Settings helper
  const openSettings = (section = 'privacy') => {
    const isSub = Boolean(section && !['privacy', 'overview'].includes(section));
    setSettingsSection(section);
    navigateToTab('settings', { viewedUser: null, section, subSection: isSub });
  };

  const openCreatePost = () => {
    if (guardDemoAction('create_post')) return;
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ modal: 'create_post', tab: currentTab, viewedUsername }, '');
    }
    setIsCreatePostOpen(true);
  };

  const closeCreatePost = () => {
    setIsCreatePostOpen(false);
    if (typeof window !== 'undefined' && window.history && window.history.state?.modal === 'create_post') {
      window.history.back();
    }
  };

  const openNotifications = () => {
    if (typeof window !== 'undefined' && window.history) {
      window.history.pushState({ modal: 'notifications', tab: currentTab, viewedUsername }, '');
    }
    setIsNotificationsOpen(true);
  };

  const closeNotifications = () => {
    setIsNotificationsOpen(false);
    if (typeof window !== 'undefined' && window.history && window.history.state?.modal === 'notifications') {
      window.history.back();
    }
  };

  // Initialize and handle browser back / popstate navigation
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;

    // Set root history state on initial load if none exists
    const initialTab = sessionStorage.getItem('vibegrid_active_tab') || 'feed';
    const initialUser = sessionStorage.getItem('vibegrid_viewed_username') || null;
    if (!window.history.state) {
      window.history.replaceState({ tab: initialTab, viewedUsername: initialUser, root: initialTab === 'feed' }, '');
    }

    const handlePopState = (e) => {
      // 1. Modals in App.jsx
      if (isCreatePostOpen) {
        setIsCreatePostOpen(false);
        return;
      }
      if (isNotificationsOpen) {
        setIsNotificationsOpen(false);
        return;
      }
      if (isProfileMenuOpen) {
        setIsProfileMenuOpen(false);
        return;
      }

      // 2. Tab Navigation
      if (e.state && e.state.tab) {
        setCurrentTab(e.state.tab);
        setViewedUsername(e.state.viewedUsername || null);
        setDirectMessageTarget(e.state.targetDM || null);
        if (e.state.section) {
          setSettingsSection(e.state.section);
        }
      } else {
        // If popped beyond recorded history, check if on feed or sub-tab
        if (currentTab !== 'feed') {
          setCurrentTab('feed');
          setViewedUsername(null);
          setDirectMessageTarget(null);
          window.history.replaceState({ tab: 'feed', viewedUsername: null, root: true }, '');
        } else {
          // On feed (root home screen), handle Android double-back exit gracefully
          const now = Date.now();
          if (now - lastBackPressTimeRef.current < 2000) {
            // User swiped back twice rapidly on feed — allow normal exit
            return;
          }
          lastBackPressTimeRef.current = now;
          // Re-insert root entry to prevent accidental immediate exit
          window.history.pushState({ tab: 'feed', viewedUsername: null }, '');
          setShowExitToast(true);
          if (exitToastTimeoutRef.current) clearTimeout(exitToastTimeoutRef.current);
          exitToastTimeoutRef.current = setTimeout(() => setShowExitToast(false), 2000);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitToastTimeoutRef.current) clearTimeout(exitToastTimeoutRef.current);
    };
  }, [isCreatePostOpen, isNotificationsOpen, isProfileMenuOpen, currentTab]);

  // Mobile/PWA Swipe Navigation (Feed <-> Explore <-> Messages <-> Activity <-> Profile)
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const handleTouchStart = (e) => {
      if (e.touches.length !== 1) {
        touchStartRef.current.isIgnored = true;
        return;
      }

      const touch = e.touches[0];
      const x = touch.clientX;
      const y = touch.clientY;
      const target = e.target;

      // Ignore if starting near extreme viewport edges to avoid OS back/forward edge gestures
      if (x < 24 || x > window.innerWidth - 24) {
        touchStartRef.current.isIgnored = true;
        return;
      }

      // Ignore if active chat is open in MessagesPage
      if (typeof document !== 'undefined' && document.body.classList.contains('has-active-chat')) {
        touchStartRef.current.isIgnored = true;
        return;
      }

      // Ignore if inside text inputs, horizontal scrollbars, sliders, or media carousels
      const ignoredSelector = [
        'input',
        'textarea',
        'select',
        '[contenteditable="true"]',
        '[role="slider"]',
        '.stories-bar',
        '.stories-container',
        '.story-tray',
        '.story-slider',
        '.image-slider',
        '.carousel',
        '[data-no-swipe]',
        '.message-composer',
        '.chat-messages-container',
        '.messages-chat-view',
        '.confirm-modal-overlay',
        '.share-modal-overlay',
        '.forward-modal-overlay',
        '.story-viewer-modal',
        '.image-lightbox-modal'
      ].join(', ');

      if (target.closest && target.closest(ignoredSelector)) {
        touchStartRef.current.isIgnored = true;
        return;
      }

      // Ignore if Create Post modal is open
      if (isCreatePostOpen) {
        touchStartRef.current.isIgnored = true;
        return;
      }

      touchStartRef.current = {
        x,
        y,
        time: Date.now(),
        isIgnored: false
      };
    };

    const handleTouchMove = (e) => {
      if (touchStartRef.current.isIgnored || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Cancel if user is primarily scrolling vertically
      if (Math.abs(deltaY) > 35 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
        touchStartRef.current.isIgnored = true;
      }
    };

    const handleTouchEnd = (e) => {
      if (touchStartRef.current.isIgnored) return;
      const touch = e.changedTouches?.[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Must be a distinct horizontal gesture (>= 50px) completed within 650ms and predominantly horizontal
      if (deltaTime > 650 || absX < 50 || absX < absY * 1.4) {
        return;
      }

      // 0: Feed, 1: Explore, 2: Messages, 3: Activity, 4: Profile
      let currentIndex = -1;
      if (isNotificationsOpen) {
        currentIndex = 3;
      } else if (currentTab === 'feed') {
        currentIndex = 0;
      } else if (currentTab === 'explore') {
        currentIndex = 1;
      } else if (currentTab === 'messages') {
        currentIndex = 2;
      } else if (currentTab === 'profile') {
        currentIndex = 4;
      }

      if (currentIndex === -1) return;

      if (deltaX < -50) {
        // Swipe Left -> Next Page (Feed -> Explore -> Messages -> Activity -> Profile)
        if (currentIndex < 4) {
          triggerTabSwitch(currentIndex + 1, 'left');
        }
      } else if (deltaX > 50) {
        // Swipe Right -> Previous Page (Profile <- Activity <- Messages <- Explore <- Feed)
        if (currentIndex > 0) {
          triggerTabSwitch(currentIndex - 1, 'right');
        }
      }
    };

    const triggerTabSwitch = (targetIndex, direction) => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(12); } catch {}
      }

      setSlideDirection(direction === 'left' ? 'slide-nav-left' : 'slide-nav-right');
      setTimeout(() => setSlideDirection(null), 250);

      const hadNotifications = isNotificationsOpen;

      switch (targetIndex) {
        case 0: // Feed
          if (hadNotifications) setIsNotificationsOpen(false);
          navigateToTab('feed', { replace: hadNotifications && window.history.state?.modal === 'notifications' });
          break;
        case 1: // Explore
          if (hadNotifications) setIsNotificationsOpen(false);
          navigateToTab('explore', { replace: hadNotifications && window.history.state?.modal === 'notifications' });
          break;
        case 2: // Messages
          if (hadNotifications) setIsNotificationsOpen(false);
          navigateToTab('messages', { replace: hadNotifications && window.history.state?.modal === 'notifications' });
          break;
        case 3: // Activity
          openNotifications();
          break;
        case 4: // Profile
          if (hadNotifications) setIsNotificationsOpen(false);
          navigateToProfile(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [user, currentTab, isNotificationsOpen, isCreatePostOpen]);

  // Handle Deep Links from Web Push Notifications or external URLs
  useEffect(() => {
    const handleDeepLink = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash || '';

      // Check hash route, e.g. #messages?partner=username or #settings or #notifications
      if (hash.startsWith('#messages')) {
        const queryIdx = hash.indexOf('?');
        let partner = null;
        if (queryIdx !== -1) {
          const params = new URLSearchParams(hash.slice(queryIdx + 1));
          partner = params.get('partner');
        }
        navigateToTab('messages', { targetDM: partner });
      } else if (hash.startsWith('#notifications')) {
        openNotifications();
      } else if (hash.startsWith('#settings')) {
        openSettings();
      } else if (hash.startsWith('#profile')) {
        const queryIdx = hash.indexOf('?');
        let profileUser = null;
        if (queryIdx !== -1) {
          const params = new URLSearchParams(hash.slice(queryIdx + 1));
          profileUser = params.get('user');
        }
        navigateToProfile(profileUser);
      }
    };

    // Run on initial mount
    handleDeepLink();

    // Listen for hashchange events
    window.addEventListener('hashchange', handleDeepLink);

    // Listen for Service Worker postMessage from notification clicks
    const handleServiceWorkerMessage = (event) => {
      if (event.data?.type === 'NAVIGATE_FROM_NOTIFICATION') {
        const notifData = event.data.data || {};
        if (notifData.type === 'dm' && notifData.username) {
          navigateToTab('messages', { targetDM: notifData.username });
        } else if (notifData.type === 'call') {
          navigateToTab('messages', { targetDM: notifData.username });
        } else if (notifData.type === 'follow' && notifData.username) {
          navigateToProfile(notifData.username);
        } else if (notifData.type === 'like' || notifData.type === 'comment') {
          navigateToTab('feed');
        } else if (notifData.url) {
          window.location.href = notifData.url;
        }
      }
    };

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.removeEventListener('hashchange', handleDeepLink);
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  // Fetch unread notifications count
  const fetchUnreadCount = async () => {
    if (!user) return;
    try {
      const res = await apiClient.get('/notifications/unread-count');
      if (res.success && typeof res.data?.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount);
      }
    } catch (err) {
      // Quietly ignore polling errors
    }
  };

  // Fetch unread messages count
  const fetchUnreadMessagesCount = async () => {
    if (!user) return;
    try {
      const res = await apiClient.get('/messages/unread-count');
      if (res.success && typeof res.data?.unreadCount === 'number') {
        setUnreadMessagesCount(res.data.unreadCount);
      }
    } catch (err) {
      // Quietly ignore polling errors
    }
  };

  // Automatically adjust tab based on auth state & start background polling
  useEffect(() => {
    if (loading) return; // Do not switch tabs while waiting for initial session verification

    if (user) {
      // Restore active tab if previously marked as auth, or keep existing tab
      setCurrentTab((prev) => {
        if (prev === 'auth') {
          const savedTab = sessionStorage.getItem('vibegrid_active_tab');
          return savedTab && savedTab !== 'auth' ? savedTab : 'feed';
        }
        return prev;
      });

      // Connect real-time socket
      try {
        socketService.connect();
      } catch (err) {
        console.warn('Socket connect error:', err);
      }

      // Initialize E2EE crypto identity only for non-demo authenticated accounts
      if (!isDemoMode && user?.id) {
        e2eeService.initDeviceKeys(user.id).catch((err) => {
          console.warn('E2EE initialization error:', err);
        });
      }

      fetchUnreadCount();
      fetchUnreadMessagesCount();
      const notifTimer = setInterval(fetchUnreadCount, 20000);
      const msgTimer = setInterval(fetchUnreadMessagesCount, 15000);
      return () => {
        clearInterval(notifTimer);
        clearInterval(msgTimer);
      };
    } else {
      try {
        socketService.disconnect();
      } catch {}
      const isCurrentlyOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (!isCurrentlyOffline) {
        setCurrentTab('auth');
        try {
          sessionStorage.removeItem('vibegrid_active_tab');
          sessionStorage.removeItem('vibegrid_viewed_username');
        } catch {}
      } else {
        // When offline, default to cached feed if currently on auth tab
        setCurrentTab((prev) => (prev === 'auth' ? 'feed' : prev));
      }
      setUnreadCount(0);
      setUnreadMessagesCount(0);
    }
  }, [user, loading]);

  // When system goes offline, ensure app does NOT redirect to auth and user can view cached feed
  useEffect(() => {
    const handleOffline = () => {
      setCurrentTab((prev) => (prev === 'auth' ? 'feed' : prev));
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  // Persist active tab changes
  useEffect(() => {
    if (currentTab && currentTab !== 'auth') {
      try {
        sessionStorage.setItem('vibegrid_active_tab', currentTab);
      } catch {}
    }
  }, [currentTab]);

  // Persist viewed profile username
  useEffect(() => {
    try {
      if (viewedUsername) {
        sessionStorage.setItem('vibegrid_viewed_username', viewedUsername);
      } else {
        sessionStorage.removeItem('vibegrid_viewed_username');
      }
    } catch {}
  }, [viewedUsername]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vibegrid_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (['light', 'pastel-light'].includes(prev) ? 'dark' : 'light'));
  };

  const navigateToProfile = (username = null) => {
    navigateToTab('profile', { viewedUser: username });
  };

  const handlePostCreated = () => {
    setFeedRefreshKey((prev) => prev + 1);
    navigateToTab('feed');
  };

  // Show a clean loading splash if checking initial auth state without a cached user
  if (loading && !user) {
    return (
      <div className="app-viewport app-loading-viewport">
        <div className="app-loading-content">
          <div className="nav-brand-icon-wrapper" style={{ width: '64px', height: '64px' }}>
            <svg viewBox="0 0 52 52" className="vg-nav-logo-svg" fill="none">
              <defs>
                <linearGradient id="vgSplashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f09433" />
                  <stop offset="25%" stopColor="#e6683c" />
                  <stop offset="50%" stopColor="#dc2743" />
                  <stop offset="75%" stopColor="#cc2366" />
                  <stop offset="100%" stopColor="#bc1888" />
                </linearGradient>
                <linearGradient id="vgSplashVGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="100%" stopColor="#fff2f6" />
                </linearGradient>
              </defs>
              <rect width="52" height="52" rx="16" fill="url(#vgSplashGrad)" />
              <circle cx="41" cy="11" r="2.4" fill="white" opacity="0.95" />
              <circle cx="41" cy="19" r="1.6" fill="white" opacity="0.6" />
              <circle cx="33" cy="11" r="1.6" fill="white" opacity="0.6" />
              <path
                d="M14 15 L26 38 L38 15"
                stroke="url(#vgSplashVGrad)"
                strokeWidth="5.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="app-loading-title">VibeGrid</h1>
          <div className="spinner-mini" style={{ width: '28px', height: '28px', borderWidth: '3px', marginTop: '16px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-viewport ${!user ? 'guest-viewport' : ''}`}>
      {/* Dynamic Screen Reader Live Region for Announcements (WCAG 2.2 AA) */}
      <div 
        id="a11y-live-region"
        role="status" 
        aria-live="polite" 
        aria-atomic="true" 
        className="sr-only"
      >
        {a11yStatus}
      </div>

      {/* PWA Network & Update Notifications */}
      {isOffline && (
        <div className="pwa-network-status-banner offline" role="status" aria-live="polite">
          <span className="pwa-status-icon">
            <WifiOff size={16} />
          </span>
          <span className="pwa-status-text">You are currently offline. Cached feed and assets remain accessible.</span>
        </div>
      )}
      {hasUpdate && (
        <div className="pwa-update-banner" role="alert">
          <div className="pwa-update-info">
            <span className="pwa-update-icon">
              <Sparkles size={16} />
            </span>
            <span className="pwa-update-text">A new version of VibeGrid is ready!</span>
          </div>
          <button type="button" onClick={applyUpdate} className="pwa-update-action-btn">
            Update Now
          </button>
        </div>
      )}

      {/* Top Navigation Bar & Landmark Banner */}
      <header role="banner" className="top-navbar">
        <div className="top-navbar-container">
          <div 
            className="nav-brand" 
            style={{ cursor: 'pointer' }}
            onClick={() => navigateToTab('feed')}
          >
            <div className="nav-brand-icon-wrapper">
              <svg viewBox="0 0 52 52" width="36" height="36" className="vg-nav-logo-svg" fill="none">
                <defs>
                  <linearGradient id="vgNavGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f09433" />
                    <stop offset="25%" stopColor="#e6683c" />
                    <stop offset="50%" stopColor="#dc2743" />
                    <stop offset="75%" stopColor="#cc2366" />
                    <stop offset="100%" stopColor="#bc1888" />
                  </linearGradient>
                  <linearGradient id="vgNavVGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#fff2f6" />
                  </linearGradient>
                </defs>
                <rect width="52" height="52" rx="16" fill="url(#vgNavGrad)" />
                <circle cx="41" cy="11" r="2.4" fill="white" opacity="0.95" />
                <circle cx="41" cy="19" r="1.6" fill="white" opacity="0.6" />
                <circle cx="33" cy="11" r="1.6" fill="white" opacity="0.6" />
                <path
                  d="M14 15 L26 38 L38 15"
                  stroke="url(#vgNavVGrad)"
                  strokeWidth="5.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="nav-brand-text">VibeGrid</span>
          </div>

          {/* Demo Mode Indicator (Visible when in Demo Mode) */}
          <DemoModeIndicator 
            onNavigateToSignup={handleNavigateToSignup}
            onNavigateToLogin={handleNavigateToLogin}
          />

          {/* Desktop Nav Actions */}
          <nav className="nav-links nav-tabs-container desktop-only" aria-label="Main Navigation">
            <ul className="nav-links-list nav-tabs-list">
              {user ? (
                <>
                  <li>
                    <a
                      href="#feed"
                      className={`nav-tab-btn ${currentTab === 'feed' && !viewedUsername ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToTab('feed');
                      }}
                    >
                      <Home size={18} />
                      <span>Feed</span>
                    </a>
                  </li>

                  <li>
                    <a
                      href="#explore"
                      className={`nav-tab-btn ${currentTab === 'explore' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToTab('explore');
                      }}
                    >
                      <Compass size={18} />
                      <span>Explore</span>
                    </a>
                  </li>

                  <li>
                    <button
                      type="button"
                      className="nav-tab-btn btn-create-nav"
                      onClick={openCreatePost}
                      title="Create and share a new post"
                      aria-label="Create and share a new post"
                    >
                      <PlusSquare size={18} />
                      <span>Create</span>
                    </button>
                  </li>

                  <li>
                    <button
                      type="button"
                      className={`nav-tab-btn nav-notifications-btn ${isNotificationsOpen ? 'active' : ''}`}
                      onClick={() => {
                        if (isNotificationsOpen) closeNotifications();
                        else openNotifications();
                      }}
                      title="Activity Notifications"
                      aria-label={`Activity Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
                    >
                      <Bell size={18} />
                      <span className="nav-notifications-label">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="nav-unread-badge">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </button>
                  </li>

                  <li>
                    <a
                      href="#messages"
                      className={`nav-tab-btn nav-messages-btn ${currentTab === 'messages' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToTab('messages');
                      }}
                      title="Direct Messages"
                      aria-label={`Direct Messages${unreadMessagesCount > 0 ? `, ${unreadMessagesCount} unread` : ''}`}
                    >
                      <MessageSquare size={18} />
                      <span className="nav-messages-label">Messages</span>
                      {unreadMessagesCount > 0 && (
                        <span className="nav-unread-badge">
                          {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                      )}
                    </a>
                  </li>

                  {/* Profile Dropdown Menu */}
                  <li ref={profileMenuRef} className="nav-profile-menu-container">
                    <button
                      type="button"
                      className={`nav-tab-btn nav-profile-btn ${isProfileMenuOpen || (currentTab === 'profile' && !viewedUsername) ? 'active' : ''}`}
                      onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                      aria-expanded={isProfileMenuOpen}
                      aria-haspopup="true"
                      title="Account & Settings"
                      aria-label={`Account menu for @${user.username}`}
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="nav-avatar-mini" />
                      ) : (
                        <span className="nav-avatar-fallback-mini">
                          {user.username?.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="nav-profile-name">@{user.username}</span>
                      <span className="nav-chevron">{isProfileMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
                    </button>

                    {isProfileMenuOpen && (
                      <div className="nav-profile-dropdown" role="menu">
                        <div className="dropdown-user-header">
                          <div className="dropdown-user-avatar">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" />
                            ) : (
                              <span>{user.username?.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="dropdown-user-info">
                            <span className="dropdown-user-name">{user.full_name || user.username}</span>
                            <span className="dropdown-user-handle">@{user.username}</span>
                          </div>
                        </div>

                        <div className="dropdown-divider" />

                        <button
                          type="button"
                          className="dropdown-item"
                          role="menuitem"
                          onClick={() => {
                            navigateToProfile(null);
                            setIsProfileMenuOpen(false);
                          }}
                        >
                          <span className="dropdown-icon"><User size={16} /></span>
                          <span>My Profile</span>
                        </button>

                        <button
                          type="button"
                          className="dropdown-item"
                          role="menuitem"
                          onClick={() => {
                            openSettings('privacy');
                            setIsProfileMenuOpen(false);
                          }}
                        >
                          <span className="dropdown-icon"><Settings size={16} /></span>
                          <span>Settings & Privacy</span>
                        </button>

                        {isTestUser && (
                          <button
                            type="button"
                            className="dropdown-item"
                            role="menuitem"
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              navigateToTab('status');
                            }}
                          >
                            <span className="dropdown-icon"><Activity size={16} /></span>
                            <span>System Status</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="dropdown-item"
                          role="menuitem"
                          onClick={toggleTheme}
                        >
                          <span className="dropdown-icon">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</span>
                          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
                        </button>

                        {isInstallable && !isInstalled && (
                          <button
                            type="button"
                            className="dropdown-item highlight-install"
                            role="menuitem"
                            onClick={() => {
                              promptInstall();
                              setIsProfileMenuOpen(false);
                            }}
                          >
                            <span className="dropdown-icon"><Smartphone size={16} /></span>
                            <span>Install VibeGrid App</span>
                          </button>
                        )}

                        <div className="dropdown-divider" />

                        <button
                          type="button"
                          className="dropdown-item logout-item"
                          role="menuitem"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            logout();
                          }}
                        >
                          <span className="dropdown-icon"><LogOut size={16} /></span>
                          <span>Sign Out</span>
                        </button>
                      </div>
                    )}
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <a
                      href="#feed"
                      className={`nav-tab-btn ${currentTab === 'feed' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToTab('feed');
                      }}
                    >
                      <Home size={18} />
                      <span>Feed</span>
                    </a>
                  </li>

                  <li>
                    <a
                      href="#explore"
                      className={`nav-tab-btn ${currentTab === 'explore' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToTab('explore');
                      }}
                    >
                      <Compass size={18} />
                      <span>Explore</span>
                    </a>
                  </li>

                  <li>
                    <a
                      href="#auth"
                      className={`nav-tab-btn ${currentTab === 'auth' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateToTab('auth');
                      }}
                    >
                      <User size={18} />
                      <span>Sign In / Register</span>
                    </a>
                  </li>

                  {isInstallable && !isInstalled && (
                    <li>
                      <button
                        type="button"
                        className="nav-tab-btn nav-install-btn"
                        onClick={promptInstall}
                        title="Install VibeGrid as Progressive Web App"
                      >
                        <Smartphone size={18} />
                        <span>Install App</span>
                      </button>
                    </li>
                  )}

                  <li>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className="nav-tab-btn nav-theme-btn"
                      title="Toggle Dark/Light Mode"
                      aria-label="Toggle dark/light theme"
                    >
                      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                  </li>
                </>
              )}
            </ul>
          </nav>

          {/* Mobile Header Actions (Visible on mobile <= 768px) */}
          <div className="mobile-header-actions mobile-only">
            {isInstallable && !isInstalled && (
              <button
                type="button"
                className="mobile-install-pill-btn"
                onClick={promptInstall}
                title="Install VibeGrid"
                aria-label="Install App"
              >
                <Smartphone size={14} />
                <span>Install</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="nav-icon-btn-mobile"
              title="Toggle Dark/Light Mode"
              aria-label="Toggle dark/light theme"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user ? (
              <>
                <button
                  className={`nav-icon-btn-mobile ${currentTab === 'messages' ? 'active' : ''}`}
                  onClick={() => navigateToTab('messages')}
                  title="Direct Messages"
                  aria-label="Direct Messages"
                >
                  <MessageSquare size={18} />
                  {unreadMessagesCount > 0 && (
                    <span className="nav-unread-badge-mobile">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </button>

                <button
                  className={`nav-icon-btn-mobile ${currentTab === 'settings' ? 'active' : ''}`}
                  onClick={() => openSettings('privacy')}
                  title="Settings & Privacy"
                  aria-label="Settings & Privacy"
                >
                  <Settings size={18} />
                </button>
              </>
            ) : (
              <button
                className="btn-primary btn-sm"
                onClick={() => navigateToTab('auth')}
                aria-label="Sign In"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`main-content ${user ? 'has-bottom-nav' : ''} ${isOffline ? 'has-offline-banner' : ''} ${slideDirection || ''}`}>
        <ErrorBoundary>
          {currentTab === 'status' && (
            isTestUser ? (
              <StatusDashboard />
            ) : (
              <FeedPage
                key={feedRefreshKey}
                onOpenCreatePost={openCreatePost}
                onNavigateToProfile={(username) => navigateToProfile(username)}
              />
            )
          )}
          {currentTab === 'auth' && <AuthPage initialTab={authPageTab} />}
          {currentTab === 'feed' && (
            <FeedPage
              key={feedRefreshKey}
              onOpenCreatePost={openCreatePost}
              onNavigateToProfile={(username) => navigateToProfile(username)}
            />
          )}
          {currentTab === 'explore' && (
            <ExplorePage
              onNavigateToProfile={(username) => navigateToProfile(username)}
            />
          )}
          {currentTab === 'messages' && (
            <MessagesPage
              initialTargetUsername={directMessageTarget}
              onNavigateToProfile={(username) => navigateToProfile(username)}
              onUnreadCountChange={fetchUnreadMessagesCount}
            />
          )}
          {currentTab === 'profile' && (
            user ? (
              <ProfilePage
                key={viewedUsername || user.username}
                targetUsername={viewedUsername}
                onOpenCreatePost={openCreatePost}
                onNavigateToProfile={(username) => navigateToProfile(username)}
                onOpenDirectMessage={(username) => {
                  navigateToTab('messages', { targetDM: username });
                }}
                onOpenSettings={openSettings}
              />
            ) : (
              <AuthPage initialTab={authPageTab} />
            )
          )}
          {currentTab === 'settings' && (
            user ? (
              <SettingsPage
                initialSection={settingsSection}
                onNavigateToProfile={(username) => navigateToProfile(username)}
                currentTheme={theme}
                onThemeChange={setTheme}
              />
            ) : (
              <AuthPage initialTab={authPageTab} />
            )
          )}
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Navigation Bar (Visible on mobile <= 768px when logged in) */}
      {user && (
        <nav className="mobile-bottom-navbar mobile-only" aria-label="Mobile navigation">
          <ul className="mobile-bottom-navbar-list">
            <li>
              <a
                href="#feed"
                className={`mobile-nav-item ${currentTab === 'feed' && !viewedUsername ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToTab('feed');
                }}
                title="Home Feed"
              >
                <span className="mobile-nav-icon"><Home size={20} /></span>
                <span className="mobile-nav-label">Feed</span>
              </a>
            </li>

            <li>
              <a
                href="#explore"
                className={`mobile-nav-item ${currentTab === 'explore' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToTab('explore');
                }}
                title="Explore"
              >
                <span className="mobile-nav-icon"><Compass size={20} /></span>
                <span className="mobile-nav-label">Explore</span>
              </a>
            </li>

            <li>
              <button
                type="button"
                className="mobile-nav-item mobile-nav-create-btn"
                onClick={openCreatePost}
                title="Create Post"
                aria-label="Create new post"
              >
                <span className="mobile-nav-create-icon"><PlusSquare size={20} /></span>
              </button>
            </li>

            <li>
              <button
                type="button"
                className={`mobile-nav-item ${isNotificationsOpen ? 'active' : ''}`}
                onClick={() => {
                  if (isNotificationsOpen) closeNotifications();
                  else openNotifications();
                }}
                title="Activity Notifications"
                aria-label={`Activity Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              >
                <span className="mobile-nav-icon">
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="mobile-nav-badge">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className="mobile-nav-label">Activity</span>
              </button>
            </li>

            <li>
              <a
                href={`#profile/${user.username}`}
                className={`mobile-nav-item ${currentTab === 'profile' && !viewedUsername ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateToProfile(null);
                }}
                title="My Profile"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="mobile-nav-avatar" />
                ) : (
                  <span className="mobile-nav-avatar-fallback">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="mobile-nav-label">Profile</span>
              </a>
            </li>
          </ul>
        </nav>
      )}

      {/* Global Create Post Modal */}
      <CreatePostModal
        isOpen={isCreatePostOpen}
        onClose={closeCreatePost}
        onPostCreated={handlePostCreated}
      />

      {/* Global Activity Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={closeNotifications}
        onNavigateToProfile={navigateToProfile}
        onUnreadCountChange={(count) => {
          if (typeof count === 'number') {
            setUnreadCount(count);
          } else {
            fetchUnreadCount();
          }
        }}
      />

      {/* PWA Double-Back Exit Toast */}
      {showExitToast && (
        <div className="pwa-exit-toast" role="status">
          Swipe back again to exit
        </div>
      )}

      {/* Global WebRTC 1-to-1 Audio/Video Call Modal */}
      {user && <CallModal />}

      {/* Global Join VibeGrid Auth Prompt Modal for Demo Mode */}
      <AuthPromptModal
        isOpen={authModalState.isOpen}
        title={authModalState.title}
        subtitle={authModalState.subtitle}
        onClose={closeAuthModal}
        onNavigateToSignup={handleNavigateToSignup}
        onNavigateToLogin={handleNavigateToLogin}
      />

      {/* Phase 1 Delight Feature: Vibi Mascot & App Open Animation */}
      <VibiMascotGreeting user={user} />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
