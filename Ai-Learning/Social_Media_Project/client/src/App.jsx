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
  const [settingsSection, setSettingsSection] = useState('profile');
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

  // Open Settings helper
  const openSettings = (section = 'privacy') => {
    setSettingsSection(section);
    setViewedUsername(null);
    setCurrentTab('settings');
  };

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
      setCurrentTab('auth');
      try {
        sessionStorage.removeItem('vibegrid_active_tab');
        sessionStorage.removeItem('vibegrid_viewed_username');
      } catch {}
      setUnreadCount(0);
      setUnreadMessagesCount(0);
    }
  }, [user, loading]);

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
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const navigateToProfile = (username = null) => {
    setViewedUsername(username);
    setCurrentTab('profile');
  };

  const handlePostCreated = () => {
    setFeedRefreshKey((prev) => prev + 1);
    setCurrentTab('feed');
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
          <span className="pwa-status-icon">📡</span>
          <span className="pwa-status-text">You are currently offline. Cached feed and assets remain accessible.</span>
        </div>
      )}
      {hasUpdate && (
        <div className="pwa-update-banner" role="alert">
          <div className="pwa-update-info">
            <span className="pwa-update-icon">✨</span>
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
            onClick={() => {
              if (user) {
                setViewedUsername(null);
                setCurrentTab('feed');
              } else {
                setCurrentTab('feed');
              }
            }}
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
            <span className="nav-brand-title">VibeGrid</span>
          </div>

          {/* Demo Mode Indicator (Visible when in Demo Mode) */}
          <DemoModeIndicator 
            onNavigateToSignup={handleNavigateToSignup}
            onNavigateToLogin={handleNavigateToLogin}
          />

          {/* Desktop Navigation Links */}
          <nav className="nav-links desktop-only" aria-label="Main navigation">
            <ul className="nav-links-list">
              {user ? (
                <>
                  <li>
                    <a
                      href="#feed"
                      className={`nav-tab-btn ${currentTab === 'feed' && !viewedUsername ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setViewedUsername(null);
                        setCurrentTab('feed');
                      }}
                    >
                      🏠 Feed
                    </a>
                  </li>

                  <li>
                    <a
                      href="#explore"
                      className={`nav-tab-btn ${currentTab === 'explore' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentTab('explore');
                      }}
                    >
                      🔍 Explore
                    </a>
                  </li>

                  <li>
                    <button
                      type="button"
                      className="nav-tab-btn btn-create-nav"
                      onClick={() => {
                        if (guardDemoAction('create_post')) return;
                        setIsCreatePostOpen(true);
                      }}
                      title="Create and share a new post"
                    >
                      ➕ Create
                    </button>
                  </li>

                  <li>
                    <button
                      type="button"
                      className={`nav-tab-btn nav-notifications-btn ${isNotificationsOpen ? 'active' : ''}`}
                      onClick={() => setIsNotificationsOpen((prev) => !prev)}
                      title="Activity Notifications"
                    >
                      <span>🔔</span>
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
                        setDirectMessageTarget(null);
                        setCurrentTab('messages');
                      }}
                      title="Direct Messages"
                    >
                      <span>💬</span>
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
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="nav-avatar-mini" />
                      ) : (
                        <span className="nav-avatar-fallback-mini">
                          {user.username?.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="nav-profile-name">@{user.username}</span>
                      <span className="nav-chevron">{isProfileMenuOpen ? '▲' : '▼'}</span>
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
                          <span className="dropdown-icon">👤</span>
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
                          <span className="dropdown-icon">⚙️</span>
                          <span>Settings & Privacy</span>
                        </button>

                        {isTestUser && (
                          <button
                            type="button"
                            className="dropdown-item"
                            role="menuitem"
                            onClick={() => {
                              setCurrentTab('status');
                              setIsProfileMenuOpen(false);
                            }}
                          >
                            <span className="dropdown-icon">📊</span>
                            <span>System Status</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="dropdown-item"
                          role="menuitem"
                          onClick={toggleTheme}
                        >
                          <span className="dropdown-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
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
                            <span className="dropdown-icon">📲</span>
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
                          <span className="dropdown-icon">🚪</span>
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
                        setViewedUsername(null);
                        setCurrentTab('feed');
                      }}
                    >
                      🏠 Feed
                    </a>
                  </li>

                  <li>
                    <a
                      href="#explore"
                      className={`nav-tab-btn ${currentTab === 'explore' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentTab('explore');
                      }}
                    >
                      🔍 Explore
                    </a>
                  </li>

                  <li>
                    <a
                      href="#auth"
                      className={`nav-tab-btn ${currentTab === 'auth' ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentTab('auth');
                      }}
                    >
                      👤 Sign In / Register
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
                        📲 Install App
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
                      {theme === 'dark' ? '☀️' : '🌙'}
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
                📲 Install
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="nav-icon-btn-mobile"
              title="Toggle Dark/Light Mode"
              aria-label="Toggle dark/light theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {user ? (
              <>
                <button
                  className={`nav-icon-btn-mobile ${currentTab === 'messages' ? 'active' : ''}`}
                  onClick={() => {
                    setDirectMessageTarget(null);
                    setCurrentTab('messages');
                  }}
                  title="Direct Messages"
                  aria-label="Direct Messages"
                >
                  <span>💬</span>
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
                  <span>⚙️</span>
                </button>
              </>
            ) : (
              <button
                className="btn-primary btn-sm"
                onClick={() => setCurrentTab('auth')}
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
      <main className={`main-content ${user ? 'has-bottom-nav' : ''}`}>
        <ErrorBoundary>
          {currentTab === 'status' && (
            isTestUser ? (
              <StatusDashboard />
            ) : (
              <FeedPage
                key={feedRefreshKey}
                onOpenCreatePost={() => setIsCreatePostOpen(true)}
                onNavigateToProfile={(username) => navigateToProfile(username)}
              />
            )
          )}
          {currentTab === 'auth' && <AuthPage initialTab={authPageTab} />}
          {currentTab === 'feed' && (
            <FeedPage
              key={feedRefreshKey}
              onOpenCreatePost={() => {
                if (guardDemoAction('create_post')) return;
                setIsCreatePostOpen(true);
              }}
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
                onOpenCreatePost={() => {
                  if (guardDemoAction('create_post')) return;
                  setIsCreatePostOpen(true);
                }}
                onNavigateToProfile={(username) => navigateToProfile(username)}
                onOpenDirectMessage={(username) => {
                  setDirectMessageTarget(username);
                  setCurrentTab('messages');
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
                  setViewedUsername(null);
                  setCurrentTab('feed');
                }}
                title="Home Feed"
              >
                <span className="mobile-nav-icon">🏠</span>
                <span className="mobile-nav-label">Feed</span>
              </a>
            </li>

            <li>
              <a
                href="#explore"
                className={`mobile-nav-item ${currentTab === 'explore' ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentTab('explore');
                }}
                title="Explore"
              >
                <span className="mobile-nav-icon">🔍</span>
                <span className="mobile-nav-label">Explore</span>
              </a>
            </li>

            <li>
              <button
                type="button"
                className="mobile-nav-item mobile-nav-create-btn"
                onClick={() => {
                  if (guardDemoAction('create_post')) return;
                  setIsCreatePostOpen(true);
                }}
                title="Create Post"
              >
                <span className="mobile-nav-create-icon">➕</span>
              </button>
            </li>

            <li>
              <button
                type="button"
                className={`mobile-nav-item ${isNotificationsOpen ? 'active' : ''}`}
                onClick={() => setIsNotificationsOpen(true)}
                title="Activity Notifications"
              >
                <span className="mobile-nav-icon">
                  🔔
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
        onClose={() => setIsCreatePostOpen(false)}
        onPostCreated={handlePostCreated}
      />

      {/* Global Activity Notifications Modal */}
      <NotificationsModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onNavigateToProfile={navigateToProfile}
        onUnreadCountChange={(count) => {
          if (typeof count === 'number') {
            setUnreadCount(count);
          } else {
            fetchUnreadCount();
          }
        }}
      />

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
