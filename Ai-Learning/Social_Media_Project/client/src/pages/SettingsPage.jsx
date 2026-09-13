/**
 * client/src/pages/SettingsPage.jsx
 * =================================
 * Dedicated Social Media Settings & Privacy Center
 * 
 * Features:
 * 1. 👤 Edit Profile (Avatar upload/delete, Username, Full Name, Bio, Website, Location, DOB)
 * 2. 📧 Account & Contact (Email OTP verification/change, Phone OTP verification/unlink)
 * 3. 🔒 Password & Security (Password strength meter, Active Sessions device tracker, remote logout)
 * 4. 🛡️ Privacy & Permissions (Private Account, Message/Comment/Mention permissions, Online status)
 * 5. 🔔 Notification Preferences (Push & In-App alert switches with instant persistence)
 * 6. ⚠️ Account Status & Danger Zone (Temporary Deactivation, Permanent Account Deletion)
 * 
 * Master-Detail Layout:
 * - Desktop/Tablet: Left navigation sidebar with category items; right content pane.
 * - Mobile: Category navigation menu with chevron buttons, switching to full category view with "← Back" bar.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';

export default function SettingsPage({ initialSection = 'profile', onNavigateToProfile }) {
  const { user: currentUser, updateUser, logout } = useAuth();

  // Active section: 'profile' | 'contact' | 'security' | 'privacy' | 'notifications' | 'danger'
  const [activeSection, setActiveSection] = useState(initialSection || 'profile');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileViewingSection, setMobileViewingSection] = useState(window.innerWidth > 768);

  // Global message banner for settings
  const [feedbackMsg, setFeedbackMsg] = useState(null);

  // Profile data & form states (initialized with currentUser to prevent flash of empty/undefined data)
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState(currentUser || null);
  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [editFullName, setEditFullName] = useState(currentUser?.full_name || '');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editWebsite, setEditWebsite] = useState(currentUser?.website || '');
  const [editLocation, setEditLocation] = useState(currentUser?.location || '');
  const [editDateOfBirth, setEditDateOfBirth] = useState(currentUser?.date_of_birth ? currentUser.date_of_birth.substring(0, 10) : '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar Upload States
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar_url || '/uploads/avatars/default-avatar.png');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Email Management States
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Phone Management States
  const [newPhone, setNewPhone] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
  const [removingPhone, setRemovingPhone] = useState(false);
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);

  // Password & Security States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Sessions States
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Privacy Settings States
  const [privacySettings, setPrivacySettings] = useState({
    is_private: false,
    allow_messages_from: 'everyone',
    allow_comments_from: 'everyone',
    allow_mentions_from: 'everyone',
    allow_tags_from: 'everyone',
    show_online_status: true,
    show_read_receipts: true,
    story_visibility: 'everyone'
  });
  const [loadingPrivacy, setLoadingPrivacy] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Notification Preferences States
  const [notificationSettings, setNotificationSettings] = useState({
    notif_likes: true,
    notif_comments: true,
    notif_follows: true,
    notif_messages: true,
    notif_mentions: true,
    notif_tags: true,
    notif_stories: true,
    notif_security: true,
    notif_email: true
  });
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  // Account Deactivation Modal States
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('Taking a break');
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [showDeactivatePassword, setShowDeactivatePassword] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  // Permanent Account Deletion Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Track window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setMobileViewingSection(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update section from props if provided
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
      if (isMobile) setMobileViewingSection(true);
    }
  }, [initialSection, isMobile]);

  // Dismiss feedback messages automatically after 5 seconds
  useEffect(() => {
    if (feedbackMsg) {
      const timer = setTimeout(() => setFeedbackMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [feedbackMsg]);

  // OTP resend timers
  useEffect(() => {
    let timer;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  useEffect(() => {
    let timer;
    if (phoneOtpCountdown > 0) {
      timer = setTimeout(() => setPhoneOtpCountdown(phoneOtpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [phoneOtpCountdown]);

  // Load user profile on mount
  useEffect(() => {
    if (!currentUser?.username) return;
    const fetchUserProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await apiClient.get(`/users/${currentUser.username}`);
        const u = res.data?.profile || res.data?.user || currentUser;
        if (u) {
          setProfile(u);
          setEditUsername(u.username || currentUser.username || '');
          setEditFullName(u.full_name || currentUser.full_name || '');
          setEditBio(u.bio || currentUser.bio || '');
          setEditWebsite(u.website || currentUser.website || '');
          setEditLocation(u.location || currentUser.location || '');
          setEditDateOfBirth(u.date_of_birth ? u.date_of_birth.substring(0, 10) : '');
          setAvatarPreview(u.avatar_url || currentUser.avatar_url || '/uploads/avatars/default-avatar.png');
        }
      } catch (err) {
        setFeedbackMsg({ type: 'error', text: err.message || 'Failed to load profile details.' });
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchUserProfile();
  }, [currentUser]);

  // Load section-specific data when tab changes
  useEffect(() => {
    if (activeSection === 'security') {
      fetchSessions();
    } else if (activeSection === 'privacy') {
      fetchPrivacySettings();
    } else if (activeSection === 'notifications') {
      fetchNotificationSettings();
    }
  }, [activeSection]);

  // ============================================================================
  // API Handlers
  // ============================================================================

  // 1. Edit Profile Handlers
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedbackMsg({ type: 'error', text: 'Please choose an image file (JPG, PNG, GIF, WebP).' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedbackMsg({ type: 'error', text: 'Avatar file size must be less than 5MB.' });
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (uploadEvt) => setAvatarPreview(uploadEvt.target.result);
    reader.readAsDataURL(file);
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) return;
    try {
      setAvatarUploading(true);
      const formData = new FormData();
      formData.append('avatar', avatarFile);
      const res = await apiClient.put('/users/avatar', formData);
      if (res.success && res.data?.avatar_url) {
        setProfile((prev) => ({ ...prev, avatar_url: res.data.avatar_url }));
        updateUser({ avatar_url: res.data.avatar_url });
        setAvatarFile(null);
        setFeedbackMsg({ type: 'success', text: 'Profile picture updated successfully!' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to upload profile picture.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to upload profile picture.' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarUploading(true);
      const res = await apiClient.delete('/users/avatar');
      if (res.success && res.data?.avatar_url) {
        setProfile((prev) => ({ ...prev, avatar_url: res.data.avatar_url }));
        setAvatarPreview(res.data.avatar_url);
        updateUser({ avatar_url: res.data.avatar_url });
        setAvatarFile(null);
        setFeedbackMsg({ type: 'success', text: 'Avatar removed and reverted to default.' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to remove avatar.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to remove avatar.' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const res = await apiClient.put('/users/profile', {
        username: editUsername.trim(),
        full_name: editFullName.trim(),
        bio: editBio.trim(),
        website: editWebsite.trim(),
        location: editLocation.trim(),
        date_of_birth: editDateOfBirth || null
      });

      if (res.success && res.data?.user) {
        setProfile(res.data.user);
        updateUser(res.data.user);
        setFeedbackMsg({ type: 'success', text: 'Profile details saved successfully!' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to save changes.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to save profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // 2. Email Management Handlers
  const handleSendEmailOtp = async () => {
    try {
      setSendingEmailOtp(true);
      const payload = newEmail.trim() ? { newEmail: newEmail.trim() } : {};
      const res = await apiClient.post('/users/email/send-otp', payload);
      if (res.success) {
        setEmailOtpSent(true);
        setOtpCountdown(60);
        setFeedbackMsg({ type: 'success', text: res.message || 'Verification code sent to your email.' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to send verification code.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to send verification code.' });
    } finally {
      setSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp.trim() || emailOtp.trim().length !== 6) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid 6-digit verification code.' });
      return;
    }
    try {
      setVerifyingEmailOtp(true);
      const payload = { otp: emailOtp.trim() };
      if (newEmail.trim()) payload.newEmail = newEmail.trim();

      const res = await apiClient.post('/users/email/verify-otp', payload);
      if (res.success && res.data?.user) {
        setProfile((prev) => ({ ...prev, ...res.data.user }));
        updateUser(res.data.user);
        setEmailOtpSent(false);
        setEmailOtp('');
        setNewEmail('');
        setFeedbackMsg({ type: 'success', text: res.message || 'Email verified successfully!' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Verification failed.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Verification failed.' });
    } finally {
      setVerifyingEmailOtp(false);
    }
  };

  // 3. Phone Management Handlers
  const handleSendPhoneOtp = async () => {
    if (!newPhone.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a phone number in international format (+1...)' });
      return;
    }
    try {
      setSendingPhoneOtp(true);
      const res = await apiClient.post('/users/phone/send-otp', { phoneNumber: newPhone.trim() });
      if (res.success) {
        setPhoneOtpSent(true);
        setPhoneOtpCountdown(60);
        setFeedbackMsg({ type: 'success', text: res.message || 'Verification code sent to your phone.' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to send verification code.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to send verification code.' });
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp.trim() || phoneOtp.trim().length !== 6) {
      setFeedbackMsg({ type: 'error', text: 'Please enter a valid 6-digit verification code.' });
      return;
    }
    try {
      setVerifyingPhoneOtp(true);
      const res = await apiClient.post('/users/phone/verify-otp', {
        phoneNumber: newPhone.trim(),
        otp: phoneOtp.trim()
      });
      if (res.success && res.data?.user) {
        setProfile((prev) => ({ ...prev, ...res.data.user }));
        updateUser(res.data.user);
        setPhoneOtpSent(false);
        setPhoneOtp('');
        setNewPhone('');
        setFeedbackMsg({ type: 'success', text: res.message || 'Phone number linked successfully!' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Phone verification failed.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Phone verification failed.' });
    } finally {
      setVerifyingPhoneOtp(false);
    }
  };

  const handleRemovePhone = async () => {
    if (!window.confirm('Are you sure you want to remove your linked phone number?')) return;
    try {
      setRemovingPhone(true);
      const res = await apiClient.delete('/users/phone');
      if (res.success && res.data?.user) {
        setProfile((prev) => ({ ...prev, ...res.data.user }));
        updateUser(res.data.user);
        setNewPhone('');
        setPhoneOtpSent(false);
        setPhoneOtp('');
        setFeedbackMsg({ type: 'success', text: 'Phone number removed from your account.' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to remove phone number.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to remove phone number.' });
    } finally {
      setRemovingPhone(false);
    }
  };

  // 4. Password Change & Sessions Handlers
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score, label: 'Weak', color: '#ef4444' };
    if (score <= 4) return { score, label: 'Moderate', color: '#f59e0b' };
    return { score, label: 'Strong', color: '#10b981' };
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setFeedbackMsg({ type: 'error', text: 'Please fill in all password fields.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedbackMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPassword.length < 8) {
      setFeedbackMsg({ type: 'error', text: 'New password must be at least 8 characters long.' });
      return;
    }
    try {
      setChangingPassword(true);
      const res = await apiClient.post('/users/security/password', {
        currentPassword,
        newPassword,
        confirmPassword
      });
      if (res.success) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setFeedbackMsg({ type: 'success', text: 'Password changed successfully!' });
        fetchSessions();
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to change password.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const fetchSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await apiClient.get('/users/security/sessions');
      if (res.success && res.data?.sessions) {
        setSessions(res.data.sessions);
      }
    } catch (err) {
      console.error('Failed to load active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      setRevokingSessionId(sessionId);
      const res = await apiClient.delete(`/users/security/sessions/${sessionId}`);
      if (res.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setFeedbackMsg({ type: 'success', text: 'Session terminated.' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to terminate session.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to terminate session.' });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleLogoutOthers = async () => {
    if (!window.confirm('Log out of all other devices except this current session?')) return;
    try {
      setLoggingOutOthers(true);
      const res = await apiClient.post('/users/security/sessions/logout-others');
      if (res.success) {
        setFeedbackMsg({ type: 'success', text: res.message || 'Logged out of all other devices.' });
        fetchSessions();
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to log out of other devices.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to log out of other devices.' });
    } finally {
      setLoggingOutOthers(false);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm('Are you sure you want to log out of ALL devices including this one?')) return;
    try {
      setLoggingOutAll(true);
      const res = await apiClient.post('/users/security/sessions/logout-all');
      if (res.success) {
        await logout();
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to log out of all devices.' });
      setLoggingOutAll(false);
    }
  };

  // 5. Privacy Settings Handlers
  const fetchPrivacySettings = async () => {
    try {
      setLoadingPrivacy(true);
      const res = await apiClient.get('/users/privacy');
      if (res.success && res.data?.privacy) {
        setPrivacySettings(res.data.privacy);
      }
    } catch (err) {
      console.error('Failed to fetch privacy settings:', err);
    } finally {
      setLoadingPrivacy(false);
    }
  };

  const handleUpdatePrivacy = async (updatedFields) => {
    const newSettings = { ...privacySettings, ...updatedFields };
    setPrivacySettings(newSettings);
    try {
      setSavingPrivacy(true);
      const res = await apiClient.put('/users/privacy', newSettings);
      if (res.success) {
        setPrivacySettings(res.data.privacy);
        setFeedbackMsg({ type: 'success', text: 'Privacy settings updated successfully.' });
        if (updatedFields.is_private !== undefined) {
          setProfile((prev) => ({ ...prev, is_private: updatedFields.is_private }));
          updateUser({ is_private: updatedFields.is_private });
        }
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to update privacy settings.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update privacy settings.' });
    } finally {
      setSavingPrivacy(false);
    }
  };

  // 6. Notification Preferences Handlers
  const fetchNotificationSettings = async () => {
    try {
      setLoadingNotif(true);
      const res = await apiClient.get('/users/notifications/settings');
      if (res.success && res.data?.notifications) {
        setNotificationSettings(res.data.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notification settings:', err);
    } finally {
      setLoadingNotif(false);
    }
  };

  const handleUpdateNotification = async (updatedFields) => {
    const newSettings = { ...notificationSettings, ...updatedFields };
    setNotificationSettings(newSettings);
    try {
      setSavingNotif(true);
      const res = await apiClient.put('/users/notifications/settings', newSettings);
      if (res.success && res.data?.notifications) {
        setNotificationSettings(res.data.notifications);
        setFeedbackMsg({ type: 'success', text: 'Notification preferences updated.' });
      } else {
        setFeedbackMsg({ type: 'error', text: res.error || 'Failed to update notification preferences.' });
      }
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to update notification preferences.' });
    } finally {
      setSavingNotif(false);
    }
  };

  // 7. Deactivation & Deletion Handlers
  const handleDeactivateAccount = async (e) => {
    if (e) e.preventDefault();
    if (!deactivatePassword.trim()) {
      setDeactivateError('Please enter your password to confirm deactivation.');
      return;
    }
    try {
      setDeactivating(true);
      setDeactivateError('');
      const res = await apiClient.post('/users/deactivate', {
        password: deactivatePassword,
        reason: deactivateReason
      });
      if (res.success) {
        setShowDeactivateModal(false);
        await logout();
      } else {
        setDeactivateError(res.error || 'Failed to deactivate account.');
      }
    } catch (err) {
      setDeactivateError(err.message || 'Failed to deactivate account.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    if (e) e.preventDefault();
    if (!deletePassword.trim()) {
      setDeleteError('Please enter your password to confirm permanent deletion.');
      return;
    }
    const expectedUsername = profile?.username || currentUser?.username || '';
    if (deleteConfirmation.trim().toLowerCase() !== expectedUsername.toLowerCase()) {
      setDeleteError(`Please type your exact username "@${expectedUsername}" to confirm.`);
      return;
    }
    try {
      setDeletingAccount(true);
      setDeleteError('');
      const res = await apiClient.delete('/users/account', {
        password: deletePassword,
        confirmation: deleteConfirmation.trim()
      });
      if (res.success) {
        setShowDeleteModal(false);
        await logout();
      } else {
        setDeleteError(res.error || 'Failed to permanently delete account.');
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to permanently delete account.');
    } finally {
      setDeletingAccount(false);
    }
  };

  // Navigation category definitions
  const categories = [
    { id: 'profile', label: 'Edit Profile', icon: '👤', description: 'Photo, name, bio & links' },
    { id: 'contact', label: 'Account & Contact', icon: '📧', description: 'Email & phone verification' },
    { id: 'security', label: 'Password & Security', icon: '🔒', description: 'Password, sessions & devices' },
    { id: 'privacy', label: 'Privacy & Permissions', icon: '🛡️', description: 'Account privacy, DMs & comments' },
    { id: 'notifications', label: 'Notifications', icon: '🔔', description: 'Push & email preferences' },
    { id: 'danger', label: 'Account Status', icon: '⚠️', description: 'Deactivate or delete account' }
  ];

  const currentPassStrength = getPasswordStrength(newPassword);

  if (loadingProfile && !profile) {
    return (
      <div className="settings-page-wrapper">
        <div className="profile-loading-state">
          <div className="spinner"></div>
          <p>Loading settings & preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page-wrapper">
      <div className="settings-card-container">
        {/* Settings Header Bar */}
        <div className="settings-top-header">
          <div className="settings-top-header-left">
            {isMobile && mobileViewingSection && (
              <button
                type="button"
                className="settings-back-btn"
                onClick={() => setMobileViewingSection(false)}
                title="Back to Settings menu"
              >
                ←
              </button>
            )}
            <div className="settings-header-titles">
              <h2 className="settings-main-title">
                {isMobile && mobileViewingSection
                  ? categories.find((c) => c.id === activeSection)?.label || 'Settings'
                  : 'Settings & Privacy'}
              </h2>
              <span className="settings-main-subtitle">
                {isMobile && mobileViewingSection
                  ? categories.find((c) => c.id === activeSection)?.description
                  : 'Manage your account settings, privacy, notifications, and security'}
              </span>
            </div>
          </div>

          <div className="settings-top-header-right">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => onNavigateToProfile && onNavigateToProfile(currentUser?.username)}
            >
              Done
            </button>
          </div>
        </div>

        {/* Global Floating Notification Message */}
        {feedbackMsg && (
          <div className={`settings-alert-banner ${feedbackMsg.type}`}>
            <span>{feedbackMsg.type === 'success' ? '✅' : '⚠️'} {feedbackMsg.text}</span>
            <button
              type="button"
              className="alert-close-btn"
              onClick={() => setFeedbackMsg(null)}
            >
              ×
            </button>
          </div>
        )}

        <div className="settings-layout">
          {/* Left Navigation Sidebar (Desktop or Mobile Menu View) */}
          {(!isMobile || !mobileViewingSection) && (
            <aside className="settings-sidebar">
              <div className="settings-user-summary">
                {profile?.avatar_url || currentUser?.avatar_url ? (
                  <img
                    src={profile?.avatar_url || currentUser?.avatar_url}
                    alt={profile?.username || currentUser?.username}
                    className="settings-user-avatar"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/uploads/avatars/default-avatar.png';
                    }}
                  />
                ) : (
                  <div className="settings-user-avatar-fallback">
                    {(profile?.username || currentUser?.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="settings-user-text">
                  <span className="settings-user-name">
                    {profile?.full_name || currentUser?.full_name || `@${profile?.username || currentUser?.username}`}
                  </span>
                  <span className="settings-user-handle">
                    @{profile?.username || currentUser?.username}
                  </span>
                </div>
              </div>

              <nav className="settings-nav-list">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`settings-nav-item ${activeSection === cat.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSection(cat.id);
                      if (isMobile) setMobileViewingSection(true);
                    }}
                  >
                    <span className="settings-nav-icon">{cat.icon}</span>
                    <div className="settings-nav-info">
                      <span className="settings-nav-label">{cat.label}</span>
                      <span className="settings-nav-desc">{cat.description}</span>
                    </div>
                    {isMobile && <span className="settings-nav-chevron">›</span>}
                  </button>
                ))}
              </nav>

              <div className="settings-sidebar-footer">
                <button
                  type="button"
                  className="settings-sidebar-logout-btn"
                  onClick={logout}
                  title="Sign out of your account"
                >
                  <span>🚪</span>
                  <span>Log Out</span>
                </button>
              </div>
            </aside>
          )}

          {/* Right Content Panel (Desktop or Mobile Active Section View) */}
          {(!isMobile || mobileViewingSection) && (
            <section className="settings-content-panel">
              {/* ========================================================== */}
              {/* CATEGORY 1: EDIT PROFILE                                    */}
              {/* ========================================================== */}
              {activeSection === 'profile' && (
                <div className="settings-section-body">
                  <div className="settings-panel-header">
                    <h3>👤 Edit Profile</h3>
                    <p>Update your photo, display name, bio, and public social details.</p>
                  </div>

                  {/* Avatar Upload Box */}
                  <div className="settings-avatar-row">
                    <div className="settings-avatar-wrapper">
                      <img
                        src={avatarPreview || profile?.avatar_url || currentUser?.avatar_url || '/uploads/avatars/default-avatar.png'}
                        alt="Profile Preview"
                        className="settings-avatar-img"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/uploads/avatars/default-avatar.png';
                        }}
                      />
                      {avatarUploading && (
                        <div className="avatar-upload-overlay">
                          <div className="spinner-small" />
                        </div>
                      )}
                    </div>
                    <div className="settings-avatar-controls">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        style={{ display: 'none' }}
                        onChange={handleAvatarFileSelect}
                      />
                      <div className="settings-avatar-btns">
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={() => fileInputRef.current && fileInputRef.current.click()}
                          disabled={avatarUploading}
                        >
                          Change Photo
                        </button>
                        {avatarFile && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={handleUploadAvatar}
                            disabled={avatarUploading}
                          >
                            Save Photo
                          </button>
                        )}
                        {profile?.avatar_url && !profile.avatar_url.includes('default-avatar.png') && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={handleRemoveAvatar}
                            disabled={avatarUploading}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <span className="settings-subtext">JPG, PNG, GIF, or WebP. Max size 5MB.</span>
                    </div>
                  </div>

                  {/* Profile Edit Form */}
                  <form onSubmit={handleSaveProfile} className="settings-form">
                    <div className="form-group">
                      <label htmlFor="settingsUsername">Username</label>
                      <input
                        id="settingsUsername"
                        type="text"
                        className="form-input"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        maxLength={30}
                        required
                      />
                      <span className="form-input-hint">Your unique @handle on VibeGrid (letters, numbers, underscore).</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="settingsFullName">Full Name</label>
                      <input
                        id="settingsFullName"
                        type="text"
                        className="form-input"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        maxLength={100}
                        placeholder="Your full name"
                      />
                    </div>

                    <div className="form-group">
                      <div className="form-label-with-counter">
                        <label htmlFor="settingsBio">Bio</label>
                        <span className={`char-counter ${150 - editBio.length < 20 ? 'counter-warning' : ''}`}>
                          {150 - editBio.length} left
                        </span>
                      </div>
                      <textarea
                        id="settingsBio"
                        className="form-input form-textarea"
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value.slice(0, 150))}
                        placeholder="Tell the community about yourself..."
                        rows={3}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="settingsWebsite">Website</label>
                      <input
                        id="settingsWebsite"
                        type="url"
                        className="form-input"
                        value={editWebsite}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        placeholder="https://yourwebsite.com"
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group form-col">
                        <label htmlFor="settingsLocation">Location</label>
                        <input
                          id="settingsLocation"
                          type="text"
                          className="form-input"
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          placeholder="e.g. San Francisco, CA"
                        />
                      </div>
                      <div className="form-group form-col">
                        <label htmlFor="settingsDob">Date of Birth</label>
                        <input
                          id="settingsDob"
                          type="date"
                          className="form-input"
                          value={editDateOfBirth}
                          onChange={(e) => setEditDateOfBirth(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="settings-form-actions">
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={savingProfile || editBio.length > 150 || !editUsername.trim()}
                      >
                        {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ========================================================== */}
              {/* CATEGORY 2: ACCOUNT & CONTACT                               */}
              {/* ========================================================== */}
              {activeSection === 'contact' && (
                <div className="settings-section-body">
                  <div className="settings-panel-header">
                    <h3>📧 Account & Contact Information</h3>
                    <p>Manage your verified email address and linked phone number.</p>
                  </div>

                  {/* Email Management Card */}
                  <div className="account-mgmt-card">
                    <div className="account-mgmt-header">
                      <div className="account-mgmt-title">
                        <span>Email Address</span>
                        <span className={`email-status-badge ${profile?.is_email_verified ? 'verified' : 'unverified'}`}>
                          {profile?.is_email_verified ? '✓ Verified' : '⚠️ Unverified'}
                        </span>
                      </div>
                      <span className="account-mgmt-subtitle">Used for login, security notices, and password recovery</span>
                    </div>

                    <div className="account-mgmt-current-val">
                      <span className="account-mgmt-val-text">{profile?.email || 'No email registered'}</span>
                    </div>

                    <div className="account-mgmt-field-row">
                      <input
                        type="email"
                        className="form-input"
                        placeholder="Enter new email address (e.g. user@example.com)"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        disabled={sendingEmailOtp || verifyingEmailOtp}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSendEmailOtp}
                        disabled={sendingEmailOtp || verifyingEmailOtp || otpCountdown > 0}
                      >
                        {sendingEmailOtp
                          ? 'Sending...'
                          : otpCountdown > 0
                          ? `Resend (${otpCountdown}s)`
                          : emailOtpSent
                          ? 'Resend OTP'
                          : 'Send Code'}
                      </button>
                    </div>

                    {emailOtpSent && (
                      <div className="account-mgmt-otp-box">
                        <span className="otp-prompt-text">
                          Enter the 6-digit verification code sent to {newEmail.trim() || profile?.email}:
                        </span>
                        <div className="account-mgmt-field-row" style={{ marginTop: '8px' }}>
                          <input
                            type="text"
                            className="form-input otp-code-input"
                            placeholder="• • • • • •"
                            maxLength={6}
                            value={emailOtp}
                            onChange={(e) => setEmailOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                            disabled={verifyingEmailOtp}
                          />
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleVerifyEmailOtp}
                            disabled={verifyingEmailOtp || emailOtp.length !== 6}
                          >
                            {verifyingEmailOtp ? 'Verifying...' : 'Verify & Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Phone Number Management Card */}
                  <div className="account-mgmt-card" style={{ marginTop: '16px' }}>
                    <div className="account-mgmt-header">
                      <div className="account-mgmt-title">
                        <span>Phone Number</span>
                        <span className={`email-status-badge ${profile?.phone_number && profile?.is_phone_verified ? 'verified' : 'unverified'}`}>
                          {profile?.phone_number && profile?.is_phone_verified ? '✓ Verified' : '📱 Optional'}
                        </span>
                      </div>
                      <span className="account-mgmt-subtitle">Used for multi-factor security and account recovery</span>
                    </div>

                    <div className="account-mgmt-current-val">
                      <span className="account-mgmt-val-text">
                        {profile?.phone_number ? profile.phone_number : 'No phone number linked'}
                      </span>
                      {profile?.phone_number && (
                        <button
                          type="button"
                          className="btn-text-danger"
                          onClick={handleRemovePhone}
                          disabled={removingPhone}
                        >
                          {removingPhone ? 'Removing...' : 'Unlink Phone'}
                        </button>
                      )}
                    </div>

                    <div className="account-mgmt-field-row">
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="Enter phone with country code (e.g. +14155552671)"
                        value={newPhone}
                        onChange={(e) => setNewPhone(e.target.value)}
                        disabled={sendingPhoneOtp || verifyingPhoneOtp}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSendPhoneOtp}
                        disabled={sendingPhoneOtp || verifyingPhoneOtp || phoneOtpCountdown > 0 || !newPhone.trim()}
                      >
                        {sendingPhoneOtp
                          ? 'Sending...'
                          : phoneOtpCountdown > 0
                          ? `Resend (${phoneOtpCountdown}s)`
                          : phoneOtpSent
                          ? 'Resend Code'
                          : 'Send Code'}
                      </button>
                    </div>

                    {phoneOtpSent && (
                      <div className="account-mgmt-otp-box">
                        <span className="otp-prompt-text">
                          Enter the 6-digit verification code sent to {newPhone.trim()}:
                        </span>
                        <div className="account-mgmt-field-row" style={{ marginTop: '8px' }}>
                          <input
                            type="text"
                            className="form-input otp-code-input"
                            placeholder="• • • • • •"
                            maxLength={6}
                            value={phoneOtp}
                            onChange={(e) => setPhoneOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                            disabled={verifyingPhoneOtp}
                          />
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleVerifyPhoneOtp}
                            disabled={verifyingPhoneOtp || phoneOtp.length !== 6}
                          >
                            {verifyingPhoneOtp ? 'Verifying...' : 'Verify Phone'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* CATEGORY 3: PASSWORD & SECURITY                             */}
              {/* ========================================================== */}
              {activeSection === 'security' && (
                <div className="settings-section-body">
                  <div className="settings-panel-header">
                    <h3>🔒 Password & Security</h3>
                    <p>Keep your account safe by updating your password and reviewing active sessions.</p>
                  </div>

                  {/* Change Password Card */}
                  <div className="account-mgmt-card">
                    <div className="account-mgmt-header">
                      <div className="account-mgmt-title">
                        <span>Change Password</span>
                      </div>
                      <span className="account-mgmt-subtitle">Choose a strong password with at least 8 characters</span>
                    </div>

                    <form onSubmit={handleChangePassword} className="security-password-form">
                      <div className="form-group">
                        <label htmlFor="settingsCurrPass">Current Password</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settingsCurrPass"
                            type={showCurrentPass ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Enter current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            disabled={changingPassword}
                            required
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                            tabIndex="-1"
                          >
                            {showCurrentPass ? '👁️' : '👁️‍🗨️'}
                          </button>
                        </div>
                      </div>

                      <div className="form-group">
                        <label htmlFor="settingsNewPass">New Password</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settingsNewPass"
                            type={showNewPass ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Enter new password (8+ chars)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={changingPassword}
                            required
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowNewPass(!showNewPass)}
                            tabIndex="-1"
                          >
                            {showNewPass ? '👁️' : '👁️‍🗨️'}
                          </button>
                        </div>

                        {newPassword.length > 0 && (
                          <div className="password-strength-container">
                            <div className="password-strength-bars">
                              {[1, 2, 3, 4, 5].map((lvl) => (
                                <div
                                  key={lvl}
                                  className="strength-bar"
                                  style={{
                                    backgroundColor: lvl <= currentPassStrength.score ? currentPassStrength.color : 'var(--border-color)'
                                  }}
                                />
                              ))}
                            </div>
                            <span className="password-strength-text" style={{ color: currentPassStrength.color }}>
                              Strength: <strong>{currentPassStrength.label}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="form-group">
                        <label htmlFor="settingsConfirmPass">Confirm New Password</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settingsConfirmPass"
                            type={showConfirmPass ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={changingPassword}
                            required
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowConfirmPass(!showConfirmPass)}
                            tabIndex="-1"
                          >
                            {showConfirmPass ? '👁️' : '👁️‍🗨️'}
                          </button>
                        </div>
                        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                          <span className="form-input-hint" style={{ color: 'var(--danger)' }}>
                            Passwords do not match.
                          </span>
                        )}
                      </div>

                      <div className="settings-form-actions" style={{ marginTop: '16px' }}>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
                        >
                          {changingPassword ? 'Updating Password...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Active Login Sessions Card */}
                  <div className="account-mgmt-card" style={{ marginTop: '16px' }}>
                    <div className="account-mgmt-header">
                      <div className="account-mgmt-title">
                        <span>Active Login Sessions</span>
                        <span className="sessions-count-badge">{sessions.length} Active</span>
                      </div>
                      <span className="account-mgmt-subtitle">
                        Devices where your account is currently signed in. Terminate unrecognized sessions.
                      </span>
                    </div>

                    {loadingSessions ? (
                      <div className="sessions-loading">
                        <div className="spinner-small" />
                        <span>Loading active sessions...</span>
                      </div>
                    ) : (
                      <div className="sessions-list">
                        {sessions.map((sess) => (
                          <div key={sess.id} className={`session-item ${sess.is_current ? 'current-session' : ''}`}>
                            <div className="session-icon">
                              {sess.device === 'Mobile' ? '📱' : sess.device === 'Tablet' ? '📟' : '💻'}
                            </div>
                            <div className="session-details">
                              <div className="session-header-row">
                                <span className="session-device-name">
                                  {sess.browser || 'Browser'} on {sess.os || 'Device'}
                                </span>
                                {sess.is_current && <span className="current-badge">This Device</span>}
                              </div>
                              <span className="session-meta">
                                {sess.location || 'Local Network'} • Last active: {new Date(sess.last_active).toLocaleString()}
                              </span>
                            </div>
                            {!sess.is_current && (
                              <button
                                type="button"
                                className="session-revoke-btn"
                                onClick={() => handleRevokeSession(sess.id)}
                                disabled={revokingSessionId === sess.id}
                              >
                                {revokingSessionId === sess.id ? 'Revoking...' : 'Revoke'}
                              </button>
                            )}
                          </div>
                        ))}

                        <div className="sessions-bulk-actions">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={handleLogoutOthers}
                            disabled={loggingOutOthers || sessions.length <= 1}
                          >
                            {loggingOutOthers ? 'Logging out...' : 'Log Out of Other Devices'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={handleLogoutAll}
                            disabled={loggingOutAll}
                          >
                            {loggingOutAll ? 'Logging out...' : 'Log Out of All Devices'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* CATEGORY 4: PRIVACY & PERMISSIONS                           */}
              {/* ========================================================== */}
              {activeSection === 'privacy' && (
                <div className="settings-section-body">
                  <div className="settings-panel-header">
                    <h3>🛡️ Privacy & Permissions</h3>
                    <p>Control who can see your media, send you messages, comment, and see your activity.</p>
                  </div>

                  <div className="account-mgmt-card">
                    {/* Private Account Toggle */}
                    <div className="privacy-toggle-row">
                      <div className="privacy-toggle-info">
                        <strong>Private Account</strong>
                        <p>When private, only people you approve can see your photos, videos, and profile details.</p>
                      </div>
                      <label className="switch-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(privacySettings.is_private)}
                          onChange={(e) => handleUpdatePrivacy({ is_private: e.target.checked })}
                          disabled={savingPrivacy}
                        />
                        <span className="switch-slider" />
                      </label>
                    </div>

                    <div className="privacy-divider" />

                    {/* Interactions Section */}
                    <div className="privacy-group">
                      <span className="privacy-group-title">💬 Interactions & Communications</span>

                      {/* Direct Messages */}
                      <div className="privacy-select-row">
                        <div className="privacy-select-info">
                          <label htmlFor="settingsMsgFrom">Who can send you direct messages</label>
                          <p>Controls who can initiate private 1-on-1 conversations with you.</p>
                        </div>
                        <select
                          id="settingsMsgFrom"
                          className="privacy-select-input"
                          value={privacySettings.allow_messages_from || 'everyone'}
                          onChange={(e) => handleUpdatePrivacy({ allow_messages_from: e.target.value })}
                          disabled={savingPrivacy}
                        >
                          <option value="everyone">Everyone</option>
                          <option value="following">People You Follow</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>

                      {/* Comments */}
                      <div className="privacy-select-row">
                        <div className="privacy-select-info">
                          <label htmlFor="settingsCommentFrom">Who can comment on your posts</label>
                          <p>Controls who is allowed to comment on your media.</p>
                        </div>
                        <select
                          id="settingsCommentFrom"
                          className="privacy-select-input"
                          value={privacySettings.allow_comments_from || 'everyone'}
                          onChange={(e) => handleUpdatePrivacy({ allow_comments_from: e.target.value })}
                          disabled={savingPrivacy}
                        >
                          <option value="everyone">Everyone</option>
                          <option value="following">People You Follow</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>

                      {/* Mentions */}
                      <div className="privacy-select-row">
                        <div className="privacy-select-info">
                          <label htmlFor="settingsMentionFrom">Who can @mention you</label>
                          <p>Choose who can mention your @username in captions and comments.</p>
                        </div>
                        <select
                          id="settingsMentionFrom"
                          className="privacy-select-input"
                          value={privacySettings.allow_mentions_from || 'everyone'}
                          onChange={(e) => handleUpdatePrivacy({ allow_mentions_from: e.target.value })}
                          disabled={savingPrivacy}
                        >
                          <option value="everyone">Everyone</option>
                          <option value="following">People You Follow</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>

                      {/* Story Visibility */}
                      <div className="privacy-select-row">
                        <div className="privacy-select-info">
                          <label htmlFor="settingsStoryVis">Who can view your stories</label>
                          <p>Choose the audience for your 24-hour stories.</p>
                        </div>
                        <select
                          id="settingsStoryVis"
                          className="privacy-select-input"
                          value={privacySettings.story_visibility || 'everyone'}
                          onChange={(e) => handleUpdatePrivacy({ story_visibility: e.target.value })}
                          disabled={savingPrivacy}
                        >
                          <option value="everyone">Everyone</option>
                          <option value="following">People You Follow</option>
                        </select>
                      </div>
                    </div>

                    <div className="privacy-divider" />

                    {/* Activity Status */}
                    <div className="privacy-group">
                      <span className="privacy-group-title">👁️ Activity Status & Read Receipts</span>

                      {/* Online Status Toggle */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Show Activity Status</strong>
                          <p>Allow accounts you follow and anyone you message to see when you were last active.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(privacySettings.show_online_status)}
                            onChange={(e) => handleUpdatePrivacy({ show_online_status: e.target.checked })}
                            disabled={savingPrivacy}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>

                      {/* Read Receipts Toggle */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Show Read Receipts</strong>
                          <p>Allow message senders to see when you have read their messages.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(privacySettings.show_read_receipts)}
                            onChange={(e) => handleUpdatePrivacy({ show_read_receipts: e.target.checked })}
                            disabled={savingPrivacy}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* CATEGORY 5: NOTIFICATION PREFERENCES                        */}
              {/* ========================================================== */}
              {activeSection === 'notifications' && (
                <div className="settings-section-body">
                  <div className="settings-panel-header">
                    <h3>🔔 Notification Preferences</h3>
                    <p>Customize the push alerts and activity notices you receive.</p>
                  </div>

                  <div className="account-mgmt-card">
                    {/* Activity Group */}
                    <div className="privacy-group">
                      <span className="privacy-group-title">💬 Activity & Interactions</span>

                      {/* Likes */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Likes</strong>
                          <p>Receive notifications when someone likes your posts.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_likes)}
                            onChange={(e) => handleUpdateNotification({ notif_likes: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>

                      {/* Comments */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Comments</strong>
                          <p>Receive notifications when someone comments on your posts.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_comments)}
                            onChange={(e) => handleUpdateNotification({ notif_comments: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>

                      {/* Followers */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>New Followers</strong>
                          <p>Receive notifications when someone starts following you.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_follows)}
                            onChange={(e) => handleUpdateNotification({ notif_follows: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>

                      {/* Direct Messages */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Direct Messages</strong>
                          <p>Receive notifications for incoming direct chat messages.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_messages)}
                            onChange={(e) => handleUpdateNotification({ notif_messages: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>

                      {/* Mentions */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Mentions</strong>
                          <p>Receive notifications when someone mentions your @username.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_mentions)}
                            onChange={(e) => handleUpdateNotification({ notif_mentions: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>

                      {/* Tags */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Tags</strong>
                          <p>Receive notifications when someone tags you in photos.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_tags)}
                            onChange={(e) => handleUpdateNotification({ notif_tags: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>

                      {/* Stories */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Story Updates</strong>
                          <p>Receive notifications about new stories and replies.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_stories)}
                            onChange={(e) => handleUpdateNotification({ notif_stories: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>
                    </div>

                    <div className="privacy-divider" />

                    {/* Security Group */}
                    <div className="privacy-group">
                      <span className="privacy-group-title">🛡️ Security & Delivery</span>

                      {/* Security Alerts */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Security Alerts</strong>
                          <p>Alerts about new logins, password modifications, and security events.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_security)}
                            onChange={(e) => handleUpdateNotification({ notif_security: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>

                      {/* Email Notifications */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Email Notifications</strong>
                          <p>Receive periodic digest emails and important product updates.</p>
                        </div>
                        <label className="switch-toggle">
                          <input
                            type="checkbox"
                            checked={Boolean(notificationSettings.notif_email)}
                            onChange={(e) => handleUpdateNotification({ notif_email: e.target.checked })}
                            disabled={savingNotif}
                          />
                          <span className="switch-slider" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================== */}
              {/* CATEGORY 6: ACCOUNT STATUS & DANGER ZONE                   */}
              {/* ========================================================== */}
              {activeSection === 'danger' && (
                <div className="settings-section-body">
                  <div className="settings-panel-header">
                    <h3>⚠️ Account Status & Danger Zone</h3>
                    <p>Temporarily step away or permanently delete your account and personal data.</p>
                  </div>

                  <div className="account-mgmt-card danger-zone-card">
                    {/* Temporary Deactivation */}
                    <div className="danger-zone-body">
                      <div className="danger-zone-info">
                        <strong>Temporarily Deactivate Account</strong>
                        <p>
                          Hide your profile, photos, comments, and likes until you log back in.
                          Your account data remains safely preserved and can be reactivated anytime.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-danger-outline"
                        onClick={() => {
                          setDeactivatePassword('');
                          setDeactivateError('');
                          setDeactivateReason('Taking a break');
                          setShowDeactivateModal(true);
                        }}
                      >
                        Deactivate Account
                      </button>
                    </div>

                    <div className="privacy-divider" />

                    {/* Permanent Deletion */}
                    <div className="danger-zone-body">
                      <div className="danger-zone-info">
                        <strong style={{ color: '#ef4444' }}>Permanently Delete Account</strong>
                        <p>
                          Permanently delete your profile, media, comments, likes, and messages.
                          This action is irreversible and cannot be undone.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-danger-solid"
                        style={{ fontSize: '0.82rem', padding: '8px 16px', whiteSpace: 'nowrap' }}
                        onClick={() => {
                          setDeletePassword('');
                          setDeleteConfirmation('');
                          setDeleteError('');
                          setShowDeleteModal(true);
                        }}
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {/* ========================================================== */}
      {/* DEACTIVATION CONFIRMATION MODAL                            */}
      {/* ========================================================== */}
      {showDeactivateModal && (
        <div className="modal-overlay" onClick={() => !deactivating && setShowDeactivateModal(false)}>
          <div className="deactivate-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="deactivate-modal-header">
              <div className="deactivate-modal-icon">⚠️</div>
              <h3>Deactivate Your Account?</h3>
              <p>
                Deactivating your account is temporary. Your profile, photos, comments, and likes will be hidden immediately.
                You can easily reactivate your account at any time simply by logging back in.
              </p>
            </div>

            {deactivateError && (
              <div className="deactivate-error-banner">
                <span>⚠️ {deactivateError}</span>
              </div>
            )}

            <form onSubmit={handleDeactivateAccount} className="deactivate-modal-form">
              <div className="form-group">
                <label htmlFor="settingsDeactivateReason">Why are you taking a break?</label>
                <select
                  id="settingsDeactivateReason"
                  className="privacy-select-input"
                  value={deactivateReason}
                  onChange={(e) => setDeactivateReason(e.target.value)}
                  disabled={deactivating}
                >
                  <option value="Taking a break">Just need a break from social media</option>
                  <option value="Privacy concerns">Privacy concerns</option>
                  <option value="Too busy / distracting">Too busy or distracting</option>
                  <option value="Just need a fresh start">Want a fresh start</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label htmlFor="settingsDeactivatePass">To continue, enter your current password</label>
                <div className="password-input-wrapper">
                  <input
                    id="settingsDeactivatePass"
                    type={showDeactivatePassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter current password"
                    value={deactivatePassword}
                    onChange={(e) => setDeactivatePassword(e.target.value)}
                    disabled={deactivating}
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowDeactivatePassword(!showDeactivatePassword)}
                    tabIndex="-1"
                  >
                    {showDeactivatePassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="deactivate-modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDeactivateModal(false)}
                  disabled={deactivating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger-solid"
                  disabled={deactivating || !deactivatePassword.trim()}
                >
                  {deactivating ? 'Deactivating...' : 'Deactivate Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* PERMANENT DELETION CONFIRMATION MODAL                      */}
      {/* ========================================================== */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => !deletingAccount && setShowDeleteModal(false)}>
          <div className="deactivate-modal-box" style={{ borderColor: '#ef4444' }} onClick={(e) => e.stopPropagation()}>
            <div className="deactivate-modal-header">
              <div className="deactivate-modal-icon">🚨</div>
              <h3 style={{ color: '#ef4444' }}>Permanently Delete Account?</h3>
              <p>
                This action is <strong>permanent and irreversible</strong>. All your posts, photos, comments, messages,
                followers, and likes will be permanently erased from VibeGrid.
              </p>
            </div>

            {deleteError && (
              <div className="deactivate-error-banner">
                <span>⚠️ {deleteError}</span>
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="deactivate-modal-form">
              <div className="form-group">
                <label htmlFor="settingsDeleteConfirmInput">
                  Type your username <strong>@{profile?.username || currentUser?.username}</strong> to confirm:
                </label>
                <input
                  id="settingsDeleteConfirmInput"
                  type="text"
                  className="form-input"
                  placeholder={profile?.username || currentUser?.username || 'username'}
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  disabled={deletingAccount}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group" style={{ marginTop: '14px' }}>
                <label htmlFor="settingsDeletePassInput">Enter your current password:</label>
                <div className="password-input-wrapper">
                  <input
                    id="settingsDeletePassInput"
                    type={showDeletePassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter current password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    disabled={deletingAccount}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}
                    tabIndex="-1"
                  >
                    {showDeletePassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="deactivate-modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingAccount}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger-solid"
                  style={{ background: '#b91c1c' }}
                  disabled={
                    deletingAccount ||
                    !deletePassword.trim() ||
                    deleteConfirmation.trim().toLowerCase() !== (profile?.username || currentUser?.username || '').toLowerCase()
                  }
                >
                  {deletingAccount ? 'Deleting Forever...' : 'Delete My Account Permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
