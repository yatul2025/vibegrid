import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import ReturningUserWelcomeDrop from './components/ReturningUserWelcomeDrop';
import AuroraCelebrationOverlay, { triggerCelebration } from './components/AuroraCelebrationOverlay';
import NetworkStatusPill from './components/NetworkStatusPill';
import PermissionOnboardingModal from './components/PermissionOnboardingModal';
import soundFx from './services/soundFxService';
import navigationService from './services/navigationService';
import permissionService from './services/permissionService';
import vibiContextService from './services/vibiContextService';
import { NavigationProvider } from './context/NavigationContext';
import { VibiAssistantProvider } from './context/VibiAssistantContext';
import VibiHeaderEntry from './components/vibi/VibiHeaderEntry';
import VibiLauncher from './components/vibi/VibiLauncher';
import VibiPanel from './components/vibi/VibiPanel';
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
  const { user, loading, logout, isDemoMode, authModalState, closeAuthModal, guardDemoAction, completeOnboarding } = useAuth();
  const { isInstallable, isInstalled, isOffline, hasUpdate, promptInstall, applyUpdate } = usePWA();
  const [authPageTab, setAuthPageTab] = useState('login');
  const [showPermissionOnboarding, setShowPermissionOnboarding] = useState(false);
  const [isManualOnboardingRecheck, setIsManualOnboardingRecheck] = useState(false);
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
  const [settingsSection, setSettingsSection] = useState(null);
  const [slideDirection, setSlideDirection] = useState(null);
  const currentTabRef = useRef(currentTab);
  useEffect(() => {
    currentTabRef.current = currentTab;
    vibiContextService.setActiveTab(currentTab);
  }, [currentTab]);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0, isIgnored: false });
  const [a11yStatus, setA11yStatus] = useState('');
  const [vibiEasterEgg, setVibiEasterEgg] = useState({ active: false, key: 0 });
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  // Phase 11: Vibi Secret Easter Egg Trigger
  const triggerVibiEasterEgg = useCallback(() => {
    triggerCelebration('confetti');
    soundFx.playCelebration();
    setVibiEasterEgg((prev) => ({ active: true, key: prev.key + 1 }));
    setA11yStatus('Secret Vibe Sparkle unlocked! Vibi mascot easter egg activated!');
  }, []);

  // Global key sequence listener ('v-i-b-i') and custom event
  useEffect(() => {
    let buffer = '';
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName) || e.target?.isContentEditable) {
        return;
      }
      buffer = (buffer + e.key.toLowerCase()).slice(-4);
      if (buffer === 'vibi') {
        triggerVibiEasterEgg();
        buffer = '';
      }
    };

    const handleCustomEasterEgg = () => {
      triggerVibiEasterEgg();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('vibegrid:trigger-vibi', handleCustomEasterEgg);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('vibegrid:trigger-vibi', handleCustomEasterEgg);
    };
  }, [triggerVibiEasterEgg]);

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
  const [inAppToast, setInAppToast] = useState(null);
  const inAppToastTimerRef = useRef(null);
  const recentNotificationIdsRef = useRef(new Set());

  const triggerInAppToast = (toast) => {
    if (!toast || !toast.id) return;
    const toastIdStr = String(toast.id);
    if (recentNotificationIdsRef.current.has(toastIdStr)) {
      return; // Prevent duplicate toast for the same event
    }
    recentNotificationIdsRef.current.add(toastIdStr);
    setTimeout(() => {
      recentNotificationIdsRef.current.delete(toastIdStr);
    }, 12000);

    if (inAppToastTimerRef.current) {
      clearTimeout(inAppToastTimerRef.current);
    }
    setInAppToast(toast);
    inAppToastTimerRef.current = setTimeout(() => {
      setInAppToast(null);
    }, 4500);
  };

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
  const openSettings = (section = null) => {
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

  // Register App-level modal back interceptors
  useEffect(() => {
    if (isCreatePostOpen) {
      return navigationService.registerBackInterceptor('app_create_post', () => {
        setIsCreatePostOpen(false);
        return true;
      }, 50);
    }
  }, [isCreatePostOpen]);

  useEffect(() => {
    if (isNotificationsOpen) {
      return navigationService.registerBackInterceptor('app_notifications', () => {
        setIsNotificationsOpen(false);
        return true;
      }, 50);
    }
  }, [isNotificationsOpen]);

  useEffect(() => {
    if (isProfileMenuOpen) {
      return navigationService.registerBackInterceptor('app_profile_menu', () => {
        setIsProfileMenuOpen(false);
        return true;
      }, 40);
    }
  }, [isProfileMenuOpen]);

  // Live Permission Onboarding & Cleared-Data Validation
  useEffect(() => {
    let isMounted = true;
    if (user && user.id && !isDemoMode) {
      permissionService.shouldShowPermissionOnboarding(user).then((shouldShow) => {
        if (isMounted && shouldShow) {
          setShowPermissionOnboarding(true);
          setIsManualOnboardingRecheck(false);
        }
      });
    } else {
      setShowPermissionOnboarding(false);
    }
    return () => { isMounted = false; };
  }, [user?.id, user?.has_completed_onboarding, isDemoMode]);

  // Listen for manual permission re-check trigger from Settings
  useEffect(() => {
    const handleOpenPermissionSetup = () => {
      setIsManualOnboardingRecheck(true);
      setShowPermissionOnboarding(true);
    };
    window.addEventListener('vibegrid:open-permission-setup', handleOpenPermissionSetup);
    return () => {
      window.removeEventListener('vibegrid:open-permission-setup', handleOpenPermissionSetup);
    };
  }, []);

  // Back interceptor for permission onboarding modal
  useEffect(() => {
    if (showPermissionOnboarding) {
      return navigationService.registerBackInterceptor('permission_onboarding', () => {
        if (isManualOnboardingRecheck) {
          setShowPermissionOnboarding(false);
          return true;
        }
        if (user?.id) {
          permissionService.dismissOnboardingForSession(user.id);
        }
        setShowPermissionOnboarding(false);
        return true;
      }, 25);
    }
  }, [showPermissionOnboarding, isManualOnboardingRecheck, user?.id]);

  // Initialize and handle browser back / popstate navigation
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;

    // Set root history state on initial load if none exists
    const initialTab = sessionStorage.getItem('vibegrid_active_tab') || 'feed';
    const initialUser = sessionStorage.getItem('vibegrid_viewed_username') || null;
    if (!window.history.state) {
      window.history.replaceState({ tab: initialTab, viewedUsername: initialUser, root: initialTab === 'feed' }, '');
    }

    navigationService.setRouteListener((state) => {
      if (state && state.tab) {
        setCurrentTab(state.tab);
        setViewedUsername(state.viewedUsername || null);
        setDirectMessageTarget(state.targetDM || null);
        if (state.section) {
          setSettingsSection(state.section);
        }
      } else {
        // Safe contextual fallback when popped to root or empty state
        if (viewedUsername) {
          setViewedUsername(null);
          return;
        }
        if (currentTab === 'settings') {
          setCurrentTab('profile');
          return;
        }
        if (currentTab !== 'feed') {
          setCurrentTab('feed');
          setViewedUsername(null);
          setDirectMessageTarget(null);
          window.history.replaceState({ tab: 'feed', viewedUsername: null, root: true }, '');
        } else {
          // On feed (root home screen), handle Android double-back exit gracefully
          const now = Date.now();
          if (now - lastBackPressTimeRef.current < 2000) {
            return;
          }
          lastBackPressTimeRef.current = now;
          window.history.pushState({ tab: 'feed', viewedUsername: null }, '');
          setShowExitToast(true);
          if (exitToastTimeoutRef.current) clearTimeout(exitToastTimeoutRef.current);
          exitToastTimeoutRef.current = setTimeout(() => setShowExitToast(false), 2000);
        }
      }
    });

    const handlePopState = (e) => {
      navigationService.handlePopState(e);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitToastTimeoutRef.current) clearTimeout(exitToastTimeoutRef.current);
    };
  }, [currentTab, viewedUsername]);

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

      // Ignore if active chat is open in MessagesPage
      if (typeof document !== 'undefined' && document.body.classList.contains('has-active-chat')) {
        touchStartRef.current.isIgnored = true;
        return;
      }

      // Nested Gesture Ownership:
      // Determine gesture ownership at touchstart. Local components have first priority:
      // 1. Stories (tray, scroll container, avatar circles, viewer modal)
      // 2. Categories carousel & chips
      // 3. For You / Following / Close Friends tabs
      // 4. Local carousels, sliders, text inputs, message composers, and overlays
      // Swiping inside these components will NOT trigger global Home <-> Explore navigation.
      // Touches on the Home Feed outside these components enable global page navigation.
      const ignoredSelector = [
        'input',
        'textarea',
        'select',
        '[contenteditable="true"]',
        '[role="slider"]',
        '.stories-bar',
        '.stories-container',
        '.story-tray',
        '.story-tray-wrapper',
        '.story-tray-scroll',
        '.story-item',
        '.story-avatar-container',
        '.story-slider',
        '.story-viewer-modal',
        '.story-viewer-container',
        '.story-viewer-overlay',
        '.feed-category-chips-bar-wrapper',
        '.feed-category-chips-bar',
        '.category-chip',
        '.feed-primary-tabs',
        '.feed-primary-tab',
        '.image-slider',
        '.carousel',
        '[data-no-swipe]',
        '.message-composer',
        '.chat-messages-container',
        '.messages-chat-view',
        '.confirm-modal-overlay',
        '.share-modal-overlay',
        '.forward-modal-overlay',
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
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // Section 6: If abs(deltaY) > abs(deltaX), allow normal vertical scrolling.
      // Cancel global horizontal navigation immediately once vertical movement dominates.
      if (absY > 10 && absY > absX) {
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

      // Must be a predominantly horizontal gesture (absX > absY) with deltaX >= 50px completed within 650ms
      if (deltaTime > 650 || absX < 50 || absX <= absY * 1.2) {
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
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          try { setSlideDirection(null); } catch {}
        }
      }, 250);

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
      const pathname = window.location.pathname || '';

      // Check group invite link, e.g. /join/:code or #join/:code
      let inviteCode = null;
      if (pathname.startsWith('/join/')) {
        inviteCode = pathname.replace('/join/', '').split('?')[0].split('#')[0].trim();
      } else if (hash.startsWith('#join/')) {
        inviteCode = hash.replace('#join/', '').split('?')[0].trim();
      }

      if (inviteCode) {
        window.history.replaceState(null, '', '/#messages');
        apiClient.post(`/conversations/join/${inviteCode}`)
          .then((res) => {
            if (res.success && res.data?.conversation_id) {
              navigateToTab('messages', { targetDM: `group-${res.data.conversation_id}` });
            } else if (res.data?.requested) {
              alert(res.data?.message || 'Join request submitted! An admin will review your request.');
              navigateToTab('feed');
            }
          })
          .catch((err) => {
            alert(err.message || 'Failed to join group via invite link.');
          });
        return;
      }

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

      // Global real-time message chime & in-app notification toast
      const handleGlobalIncomingMessage = (msg) => {
        if (!msg) return;
        // Do not display generic unread message toasts or play message chimes for call logs (missed calls, call logs)
        if (msg.message_type === 'call_log') return;

        if (Number(msg.sender_id) !== Number(user.id)) {
          setUnreadMessagesCount((prev) => prev + 1);
          if (currentTabRef.current !== 'messages') {
            try {
              soundFx.play('receive');
            } catch {}

            const senderName = msg.sender_username || msg.sender?.username || 'Contact';
            const snippet = msg.text || (msg.media_type ? `Sent ${msg.media_type}` : 'New encrypted message');
            triggerInAppToast({
              id: msg.id || `msg-${Date.now()}`,
              type: 'message',
              title: `@${senderName}`,
              body: snippet,
              avatar: msg.sender_avatar_url || msg.sender?.avatar_url,
              onClick: () => {
                navigateToTab('messages', { targetDM: senderName });
                setInAppToast(null);
              }
            });
          }
        }
      };

      const handleGlobalNotification = (notif) => {
        if (!notif) return;
        setUnreadCount((prev) => prev + 1);
        try {
          soundFx.play('receive');
        } catch {}

        triggerInAppToast({
          id: notif.id || `notif-${Date.now()}`,
          type: 'notification',
          title: notif.title || 'Activity Alert',
          body: notif.body || notif.message || 'You have new activity on VibeGrid',
          avatar: notif.sender_avatar_url,
          onClick: () => {
            openNotifications();
            setInAppToast(null);
          }
        });
      };

      // Listen for Service Worker postMessage (fallback for push events suppressed in foreground)
      const handleServiceWorkerMessage = (event) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
          const payload = event.data.payload || {};
          const notifType = payload.data?.type || payload.type || (payload.data?.callId || payload.tag?.startsWith('call-') ? 'call' : 'general');
          const isCall = notifType === 'call' || payload.type === 'call' || Boolean(payload.data?.callId) || Boolean(payload.tag?.startsWith('call-'));
          if (isCall) return; // Handled exclusively by CallModal incoming call flow

          const notifId = payload.data?.id || payload.tag || `sw-${Date.now()}`;
          triggerInAppToast({
            id: notifId,
            type: notifType,
            title: payload.title || 'VibeGrid',
            body: payload.body || 'New notification',
            avatar: payload.icon,
            onClick: () => {
              if (payload.data?.url?.includes('messages') || notifType === 'message') {
                navigateToTab('messages');
              } else {
                openNotifications();
              }
              setInAppToast(null);
            }
          });
        }
      };

      try {
        socketService.on('message:receive', handleGlobalIncomingMessage);
        socketService.on('notification:receive', handleGlobalNotification);
      } catch {}

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        try {
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        } catch {}
      }

      return () => {
        clearInterval(notifTimer);
        clearInterval(msgTimer);
        try {
          socketService.off('message:receive', handleGlobalIncomingMessage);
          socketService.off('notification:receive', handleGlobalNotification);
        } catch {}
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
          try {
            navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
          } catch {}
        }
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
    triggerCelebration({
      title: 'Post Published! 🎉',
      subtitle: 'Shared to your feed and followers'
    });
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
    <NavigationProvider navigateToTab={navigateToTab} currentTab={currentTab} viewedUsername={viewedUsername}>
      <VibiAssistantProvider>
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

      {/* Phase 7 Delight Feature: Offline & Reconnection Experience (Option 1: Floating Dynamic Pill & Emerald Pulse) */}
      <NetworkStatusPill isOffline={isOffline} />
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

                  {/* Vibi AI Assistant Entry */}
                  <li className="nav-item-vibi-header">
                    <VibiHeaderEntry />
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
                            openSettings();
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

            {/* Vibi Mobile Header Entry */}
            <VibiHeaderEntry isMobile={true} />

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
                  onClick={() => openSettings()}
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

      {/* In-App Real-Time Notification Toast Banner */}
      {inAppToast && (
        <div
          className="in-app-notification-toast"
          role="status"
          aria-live="polite"
          onClick={inAppToast.onClick}
        >
          <div className="in-app-toast-content">
            {inAppToast.avatar ? (
              <img
                src={inAppToast.avatar}
                alt=""
                className="in-app-toast-avatar"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="in-app-toast-icon">
                {inAppToast.type === 'message' ? '💬' : '🔔'}
              </div>
            )}
            <div className="in-app-toast-text">
              <span className="in-app-toast-title">{inAppToast.title}</span>
              <span className="in-app-toast-body">{inAppToast.body}</span>
            </div>
          </div>
          <button
            type="button"
            className="in-app-toast-close"
            aria-label="Dismiss notification"
            onClick={(e) => {
              e.stopPropagation();
              setInAppToast(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

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

      {/* Phase 1 Delight Feature & Phase 11 Easter Egg: Vibi Mascot */}
      <VibiMascotGreeting
        key={`vibi-${vibiEasterEgg.key}`}
        user={user}
        forceShow={vibiEasterEgg.active}
        customMessage={
          vibiEasterEgg.active
            ? "🌟 You unlocked the Secret Vibe Sparkle! You're an official Vibe Legend! 🦊✨"
            : null
        }
        onDismiss={() => setVibiEasterEgg((prev) => ({ ...prev, active: false }))}
      />

      {/* Phase 2 Delight Feature: Returning User Welcome Drop (Option 5) */}
      <ReturningUserWelcomeDrop user={user} unreadCount={unreadCount + unreadMessagesCount} />

      {/* Phase 5 Delight Feature: Aurora Radiance & Shimmer Celebration (Option 2) */}
      <AuroraCelebrationOverlay />

      {/* New User & Cleared-Data Permission Onboarding Modal */}
      {showPermissionOnboarding && user && (
        <PermissionOnboardingModal
          user={user}
          isOpen={true}
          isManualRecheck={isManualOnboardingRecheck}
          onClose={() => {
            if (user?.id) permissionService.dismissOnboardingForSession(user.id);
            setShowPermissionOnboarding(false);
          }}
          onComplete={() => {
            if (completeOnboarding) completeOnboarding();
            setShowPermissionOnboarding(false);
          }}
        />
      )}

      {/* Phase 2: Vibi AI Assistant UI Shell */}
      <VibiLauncher />
      <VibiPanel />
      </div>
    </VibiAssistantProvider>
    </NavigationProvider>
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
