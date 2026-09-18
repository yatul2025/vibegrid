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
import { getDefaultAvatar, isDefaultAvatar } from '../utils/avatar';
import ConfirmModal from '../components/ConfirmModal';
import PasswordToggleButton from '../components/PasswordToggleIcon';
import SpringToggle from '../components/SpringToggle';
import pushNotificationService from '../services/pushNotificationService';
import { THEMES, getThemeById } from '../constants/themes';
import soundFx, { SOUND_PACKS } from '../services/soundFxService';
import navigationService from '../services/navigationService';
import { SettingsSkeleton, SkeletonLine, SkeletonCircle, SkeletonPill } from '../components/common/Skeleton';
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  Bell,
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertCircle,
  Palette,
  Check,
  Volume2,
  VolumeX,
  Music
} from 'lucide-react';

const DEMO_USERNAMES = ['sophia_wander', 'alex_design', 'elena_culinary', 'liam_visuals'];

export default function SettingsPage({
  initialSection = null,
  onNavigateToProfile,
  currentTheme = 'dark',
  onThemeChange
}) {
  const { user: currentUser, updateUser, logout } = useAuth();

  // Active section: 'profile' | 'appearance' | 'contact' | 'security' | 'privacy' | 'notifications' | 'danger' | null
  const [activeSection, setActiveSection] = useState(initialSection || null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileViewingSection, setMobileViewingSection] = useState(() => {
    if (typeof window !== 'undefined' && window.history?.state?.tab === 'settings' && window.history?.state?.subSection !== undefined) {
      return Boolean(window.history.state.subSection);
    }
    return Boolean(initialSection);
  });

  const mobileViewingSectionRef = useRef(mobileViewingSection);
  useEffect(() => {
    mobileViewingSectionRef.current = mobileViewingSection;
  }, [mobileViewingSection]);

  // Global message banner for settings
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);

  // Theme selection state (Phase 10 Option 6 Complete Suite)
  const [selectedTheme, setSelectedTheme] = useState(() => currentTheme || (typeof window !== 'undefined' ? localStorage.getItem('vibegrid_theme') : null) || 'dark');
  const [themeFilter, setThemeFilter] = useState('all');
  const [previewHoverTheme, setPreviewHoverTheme] = useState(null);
  const [copiedSwatch, setCopiedSwatch] = useState(null);
  const [showcaseTab, setShowcaseTab] = useState('feed');
  const [autoSyncDevice, setAutoSyncDevice] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('vibegrid_theme_auto_sync') === 'true';
    } catch {
      return false;
    }
  });
  const [scheduledDayTheme, setScheduledDayTheme] = useState(() => {
    try {
      return (typeof window !== 'undefined' && localStorage.getItem('vibegrid_theme_day')) || 'light';
    } catch {
      return 'light';
    }
  });
  const [scheduledNightTheme, setScheduledNightTheme] = useState(() => {
    try {
      return (typeof window !== 'undefined' && localStorage.getItem('vibegrid_theme_night')) || 'dark';
    } catch {
      return 'dark';
    }
  });
  const [batteryOledEnabled, setBatteryOledEnabled] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('vibegrid_theme_battery_oled') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (currentTheme) {
      setSelectedTheme(currentTheme);
    }
  }, [currentTheme]);

  const handleThemeSelect = (themeId) => {
    setSelectedTheme(themeId);
    if (onThemeChange) {
      onThemeChange(themeId);
    } else {
      try {
        localStorage.setItem('vibegrid_theme', themeId);
        document.documentElement.setAttribute('data-theme', themeId);
      } catch {}
    }
    try {
      soundFx.play('refresh');
    } catch {}
    const t = THEMES.find((item) => item.id === themeId);
    setFeedbackMsg({
      type: 'success',
      text: `Applied "${t?.name || themeId}" theme!`
    });
  };

  // Smart OS Appearance Auto-Sync
  useEffect(() => {
    if (!autoSyncDevice || typeof window === 'undefined') return;

    try {
      localStorage.setItem('vibegrid_theme_auto_sync', 'true');
    } catch {}

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSchemeChange = (e) => {
      const targetId = e.matches ? scheduledNightTheme : scheduledDayTheme;
      handleThemeSelect(targetId);
    };

    if (mediaQuery.matches && selectedTheme !== scheduledNightTheme) {
      handleThemeSelect(scheduledNightTheme);
    } else if (!mediaQuery.matches && selectedTheme !== scheduledDayTheme) {
      handleThemeSelect(scheduledDayTheme);
    }

    mediaQuery.addEventListener('change', handleSchemeChange);
    return () => mediaQuery.removeEventListener('change', handleSchemeChange);
  }, [autoSyncDevice, scheduledDayTheme, scheduledNightTheme]);

  // Battery OLED Auto-Saver
  useEffect(() => {
    if (!batteryOledEnabled || typeof navigator === 'undefined' || !navigator.getBattery) return;

    try {
      localStorage.setItem('vibegrid_theme_battery_oled', 'true');
    } catch {}

    let isMounted = true;
    navigator.getBattery().then((battery) => {
      if (!isMounted) return;
      const checkBattery = () => {
        if (battery.level <= 0.20 && !battery.charging && selectedTheme !== 'amoled-black') {
          handleThemeSelect('amoled-black');
          setFeedbackMsg({
            type: 'info',
            text: '⚡ Low battery detected (<20%). Switched to AMOLED Black for maximum power efficiency.'
          });
        }
      };
      checkBattery();
      battery.addEventListener('levelchange', checkBattery);
      battery.addEventListener('chargingchange', checkBattery);
    }).catch(() => {});

    return () => { isMounted = false; };
  }, [batteryOledEnabled, selectedTheme]);

  const handleCopySwatch = (e, hex) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(hex);
      setCopiedSwatch(hex);
      soundFx.play('click');
      setTimeout(() => setCopiedSwatch(null), 1500);
    } catch {}
  };

  // Profile data & form states (initialized with currentUser to prevent flash of empty/undefined data)
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState(currentUser || null);

  const isDemoUser = Boolean(
    currentUser?.is_demo_session ||
    DEMO_USERNAMES.includes((currentUser?.username || '').toLowerCase()) ||
    DEMO_USERNAMES.includes((profile?.username || '').toLowerCase())
  );

  const [editUsername, setEditUsername] = useState(currentUser?.username || '');
  const [editFullName, setEditFullName] = useState(currentUser?.full_name || '');
  const [editBio, setEditBio] = useState(currentUser?.bio || '');
  const [editWebsite, setEditWebsite] = useState(currentUser?.website || '');
  const [editLocation, setEditLocation] = useState(currentUser?.location || '');
  const [editDateOfBirth, setEditDateOfBirth] = useState(
    currentUser?.date_of_birth ? String(currentUser.date_of_birth).substring(0, 10) : ''
  );
  const [editGender, setEditGender] = useState(currentUser?.gender || 'unspecified');
  const [savingProfile, setSavingProfile] = useState(false);

  // Maximum allowed date of birth (must be at least 18 years old)
  const maxDobDate = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 18);
    return d.toISOString().split('T')[0];
  })();

  // Avatar Upload States
  const [avatarPreview, setAvatarPreview] = useState(
    currentUser?.avatar_url || getDefaultAvatar(currentUser?.gender)
  );
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleGenderChange = (newGender) => {
    setEditGender(newGender);
    if (isDefaultAvatar(avatarPreview)) {
      setAvatarPreview(getDefaultAvatar(newGender));
    }
  };

  // Email Management States
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);

  // Phone Management States
  const [newPhone, setNewPhone] = useState('');
  const [phonePassword, setPhonePassword] = useState('');
  const [showPhonePassword, setShowPhonePassword] = useState(false);
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
    allow_calls_from: 'everyone',
    allow_group_add_from: 'everyone',
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
    notif_calls: true,
    notif_mentions: true,
    notif_tags: true,
    notif_stories: true,
    notif_security: true,
    notif_email: true
  });
  const [loadingNotif, setLoadingNotif] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  // Web Push Subscription & Diagnostics States
  const [pushPermission, setPushPermission] = useState(() => pushNotificationService.getNotificationPermission());
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [pushDiagnostics, setPushDiagnostics] = useState(null);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const modalOpenedAtRef = useRef(0);

  // Sound FX Preferences States (Phase 9 Option 6)
  const [soundEnabled, setSoundEnabled] = useState(() => soundFx.isEnabled());
  const [soundPack, setSoundPack] = useState(() => soundFx.getPack());
  const [soundVolume, setSoundVolume] = useState(() => soundFx.getVolume());

  useEffect(() => {
    const unsub = soundFx.subscribe((state) => {
      setSoundEnabled(state.enabled);
      setSoundPack(state.pack);
      setSoundVolume(state.volume);
    });
    return unsub;
  }, []);

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

  // Synchronize modal and sub-section state with global navigation coordinator
  useEffect(() => {
    if (showDiagnosticsModal) {
      if (typeof window !== 'undefined') window.__vg_modal_open = true;
      return navigationService.registerBackInterceptor('settings_diagnostics_modal', () => {
        if (typeof window !== 'undefined') window.__vg_modal_open = false;
        setShowDiagnosticsModal(false);
        return true;
      }, 20);
    } else {
      if (typeof window !== 'undefined' && !showDeactivateModal && !showDeleteModal && !confirmAction) {
        window.__vg_modal_open = false;
      }
    }
  }, [showDiagnosticsModal, showDeactivateModal, showDeleteModal, confirmAction]);

  useEffect(() => {
    if (showDeactivateModal) {
      return navigationService.registerBackInterceptor('settings_deactivate_modal', () => {
        setShowDeactivateModal(false);
        return true;
      }, 20);
    }
  }, [showDeactivateModal]);

  useEffect(() => {
    if (showDeleteModal) {
      return navigationService.registerBackInterceptor('settings_delete_modal', () => {
        setShowDeleteModal(false);
        return true;
      }, 20);
    }
  }, [showDeleteModal]);

  useEffect(() => {
    if (confirmAction) {
      return navigationService.registerBackInterceptor('settings_confirm_modal', () => {
        setConfirmAction(null);
        return true;
      }, 20);
    }
  }, [confirmAction]);

  useEffect(() => {
    if (mobileViewingSection) {
      return navigationService.registerBackInterceptor('settings_sub_section', (e) => {
        setMobileViewingSection(false);
        if (e?.state?.section) {
          setActiveSection(e.state.section);
        }
        return true;
      }, 15);
    }
  }, [mobileViewingSection]);

  // Update section from props if provided
  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
      if (isMobile) {
        const hasHistorySub = typeof window !== 'undefined' && window.history?.state?.tab === 'settings' && window.history?.state?.subSection !== undefined;
        if (hasHistorySub) {
          setMobileViewingSection(Boolean(window.history.state.subSection));
        } else {
          setMobileViewingSection(Boolean(initialSection));
        }
      }
    } else {
      setActiveSection(null);
      setMobileViewingSection(false);
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
          setEditDateOfBirth(u.date_of_birth ? String(u.date_of_birth).substring(0, 10) : '');
          setEditGender(u.gender || currentUser.gender || 'unspecified');
          setAvatarPreview(u.avatar_url || currentUser.avatar_url || getDefaultAvatar(u.gender || currentUser.gender));
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
    if (activeSection === 'security' && !isDemoUser) {
      fetchSessions();
    } else if (activeSection === 'privacy') {
      fetchPrivacySettings();
    } else if (activeSection === 'notifications') {
      fetchNotificationSettings();
      checkPushState();
    }
  }, [activeSection]);

  // ============================================================================
  // API Handlers
  // ============================================================================

  // 1. Edit Profile Handlers
  const handleAvatarFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (isDemoUser) {
      setFeedbackMsg({ type: 'error', text: '🔒 Profile photo cannot be changed on official demo accounts.' });
      return;
    }
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
    if (isDemoUser) {
      setFeedbackMsg({ type: 'error', text: '🔒 Profile photo cannot be changed on official demo accounts.' });
      return;
    }
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
    if (isDemoUser) {
      setFeedbackMsg({ type: 'error', text: '🔒 Profile photo cannot be removed on official demo accounts.' });
      return;
    }
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
    if (isDemoUser) {
      setFeedbackMsg({ type: 'error', text: '🔒 Profile details cannot be modified on official demo accounts.' });
      return;
    }

    if (editDateOfBirth) {
      const dob = new Date(editDateOfBirth);
      if (isNaN(dob.getTime())) {
        setFeedbackMsg({ type: 'error', text: 'Please provide a valid date of birth.' });
        return;
      }
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 18) {
        setFeedbackMsg({ type: 'error', text: 'You must be at least 18 years old.' });
        return;
      }
    }

    try {
      setSavingProfile(true);
      const res = await apiClient.put('/users/profile', {
        username: editUsername.trim(),
        full_name: editFullName.trim(),
        bio: editBio.trim(),
        website: editWebsite.trim(),
        location: editLocation.trim(),
        date_of_birth: editDateOfBirth || null,
        gender: editGender || 'unspecified'
      });

      if (res.success && res.data?.user) {
        setProfile(res.data.user);
        if (res.data.user.avatar_url) {
          setAvatarPreview(res.data.user.avatar_url);
        }
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
    if (newEmail.trim() && !emailPassword) {
      setFeedbackMsg({ type: 'error', text: 'Please enter your current password to authorize changing your email address.' });
      return;
    }
    try {
      setSendingEmailOtp(true);
      const payload = newEmail.trim() 
        ? { newEmail: newEmail.trim(), currentPassword: emailPassword } 
        : {};
      const res = await apiClient.post('/users/email/send-otp', payload);
      if (res.success) {
        if (res.updatedDirectly && res.data?.user) {
          setProfile((prev) => ({ ...prev, ...res.data.user }));
          updateUser(res.data.user);
          setEmailOtpSent(false);
          setEmailOtp('');
          setNewEmail('');
          setEmailPassword('');
          setFeedbackMsg({ type: 'success', text: res.message || 'Email address updated successfully!' });
        } else {
          setEmailOtpSent(true);
          setOtpCountdown(60);
          setFeedbackMsg({ type: 'success', text: res.message || 'Verification code sent to your email.' });
        }
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
        setEmailPassword('');
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
    if (!phonePassword) {
      setFeedbackMsg({ type: 'error', text: 'Please enter your current password to authorize linking a phone number.' });
      return;
    }
    try {
      setSendingPhoneOtp(true);
      const res = await apiClient.post('/users/phone/send-otp', {
        phoneNumber: newPhone.trim(),
        currentPassword: phonePassword
      });
      if (res.success) {
        if (res.updatedDirectly && res.data?.user) {
          setProfile((prev) => ({ ...prev, ...res.data.user }));
          updateUser(res.data.user);
          setPhoneOtpSent(false);
          setPhoneOtp('');
          setNewPhone('');
          setPhonePassword('');
          setFeedbackMsg({ type: 'success', text: res.message || 'Phone number linked successfully!' });
        } else {
          setPhoneOtpSent(true);
          setPhoneOtpCountdown(60);
          setFeedbackMsg({ type: 'success', text: res.message || 'Verification code sent to your phone.' });
        }
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
        setPhonePassword('');
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

  const handleRemovePhone = () => {
    if (isDemoUser) {
      setFeedbackMsg({ type: 'error', text: '🔒 Phone modification is locked on official demo accounts.' });
      return;
    }
    setConfirmAction({
      title: 'Unlink Phone Number?',
      description: 'Are you sure you want to remove your linked phone number from your account?',
      confirmText: 'Unlink Phone',
      variant: 'danger',
      onConfirm: async () => {
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
            setConfirmAction(null);
          } else {
            setFeedbackMsg({ type: 'error', text: res.error || 'Failed to remove phone number.' });
          }
        } catch (err) {
          setFeedbackMsg({ type: 'error', text: err.message || 'Failed to remove phone number.' });
        } finally {
          setRemovingPhone(false);
        }
      }
    });
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

  const handleLogoutOthers = () => {
    setConfirmAction({
      title: 'Log Out Other Sessions?',
      description: 'Log out of all other devices except this current session?',
      confirmText: 'Log Out Others',
      variant: 'warning',
      onConfirm: async () => {
        try {
          setLoggingOutOthers(true);
          const res = await apiClient.post('/users/security/sessions/logout-others');
          if (res.success) {
            setFeedbackMsg({ type: 'success', text: res.message || 'Logged out of all other devices.' });
            fetchSessions();
            setConfirmAction(null);
          } else {
            setFeedbackMsg({ type: 'error', text: res.error || 'Failed to log out of other devices.' });
          }
        } catch (err) {
          setFeedbackMsg({ type: 'error', text: err.message || 'Failed to log out of other devices.' });
        } finally {
          setLoggingOutOthers(false);
        }
      }
    });
  };

  const handleLogoutAll = () => {
    setConfirmAction({
      title: 'Log Out All Devices?',
      description: 'Are you sure you want to log out of ALL devices including this one? You will need to log in again.',
      confirmText: 'Log Out All',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setLoggingOutAll(true);
          const res = await apiClient.post('/users/security/sessions/logout-all');
          if (res.success) {
            setConfirmAction(null);
            await logout();
          }
        } catch (err) {
          setFeedbackMsg({ type: 'error', text: err.message || 'Failed to log out of all devices.' });
          setLoggingOutAll(false);
        }
      }
    });
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
    if (isDemoUser) {
      setFeedbackMsg({ type: 'error', text: '🔒 Privacy settings are locked for official demo accounts.' });
      return;
    }
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
    if (isDemoUser) {
      setFeedbackMsg({ type: 'error', text: '🔒 Notification preferences are locked for official demo accounts.' });
      return;
    }
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

  const checkPushState = async () => {
    try {
      const perm = pushNotificationService.getNotificationPermission();
      setPushPermission(perm);
      const sub = await pushNotificationService.getExistingSubscription();
      setIsPushSubscribed(Boolean(sub));
    } catch (e) {
      console.warn('Failed to check push state:', e);
    }
  };

  const handleEnablePush = async () => {
    try {
      setPushLoading(true);
      await pushNotificationService.subscribeToPushNotifications();
      await checkPushState();
      setFeedbackMsg({ type: 'success', text: '✅ Web Push notifications enabled! You will now receive background alerts.' });
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to enable push notifications.' });
    } finally {
      setPushLoading(false);
    }
  };

  const handleDisablePush = async () => {
    try {
      setPushLoading(true);
      await pushNotificationService.unsubscribeFromPushNotifications();
      await checkPushState();
      setFeedbackMsg({ type: 'success', text: 'Web Push notifications disabled for this device.' });
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to unsubscribe.' });
    } finally {
      setPushLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    try {
      setTestPushLoading(true);
      await pushNotificationService.sendTestNotification();
      setFeedbackMsg({ type: 'success', text: '🚀 Test push notification sent! Check your notification tray.' });
    } catch (err) {
      setFeedbackMsg({ type: 'error', text: err.message || 'Failed to send test push notification.' });
    } finally {
      setTestPushLoading(false);
    }
  };

  const handleForcePwaUpdate = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  const handleLoadDiagnostics = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    try {
      setLoadingDiagnostics(true);
      const diag = await pushNotificationService.getPushDiagnostics();
      setPushDiagnostics(diag);
      modalOpenedAtRef.current = Date.now();
      if (typeof window !== 'undefined') window.__vg_modal_open = true;
      setShowDiagnosticsModal(true);
    } catch (err) {
      alert('Failed to load push diagnostics: ' + err.message);
    } finally {
      setLoadingDiagnostics(false);
    }
  };

  const handleCloseDiagnosticsModal = (e) => {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    // Ignore clicks that fire within 400ms of opening to eliminate mobile ghost clicks
    if (Date.now() - modalOpenedAtRef.current < 400) {
      return;
    }
    if (typeof window !== 'undefined') window.__vg_modal_open = false;
    setShowDiagnosticsModal(false);
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
    { id: 'profile', label: 'Edit Profile', icon: <User size={18} strokeWidth={1.75} />, description: 'Photo, name, bio & links' },
    { id: 'appearance', label: 'Appearance & Themes', icon: <Palette size={18} strokeWidth={1.75} />, description: '10 selectable custom app themes' },
    { id: 'contact', label: 'Account & Contact', icon: <Mail size={18} strokeWidth={1.75} />, description: 'Email & phone verification' },
    { id: 'security', label: 'Password & Security', icon: <Lock size={18} strokeWidth={1.75} />, description: 'Password, sessions & devices' },
    { id: 'privacy', label: 'Privacy & Permissions', icon: <ShieldCheck size={18} strokeWidth={1.75} />, description: 'Account privacy, DMs & comments' },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} strokeWidth={1.75} />, description: 'Push, sound FX & email' },
    { id: 'danger', label: 'Account Status', icon: <AlertTriangle size={18} strokeWidth={1.75} />, description: 'Deactivate or delete account' }
  ];

  const currentPassStrength = getPasswordStrength(newPassword);

  const handleSelectSection = (catId) => {
    setActiveSection(catId);
    if (isMobile) {
      setMobileViewingSection(true);
      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState(
          { tab: 'settings', section: catId, subSection: true },
          ''
        );
      }
    }
  };

  const handleBackToMenu = () => {
    navigationService.goBack(() => {
      setMobileViewingSection(false);
      setActiveSection(null);
    });
  };

  if (loadingProfile && !profile) {
    return (
      <div className="settings-page-wrapper">
        <SettingsSkeleton />
      </div>
    );
  }

  return (
    <div className="settings-page-wrapper">
      <div className="settings-card-container">
        {/* Settings Header Bar */}
        <div className="settings-top-header">
          <div className="settings-top-header-left">
            {isMobile && mobileViewingSection ? (
              <button
                type="button"
                className="settings-back-btn"
                onClick={handleBackToMenu}
                title="Back to Settings menu"
                aria-label="Back to Settings menu"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <button
                type="button"
                className="settings-back-btn"
                onClick={() => navigationService.goBack(() => onNavigateToProfile && onNavigateToProfile(currentUser?.username))}
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft size={18} />
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {feedbackMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {feedbackMsg.text}
            </span>
            <button
              type="button"
              className="alert-close-btn"
              onClick={() => setFeedbackMsg(null)}
              aria-label="Dismiss alert"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {/* Demo Mode Security Notice */}
        {isDemoUser && (
          <div className="demo-account-banner">
            <span style={{ fontSize: '20px' }}>🔒</span>
            <div style={{ flex: 1 }}>
              <strong>
                Official Demo Account (Read-Only)
              </strong>
              <span>
                You are currently browsing an official showcase demo account. Profile details, avatar photo, contact info, privacy controls, notification preferences, and credentials are locked in read-only mode.
              </span>
            </div>
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

              <nav className="settings-nav-list" aria-label="Settings navigation">
                <ul className="settings-nav-items-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {categories.map((cat) => (
                    <li key={cat.id}>
                      <a
                        href={`#${cat.id}`}
                        className={`settings-nav-item ${activeSection === cat.id ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleSelectSection(cat.id);
                        }}
                        style={{ textDecoration: 'none' }}
                      >
                        <span className="settings-nav-icon">{cat.icon}</span>
                        <div className="settings-nav-info">
                          <span className="settings-nav-label">
                            {cat.label}
                            {isDemoUser && (
                              <span style={{ fontSize: '11px', color: '#f87171', marginLeft: '6px', display: 'inline-flex', alignItems: 'center' }} title="Locked on demo accounts">
                                <Lock size={11} />
                              </span>
                            )}
                          </span>
                          <span className="settings-nav-desc">{cat.description}</span>
                        </div>
                        {isMobile && <span className="settings-nav-chevron"><ChevronRight size={16} /></span>}
                      </a>
                    </li>
                  ))}
                </ul>
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
              {/* Empty Selection Placeholder (Shown on Desktop when no section is selected) */}
              {!activeSection && (
                <div className="settings-empty-selection">
                  <div className="settings-empty-icon">⚙️</div>
                  <h3>Settings & Privacy</h3>
                  <p>Select a category from the menu to manage your account details, appearance, security, notifications, and preferences.</p>
                </div>
              )}

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
                        src={avatarPreview || profile?.avatar_url || currentUser?.avatar_url || getDefaultAvatar(editGender || profile?.gender || currentUser?.gender)}
                        alt="Profile Preview"
                        className="settings-avatar-img"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = getDefaultAvatar(editGender || profile?.gender || currentUser?.gender);
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
                          disabled={avatarUploading || isDemoUser}
                          title={isDemoUser ? 'Locked on official demo accounts' : undefined}
                        >
                          Change Photo
                        </button>
                        {avatarFile && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={handleUploadAvatar}
                            disabled={avatarUploading || isDemoUser}
                          >
                            Save Photo
                          </button>
                        )}
                        {profile?.avatar_url && !isDefaultAvatar(profile.avatar_url) && (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={handleRemoveAvatar}
                            disabled={avatarUploading || isDemoUser}
                            title={isDemoUser ? 'Locked on official demo accounts' : undefined}
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
                      <label htmlFor="settingsUsername">
                        Username {isDemoUser && <span style={{ fontSize: '11px', color: '#f87171' }}>🔒 (Locked in Demo Mode)</span>}
                      </label>
                      <input
                        id="settingsUsername"
                        type="text"
                        className="form-input"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        maxLength={30}
                        required
                        disabled={savingProfile || isDemoUser}
                      />
                      <span className="form-input-hint" style={{ color: isDemoUser ? '#f87171' : undefined }}>
                        {isDemoUser
                          ? '🔒 Username cannot be modified on official demo accounts.'
                          : 'Your unique @handle on VibeGrid (letters, numbers, underscore).'}
                      </span>
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
                        disabled={savingProfile || isDemoUser}
                      />
                    </div>

                    <div className="form-group">
                      <div className="form-label-with-counter">
                        <label htmlFor="settingsBio">Bio</label>
                        <span className={`char-counter ${150 - (editBio || '').length < 20 ? 'counter-warning' : ''}`}>
                          {150 - (editBio || '').length} left
                        </span>
                      </div>
                      <textarea
                        id="settingsBio"
                        className="form-input form-textarea"
                        value={editBio || ''}
                        onChange={(e) => setEditBio(e.target.value.slice(0, 150))}
                        placeholder="Tell the community about yourself..."
                        rows={3}
                        disabled={savingProfile || isDemoUser}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="settingsWebsite">Website</label>
                      <input
                        id="settingsWebsite"
                        type="url"
                        className="form-input"
                        value={editWebsite || ''}
                        onChange={(e) => setEditWebsite(e.target.value)}
                        placeholder="https://yourwebsite.com"
                        disabled={savingProfile || isDemoUser}
                      />
                    </div>

                    <div className="form-row">
                      <div className="form-group form-col">
                        <label htmlFor="settingsLocation">Location</label>
                        <input
                          id="settingsLocation"
                          type="text"
                          className="form-input"
                          value={editLocation || ''}
                          onChange={(e) => setEditLocation(e.target.value)}
                          placeholder="e.g. San Francisco, CA"
                          disabled={savingProfile || isDemoUser}
                        />
                      </div>
                      <div className="form-group form-col">
                        <label htmlFor="settingsDob">Date of Birth (Must be 18+)</label>
                        <input
                          id="settingsDob"
                          type="date"
                          max={maxDobDate}
                          className="form-input"
                          value={editDateOfBirth || ''}
                          onChange={(e) => setEditDateOfBirth(e.target.value)}
                          disabled={savingProfile || isDemoUser}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group form-col">
                        <label htmlFor="settingsGender">Gender</label>
                        <select
                          id="settingsGender"
                          className="form-input"
                          value={editGender || 'unspecified'}
                          onChange={(e) => handleGenderChange(e.target.value)}
                          disabled={savingProfile || isDemoUser}
                          style={{ cursor: 'pointer' }}
                        >
                          <option value="unspecified">Prefer not to say / Unspecified</option>
                          <option value="male">Male 👨</option>
                          <option value="female">Female 👩</option>
                          <option value="other">Other 🧑</option>
                        </select>
                      </div>
                    </div>

                    <div className="settings-form-actions">
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={savingProfile || (editBio || '').length > 150 || !(editUsername || '').trim() || isDemoUser}
                      >
                        {isDemoUser ? '🔒 Profile Locked (Demo)' : (savingProfile ? 'Saving...' : 'Save Profile Changes')}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ========================================================== */}
              {/* CATEGORY: APPEARANCE & THEMES (Phase 10 Option 6 Suite)     */}
              {/* ========================================================== */}
              {activeSection === 'appearance' && (() => {
                const activeDisplayTheme = previewHoverTheme || getThemeById(selectedTheme);
                const filteredThemes = THEMES.filter((t) => {
                  if (themeFilter === 'dark') return t.category === 'dark' || t.id === 'amoled-black';
                  if (themeFilter === 'light') return t.category === 'light';
                  if (themeFilter === 'cyber') return ['neon-glow', 'sunset-gradient', 'purple-dream', 'rose-pink'].includes(t.id);
                  return true;
                });

                return (
                  <div className="settings-section-body appearance-section-wrapper">
                    <div className="settings-panel-header">
                      <h3>🎨 Appearance & Themes</h3>
                      <p>Customize VibeGrid with 10 hand-crafted themes. Changes apply instantly across the entire application.</p>
                    </div>

                    <div className="appearance-banner">
                      <div className="appearance-banner-icon">
                        <Palette size={22} />
                      </div>
                      <div className="appearance-banner-text">
                        <h3>Active Theme: {getThemeById(selectedTheme).name}</h3>
                        <p>
                          Selected theme persists across refreshes, app restarts, and mobile PWA sessions.
                          Enjoy high contrast readability across Feed, Explore, Messages, and Chat.
                        </p>
                      </div>
                    </div>

                    {/* Top-Anchored Live Interactive Showcase Canvas */}
                    <div
                      className="theme-showcase-canvas"
                      data-testid="theme-showcase-canvas"
                      style={{
                        background: activeDisplayTheme.bgPage,
                        border: `2px solid ${activeDisplayTheme.borderColor}`,
                        color: activeDisplayTheme.textPrimary
                      }}
                    >
                      <div className="theme-showcase-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '50%',
                              background: activeDisplayTheme.primary,
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '14px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                            }}
                          >
                            V
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '15px' }}>{activeDisplayTheme.name}</strong>
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  background: activeDisplayTheme.primary,
                                  color: '#ffffff',
                                  padding: '2px 7px',
                                  borderRadius: '9999px',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em'
                                }}
                              >
                                {activeDisplayTheme.badge}
                              </span>
                            </div>
                            <span style={{ fontSize: '11px', opacity: 0.75 }}>
                              {previewHoverTheme ? '🔍 Live Hover Preview' : '✨ Current Active Theme'}
                            </span>
                          </div>
                        </div>

                        {/* Showcase Preview Component Switcher */}
                        <div className="theme-showcase-tabs">
                          <button
                            type="button"
                            className={`theme-showcase-tab ${showcaseTab === 'feed' ? 'is-active' : ''}`}
                            onClick={() => setShowcaseTab('feed')}
                          >
                            📱 Feed Post
                          </button>
                          <button
                            type="button"
                            className={`theme-showcase-tab ${showcaseTab === 'chat' ? 'is-active' : ''}`}
                            onClick={() => setShowcaseTab('chat')}
                          >
                            💬 Direct Message
                          </button>
                          <button
                            type="button"
                            className={`theme-showcase-tab ${showcaseTab === 'profile' ? 'is-active' : ''}`}
                            onClick={() => setShowcaseTab('profile')}
                          >
                            👤 Profile Card
                          </button>
                        </div>
                      </div>

                      {/* Showcase Dynamic Component Body */}
                      <div style={{ transition: 'all 0.3s ease' }}>
                        {showcaseTab === 'feed' && (
                          <div
                            style={{
                              background: activeDisplayTheme.bgCard,
                              border: `1px solid ${activeDisplayTheme.borderColor}`,
                              borderRadius: '12px',
                              padding: '14px 16px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: activeDisplayTheme.primary,
                                    opacity: 0.85
                                  }}
                                />
                                <div>
                                  <div style={{ fontSize: '12px', fontWeight: 700 }}>Alex Mercer</div>
                                  <div style={{ fontSize: '10px', opacity: 0.6 }}>@alex_vibe • 2m ago</div>
                                </div>
                              </div>
                              <button
                                type="button"
                                style={{
                                  background: activeDisplayTheme.primary,
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '4px 10px',
                                  borderRadius: '9999px',
                                  cursor: 'pointer'
                                }}
                              >
                                Follow
                              </button>
                            </div>
                            <p style={{ fontSize: '12px', lineHeight: 1.5, margin: '0 0 10px 0', opacity: 0.9 }}>
                              VibeGrid in <strong>{activeDisplayTheme.name}</strong> mode is pure visual delight! Clean contrast, responsive spring animations, and native Web Audio FX. ✨
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', fontWeight: 600, color: activeDisplayTheme.primary }}>
                              <span style={{ cursor: 'pointer' }}>❤️ 84 Likes</span>
                              <span style={{ cursor: 'pointer' }}>💬 19 Comments</span>
                              <span style={{ cursor: 'pointer' }}>⚡ Share</span>
                            </div>
                          </div>
                        )}

                        {showcaseTab === 'chat' && (
                          <div
                            style={{
                              background: activeDisplayTheme.bgCard,
                              border: `1px solid ${activeDisplayTheme.borderColor}`,
                              borderRadius: '12px',
                              padding: '14px 16px'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                              <div
                                style={{
                                  alignSelf: 'flex-start',
                                  background: activeDisplayTheme.incomingBubble,
                                  border: `1px solid ${activeDisplayTheme.borderColor}`,
                                  color: activeDisplayTheme.textPrimary,
                                  borderRadius: '10px 10px 10px 2px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  maxWidth: '75%'
                                }}
                              >
                                Hey there! Have you tested the new theme engine? 👋
                              </div>
                              <div
                                style={{
                                  alignSelf: 'flex-end',
                                  background: activeDisplayTheme.outgoingBubble,
                                  color: '#ffffff',
                                  borderRadius: '10px 10px 2px 10px',
                                  padding: '6px 12px',
                                  fontSize: '12px',
                                  maxWidth: '75%',
                                  fontWeight: 500
                                }}
                              >
                                Yes! Loving the crisp contrast and live preview. 🚀
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: `1px solid ${activeDisplayTheme.borderColor}`, paddingTop: '8px' }}>
                              <input
                                disabled
                                placeholder="Message @alex_vibe..."
                                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '12px', color: 'inherit', opacity: 0.6 }}
                              />
                              <button
                                type="button"
                                style={{
                                  background: activeDisplayTheme.primary,
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  cursor: 'pointer'
                                }}
                              >
                                Send
                              </button>
                            </div>
                          </div>
                        )}

                        {showcaseTab === 'profile' && (
                          <div
                            style={{
                              background: activeDisplayTheme.bgCard,
                              border: `1px solid ${activeDisplayTheme.borderColor}`,
                              borderRadius: '12px',
                              overflow: 'hidden'
                            }}
                          >
                            <div style={{ height: '45px', background: activeDisplayTheme.outgoingBubble }} />
                            <div style={{ padding: '0 16px 14px 16px', marginTop: '-20px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px' }}>
                                <div
                                  style={{
                                    width: '42px',
                                    height: '42px',
                                    borderRadius: '50%',
                                    background: activeDisplayTheme.primary,
                                    border: `3px solid ${activeDisplayTheme.bgCard}`,
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    fontSize: '16px'
                                  }}
                                >
                                  A
                                </div>
                                <div style={{ marginBottom: '2px' }}>
                                  <strong style={{ fontSize: '13px', display: 'block' }}>Alex Mercer</strong>
                                  <span style={{ fontSize: '10px', opacity: 0.6 }}>@alex_vibe</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                style={{
                                  background: activeDisplayTheme.primary,
                                  color: '#ffffff',
                                  border: 'none',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '5px 12px',
                                  borderRadius: '9999px',
                                  cursor: 'pointer'
                                }}
                              >
                                Edit Profile
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ marginTop: '12px', fontSize: '11px', opacity: 0.65, textAlign: 'center' }}>
                        💡 Tip: Hover any theme card below for instant simulation, or click to apply permanently.
                      </div>
                    </div>

                    {/* Smart OS Sync & Battery Saver Card (Phase 10 Option 3) */}
                    <div className="theme-smart-sync-card" data-testid="theme-smart-sync-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: autoSyncDevice ? '14px' : '0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>🌓</span>
                          <div>
                            <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Sync with Device Appearance</strong>
                            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              Automatically switches between your preferred Day and Night themes matching your system OS schedule.
                            </p>
                          </div>
                        </div>
                        <SpringToggle
                          checked={autoSyncDevice}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setAutoSyncDevice(val);
                            try {
                              localStorage.setItem('vibegrid_theme_auto_sync', String(val));
                            } catch {}
                          }}
                          aria-label="Toggle Auto-Sync with Device Appearance"
                          data-testid="theme-auto-sync-toggle"
                        />
                      </div>

                      {autoSyncDevice && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              ☀️ Daytime Theme (OS Light)
                            </label>
                            <select
                              value={scheduledDayTheme}
                              onChange={(e) => {
                                const val = e.target.value;
                                setScheduledDayTheme(val);
                                try {
                                  localStorage.setItem('vibegrid_theme_day', val);
                                } catch {}
                              }}
                              className="form-input"
                              style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
                            >
                              <option value="light">Light (Classic Clean)</option>
                              <option value="pastel-light">Pastel Light (Soft Creamy)</option>
                            </select>
                          </div>

                          <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                              🌙 Nighttime Theme (OS Dark)
                            </label>
                            <select
                              value={scheduledNightTheme}
                              onChange={(e) => {
                                const val = e.target.value;
                                setScheduledNightTheme(val);
                                try {
                                  localStorage.setItem('vibegrid_theme_night', val);
                                } catch {}
                              }}
                              className="form-input"
                              style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
                            >
                              <option value="dark">Dark (Midnight Navy)</option>
                              <option value="amoled-black">AMOLED Black (Pure OLED)</option>
                              <option value="neon-glow">Neon Glow (Cyberpunk)</option>
                              <option value="ocean-blue">Ocean Blue (Maritime)</option>
                              <option value="forest-green">Forest Green (Emerald)</option>
                              <option value="sunset-gradient">Sunset Gradient (Twilight)</option>
                              <option value="rose-pink">Rose Pink (Elegance)</option>
                              <option value="purple-dream">Purple Dream (Amethyst)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>🔋</span>
                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Low-Battery Auto AMOLED Mode</strong>
                            <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>
                              Automatically switches to pure AMOLED Black when your battery drops below 20% to save device power.
                            </p>
                          </div>
                        </div>
                        <SpringToggle
                          checked={batteryOledEnabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setBatteryOledEnabled(val);
                            try {
                              localStorage.setItem('vibegrid_theme_battery_oled', String(val));
                            } catch {}
                          }}
                          aria-label="Toggle Low-Battery Auto AMOLED Mode"
                          data-testid="theme-battery-oled-toggle"
                        />
                      </div>
                    </div>

                    {/* Category Filter Chips */}
                    <div className="theme-filter-chips" role="tablist" aria-label="Filter theme categories">
                      <button
                        type="button"
                        className={`theme-filter-chip ${themeFilter === 'all' ? 'is-active' : ''}`}
                        onClick={() => {
                          setThemeFilter('all');
                          soundFx.play('click');
                        }}
                      >
                        All Themes ({THEMES.length})
                      </button>
                      <button
                        type="button"
                        className={`theme-filter-chip ${themeFilter === 'dark' ? 'is-active' : ''}`}
                        onClick={() => {
                          setThemeFilter('dark');
                          soundFx.play('click');
                        }}
                      >
                        🌙 Dark & OLED (7)
                      </button>
                      <button
                        type="button"
                        className={`theme-filter-chip ${themeFilter === 'light' ? 'is-active' : ''}`}
                        onClick={() => {
                          setThemeFilter('light');
                          soundFx.play('click');
                        }}
                      >
                        ☀️ Light & Soft (3)
                      </button>
                      <button
                        type="button"
                        className={`theme-filter-chip ${themeFilter === 'cyber' ? 'is-active' : ''}`}
                        onClick={() => {
                          setThemeFilter('cyber');
                          soundFx.play('click');
                        }}
                      >
                        ⚡ Cyber & Vibrant (4)
                      </button>
                    </div>

                    {/* Themes Grid */}
                    <div className="themes-grid" role="radiogroup" aria-label="Theme selection">
                      {filteredThemes.map((t) => {
                        const isSelected = selectedTheme === t.id;
                        return (
                          <div
                            key={t.id}
                            className={`theme-card ${isSelected ? 'is-active' : ''}`}
                            style={{
                              '--card-accent': t.primary,
                              boxShadow: isSelected ? `0 0 20px -3px ${t.primary}55` : 'none'
                            }}
                            onClick={() => handleThemeSelect(t.id)}
                            onMouseEnter={() => setPreviewHoverTheme(t)}
                            onMouseLeave={() => setPreviewHoverTheme(null)}
                            role="radio"
                            aria-checked={isSelected}
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleThemeSelect(t.id);
                              }
                            }}
                          >
                            {/* Ambient Glow flare */}
                            <div className="theme-card-ambient-glow" style={{ background: t.primary }} />

                            <div className="theme-card-header">
                              <div className="theme-card-title-group">
                                <span className="theme-card-name">{t.name}</span>
                                <span className="theme-badge">{t.badge}</span>
                              </div>
                              {isSelected ? (
                                <div className="theme-check-indicator" title="Currently Active">
                                  <Check size={14} strokeWidth={3} />
                                </div>
                              ) : (
                                <div className="theme-uncheck-indicator" />
                              )}
                            </div>

                            {/* Interactive Mini-UI Preview Box */}
                            <div
                              className="theme-preview-box"
                              style={{
                                background: t.bgPage,
                                borderColor: t.borderColor
                              }}
                            >
                              <div className="theme-preview-header">
                                <div className="theme-preview-dot-group">
                                  <span className="theme-preview-dot" style={{ background: t.primary }} />
                                  <span className="theme-preview-dot" style={{ background: t.textSecondary, opacity: 0.5 }} />
                                </div>
                                <span className="theme-preview-bar" style={{ background: t.borderColor }} />
                              </div>

                              <div className="theme-preview-bubbles">
                                <div
                                  className="theme-preview-bubble-incoming"
                                  style={{
                                    background: t.incomingBubble,
                                    color: t.textPrimary,
                                    border: `1px solid ${t.borderColor}`
                                  }}
                                >
                                  Hey there! 👋
                                </div>
                                <div
                                  className="theme-preview-bubble-outgoing"
                                  style={{
                                    background: t.outgoingBubble,
                                    color: '#ffffff'
                                  }}
                                >
                                  Love this theme! ✨
                                </div>
                              </div>
                            </div>

                            {/* Swatches Row with 1-Click Copy Inspector */}
                            <div className="theme-swatches-row" title="Click swatch to copy HEX">
                              {t.swatches.map((color, i) => (
                                <span
                                  key={i}
                                  className="theme-swatch-circle"
                                  style={{ background: color }}
                                  title={`Click to copy ${color}`}
                                  onClick={(e) => handleCopySwatch(e, color)}
                                >
                                  {copiedSwatch === color && (
                                    <span className="theme-swatch-copied-badge">Copied!</span>
                                  )}
                                </span>
                              ))}
                            </div>

                            <p className="theme-card-desc">{t.description}</p>

                            {t.id === 'amoled-black' && (
                              <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>⚡ 100% OLED Battery Saver</span>
                              </div>
                            )}

                            <div className="theme-card-footer">
                              {isSelected ? (
                                <span className="theme-active-status">
                                  <Check size={13} strokeWidth={2.5} /> Active Theme
                                </span>
                              ) : (
                                <span className="theme-apply-btn">Apply Theme</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Phase 11: Vibi Mascot Easter Egg Card */}
                    <div
                      className="theme-smart-sync-card"
                      style={{ marginTop: '24px' }}
                      data-testid="vibi-easter-egg-card"
                    >
                      <div className="theme-smart-sync-header">
                        <div>
                          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>🦊</span>
                            <span>Vibi Mascot Easter Egg</span>
                          </h4>
                          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', opacity: 0.75 }}>
                            Tip: You can also type <strong>v-i-b-i</strong> anywhere on your keyboard!
                          </p>
                        </div>
                        <button
                          type="button"
                          className="theme-filter-chip active"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            padding: '8px 16px'
                          }}
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('vibegrid:trigger-vibi'));
                          }}
                          data-testid="summon-vibi-easter-egg-btn"
                          aria-label="Summon Vibi mascot easter egg"
                        >
                          <span>✨</span>
                          <span>Summon Vibi</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

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
                      <span className="account-mgmt-val-text">
                        <span style={{ fontSize: '1.05rem' }}>✉️</span>
                        {profile?.email || 'No email registered'}
                      </span>
                    </div>

                    {isDemoUser && (
                      <span className="settings-subtext" style={{ color: '#f87171', display: 'block', marginBottom: '8px' }}>
                        🔒 Email modification is locked on official demo accounts.
                      </span>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="account-mgmt-field-row">
                        <input
                          type="email"
                          className="form-input"
                          placeholder="Enter new email address (e.g. user@example.com)"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          disabled={sendingEmailOtp || verifyingEmailOtp || isDemoUser}
                        />
                      </div>

                      {newEmail.trim() !== '' && (
                        <div className="password-input-wrapper">
                          <input
                            type={showEmailPassword ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Enter current password to authorize email change"
                            value={emailPassword}
                            onChange={(e) => setEmailPassword(e.target.value)}
                            disabled={sendingEmailOtp || verifyingEmailOtp || isDemoUser}
                          />
                          <PasswordToggleButton
                            isVisible={showEmailPassword}
                            onToggle={() => setShowEmailPassword(!showEmailPassword)}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleSendEmailOtp}
                          disabled={sendingEmailOtp || verifyingEmailOtp || otpCountdown > 0 || isDemoUser}
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
                            disabled={verifyingEmailOtp || isDemoUser}
                          />
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleVerifyEmailOtp}
                            disabled={verifyingEmailOtp || emailOtp.length !== 6 || isDemoUser}
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

                    {isDemoUser && (
                      <span className="settings-subtext" style={{ color: '#f87171', display: 'block', marginBottom: '8px' }}>
                        🔒 Phone number modification is locked on official demo accounts.
                      </span>
                    )}

                    <div className="account-mgmt-current-val">
                      <span className="account-mgmt-val-text">
                        <span style={{ fontSize: '1.05rem' }}>📞</span>
                        {profile?.phone_number ? profile.phone_number : 'No phone number linked'}
                      </span>
                      {profile?.phone_number && (
                        <button
                          type="button"
                          className="btn-text-danger"
                          onClick={handleRemovePhone}
                          disabled={removingPhone || isDemoUser}
                          title="Unlink phone number"
                        >
                          {removingPhone ? 'Removing...' : '✕ Unlink Phone'}
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div className="account-mgmt-field-row">
                        <input
                          type="tel"
                          className="form-input"
                          placeholder="Enter phone with country code (e.g. +14155552671)"
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value)}
                          disabled={sendingPhoneOtp || verifyingPhoneOtp || isDemoUser}
                        />
                      </div>

                      {newPhone.trim() !== '' && (
                        <div className="password-input-wrapper">
                          <input
                            type={showPhonePassword ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Enter current password to authorize phone change"
                            value={phonePassword}
                            onChange={(e) => setPhonePassword(e.target.value)}
                            disabled={sendingPhoneOtp || verifyingPhoneOtp || isDemoUser}
                          />
                          <PasswordToggleButton
                            isVisible={showPhonePassword}
                            onToggle={() => setShowPhonePassword(!showPhonePassword)}
                          />
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={handleSendPhoneOtp}
                          disabled={sendingPhoneOtp || verifyingPhoneOtp || phoneOtpCountdown > 0 || !newPhone.trim() || isDemoUser}
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
                            disabled={verifyingPhoneOtp || isDemoUser}
                          />
                          <button
                            type="button"
                            className="btn-primary"
                            onClick={handleVerifyPhoneOtp}
                            disabled={verifyingPhoneOtp || phoneOtp.length !== 6 || isDemoUser}
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

                    {isDemoUser && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        margin: '12px 0',
                        color: '#f87171',
                        fontSize: '13px'
                      }}>
                        🔒 Password modification is locked on official demo accounts.
                      </div>
                    )}

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
                            disabled={changingPassword || isDemoUser}
                            required
                          />
                          <PasswordToggleButton
                            isVisible={showCurrentPass}
                            onToggle={() => setShowCurrentPass(!showCurrentPass)}
                          />
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
                            disabled={changingPassword || isDemoUser}
                            required
                          />
                          <PasswordToggleButton
                            isVisible={showNewPass}
                            onToggle={() => setShowNewPass(!showNewPass)}
                          />
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
                            disabled={changingPassword || isDemoUser}
                            required
                          />
                          <PasswordToggleButton
                            isVisible={showConfirmPass}
                            onToggle={() => setShowConfirmPass(!showConfirmPass)}
                          />
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
                          disabled={changingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword || isDemoUser}
                        >
                          {changingPassword ? 'Updating Password...' : 'Update Password'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Active Login Sessions Card (Hidden for demo profiles so visitors cannot terminate other users' sessions) */}
                  {!isDemoUser && (
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 0' }}>
                          {[1, 2].map((i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <SkeletonCircle size={36} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <SkeletonLine width="150px" height="13px" />
                                  <SkeletonLine width="100px" height="10px" />
                                </div>
                              </div>
                              <SkeletonPill width="50px" height="24px" />
                            </div>
                          ))}
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
                  )}
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

                  {isDemoUser && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '16px',
                      color: '#f87171',
                      fontSize: '13px'
                    }}>
                      🔒 Privacy and permissions settings are locked on official demo accounts.
                    </div>
                  )}

                  <div className="account-mgmt-card">
                    {/* Private Account Toggle */}
                    <div className="privacy-toggle-row">
                      <div className="privacy-toggle-info">
                        <strong>Private Account</strong>
                        <p>When private, only people you approve can see your photos, videos, and profile details.</p>
                      </div>
                      <SpringToggle
                        checked={Boolean(privacySettings.is_private)}
                        onChange={(e) => handleUpdatePrivacy({ is_private: e.target.checked })}
                        disabled={savingPrivacy || isDemoUser}
                        aria-label="Private Account"
                      />
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
                          disabled={savingPrivacy || isDemoUser}
                        >
                          <option value="everyone">Everyone</option>
                          <option value="following">People You Follow</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>

                      {/* Audio/Video Calls */}
                      <div className="privacy-select-row">
                        <div className="privacy-select-info">
                          <label htmlFor="settingsCallFrom">Who can call you</label>
                          <p>Controls who can initiate encrypted audio and video calls with you.</p>
                        </div>
                        <select
                          id="settingsCallFrom"
                          className="privacy-select-input"
                          value={privacySettings.allow_calls_from || 'everyone'}
                          onChange={(e) => handleUpdatePrivacy({ allow_calls_from: e.target.value })}
                          disabled={savingPrivacy || isDemoUser}
                        >
                          <option value="everyone">Everyone</option>
                          <option value="following">People You Follow</option>
                          <option value="nobody">Nobody</option>
                        </select>
                      </div>

                      {/* Group Chats */}
                      <div className="privacy-select-row">
                        <div className="privacy-select-info">
                          <label htmlFor="settingsGroupFrom">Who can add you to group chats</label>
                          <p>Controls who can add you to multi-party encrypted group chats.</p>
                        </div>
                        <select
                          id="settingsGroupFrom"
                          className="privacy-select-input"
                          value={privacySettings.allow_group_add_from || 'everyone'}
                          onChange={(e) => handleUpdatePrivacy({ allow_group_add_from: e.target.value })}
                          disabled={savingPrivacy || isDemoUser}
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
                          disabled={savingPrivacy || isDemoUser}
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
                          disabled={savingPrivacy || isDemoUser}
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
                          disabled={savingPrivacy || isDemoUser}
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
                        <SpringToggle
                          checked={Boolean(privacySettings.show_online_status)}
                          onChange={(e) => handleUpdatePrivacy({ show_online_status: e.target.checked })}
                          disabled={savingPrivacy || isDemoUser}
                          aria-label="Show Activity Status"
                        />
                      </div>

                      {/* Read Receipts Toggle */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Show Read Receipts</strong>
                          <p>Allow message senders to see when you have read their messages.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(privacySettings.show_read_receipts)}
                          onChange={(e) => handleUpdatePrivacy({ show_read_receipts: e.target.checked })}
                          disabled={savingPrivacy || isDemoUser}
                          aria-label="Show Read Receipts"
                        />
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

                  {isDemoUser && (
                    <div style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      marginBottom: '16px',
                      color: '#f87171',
                      fontSize: '13px'
                    }}>
                      🔒 Notification preferences are locked on official demo accounts.
                    </div>
                  )}

                  {/* In-App Sound Effects & Web Audio FX Card (Phase 9 Option 6) */}
                  <div className="pwa-push-status-card sound-fx-settings-card" data-testid="sound-fx-settings-card" style={{ marginBottom: '16px' }}>
                    <div className="pwa-push-status-header">
                      <div className="pwa-push-status-title">
                        <span className="pwa-push-icon" style={{ background: soundEnabled ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148, 163, 184, 0.1)', border: soundEnabled ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(148, 163, 184, 0.2)' }}>
                          {soundEnabled ? '🎵' : '🔇'}
                        </span>
                        <div>
                          <strong>In-App Sound Effects & Web Audio FX</strong>
                          <p>Dynamic procedural audio for likes, messages, reactions, toggles & celebrations (0 kB downloads, zero latency).</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={`pwa-status-pill ${soundEnabled ? 'pill-success' : 'pill-muted'}`}>
                          {soundEnabled ? 'Audio Active' : 'Muted'}
                        </span>
                        <SpringToggle
                          checked={soundEnabled}
                          onChange={(e) => {
                            const val = e.target.checked;
                            soundFx.setEnabled(val);
                            if (val) soundFx.play('toggle');
                          }}
                          aria-label="Toggle In-App Sound Effects"
                          data-testid="sound-fx-toggle"
                        />
                      </div>
                    </div>

                    {soundEnabled && (
                      <div className="sound-fx-options-panel" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
                        {/* Sound Theme Selector */}
                        <div style={{ marginBottom: '14px' }}>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                            Sound Theme Pack
                          </label>
                          <div className="sound-packs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                            {SOUND_PACKS.map((p) => {
                              const isSelected = soundPack === p.id;
                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    soundFx.setPack(p.id);
                                    soundFx.play('like', p.id);
                                  }}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      soundFx.setPack(p.id);
                                      soundFx.play('like', p.id);
                                    }
                                  }}
                                  className={`sound-pack-card ${isSelected ? 'is-selected' : ''}`}
                                  data-testid={`sound-pack-${p.id}`}
                                  style={{
                                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card, rgba(255,255,255,0.03))',
                                    border: isSelected ? '2px solid var(--primary-color, #6366f1)' : '1px solid var(--border-color, rgba(255,255,255,0.08))',
                                    borderRadius: '12px',
                                    padding: '12px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '18px' }}>{p.icon}</span>
                                      <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{p.name}</strong>
                                    </div>
                                    {isSelected && (
                                      <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700, background: 'rgba(99,102,241,0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                                        Active
                                      </span>
                                    )}
                                  </div>
                                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '0 0 10px 0', lineHeight: 1.4 }}>
                                    {p.description}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      soundFx.play('like', p.id);
                                    }}
                                    className="btn-secondary btn-xs"
                                    style={{ width: '100%', fontSize: '11px', padding: '4px 8px' }}
                                    title={`Sample ${p.name}`}
                                  >
                                    ▶ Preview Pack
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Master Volume Slider & Audio Soundboard */}
                        <div className="sound-volume-control-box">
                          <div className="sound-volume-header">
                            <div className="sound-volume-label-group">
                              <span className="sound-volume-icon">
                                {soundVolume === 0 ? '🔇' : soundVolume < 0.4 ? '🔉' : '🔊'}
                              </span>
                              <label htmlFor="masterSoundVolume" className="sound-volume-label">
                                Master Volume
                              </label>
                            </div>
                            <span className="sound-volume-badge" data-testid="sound-volume-percent">
                              {Math.round(soundVolume * 100)}%
                            </span>
                          </div>

                          <div className="sound-volume-slider-wrapper">
                            <span className="sound-volume-limit-label">0%</span>
                            <input
                              id="masterSoundVolume"
                              type="range"
                              min="0"
                              max="100"
                              value={Math.round(soundVolume * 100)}
                              onChange={(e) => soundFx.setVolume(parseInt(e.target.value, 10) / 100)}
                              className="sound-volume-range-input"
                              aria-label="Master Sound Volume"
                              data-testid="sound-volume-slider"
                            />
                            <span className="sound-volume-limit-label">100%</span>
                          </div>

                          <div className="sound-test-soundboard">
                            <span className="sound-soundboard-title">
                              Test Sound FX:
                            </span>
                            <div className="sound-soundboard-buttons">
                              <button
                                type="button"
                                className="btn-secondary btn-xs sound-soundboard-btn"
                                onClick={() => soundFx.play('celebration')}
                                data-testid="sound-test-btn"
                                title="Play celebration fanfare test"
                              >
                                🎉 Celebration
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-xs sound-soundboard-btn"
                                onClick={() => soundFx.play('receive')}
                                title="Play incoming chat message chime"
                              >
                                💬 Chat Message
                              </button>
                              <button
                                type="button"
                                className="btn-secondary btn-xs sound-soundboard-btn"
                                onClick={() => soundFx.play('toggle')}
                                title="Play toggle switch snap"
                              >
                                🔄 Toggle Switch
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Real Web Push Status & Action Card */}
                  <div className="pwa-push-status-card">
                    <div className="pwa-push-status-header">
                      <div className="pwa-push-status-title">
                        <span className="pwa-push-icon">📲</span>
                        <div>
                          <strong>Web Push Notifications</strong>
                          <p>Delivers real OS alerts even when VibeGrid is in the background, minimized, or your screen is locked.</p>
                        </div>
                      </div>
                      <div className="pwa-push-badges">
                        <span className={`pwa-status-pill ${pushPermission === 'granted' ? 'pill-success' : pushPermission === 'denied' ? 'pill-danger' : 'pill-warning'}`}>
                          Permission: {pushPermission === 'granted' ? 'Granted' : pushPermission === 'denied' ? 'Denied' : 'Not Requested'}
                        </span>
                        <span className={`pwa-status-pill ${isPushSubscribed ? 'pill-success' : 'pill-muted'}`}>
                          Device Push: {isPushSubscribed ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    {pushPermission === 'denied' && (
                      <div className="pwa-push-alert-denied">
                        ⚠️ <strong>Notifications are blocked by your browser or OS settings.</strong>
                        <p>To enable real push notifications, click the tune/lock icon in your browser address bar and set Notifications to "Allow", then refresh.</p>
                      </div>
                    )}

                    <div className="pwa-push-actions">
                      {!isPushSubscribed ? (
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          onClick={handleEnablePush}
                          disabled={pushLoading || pushPermission === 'denied'}
                        >
                          {pushLoading ? 'Enabling...' : '🔔 Enable Push Notifications'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={handleDisablePush}
                          disabled={pushLoading}
                        >
                          {pushLoading ? 'Updating...' : '🔕 Disable on This Device'}
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={handleSendTestPush}
                        disabled={testPushLoading || !isPushSubscribed}
                        title={!isPushSubscribed ? 'Enable push notifications first to test' : 'Send a real backend push'}
                      >
                        {testPushLoading ? 'Sending...' : '🚀 Send Test Notification'}
                      </button>

                      <button
                        type="button"
                        className="btn-secondary btn-sm pwa-diagnostics-trigger-btn"
                        onClick={handleLoadDiagnostics}
                        disabled={loadingDiagnostics}
                        data-testid="push-diagnostics-btn"
                        title="Inspect Web Push and Service Worker diagnostic state"
                      >
                        {loadingDiagnostics ? 'Inspecting...' : '🔍 Push Diagnostics & Setup'}
                      </button>

                      <button
                        type="button"
                        className="btn-secondary btn-sm pwa-recheck-permissions-btn"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('vibegrid:open-permission-setup'));
                        }}
                        data-testid="recheck-permissions-btn"
                        title="Review or re-run permission and push subscription setup"
                      >
                        🛡️ Re-check & Setup Permissions
                      </button>
                    </div>
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
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_likes)}
                          onChange={(e) => handleUpdateNotification({ notif_likes: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Likes Notifications"
                        />
                      </div>

                      {/* Comments */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Comments</strong>
                          <p>Receive notifications when someone comments on your posts.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_comments)}
                          onChange={(e) => handleUpdateNotification({ notif_comments: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Comments Notifications"
                        />
                      </div>

                      {/* Followers */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>New Followers</strong>
                          <p>Receive notifications when someone starts following you.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_follows)}
                          onChange={(e) => handleUpdateNotification({ notif_follows: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Followers Notifications"
                        />
                      </div>

                      {/* Direct Messages */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Direct Messages</strong>
                          <p>Receive notifications for incoming direct chat messages.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_messages)}
                          onChange={(e) => handleUpdateNotification({ notif_messages: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Direct Messages Notifications"
                        />
                      </div>

                      {/* Incoming Calls */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Incoming Audio & Video Calls</strong>
                          <p>Receive high-urgency ringing push alerts when someone calls you.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_calls)}
                          onChange={(e) => handleUpdateNotification({ notif_calls: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Incoming Calls Notifications"
                        />
                      </div>

                      {/* Mentions */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Mentions</strong>
                          <p>Receive notifications when someone mentions your @username.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_mentions)}
                          onChange={(e) => handleUpdateNotification({ notif_mentions: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Mentions Notifications"
                        />
                      </div>

                      {/* Tags */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Tags</strong>
                          <p>Receive notifications when someone tags you in photos.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_tags)}
                          onChange={(e) => handleUpdateNotification({ notif_tags: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Tags Notifications"
                        />
                      </div>

                      {/* Stories */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Story Updates</strong>
                          <p>Receive notifications about new stories and replies.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_stories)}
                          onChange={(e) => handleUpdateNotification({ notif_stories: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Story Updates Notifications"
                        />
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
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_security)}
                          onChange={(e) => handleUpdateNotification({ notif_security: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Security Alerts Notifications"
                        />
                      </div>

                      {/* Email Notifications */}
                      <div className="privacy-toggle-row">
                        <div className="privacy-toggle-info">
                          <strong>Email Notifications</strong>
                          <p>Receive periodic digest emails and important product updates.</p>
                        </div>
                        <SpringToggle
                          checked={Boolean(notificationSettings.notif_email)}
                          onChange={(e) => handleUpdateNotification({ notif_email: e.target.checked })}
                          disabled={savingNotif || isDemoUser}
                          aria-label="Email Notifications"
                        />
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
                    {isDemoUser && (
                      <div style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '16px',
                        color: '#f87171',
                        fontSize: '13px'
                      }}>
                        🔒 Account deactivation and deletion are locked on official demo accounts.
                      </div>
                    )}

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
                        disabled={isDemoUser}
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
                        disabled={isDemoUser}
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
                  <PasswordToggleButton
                    isVisible={showDeactivatePassword}
                    onToggle={() => setShowDeactivatePassword(!showDeactivatePassword)}
                  />
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
                  <PasswordToggleButton
                    isVisible={showDeletePassword}
                    onToggle={() => setShowDeletePassword(!showDeletePassword)}
                  />
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

      {/* Web Push Diagnostics Modal */}
      {showDiagnosticsModal && pushDiagnostics && (
        <div
          className="modal-backdrop diagnostics-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleCloseDiagnosticsModal(e);
            }
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="modal-card diagnostics-modal-card"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>🔍 Web Push Diagnostics & Setup</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseDiagnosticsModal}
                aria-label="Close Diagnostics"
              >
                ✕
              </button>
            </div>
            <div className="diagnostics-list">
              <div className="diagnostics-row">
                <span className="diagnostics-label">Notification Permission</span>
                <span className="diagnostics-value">{pushDiagnostics.permission}</span>
              </div>
              <div className="diagnostics-row">
                <span className="diagnostics-label">Service Worker</span>
                <span className="diagnostics-value">
                  {pushDiagnostics.serviceWorker?.registered ? `Registered (${pushDiagnostics.serviceWorker.scope})` : 'Not Registered'}
                </span>
              </div>
              <div className="diagnostics-row">
                <span className="diagnostics-label">Push Subscription</span>
                <span className="diagnostics-value">
                  {pushDiagnostics.subscription ? `Active (${pushDiagnostics.subscription.endpointDomain})` : 'None'}
                </span>
              </div>
              <div className="diagnostics-row">
                <span className="diagnostics-label">Backend VAPID</span>
                <span className="diagnostics-value">
                  {pushDiagnostics.backendStatus?.isVapidConfigured ? 'Configured ✅' : 'Not Configured ⚠️'}
                </span>
              </div>
              <div className="diagnostics-row">
                <span className="diagnostics-label">Active Devices</span>
                <span className="diagnostics-value">
                  {pushDiagnostics.backendStatus?.activeSubscriptionsCount || 0} registered
                </span>
              </div>
              <div className="diagnostics-row">
                <span className="diagnostics-label">PWA Cache Version:</span>
                <span className="diagnostics-value">
                  {pushDiagnostics.serviceWorker?.cacheVersion || 'vibegrid-pwa-v57'}
                </span>
              </div>
              <div className="diagnostics-row">
                <span className="diagnostics-label">Platform Notes</span>
                <span className="diagnostics-value" style={{ whiteSpace: 'normal', fontFamily: 'inherit' }}>
                  {pushDiagnostics.platform?.notes}
                </span>
              </div>
            </div>
            <div className="diagnostics-modal-footer">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleForcePwaUpdate}
                title="Clears cached service workers and refreshes the application to the latest version"
              >
                🔄 Refresh to Latest Version
              </button>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={handleSendTestPush}
                disabled={testPushLoading || !isPushSubscribed}
              >
                {testPushLoading ? 'Sending...' : '🚀 Send Test Notification'}
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={handleCloseDiagnosticsModal}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Market-Level Confirmation Modal */}
      {confirmAction && (
        <ConfirmModal
          isOpen={true}
          title={confirmAction.title}
          description={confirmAction.description}
          confirmText={confirmAction.confirmText || 'Confirm'}
          cancelText="Cancel"
          variant={confirmAction.variant || 'danger'}
          isLoading={confirmAction.isLoading || false}
          onConfirm={confirmAction.onConfirm}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
