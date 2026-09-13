import React, { useState, useEffect } from 'react';
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

function AppContent() {
  const { user, loading, logout } = useAuth();
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

  // Open Settings helper
  const openSettings = (section = 'profile') => {
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
      fetchUnreadCount();
      fetchUnreadMessagesCount();
      const notifTimer = setInterval(fetchUnreadCount, 20000);
      const msgTimer = setInterval(fetchUnreadMessagesCount, 15000);
      return () => {
        clearInterval(notifTimer);
        clearInterval(msgTimer);
      };
    } else {
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

  const showNavbar = user || currentTab === 'status';

  return (
    <div className={`app-viewport ${!showNavbar ? 'auth-mode-viewport' : ''}`}>
      {/* Top Navigation Bar */}
      {showNavbar && (
        <header className="top-navbar">
          <div className="top-navbar-container">
            <div 
              className="nav-brand" 
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (user) {
                  setViewedUsername(null);
                  setCurrentTab('feed');
                } else {
                  setCurrentTab('auth');
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

        {/* Desktop Navigation Links */}
        <nav className="nav-links desktop-only">
          {user && (
            <>
              <button
                className={`nav-tab-btn ${currentTab === 'feed' ? 'active' : ''}`}
                onClick={() => {
                  setViewedUsername(null);
                  setCurrentTab('feed');
                }}
              >
                🏠 Feed
              </button>

              <button
                className={`nav-tab-btn ${currentTab === 'explore' ? 'active' : ''}`}
                onClick={() => setCurrentTab('explore')}
              >
                🔍 Explore
              </button>

              <button
                className="nav-tab-btn btn-create-nav"
                onClick={() => setIsCreatePostOpen(true)}
                title="Create and share a new post"
              >
                ➕ Create
              </button>

              <button
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

              <button
                className={`nav-tab-btn nav-messages-btn ${currentTab === 'messages' ? 'active' : ''}`}
                onClick={() => {
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
              </button>

              <button
                className={`nav-tab-btn ${currentTab === 'profile' && !viewedUsername ? 'active' : ''}`}
                onClick={() => navigateToProfile(null)}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="nav-avatar-mini" />
                ) : (
                  <span className="nav-avatar-fallback-mini">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                )}
                <span>@{user.username}</span>
              </button>

              <button
                className={`nav-tab-btn ${currentTab === 'settings' ? 'active' : ''}`}
                onClick={() => openSettings('contact')}
                title="Settings & Privacy"
              >
                ⚙️ Settings
              </button>
            </>
          )}

          {isTestUser && (
            <button
              className={`nav-tab-btn ${currentTab === 'status' ? 'active' : ''}`}
              onClick={() => setCurrentTab('status')}
            >
              📊 System Status
            </button>
          )}

          {!user && (
            <button
              className={`nav-tab-btn ${currentTab === 'auth' ? 'active' : ''}`}
              onClick={() => setCurrentTab('auth')}
            >
              👤 Sign In / Register
            </button>
          )}

          {user && (
            <button
              onClick={logout}
              className="nav-tab-btn nav-logout-btn"
              title="Sign out of your account"
            >
              Sign Out
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="nav-tab-btn nav-theme-btn"
            title="Toggle Dark/Light Mode"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </nav>

        {/* Mobile Header Actions (Visible on mobile <= 768px) */}
        <div className="mobile-header-actions mobile-only">
          <button
            onClick={toggleTheme}
            className="nav-icon-btn-mobile"
            title="Toggle Dark/Light Mode"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user ? (
            <>
              <button
                className={`nav-icon-btn-mobile ${isNotificationsOpen ? 'active' : ''}`}
                onClick={() => setIsNotificationsOpen((prev) => !prev)}
                title="Activity Notifications"
              >
                <span>🔔</span>
                {unreadCount > 0 && (
                  <span className="nav-unread-badge-mobile">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              <button
                className={`nav-icon-btn-mobile ${currentTab === 'messages' ? 'active' : ''}`}
                onClick={() => {
                  setDirectMessageTarget(null);
                  setCurrentTab('messages');
                }}
                title="Direct Messages"
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
                onClick={() => openSettings('contact')}
                title="Settings & Privacy"
              >
                <span>⚙️</span>
              </button>
            </>
          ) : (
            <button
              className="btn-primary btn-sm"
              onClick={() => setCurrentTab('auth')}
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
    )}

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
          {currentTab === 'auth' && <AuthPage />}
          {currentTab === 'feed' && (
            <FeedPage
              key={feedRefreshKey}
              onOpenCreatePost={() => setIsCreatePostOpen(true)}
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
                onOpenCreatePost={() => setIsCreatePostOpen(true)}
                onNavigateToProfile={(username) => navigateToProfile(username)}
                onOpenDirectMessage={(username) => {
                  setDirectMessageTarget(username);
                  setCurrentTab('messages');
                }}
                onOpenSettings={openSettings}
              />
            ) : (
              <AuthPage />
            )
          )}
          {currentTab === 'settings' && (
            user ? (
              <SettingsPage
                initialSection={settingsSection}
                onNavigateToProfile={(username) => navigateToProfile(username)}
              />
            ) : (
              <AuthPage />
            )
          )}
        </ErrorBoundary>
      </main>

      {/* Mobile Bottom Navigation Bar (Visible on mobile <= 768px when logged in) */}
      {user && (
        <nav className="mobile-bottom-navbar mobile-only">
          <button
            type="button"
            className={`mobile-nav-item ${currentTab === 'feed' && !viewedUsername ? 'active' : ''}`}
            onClick={() => {
              setViewedUsername(null);
              setCurrentTab('feed');
            }}
            title="Home Feed"
          >
            <span className="mobile-nav-icon">🏠</span>
            <span className="mobile-nav-label">Feed</span>
          </button>

          <button
            type="button"
            className={`mobile-nav-item ${currentTab === 'explore' ? 'active' : ''}`}
            onClick={() => setCurrentTab('explore')}
            title="Explore"
          >
            <span className="mobile-nav-icon">🔍</span>
            <span className="mobile-nav-label">Explore</span>
          </button>

          <button
            type="button"
            className="mobile-nav-item mobile-nav-create-btn"
            onClick={() => setIsCreatePostOpen(true)}
            title="Create Post"
          >
            <span className="mobile-nav-create-icon">➕</span>
          </button>

          {isTestUser && (
            <button
              type="button"
              className={`mobile-nav-item ${currentTab === 'status' ? 'active' : ''}`}
              onClick={() => setCurrentTab('status')}
              title="System Status"
            >
              <span className="mobile-nav-icon">📊</span>
              <span className="mobile-nav-label">Status</span>
            </button>
          )}

          <button
            type="button"
            className={`mobile-nav-item ${currentTab === 'profile' && !viewedUsername ? 'active' : ''}`}
            onClick={() => navigateToProfile(null)}
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
          </button>
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
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
