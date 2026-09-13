/**
 * ============================================================================
 * TaskFlow — Authentication Logic (auth.js)
 * ============================================================================
 * 
 * Demonstrates:
 * 1. Form validation & event handling.
 * 2. Storing user authentication state in `localStorage`.
 * 3. Conditional redirection based on session state.
 * 4. Password show/hide DOM manipulation.
 */

const USER_STORAGE_KEY = 'taskflow_user';
const THEME_KEY = 'taskflow_theme';

// Configured default credentials requested by the user
const DEFAULT_AUTH = {
  username: '@tul',
  password: 'Atul'
};

// DOM Elements
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('togglePassword');
const errorAlert = document.getElementById('errorAlert');
const errorMessage = document.getElementById('errorMessage');
const autoFillBtn = document.getElementById('autoFillBtn');
const guestBtn = document.getElementById('guestBtn');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');

// ============================================================================
// 1. Theme Management (Sync with app theme)
// ============================================================================
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (themeIcon) themeIcon.textContent = '☀️';
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    if (themeIcon) themeIcon.textContent = '🌙';
  }
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    if (themeIcon) themeIcon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, newTheme);
  });
}

// ============================================================================
// 2. Password Visibility Toggle
// ============================================================================
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener('click', () => {
    const currentType = passwordInput.getAttribute('type');
    if (currentType === 'password') {
      passwordInput.setAttribute('type', 'text');
      togglePasswordBtn.textContent = '🙈';
    } else {
      passwordInput.setAttribute('type', 'password');
      togglePasswordBtn.textContent = '👁️';
    }
  });
}

// ============================================================================
// 3. Auto-fill Helper for Quick Testing
// ============================================================================
if (autoFillBtn) {
  autoFillBtn.addEventListener('click', () => {
    usernameInput.value = DEFAULT_AUTH.username;
    passwordInput.value = DEFAULT_AUTH.password;
    hideError();
  });
}

// ============================================================================
// 4. Error Display Helpers
// ============================================================================
function showError(msg) {
  errorMessage.textContent = msg;
  errorAlert.classList.remove('hidden');
}

function hideError() {
  errorAlert.classList.add('hidden');
}

usernameInput.addEventListener('input', hideError);
passwordInput.addEventListener('input', hideError);

// ============================================================================
// 5. Login Submission & Validation (Calls Real SQLite API with fallback)
// ============================================================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const enteredUsername = usernameInput.value.trim();
  const enteredPassword = passwordInput.value;

  // 1. First, try authenticating via SQLite REST API (when server is running)
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: enteredUsername, password: enteredPassword })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
        window.location.href = 'index.html';
        return;
      }
    } else if (res.status === 401) {
      const err = await res.json().catch(() => ({}));
      showError(err.error || 'Invalid username or password in database.');
      return;
    }
  } catch (err) {
    // If fetch failed (e.g. accessed directly via file:// instead of http://localhost:8000),
    // proceed to offline credential check:
    console.log('[Auth] Server not reachable, falling back to local verification:', err.message);
  }

  // 2. Offline / Local fallback validation
  if (
    enteredUsername === DEFAULT_AUTH.username &&
    enteredPassword === DEFAULT_AUTH.password
  ) {
    const userSession = {
      username: enteredUsername,
      isGuest: false,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userSession));
    window.location.href = 'index.html';
  } else {
    showError('Invalid username or password. Default is @tul / Atul');
  }
});

// ============================================================================
// 6. Optional Guest Access (Skip Login)
// ============================================================================
if (guestBtn) {
  guestBtn.addEventListener('click', () => {
    const guestSession = {
      username: 'Guest',
      isGuest: true,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(guestSession));
    window.location.href = 'index.html';
  });
}

// ============================================================================
// 7. Initialization
// ============================================================================
initTheme();
