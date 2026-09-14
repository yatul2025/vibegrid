import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../api/client';

export default function AuthPage({ initialTab = 'login' }) {
  const { user, login, verifyLoginOtp, resendLoginOtp, register, verifyRegisterOtp, resendRegisterOtp, logout, startDemoSession } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab); // 'login' | 'register'

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // 2FA Login OTP states
  const [loginStep, setLoginStep] = useState('credentials'); // 'credentials' | 'otp'
  const [loginToken, setLoginToken] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState(null);
  const [otpSuccessMsg, setOtpSuccessMsg] = useState(null);
  const [devOtp, setDevOtp] = useState(null);
  const [otpCooldown, setOtpCooldown] = useState(0);

  // Registration OTP states
  const [registerStep, setRegisterStep] = useState('form'); // 'form' | 'otp'
  const [registerToken, setRegisterToken] = useState(null);
  const [registerMaskedEmail, setRegisterMaskedEmail] = useState('');
  const [registerOtpCode, setRegisterOtpCode] = useState('');
  const [registerOtpLoading, setRegisterOtpLoading] = useState(false);
  const [registerOtpError, setRegisterOtpError] = useState(null);
  const [registerOtpSuccessMsg, setRegisterOtpSuccessMsg] = useState(null);
  const [registerDevOtp, setRegisterDevOtp] = useState(null);
  const [registerOtpCooldown, setRegisterOtpCooldown] = useState(0);

  // Countdown timer for 2FA Login OTP resend cooldown
  useEffect(() => {
    let timer;
    if (otpCooldown > 0) {
      timer = setInterval(() => {
        setOtpCooldown((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCooldown]);

  // Countdown timer for Registration OTP resend cooldown
  useEffect(() => {
    let timer;
    if (registerOtpCooldown > 0) {
      timer = setInterval(() => {
        setRegisterOtpCooldown((prev) => (prev > 1 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [registerOtpCooldown]);

  // Form states
  const [loginData, setLoginData] = useState({
    identifier: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    email: '',
    fullName: '',
    username: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    gender: 'unspecified'
  });

  // Password Recovery / Reset states
  const [recoveryState, setRecoveryState] = useState({
    step: 'request', // 'request' | 'reset' | 'done'
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: '',
    loading: false,
    error: null,
    message: null,
    devOtp: null
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Maximum allowed date of birth (must be at least 18 years old)
  const maxDobDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  // Real-time client-side validation helpers
  const cleanUsername = registerData.username.trim();
  const usernameFormatValid = !cleanUsername || /^[a-zA-Z0-9_]+$/.test(cleanUsername);
  const passwordMatch = !registerData.confirmPassword || registerData.password === registerData.confirmPassword;
  const isAgeValid = !registerData.dateOfBirth || (() => {
    const dob = new Date(registerData.dateOfBirth);
    if (isNaN(dob.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 18;
  })();

  // Real-time Password strength calculator
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', checks: { length: false, number: false, letter: false, special: false } };
    const checks = {
      length: pwd.length >= 8,
      number: /[0-9]/.test(pwd),
      letter: /[a-zA-Z]/.test(pwd),
      special: /[^a-zA-Z0-9]/.test(pwd)
    };
    let score = 0;
    if (checks.length) score++;
    if (checks.number) score++;
    if (checks.letter) score++;
    if (checks.special || pwd.length >= 12) score++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return { score, label: labels[score] || 'Weak', checks };
  };

  const passwordStrength = getPasswordStrength(registerData.password);

  // Dummy Info Modals (Terms, Privacy, Locations, Contact Uploading, Help)
  const [infoModal, setInfoModal] = useState(null);

  const DEMO_PERSONAS = [
    { username: 'sophia_wander', name: 'Sophia', icon: '✈️', role: '📸 Travel & Photography' },
    { username: 'alex_design', name: 'Alex', icon: '📐', role: '📐 Architecture & Design' },
    { username: 'elena_culinary', name: 'Elena', icon: '🥐', role: '🥐 Pastry & Specialty Coffee' },
    { username: 'liam_visuals', name: 'Liam', icon: '🌧️', role: '🌧️ Street & Cyberpunk' }
  ];

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;
    setRegisterData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const identifier = loginData.identifier.trim();
    const { password } = loginData;

    if (!identifier || !password) {
      setError('Please enter your username/email and password.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await login(identifier, password, false);
      if (res?.step === 'otp_required') {
        setLoginStep('otp');
        setLoginToken(res.loginToken);
        setMaskedEmail(res.maskedEmail || '');
        setDevOtp(res.debugOtp || null);
        setOtpCooldown(60);
        setOtpCode('');
        setOtpError(null);
        setOtpSuccessMsg(null);
      }
    } catch (err) {
      setError(err.message || 'Invalid username/email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setOtpError('Please enter the full 6-digit verification code.');
      return;
    }
    setOtpError(null);
    setOtpSuccessMsg(null);
    setOtpLoading(true);
    try {
      await verifyLoginOtp(loginToken, cleanOtp);
    } catch (err) {
      setOtpError(err.message || 'Invalid or expired verification code.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpCooldown > 0 || !loginToken) return;
    setOtpError(null);
    setOtpSuccessMsg(null);
    setOtpLoading(true);
    try {
      const res = await resendLoginOtp(loginToken);
      setOtpSuccessMsg('A fresh verification code has been dispatched to your email.');
      if (res?.debugOtp) {
        setDevOtp(res.debugOtp);
      }
      setOtpCooldown(60);
    } catch (err) {
      setOtpError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleBackToCredentials = () => {
    setLoginStep('credentials');
    setOtpCode('');
    setOtpError(null);
    setOtpSuccessMsg(null);
    setLoginToken(null);
    setDevOtp(null);
  };

  const handleDemoLogin = async (username) => {
    setError(null);
    setLoading(true);
    try {
      await startDemoSession(username);
    } catch (err) {
      setError(err.message || 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    const email = registerData.email.trim().toLowerCase();
    const username = registerData.username.trim().toLowerCase();
    const fullName = registerData.fullName.trim();
    const { password, confirmPassword } = registerData;

    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!username) {
      setError('Please choose a username.');
      return;
    }
    if (username.length < 3 || username.length > 30) {
      setError('Username must be between 3 and 30 characters long.');
      return;
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
      setError('Username can only contain letters, numbers, and underscores (no spaces).');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password.length > 128) {
      setError('Password cannot exceed 128 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }

    const { dateOfBirth, gender } = registerData;
    if (!dateOfBirth) {
      setError('Please provide your date of birth.');
      return;
    }
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) {
      setError('Please enter a valid date of birth.');
      return;
    }
    const today = new Date();
    let calculatedAge = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      calculatedAge--;
    }
    if (calculatedAge < 18) {
      setError('You must be at least 18 years old to join VibeGrid.');
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const res = await register({
        username,
        email,
        fullName: fullName || null,
        password,
        dateOfBirth,
        gender: gender || 'unspecified'
      });

      if (res?.step === 'otp_required') {
        setRegisterStep('otp');
        setRegisterToken(res.registerToken);
        setRegisterMaskedEmail(res.maskedEmail || email);
        setRegisterDevOtp(res.debugOtp || null);
        setRegisterOtpCooldown(60);
        setRegisterOtpCode('');
        setRegisterOtpError(null);
        setRegisterOtpSuccessMsg(null);
      }
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRegisterOtpSubmit = async (e) => {
    e.preventDefault();
    const cleanOtp = registerOtpCode.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setRegisterOtpError('Please enter the full 6-digit confirmation code.');
      return;
    }
    setRegisterOtpError(null);
    setRegisterOtpSuccessMsg(null);
    setRegisterOtpLoading(true);
    try {
      await verifyRegisterOtp(registerToken, cleanOtp);
    } catch (err) {
      setRegisterOtpError(err.message || 'Invalid or expired confirmation code.');
    } finally {
      setRegisterOtpLoading(false);
    }
  };

  const handleResendRegisterOtp = async () => {
    if (registerOtpCooldown > 0 || !registerToken) return;
    setRegisterOtpError(null);
    setRegisterOtpSuccessMsg(null);
    setRegisterOtpLoading(true);
    try {
      const res = await resendRegisterOtp(registerToken);
      setRegisterOtpSuccessMsg('A fresh verification code has been dispatched to your email.');
      if (res?.registerToken) {
        setRegisterToken(res.registerToken);
      }
      if (res?.debugOtp) {
        setRegisterDevOtp(res.debugOtp);
      }
      setRegisterOtpCooldown(60);
    } catch (err) {
      setRegisterOtpError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setRegisterOtpLoading(false);
    }
  };

  const handleBackToRegisterForm = () => {
    setRegisterStep('form');
    setRegisterOtpCode('');
    setRegisterOtpError(null);
    setRegisterOtpSuccessMsg(null);
    setRegisterToken(null);
    setRegisterDevOtp(null);
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    const email = recoveryState.email.trim();
    if (!email) {
      setRecoveryState((prev) => ({ ...prev, error: 'Please enter your email address.' }));
      return;
    }
    setRecoveryState((prev) => ({ ...prev, loading: true, error: null, message: null }));
    try {
      const res = await apiClient.post('/auth/forgot-password', { email });
      setRecoveryState((prev) => ({
        ...prev,
        step: 'reset',
        loading: false,
        message: res.message || 'Reset code sent to your email.',
        devOtp: res._devDebug?.otp || null
      }));
    } catch (err) {
      setRecoveryState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to request password reset.'
      }));
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    const { email, otp, newPassword, confirmPassword } = recoveryState;
    if (!otp || otp.trim().length !== 6) {
      setRecoveryState((prev) => ({ ...prev, error: 'Please enter the 6-digit OTP code.' }));
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setRecoveryState((prev) => ({ ...prev, error: 'Password must be at least 8 characters long.' }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setRecoveryState((prev) => ({ ...prev, error: 'Passwords do not match.' }));
      return;
    }
    setRecoveryState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await apiClient.post('/auth/reset-password', {
        email: email.trim(),
        otp: otp.trim(),
        newPassword
      });
      setRecoveryState((prev) => ({
        ...prev,
        step: 'done',
        loading: false,
        message: res.message || 'Password has been reset successfully!'
      }));
    } catch (err) {
      setRecoveryState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Reset failed. Please verify your OTP.'
      }));
    }
  };

  return (
    <div className="ig-auth-wrapper">
      <div className="ig-auth-container">
        {/* =========================================================================
            LEFT COLUMN: HERO SHOWCASE (Brand, Catchy Slogan, Floating Story Mockup)
            ========================================================================= */}
        <div className="ig-auth-hero">
          {/* Custom Glowing Gradient VibeGrid Brand Logo */}
          <div className="vg-hero-brand" title="VibeGrid">
            <div className="vg-hero-logo-box">
              <svg viewBox="0 0 52 52" className="vg-hero-logo-svg" fill="none">
                <defs>
                  <linearGradient id="vgGradHero" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f09433" />
                    <stop offset="25%" stopColor="#e6683c" />
                    <stop offset="50%" stopColor="#dc2743" />
                    <stop offset="75%" stopColor="#cc2366" />
                    <stop offset="100%" stopColor="#bc1888" />
                  </linearGradient>
                  <linearGradient id="vgVGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="100%" stopColor="#fff2f6" />
                  </linearGradient>
                </defs>
                {/* Rounded Squircle Background */}
                <rect width="52" height="52" rx="16" fill="url(#vgGradHero)" />
                {/* Constellation Grid Dots representing VibeGrid */}
                <circle cx="41" cy="11" r="2.4" fill="white" opacity="0.95" />
                <circle cx="41" cy="19" r="1.6" fill="white" opacity="0.6" />
                <circle cx="33" cy="11" r="1.6" fill="white" opacity="0.6" />
                {/* Modern Sharp 'V' Glyph */}
                <path
                  d="M14 15 L26 38 L38 15"
                  stroke="url(#vgVGrad)"
                  strokeWidth="5.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          {/* Catchy Slogan with Gradient Highlight */}
          <h1 className="ig-hero-headline">
            See everyday moments from your{' '}
            <span className="ig-hero-highlight">close friends</span>.
          </h1>

          {/* Value Proposition Subtitle (Audit Item: Value prop visible above fold) */}
          <p className="ig-auth-hero-subtext" style={{ fontSize: '15px', color: 'var(--text-secondary, #94a3b8)', margin: '0 0 16px', maxWidth: '420px', lineHeight: '1.4' }}>
            Next-gen real-time social platform. Live feeds, 24-hour stories, encrypted messaging, and creator discovery.
          </p>

          {/* Risk Reversal & Guarantees Trust Strip (Audit Item: Risk reversal / guarantees) */}
          <div className="ig-trust-strip" role="region" aria-label="Platform Guarantees">
            <span className="ig-trust-pill"><span>✓</span> 100% Free Forever</span>
            <span className="ig-trust-pill"><span>✓</span> No Credit Card</span>
            <span className="ig-trust-pill"><span>🛡️</span> End-to-End Encrypted</span>
            <span className="ig-trust-pill"><span>🔒</span> Zero Ad Tracking</span>
          </div>

          {/* Layered Floating Phone Story Cards Mockup (Matches Screenshot) */}
          <div className="ig-hero-mockup-stage">
            {/* Left Angled Story Card */}
            <div className="ig-floating-card ig-card-left">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
                alt="Story thumbnail"
                className="ig-card-bg"
              />
              <div className="ig-story-bar"><div className="ig-story-progress" style={{ width: '45%' }} /></div>
            </div>

            {/* Right Angled Story Card */}
            <div className="ig-floating-card ig-card-right">
              <img
                src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=400&q=80"
                alt="Story thumbnail"
                className="ig-card-bg"
              />
              <div className="ig-close-friends-badge">
                <span>★</span>
              </div>
              <div className="ig-avatar-mini-ring">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80"
                  alt="Friend avatar"
                />
              </div>
            </div>

            {/* Center Main Phone Card */}
            <div className="ig-floating-card ig-card-center">
              <img
                src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=720&q=80"
                alt="Friends moments"
                className="ig-card-bg"
              />

              {/* Story Top Progress Bar */}
              <div className="ig-story-bar">
                <div className="ig-story-progress" style={{ width: '80%' }} />
              </div>

              {/* Floating Emojis Overlay */}
              <div className="ig-reaction-bubble">
                <span>🔮</span>
                <span>👀</span>
                <span>🥳</span>
              </div>

              {/* Bottom Quick Reply & Like Pill */}
              <div className="ig-story-bottom-bar">
                <div className="ig-story-reply-box">Send message</div>
                <div className="ig-story-heart">🤍</div>
              </div>
            </div>

            {/* Floating Pop Heart Graphic */}
            <div className="ig-floating-heart-bubble">
              💖
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: AUTH CARD (Log In / Create Account Forms)
            ========================================================================= */}
        <div className="ig-auth-form-pane">
          {user ? (
            /* Logged In View */
            <div className="ig-auth-box">
              <h2 className="ig-auth-title">Welcome back, @{user.username}!</h2>
              <div className="ig-active-user-preview">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="ig-user-avatar-lg" />
                ) : (
                  <div className="ig-avatar-fallback-lg">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="ig-user-details">
                  <strong>{user.full_name || `@${user.username}`}</strong>
                  <span className="ig-user-email">{user.email}</span>
                  <span className="ig-badge-verified">✓ Active Session</span>
                </div>
              </div>

              <button
                type="button"
                className="ig-btn-primary"
                onClick={() => window.location.reload()}
              >
                Continue to Feed
              </button>

              <button
                type="button"
                className="ig-btn-secondary"
                style={{ marginTop: '10px', color: 'var(--danger)' }}
                onClick={logout}
              >
                Sign Out
              </button>
            </div>
          ) : activeTab === 'login' ? (
            loginStep === 'otp' ? (
              /* 1B. Two-Factor Authentication OTP Verification Form */
              <div className="ig-auth-box">
                <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto',
                    fontSize: '24px'
                  }}>
                    🛡️
                  </div>
                  <h2 className="ig-auth-title" style={{ marginBottom: '6px' }}>Two-Factor Verification</h2>
                  <p className="ig-auth-subtext" style={{ fontSize: '13px', color: '#94a3b8', margin: '0' }}>
                    Enter the 6-digit security code sent to
                    <br />
                    <strong style={{ color: '#f1f5f9', wordBreak: 'break-all' }}>{maskedEmail || 'your email'}</strong>
                  </p>
                </div>

                {devOtp && (
                  <div style={{
                    background: 'rgba(234, 179, 8, 0.12)',
                    border: '1px solid rgba(234, 179, 8, 0.35)',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    fontSize: '12px',
                    color: '#facc15',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>⚡ <strong>Dev Mode Code:</strong> <code style={{ letterSpacing: '2px', fontSize: '14px', fontWeight: 'bold' }}>{devOtp}</code></span>
                    <button
                      type="button"
                      onClick={() => setOtpCode(devOtp)}
                      style={{
                        background: 'rgba(234, 179, 8, 0.25)',
                        border: '1px solid rgba(234, 179, 8, 0.5)',
                        color: '#fff',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '600'
                      }}
                    >
                      Auto-Fill
                    </button>
                  </div>
                )}

                {otpError && <div className="ig-auth-error">⚠️ {otpError}</div>}
                {otpSuccessMsg && (
                  <div style={{
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#34d399',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    textAlign: 'center',
                    marginBottom: '16px'
                  }}>
                    ✓ {otpSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleVerifyOtpSubmit} className="ig-form">
                  <div className="ig-input-group">
                    <label htmlFor="login-otp-code" className="sr-only">6-digit security code</label>
                    <input
                      id="login-otp-code"
                      aria-label="6-digit security code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtpCode(val);
                        if (otpError) setOtpError(null);
                      }}
                      autoFocus
                      style={{
                        textAlign: 'center',
                        letterSpacing: '10px',
                        fontSize: '24px',
                        fontWeight: '700',
                        padding: '12px',
                        fontFamily: 'monospace'
                      }}
                      className="ig-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={otpLoading || otpCode.trim().length !== 6}
                    className="ig-btn-primary"
                    style={{ marginTop: '12px' }}
                    aria-busy={otpLoading ? 'true' : 'false'}
                  >
                    {otpLoading ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <span className="spinner-mini" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                        <span>Verifying Security Code...</span>
                      </span>
                    ) : (
                      'Verify & Log In'
                    )}
                  </button>
                </form>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '18px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                  fontSize: '13px'
                }}>
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    className="ig-link-button"
                    style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    ← Back to Login
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={otpCooldown > 0 || otpLoading}
                    className="ig-link-button"
                    style={{ color: otpCooldown > 0 ? '#64748b' : 'var(--primary, #3897f0)' }}
                  >
                    {otpCooldown > 0 ? `Resend in ${otpCooldown}s` : 'Resend Code'}
                  </button>
                </div>

                <div className="vg-auth-brand-badge" style={{ marginTop: '20px' }}>
                  <span className="vg-badge-v">V</span>
                  <span className="vg-badge-text">VibeGrid Secure 2FA</span>
                </div>
              </div>
            ) : (
              /* 1A. Log In Form (Standard Credentials) */
              <div className="ig-auth-box">
                <h2 className="ig-auth-title">Log into VibeGrid</h2>
                <p className="ig-auth-subtext" style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 14px' }}>
                  Connect with friends, share vibes, and discover live stories.
                </p>

                {/* Risk Reversal & Guarantees Trust Strip (Visible Above Fold) */}
                <div className="ig-trust-strip" style={{ margin: '0 0 16px', gap: '6px' }} role="region" aria-label="Guarantees">
                  <span className="ig-trust-pill"><span>✓</span> Free Forever</span>
                  <span className="ig-trust-pill"><span>🛡️</span> Private & Encrypted</span>
                  <span className="ig-trust-pill"><span>🔒</span> Zero Ad Tracking</span>
                </div>

                {error && <div className="ig-auth-error">⚠️ {error}</div>}

                <form onSubmit={handleLoginSubmit} className="ig-form">
                  <div className="ig-input-group">
                    <label htmlFor="login-identifier" className="sr-only">
                      Mobile number, username or email
                    </label>
                    <input
                      id="login-identifier"
                      aria-label="Mobile number, username or email"
                      type="text"
                      name="identifier"
                      placeholder="Mobile number, username or email"
                      value={loginData.identifier}
                      onChange={handleLoginChange}
                      required
                      maxLength={255}
                      autoComplete="username"
                      inputMode="text"
                      className="ig-input"
                    />
                  </div>

                  <div className="ig-input-group ig-password-group">
                    <label htmlFor="login-password" className="sr-only">
                      Password
                    </label>
                    <input
                      id="login-password"
                      aria-label="Password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Password"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      required
                      maxLength={128}
                      autoComplete="current-password"
                      className="ig-input"
                    />
                    {loginData.password && (
                      <button
                        type="button"
                        className="ig-peek-btn"
                        onClick={() => setShowPassword((p) => !p)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !loginData.identifier.trim() || !loginData.password}
                    className="ig-btn-primary"
                    aria-busy={loading ? 'true' : 'false'}
                  >
                    {loading ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                        <span className="spinner-mini" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                        <span>Logging in...</span>
                      </span>
                    ) : (
                      'Log in'
                    )}
                  </button>
                </form>

                <div className="ig-forgot-link">
                  <button
                    type="button"
                    onClick={() => setInfoModal('forgot')}
                    className="ig-link-button"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Demo 1-Click Login Row */}
                <div className="ig-divider">
                  <span>OR TRY AS DEMO USER</span>
                </div>

                <div className="ig-demo-chips">
                  {DEMO_PERSONAS.map((p) => (
                    <button
                      key={p.username}
                      type="button"
                      className="ig-demo-chip"
                      onClick={() => handleDemoLogin(p.username)}
                      disabled={loading}
                      title={p.role}
                    >
                      <span>{p.icon}</span> @{p.username}
                    </button>
                  ))}
                </div>

                {/* Create New Account Button */}
                <div className="ig-create-account-wrapper">
                  <button
                    type="button"
                    className="ig-btn-outline"
                    onClick={() => {
                      setActiveTab('register');
                      setLoginStep('credentials');
                      setRegisterStep('form');
                      setError(null);
                    }}
                  >
                    Create new account
                  </button>
                </div>

                {/* VibeGrid Official Brand Badge */}
                <div className="vg-auth-brand-badge">
                  <span className="vg-badge-v">V</span>
                  <span className="vg-badge-text">from VibeGrid</span>
                </div>
              </div>
            )
          ) : registerStep === 'otp' ? (
            /* 2B. Signup Email OTP Verification Form */
            <div className="ig-auth-box">
              <div style={{ textAlign: 'center', marginBottom: '18px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(236, 72, 153, 0.12)',
                  border: '1px solid rgba(236, 72, 153, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px auto',
                  fontSize: '24px'
                }}>
                  ✨
                </div>
                <h2 className="ig-auth-title" style={{ marginBottom: '6px' }}>Verify Your Email</h2>
                <p className="ig-auth-subtext" style={{ fontSize: '13px', color: '#94a3b8', margin: '0' }}>
                  Enter the 6-digit confirmation code sent to
                  <br />
                  <strong style={{ color: '#f1f5f9', wordBreak: 'break-all' }}>{registerMaskedEmail || registerData.email}</strong>
                </p>
              </div>

              {registerDevOtp && (
                <div style={{
                  background: 'rgba(234, 179, 8, 0.12)',
                  border: '1px solid rgba(234, 179, 8, 0.35)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#facc15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span>⚡ <strong>Dev Mode Code:</strong> <code style={{ letterSpacing: '2px', fontSize: '14px', fontWeight: 'bold' }}>{registerDevOtp}</code></span>
                  <button
                    type="button"
                    onClick={() => setRegisterOtpCode(registerDevOtp)}
                    style={{
                      background: 'rgba(234, 179, 8, 0.25)',
                      border: '1px solid rgba(234, 179, 8, 0.5)',
                      color: '#fff',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    Auto-Fill
                  </button>
                </div>
              )}

              {registerOtpError && <div className="ig-auth-error">⚠️ {registerOtpError}</div>}
              {registerOtpSuccessMsg && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#34d399',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  textAlign: 'center',
                  marginBottom: '16px'
                }}>
                  ✓ {registerOtpSuccessMsg}
                </div>
              )}

              <form onSubmit={handleVerifyRegisterOtpSubmit} className="ig-form">
                <div className="ig-input-group">
                  <label htmlFor="reg-otp-code" className="sr-only">6-digit activation code</label>
                  <input
                    id="reg-otp-code"
                    aria-label="6-digit activation code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={registerOtpCode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setRegisterOtpCode(val);
                      if (registerOtpError) setRegisterOtpError(null);
                    }}
                    autoFocus
                    style={{
                      textAlign: 'center',
                      letterSpacing: '10px',
                      fontSize: '24px',
                      fontWeight: '700',
                      padding: '12px',
                      fontFamily: 'monospace'
                    }}
                    className="ig-input"
                  />
                </div>

                <button
                  type="submit"
                  disabled={registerOtpLoading || registerOtpCode.trim().length !== 6}
                  className="ig-btn-primary"
                  style={{ marginTop: '12px' }}
                  aria-busy={registerOtpLoading ? 'true' : 'false'}
                >
                  {registerOtpLoading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <span className="spinner-mini" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                      <span>Verifying & Creating Account...</span>
                    </span>
                  ) : (
                    'Confirm & Activate Account'
                  )}
                </button>
              </form>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '18px',
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))',
                fontSize: '13px'
              }}>
                <button
                  type="button"
                  onClick={handleBackToRegisterForm}
                  className="ig-link-button"
                  style={{ color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  ← Edit Details
                </button>

                <button
                  type="button"
                  onClick={handleResendRegisterOtp}
                  disabled={registerOtpCooldown > 0 || registerOtpLoading}
                  className="ig-link-button"
                  style={{ color: registerOtpCooldown > 0 ? '#64748b' : 'var(--primary, #3897f0)' }}
                >
                  {registerOtpCooldown > 0 ? `Resend in ${registerOtpCooldown}s` : 'Resend Code'}
                </button>
              </div>

              <div className="vg-auth-brand-badge" style={{ marginTop: '20px' }}>
                <span className="vg-badge-v">V</span>
                <span className="vg-badge-text">VibeGrid Secure Sign-Up</span>
              </div>
            </div>
          ) : (
            /* 2A. Create Account / Register Form */
            <div className="ig-auth-box">
              <h2 className="ig-auth-title">Create your account</h2>
              <p className="ig-auth-subtext" style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 14px' }}>
                Sign up to see everyday moments, stories, and discovery feeds from your friends.
              </p>

              {/* Risk Reversal & Guarantees Trust Strip (Visible Above Fold) */}
              <div className="ig-trust-strip" style={{ margin: '0 0 16px', gap: '6px' }} role="region" aria-label="Guarantees">
                <span className="ig-trust-pill"><span>✓</span> 100% Free Forever</span>
                <span className="ig-trust-pill"><span>✓</span> No Credit Card</span>
                <span className="ig-trust-pill"><span>🛡️</span> Private & Encrypted</span>
              </div>

              {error && <div className="ig-auth-error">⚠️ {error}</div>}

              <form onSubmit={handleRegisterSubmit} className="ig-form">
                <div className="ig-input-group">
                  <label htmlFor="reg-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="reg-email"
                    aria-label="Email address"
                    type="email"
                    name="email"
                    placeholder="Email address"
                    value={registerData.email}
                    onChange={handleRegisterChange}
                    required
                    maxLength={255}
                    autoComplete="email"
                    className="ig-input"
                  />
                </div>

                <div className="ig-input-group">
                  <label htmlFor="reg-full-name" className="sr-only">
                    Full Name
                  </label>
                  <input
                    id="reg-full-name"
                    aria-label="Full Name"
                    type="text"
                    name="fullName"
                    placeholder="Full Name"
                    value={registerData.fullName}
                    onChange={handleRegisterChange}
                    maxLength={100}
                    className="ig-input"
                  />
                </div>

                <div className="ig-input-group">
                  <label htmlFor="reg-username" className="sr-only">
                    Username
                  </label>
                  <input
                    id="reg-username"
                    aria-label="Username"
                    type="text"
                    name="username"
                    placeholder="Username (e.g. maya_lin)"
                    value={registerData.username}
                    onChange={handleRegisterChange}
                    required
                    maxLength={30}
                    autoComplete="username"
                    className={`ig-input ${!usernameFormatValid ? 'input-error' : ''}`}
                  />
                  {!usernameFormatValid && (
                    <span className="ig-field-error">Letters, numbers, and underscores only (no spaces)</span>
                  )}
                </div>

                <div className="ig-input-group ig-password-group">
                  <label htmlFor="reg-password" className="sr-only">
                    Password
                  </label>
                  <input
                    id="reg-password"
                    aria-label="Password (minimum 8 characters)"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Password (minimum 8 characters)"
                    value={registerData.password}
                    onChange={handleRegisterChange}
                    required
                    maxLength={128}
                    autoComplete="new-password"
                    className="ig-input"
                  />
                  {registerData.password && (
                    <button
                      type="button"
                      className="ig-peek-btn"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>

                {registerData.password && (
                  <div className="ig-password-strength-container">
                    <div className="ig-password-strength-header">
                      <span>Password strength:</span>
                      <span className={`ig-strength-text strength-${passwordStrength.score}`}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="ig-strength-track">
                      <div className={`ig-strength-fill strength-${passwordStrength.score}`} />
                    </div>
                    <div className="ig-password-rules-list">
                      <div className={`ig-password-rule-item ${passwordStrength.checks.length ? 'rule-passed' : ''}`}>
                        <span className="ig-rule-icon">{passwordStrength.checks.length ? '✓' : '○'}</span>
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`ig-password-rule-item ${passwordStrength.checks.number ? 'rule-passed' : ''}`}>
                        <span className="ig-rule-icon">{passwordStrength.checks.number ? '✓' : '○'}</span>
                        <span>At least one number (0-9)</span>
                      </div>
                      <div className={`ig-password-rule-item ${passwordStrength.checks.letter ? 'rule-passed' : ''}`}>
                        <span className="ig-rule-icon">{passwordStrength.checks.letter ? '✓' : '○'}</span>
                        <span>At least one letter (a-z, A-Z)</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="ig-input-group ig-password-group">
                  <label htmlFor="reg-confirm-password" className="sr-only">
                    Confirm Password
                  </label>
                  <input
                    id="reg-confirm-password"
                    aria-label="Confirm Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={registerData.confirmPassword}
                    onChange={handleRegisterChange}
                    required
                    maxLength={128}
                    autoComplete="new-password"
                    className={`ig-input ${registerData.confirmPassword ? (passwordMatch ? 'input-match' : 'input-error') : ''}`}
                  />
                  {registerData.confirmPassword && (
                    <button
                      type="button"
                      className="ig-peek-btn"
                      onClick={() => setShowConfirmPassword((p) => !p)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  )}
                  {!passwordMatch && (
                    <span className="ig-field-error">Passwords do not match</span>
                  )}
                  {passwordMatch && registerData.confirmPassword && (
                    <span className="ig-field-hint" style={{ color: 'var(--success, #10b981)' }}>✓ Passwords match</span>
                  )}
                </div>

                <div className="ig-input-group">
                  <label 
                    htmlFor="reg-dob" 
                    style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: 'var(--text-muted, #8e8e8e)', 
                      marginBottom: '4px', 
                      textAlign: 'left' 
                    }}
                  >
                    Date of Birth (Must be 18+) *
                  </label>
                  <input
                    id="reg-dob"
                    aria-label="Date of Birth (Must be 18+)"
                    type="date"
                    name="dateOfBirth"
                    max={maxDobDate}
                    value={registerData.dateOfBirth}
                    onChange={handleRegisterChange}
                    required
                    className={`ig-input ${registerData.dateOfBirth && !isAgeValid ? 'input-error' : ''}`}
                  />
                  {registerData.dateOfBirth && !isAgeValid && (
                    <span className="ig-field-error">You must be at least 18 years old to join VibeGrid</span>
                  )}
                </div>

                <div className="ig-input-group">
                  <label 
                    htmlFor="reg-gender" 
                    style={{ 
                      display: 'block', 
                      fontSize: '12px', 
                      fontWeight: 600, 
                      color: 'var(--text-muted, #8e8e8e)', 
                      marginBottom: '4px', 
                      textAlign: 'left' 
                    }}
                  >
                    Gender
                  </label>
                  <select
                    id="reg-gender"
                    aria-label="Gender"
                    name="gender"
                    value={registerData.gender}
                    onChange={handleRegisterChange}
                    className="ig-input"
                    style={{ cursor: 'pointer', appearance: 'auto' }}
                  >
                    <option value="unspecified">Prefer not to say / Unspecified</option>
                    <option value="male">Male 👨</option>
                    <option value="female">Female 👩</option>
                    <option value="other">Other 🧑</option>
                  </select>
                </div>

                {/* Dummy T&C and Contact Uploading Notice as in Screenshot */}
                <p className="ig-terms-notice">
                  People who use our service may have uploaded your contact information to VibeGrid.{' '}
                  <button
                    type="button"
                    className="ig-terms-link"
                    onClick={() => setInfoModal('contact-uploading')}
                  >
                    Learn More
                  </button>
                  .
                </p>

                <p className="ig-terms-notice">
                  By signing up, you agree to our{' '}
                  <button type="button" className="ig-terms-link" onClick={() => setInfoModal('terms')}>
                    Terms
                  </button>
                  ,{' '}
                  <button type="button" className="ig-terms-link" onClick={() => setInfoModal('privacy')}>
                    Privacy Policy
                  </button>{' '}
                  and{' '}
                  <button type="button" className="ig-terms-link" onClick={() => setInfoModal('cookies')}>
                    Cookies Policy
                  </button>
                  .
                </p>

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !registerData.email.trim() ||
                    !registerData.username.trim() ||
                    !usernameFormatValid ||
                    registerData.password.length < 8 ||
                    !passwordStrength.checks.number ||
                    !passwordStrength.checks.letter ||
                    !registerData.confirmPassword ||
                    !passwordMatch
                  }
                  className="ig-btn-primary"
                  aria-busy={loading ? 'true' : 'false'}
                >
                  {loading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                      <span className="spinner-mini" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                      <span>Creating Account...</span>
                    </span>
                  ) : (
                    'Sign Up'
                  )}
                </button>
              </form>

              <div className="ig-create-account-wrapper">
                <button
                  type="button"
                  className="ig-btn-outline"
                  onClick={() => {
                    setActiveTab('login');
                    setLoginStep('credentials');
                    setRegisterStep('form');
                    setError(null);
                  }}
                >
                  Already have an account? Log in
                </button>
              </div>

              {/* VibeGrid Official Brand Badge */}
              <div className="vg-auth-brand-badge">
                <span className="vg-badge-v">V</span>
                <span className="vg-badge-text">from VibeGrid</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          BOTTOM FOOTER: (VibeGrid branded links matching screenshot structure)
          ========================================================================= */}
      <footer className="ig-auth-footer">
        <div className="ig-footer-links">
          <button type="button" onClick={() => setInfoModal('vibegrid')}>VibeGrid</button>
          <button type="button" onClick={() => setInfoModal('about')}>About</button>
          <button type="button" onClick={() => setInfoModal('blog')}>Blog</button>
          <button type="button" onClick={() => setInfoModal('jobs')}>Jobs</button>
          <button type="button" onClick={() => setInfoModal('help')}>Help</button>
          <button type="button" onClick={() => setInfoModal('api')}>API</button>
          <button type="button" onClick={() => setInfoModal('privacy')}>Privacy</button>
          <button type="button" onClick={() => setInfoModal('terms')}>Terms</button>
          <button type="button" onClick={() => setInfoModal('locations')}>Locations</button>
          <button type="button" onClick={() => setInfoModal('lite')}>VibeGrid Lite</button>
          <button type="button" onClick={() => setInfoModal('ai')}>VibeGrid AI</button>
          <button type="button" onClick={() => setInfoModal('threads')}>Threads</button>
          <button type="button" onClick={() => setInfoModal('contact-uploading')}>Contact Uploading & Non-Users</button>
          <button type="button" onClick={() => setInfoModal('verified')}>VibeGrid Verified</button>
        </div>

        <div className="ig-footer-copyright">
          <span className="ig-footer-lang">English ▾</span>
          <span>© 2026 VibeGrid from Atul</span>
        </div>
      </footer>

      {/* =========================================================================
          INTERACTIVE DUMMY MODAL DIALOG (For T&C, Locations, Contact Uploading etc.)
          ========================================================================= */}
      {infoModal && (
        <div className="modal-backdrop" onClick={() => setInfoModal(null)}>
          <div className="modal-card ig-info-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {infoModal === 'terms' && '📜 Terms of Service'}
                {infoModal === 'privacy' && '🔒 Privacy Policy'}
                {infoModal === 'cookies' && '🍪 Cookie Preferences'}
                {infoModal === 'contact-uploading' && '📱 Contact Uploading & Non-User Policy'}
                {infoModal === 'locations' && '📍 Worldwide Locations & Server Regions'}
                {infoModal === 'forgot' && '🔑 Password Reset Assistance'}
                {infoModal === 'about' && 'ℹ️ About VibeGrid'}
                {infoModal === 'jobs' && '💼 Careers at VibeGrid'}
                {infoModal === 'help' && '❓ Help Center'}
                {!['terms', 'privacy', 'cookies', 'contact-uploading', 'locations', 'forgot', 'about', 'jobs', 'help'].includes(infoModal) && '✨ VibeGrid Information'}
              </h3>
              <button type="button" className="modal-close-btn" onClick={() => setInfoModal(null)}>✕</button>
            </div>

            <div className="ig-info-dialog-body">
              {infoModal === 'terms' && (
                <div>
                  <p>Welcome to VibeGrid! By using our photo and topic discovery platform, you agree to:</p>
                  <ul>
                    <li>Share authentic moments and respect intellectual property rights.</li>
                    <li>Avoid abusive, hateful, or harmful behavior against other creators.</li>
                    <li>Comply with content guidelines regarding media uploads.</li>
                  </ul>
                  <p style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Last updated: September 2026. Dummy demonstration document.
                  </p>
                </div>
              )}

              {infoModal === 'privacy' && (
                <div>
                  <p>Your privacy and safety are paramount at VibeGrid:</p>
                  <ul>
                    <li>We never sell your personal data or phone number to third parties.</li>
                    <li>Session cookies are encrypted using industry-standard HTTP-Only JWT tokens.</li>
                    <li>Saved posts and direct messages are strictly private between conversation participants.</li>
                  </ul>
                  <p style={{ marginTop: '12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Compliant with modern digital privacy and GDPR principles.
                  </p>
                </div>
              )}

              {infoModal === 'contact-uploading' && (
                <div>
                  <h4>How Contact Uploading Works</h4>
                  <p>
                    When users sync their contacts, VibeGrid checks for matching accounts to help you connect with people you know in real life.
                  </p>
                  <p style={{ marginTop: '10px' }}>
                    If you are not currently a registered user, we only store a salted, non-reversible cryptographic hash of the contact information to prevent spam and verify prospective invites.
                  </p>
                </div>
              )}

              {infoModal === 'locations' && (
                <div>
                  <h4>Global Cloud Edge Regions</h4>
                  <p>VibeGrid serves media with low latency via PostgreSQL and distributed CDN nodes:</p>
                  <ul>
                    <li>🇺🇸 <strong>US-East (Ohio / N. Virginia)</strong> - Primary Database Cluster</li>
                    <li>🇪🇺 <strong>EU-Central (Frankfurt)</strong> - European Edge Gateway</li>
                    <li>🇯🇵 <strong>Asia-Pacific (Tokyo)</strong> - APAC Media Node</li>
                    <li>🇮🇳 <strong>South Asia (Mumbai)</strong> - Regional Edge Relay</li>
                  </ul>
                </div>
              )}

              {infoModal === 'forgot' && (
                <div>
                  <h4 style={{ marginBottom: '8px' }}>Password Recovery & Reset</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    Enter your registered email address to receive a secure 6-digit verification code.
                  </p>

                  {recoveryState.error && (
                    <div className="ig-auth-error" style={{ marginBottom: '12px' }}>
                      ⚠️ {recoveryState.error}
                    </div>
                  )}

                  {recoveryState.message && (
                    <div style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px' }}>
                      ✓ {recoveryState.message}
                    </div>
                  )}

                  {recoveryState.step === 'request' && (
                    <form onSubmit={handleForgotSubmit} className="ig-form">
                      <div className="ig-input-group">
                        <label htmlFor="recovery-email" className="sr-only">
                          Your registered email address
                        </label>
                        <input
                          id="recovery-email"
                          aria-label="Your registered email address"
                          type="email"
                          placeholder="Your registered email address"
                          value={recoveryState.email}
                          onChange={(e) => setRecoveryState((prev) => ({ ...prev, email: e.target.value, error: null }))}
                          required
                          maxLength={255}
                          autoComplete="email"
                          className="ig-input"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={recoveryState.loading || !recoveryState.email.trim()}
                        className="ig-btn-primary"
                        style={{ marginTop: '8px' }}
                        aria-busy={recoveryState.loading ? 'true' : 'false'}
                      >
                        {recoveryState.loading ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <span className="spinner-mini" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                            <span>Sending Code...</span>
                          </span>
                        ) : (
                          'Send Reset Code'
                        )}
                      </button>
                    </form>
                  )}

                  {recoveryState.step === 'reset' && (
                    <form onSubmit={handleResetSubmit} className="ig-form">
                      {recoveryState.devOtp && (
                        <div style={{ background: 'var(--bg-page)', border: '1px dashed var(--primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '10px' }}>
                          💡 <strong>Recovery OTP Code:</strong> <code style={{ fontWeight: 'bold', color: 'var(--primary)', letterSpacing: '2px' }}>{recoveryState.devOtp}</code>
                        </div>
                      )}
                      <div className="ig-input-group">
                        <label htmlFor="recovery-otp" className="sr-only">
                          6-digit OTP Code
                        </label>
                        <input
                          id="recovery-otp"
                          aria-label="6-digit OTP Code"
                          type="text"
                          inputMode="numeric"
                          placeholder="6-digit OTP Code"
                          value={recoveryState.otp}
                          onChange={(e) => setRecoveryState((prev) => ({ ...prev, otp: e.target.value, error: null }))}
                          maxLength={6}
                          required
                          className="ig-input"
                          style={{ letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold' }}
                        />
                      </div>
                      <div className="ig-input-group">
                        <label htmlFor="recovery-new-password" className="sr-only">
                          New Password
                        </label>
                        <input
                          id="recovery-new-password"
                          aria-label="New Password (min 8 chars, letter + number)"
                          type="password"
                          placeholder="New Password (min 8 chars, letter + number)"
                          value={recoveryState.newPassword}
                          onChange={(e) => setRecoveryState((prev) => ({ ...prev, newPassword: e.target.value, error: null }))}
                          required
                          maxLength={128}
                          autoComplete="new-password"
                          className="ig-input"
                        />
                      </div>
                      <div className="ig-input-group">
                        <label htmlFor="recovery-confirm-password" className="sr-only">
                          Confirm New Password
                        </label>
                        <input
                          id="recovery-confirm-password"
                          aria-label="Confirm New Password"
                          type="password"
                          placeholder="Confirm New Password"
                          value={recoveryState.confirmPassword}
                          onChange={(e) => setRecoveryState((prev) => ({ ...prev, confirmPassword: e.target.value, error: null }))}
                          required
                          maxLength={128}
                          autoComplete="new-password"
                          className="ig-input"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={recoveryState.loading || recoveryState.otp.length !== 6 || recoveryState.newPassword.length < 8}
                        className="ig-btn-primary"
                        style={{ marginTop: '8px' }}
                        aria-busy={recoveryState.loading ? 'true' : 'false'}
                      >
                        {recoveryState.loading ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                            <span className="spinner-mini" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                            <span>Resetting Password...</span>
                          </span>
                        ) : (
                          'Confirm Reset Password'
                        )}
                      </button>
                    </form>
                  )}

                  {recoveryState.step === 'done' && (
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                      <p style={{ color: 'var(--success)', fontWeight: 'bold', fontSize: '1rem', marginBottom: '16px' }}>
                        🎉 Your password has been successfully updated!
                      </p>
                      <button
                        type="button"
                        className="ig-btn-primary"
                        onClick={() => {
                          setInfoModal(null);
                          setActiveTab('login');
                          setLoginStep('credentials');
                          setRecoveryState({
                            step: 'request',
                            email: '',
                            otp: '',
                            newPassword: '',
                            confirmPassword: '',
                            loading: false,
                            error: null,
                            message: null,
                            devOtp: null
                          });
                        }}
                      >
                        Return to Log In
                      </button>
                    </div>
                  )}
                </div>
              )}

              {infoModal === 'about' && (
                <div>
                  <h4>About VibeGrid</h4>
                  <p>
                    VibeGrid is a full-stack social media application crafted with modern React, PostgreSQL, and Express. Designed for aesthetic photo storytelling, topic discovery, 24-hour stories, direct messaging, and community connection.
                  </p>
                </div>
              )}

              {!['terms', 'privacy', 'contact-uploading', 'locations', 'forgot', 'about'].includes(infoModal) && (
                <div>
                  <p>This is an authentic representation of the social platform directory and legal guidelines.</p>
                  <p style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
                    All policies and terms are fully configured for your production social media environment!
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-primary" onClick={() => setInfoModal(null)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
