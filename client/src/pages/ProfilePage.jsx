/**
 * client/src/pages/ProfilePage.jsx
 * ================================
 * User Profile, Bio Updates & Avatar Upload Page
 * 
 * Features:
 * 1. Displays user statistics (Posts, Followers, Following).
 * 2. In-place avatar uploading via Multer (multipart/form-data) with instant preview.
 * 3. Full name & Bio editor with live character countdown (max 150 chars).
 * 4. Shows member join date and verified badge.
 * 5. Syncs changes with global AuthContext.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/client';
import CommentsModal from '../components/CommentsModal';
import FollowListModal from '../components/FollowListModal';
import HashtagFeedModal from '../components/HashtagFeedModal';
import ConfirmModal from '../components/ConfirmModal';
import PasswordToggleButton from '../components/PasswordToggleIcon';
import { formatCaptionWithHashtags } from '../utils/textFormatters';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Trash2,
  Grid,
  Edit3,
  Settings,
  Calendar,
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Camera,
  Upload,
  Lock,
  Check
} from 'lucide-react';

const DEMO_USERNAMES = ['sophia_wander', 'alex_design', 'elena_culinary', 'liam_visuals'];

export default function ProfilePage({
  targetUsername,
  onOpenCreatePost,
  onNavigateToProfile,
  onOpenDirectMessage,
  onOpenSettings
}) {
  const { user: currentUser, updateUser, logout, guardDemoAction } = useAuth();

  const isDemoUser = Boolean(
    currentUser?.is_demo_session ||
    DEMO_USERNAMES.includes((currentUser?.username || '').toLowerCase()) ||
    DEMO_USERNAMES.includes((targetUsername || '').toLowerCase())
  );

  // Determine which username to display (defaults to logged-in user)
  const usernameToFetch = targetUsername || currentUser?.username;

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followModal, setFollowModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editDob, setEditDob] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // Avatar Upload / Removal State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const fileInputRef = useRef(null);

  // Email Management State (Phase 3)
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpTargetEmail, setOtpTargetEmail] = useState('');
  const [otpType, setOtpType] = useState('email_verify'); // 'email_verify' | 'email_change'
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [devDebugOtp, setDevDebugOtp] = useState(null);

  // Phone Number Management State (Phase 4)
  const [showPhoneChange, setShowPhoneChange] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [phonePassword, setPhonePassword] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpStep, setPhoneOtpStep] = useState(false);
  const [phoneOtpTarget, setPhoneOtpTarget] = useState('');
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [verifyingPhoneOtp, setVerifyingPhoneOtp] = useState(false);
  const [removingPhone, setRemovingPhone] = useState(false);
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [devDebugPhoneOtp, setDevDebugPhoneOtp] = useState(null);

  // Security & Password Management State (Phase 5)
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passCurrent, setPassCurrent] = useState('');
  const [passNew, setPassNew] = useState('');
  const [passConfirm, setPassConfirm] = useState('');
  const [showPassCurrent, setShowPassCurrent] = useState(false);
  const [showPassNew, setShowPassNew] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [logoutOthersOnPassChange, setLogoutOthersOnPassChange] = useState(true);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passErrorMsg, setPassErrorMsg] = useState(null);

  // Active Sessions & Login Activity State (Phase 5)
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState(null);
  const [loggingOutOthers, setLoggingOutOthers] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // Privacy Settings State (Phase 7)
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
  const [privacyLoaded, setPrivacyLoaded] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Notification Preferences State (Phase 8)
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
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  // Account Deactivation State (Phase 9)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('Taking a break');
  const [deactivatePassword, setDeactivatePassword] = useState('');
  const [showDeactivatePassword, setShowDeactivatePassword] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  // Permanent Account Deletion State (Phase 10)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Timer effect for OTP resend cooldown
  useEffect(() => {
    let timer;
    if (otpCountdown > 0) {
      timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [otpCountdown]);

  // Timer effect for Phone OTP resend cooldown
  useEffect(() => {
    let timer;
    if (phoneOtpCountdown > 0) {
      timer = setTimeout(() => setPhoneOtpCountdown(phoneOtpCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [phoneOtpCountdown]);

  // Auto-dismiss toast notification after 5 seconds
  useEffect(() => {
    if (!profileMsg) return;
    const timer = setTimeout(() => {
      setProfileMsg(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [profileMsg]);

  // User Posts State (Phase 5 & 6)
  const [userPosts, setUserPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);

  // Saved Posts State (Phase 12)
  const [activeTab, setActiveTab] = useState('posts'); // 'posts' | 'saved'
  const [savedPosts, setSavedPosts] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Hashtag State (Phase 13)
  const [activeHashtag, setActiveHashtag] = useState(null);

  // Fetch Profile Data from API
  const fetchProfile = async () => {
    if (!usernameToFetch) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/users/${usernameToFetch}`);
      if (res.success && res.data) {
        setProfile(res.data.profile);
        setStats(res.data.stats || { posts: 0, followers: 0, following: 0 });
        setIsOwnProfile(res.data.isOwnProfile || (currentUser && currentUser.username === res.data.profile.username));
        setIsFollowing(res.data.isFollowing || false);
        setEditUsername(res.data.profile.username || '');
        setEditFullName(res.data.profile.full_name || '');
        setEditBio(res.data.profile.bio || '');
        setEditWebsite(res.data.profile.website || '');
        setEditLocation(res.data.profile.location || '');
        setEditDob(res.data.profile.date_of_birth ? String(res.data.profile.date_of_birth).split('T')[0] : '');
      } else {
        setError(res.error || 'Failed to load profile.');
      }
    } catch (err) {
      setError(err.message || 'Error fetching user profile.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch User's Posts for the 3-column Grid
  const fetchUserPosts = async () => {
    if (!usernameToFetch) return;
    try {
      setLoadingPosts(true);
      const res = await apiClient.get(`/posts/user/${usernameToFetch}`);
      if (res.success && res.data?.posts) {
        setUserPosts(res.data.posts);
        setStats((prev) => ({ ...prev, posts: res.data.posts.length }));
      }
    } catch (err) {
      console.warn('[User Posts Fetch Error]', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  // Fetch Saved Posts (Phase 12 - Account Owner Only)
  const fetchSavedPosts = async () => {
    if (!currentUser) return;
    try {
      setLoadingSaved(true);
      const res = await apiClient.get('/posts/saved');
      if (res.success && res.data?.posts) {
        setSavedPosts(res.data.posts);
      }
    } catch (err) {
      console.warn('[Saved Posts Fetch Error]', err);
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
    if (!targetUsername || (currentUser && currentUser.username === targetUsername)) {
      fetchSavedPosts();
    }
  }, [usernameToFetch, currentUser?.username]);

  // Handle post deletion from profile - Opens modern confirmation modal
  const handleDeletePost = (postId) => {
    if (guardDemoAction('create_post')) return;
    setConfirmAction({
      title: 'Delete Post?',
      description: 'Are you sure you want to permanently delete this post? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await apiClient.delete(`/posts/${postId}`);
          if (res.success) {
            setUserPosts((prev) => prev.filter((p) => p.id !== postId));
            setStats((prev) => ({ ...prev, posts: Math.max(0, prev.posts - 1) }));
            setSelectedPost(null);
            setConfirmAction(null);
          } else {
            alert(res.error || 'Failed to delete post.');
          }
        } catch (err) {
          alert(err.message || 'Error deleting post.');
        }
      }
    });
  };

  // Handle like toggle inside profile post modal
  const handleToggleLike = async (postId) => {
    if (guardDemoAction('like')) return;
    if (!currentUser) {
      alert('Please sign in to like posts.');
      return;
    }
    try {
      const res = await apiClient.post(`/posts/${postId}/like`);
      if (res.success && res.data) {
        setUserPosts((prev) =>
          prev.map((p) =>
            p.id === postId
              ? { ...p, is_liked: res.data.liked, likes_count: res.data.likes_count }
              : p
          )
        );
        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost((prev) => ({
            ...prev,
            is_liked: res.data.liked,
            likes_count: res.data.likes_count
          }));
        }
      }
    } catch (err) {
      console.warn('[Profile Like Error]', err);
    }
  };

  // Handle bookmark / save toggle inside profile (Phase 12)
  const handleToggleSave = async (postId) => {
    if (guardDemoAction('save')) return;
    if (!currentUser) {
      alert('Please sign in to save posts.');
      return;
    }

    const prevUserPost = userPosts.find((p) => p.id === postId);
    const prevSavedPost = savedPosts.find((p) => p.id === postId);
    const prevSelected = selectedPost && selectedPost.id === postId ? selectedPost : null;

    const currentSavedState = !!(prevSelected?.is_saved ?? prevUserPost?.is_saved ?? prevSavedPost?.is_saved);
    const newSavedState = !currentSavedState;

    // Optimistic UI updates
    setUserPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, is_saved: newSavedState } : p))
    );

    if (newSavedState) {
      if (prevSelected && !savedPosts.some((p) => p.id === postId)) {
        setSavedPosts((prev) => [{ ...prevSelected, is_saved: true }, ...prev]);
      }
    } else {
      setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
    }

    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost((prev) => ({ ...prev, is_saved: newSavedState }));
    }

    try {
      const res = await apiClient.post(`/posts/${postId}/save`);
      if (res.success && res.data) {
        const serverSaved = res.data.is_saved;
        setUserPosts((prev) =>
          prev.map((p) => (p.id === postId ? { ...p, is_saved: serverSaved } : p))
        );
        if (selectedPost && selectedPost.id === postId) {
          setSelectedPost((prev) => ({ ...prev, is_saved: serverSaved }));
        }
        if (!serverSaved) {
          setSavedPosts((prev) => prev.filter((p) => p.id !== postId));
        }
      }
    } catch (err) {
      console.warn('[Profile Save Error]', err);
      // Revert if error
      setUserPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, is_saved: currentSavedState } : p))
      );
      if (selectedPost && selectedPost.id === postId) {
        setSelectedPost((prev) => ({ ...prev, is_saved: currentSavedState }));
      }
      if (currentSavedState && prevSavedPost) {
        setSavedPosts((prev) => [...prev, prevSavedPost]);
      }
    }
  };

  // Handle optimistic follow / unfollow toggle
  const handleToggleFollow = async () => {
    if (guardDemoAction('follow')) return;
    if (!currentUser) {
      alert('Please sign in to follow creators.');
      return;
    }

    const prevFollowing = isFollowing;
    const prevFollowersCount = stats.followers;

    // Optimistic UI update
    setIsFollowing(!prevFollowing);
    setStats((prev) => ({
      ...prev,
      followers: !prevFollowing ? prevFollowersCount + 1 : Math.max(0, prevFollowersCount - 1)
    }));

    try {
      const res = await apiClient.post(`/users/${profile.username}/follow-toggle`);
      if (res.success && res.data) {
        setIsFollowing(res.data.isFollowing);
        setStats((prev) => ({ ...prev, followers: res.data.followersCount }));
      } else {
        throw new Error(res.error || 'Failed to toggle follow');
      }
    } catch (err) {
      console.error('[Follow Toggle Error]', err);
      // Rollback on error
      setIsFollowing(prevFollowing);
      setStats((prev) => ({ ...prev, followers: prevFollowersCount }));
    }
  };

  // Handle Profile Update (Username, Full Name, Bio, Website, Location, DOB)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (guardDemoAction('edit_profile')) return;
    if (isDemoUser) {
      setProfileMsg({ type: 'error', text: '🔒 Profile details cannot be modified on official demo accounts.' });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);

    const cleanUsername = editUsername.trim().toLowerCase();
    const cleanBio = editBio.trim().slice(0, 150);
    const cleanFullName = editFullName.trim().slice(0, 100);
    const cleanWebsite = editWebsite.trim().slice(0, 255);
    const cleanLocation = editLocation.trim().slice(0, 100);
    const cleanDob = editDob ? editDob : null;

    if (!cleanUsername || cleanUsername.length < 3 || cleanUsername.length > 30) {
      setProfileMsg({ type: 'error', text: 'Username must be between 3 and 30 characters.' });
      setSavingProfile(false);
      return;
    }

    if (currentUser?.is_demo_session && cleanUsername !== currentUser.username.toLowerCase()) {
      setProfileMsg({ type: 'error', text: 'Username cannot be modified in demo access mode. Please log in using your account password.' });
      setSavingProfile(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setProfileMsg({ type: 'error', text: 'Username can only contain letters, numbers, and underscores.' });
      setSavingProfile(false);
      return;
    }

    if (cleanWebsite) {
      try {
        const urlToTest = cleanWebsite.startsWith('http://') || cleanWebsite.startsWith('https://')
          ? cleanWebsite
          : `https://${cleanWebsite}`;
        new URL(urlToTest);
      } catch {
        setProfileMsg({ type: 'error', text: 'Please enter a valid website URL.' });
        setSavingProfile(false);
        return;
      }
    }

    if (cleanDob) {
      const dobDate = new Date(cleanDob);
      if (isNaN(dobDate.getTime()) || dobDate >= new Date()) {
        setProfileMsg({ type: 'error', text: 'Date of birth must be a valid date in the past.' });
        setSavingProfile(false);
        return;
      }
    }

    try {
      const res = await apiClient.put('/users/profile', {
        username: cleanUsername,
        fullName: cleanFullName,
        bio: cleanBio,
        website: cleanWebsite,
        location: cleanLocation,
        dateOfBirth: cleanDob
      });

      if (res.success && res.data?.user) {
        const updated = res.data.user;
        setProfile((prev) => ({
          ...prev,
          username: updated.username,
          full_name: updated.full_name,
          bio: updated.bio,
          website: updated.website,
          location: updated.location,
          date_of_birth: updated.date_of_birth
        }));
        setEditUsername(updated.username || '');
        setEditFullName(updated.full_name || '');
        setEditBio(updated.bio || '');
        setEditWebsite(updated.website || '');
        setEditLocation(updated.location || '');
        setEditDob(updated.date_of_birth ? String(updated.date_of_birth).split('T')[0] : '');

        // Sync with global AuthContext
        updateUser(updated);

        // If username changed, update navigation
        if (profile.username !== updated.username && onNavigateToProfile) {
          onNavigateToProfile(updated.username);
        }

        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        setIsEditing(false);
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Update failed.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Could not update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Avatar Removal (Revert to default) - Opens modern confirmation modal
  const handleRemoveAvatar = () => {
    if (guardDemoAction('edit_profile')) return;
    if (isDemoUser) {
      setAvatarError('🔒 Profile photo cannot be removed on official demo accounts.');
      return;
    }
    setConfirmAction({
      title: 'Remove Profile Picture?',
      description: 'Your profile picture will be removed and reset to your default gender avatar.',
      confirmText: 'Remove Photo',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setRemovingAvatar(true);
          setAvatarError(null);
          const res = await apiClient.delete('/users/avatar');
          if (res.success && res.data?.user) {
            setProfile((prev) => ({ ...prev, avatar_url: res.data.user.avatar_url }));
            setAvatarPreview(null);
            updateUser({ avatar_url: res.data.user.avatar_url });
            setProfileMsg({ type: 'success', text: 'Profile picture removed.' });
            setConfirmAction(null);
          } else {
            setAvatarError(res.error || 'Failed to remove avatar.');
          }
        } catch (err) {
          setAvatarError(err.message || 'Error removing avatar.');
        } finally {
          setRemovingAvatar(false);
        }
      }
    });
  };

  // Handle Email OTP Request (Verify current email or change to new email)
  const handleSendEmailOtp = async (isChange = false) => {
    try {
      setSendingEmailOtp(true);
      setProfileMsg(null);
      setDevDebugOtp(null);

      const payload = {};
      if (isChange) {
        if (!newEmail.trim()) {
          setProfileMsg({ type: 'error', text: 'Please enter your new email address.' });
          setSendingEmailOtp(false);
          return;
        }
        if (!currentPassword) {
          setProfileMsg({ type: 'error', text: 'Current password is required to authorize an email change.' });
          setSendingEmailOtp(false);
          return;
        }
        payload.newEmail = newEmail.trim();
        payload.currentPassword = currentPassword;
      }

      const res = await apiClient.post('/users/email/send-otp', payload);
      if (res.success) {
        setOtpStep(true);
        setOtpTargetEmail(res.data?.targetEmail || (isChange ? newEmail : profile.email));
        setOtpType(res.data?.type || (isChange ? 'email_change' : 'email_verify'));
        setOtpCountdown(60); // 60s cooldown for resending
        if (res._devDebug?.otp) {
          setDevDebugOtp(res._devDebug.otp);
        }
        setProfileMsg({ type: 'success', text: res.message || 'Verification code sent!' });
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Failed to send verification code.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Network error sending verification code.' });
    } finally {
      setSendingEmailOtp(false);
    }
  };

  // Handle Email OTP Confirmation & Update
  const handleVerifyEmailOtp = async (e) => {
    if (e) e.preventDefault();
    if (!emailOtp || emailOtp.trim().length !== 6) {
      setProfileMsg({ type: 'error', text: 'Please enter the complete 6-digit verification code.' });
      return;
    }

    try {
      setVerifyingEmailOtp(true);
      setProfileMsg(null);

      const res = await apiClient.post('/users/email/verify-otp', {
        otp: emailOtp.trim(),
        newEmail: otpType === 'email_change' ? otpTargetEmail : undefined
      });

      if (res.success && res.data?.user) {
        const updated = res.data.user;
        setProfile((prev) => ({
          ...prev,
          email: updated.email,
          is_email_verified: updated.is_email_verified
        }));
        updateUser({
          email: updated.email,
          is_email_verified: updated.is_email_verified
        });

        // Reset email management form state
        setOtpStep(false);
        setEmailOtp('');
        setNewEmail('');
        setCurrentPassword('');
        setShowEmailChange(false);
        setDevDebugOtp(null);

        setProfileMsg({ type: 'success', text: res.message || 'Email verified successfully!' });
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Invalid verification code.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Error verifying code.' });
    } finally {
      setVerifyingEmailOtp(false);
    }
  };

  // Handle Phone OTP Request (Send OTP to add or change phone)
  const handleSendPhoneOtp = async () => {
    try {
      setSendingPhoneOtp(true);
      setProfileMsg(null);
      setDevDebugPhoneOtp(null);

      const cleanPhone = newPhoneNumber.trim().replace(/[\s\-()]/g, '');
      if (!cleanPhone) {
        setProfileMsg({ type: 'error', text: 'Please enter a valid phone number.' });
        setSendingPhoneOtp(false);
        return;
      }
      if (!/^\+[1-9]\d{1,14}$/.test(cleanPhone)) {
        setProfileMsg({ type: 'error', text: 'Phone number must start with country code "+" followed by 1 to 14 digits (e.g. +14155552671 or +919876543210).' });
        setSendingPhoneOtp(false);
        return;
      }
      if (!phonePassword) {
        setProfileMsg({ type: 'error', text: 'Current password is required to authorize phone number changes.' });
        setSendingPhoneOtp(false);
        return;
      }

      const res = await apiClient.post('/users/phone/send-otp', {
        phoneNumber: cleanPhone,
        currentPassword: phonePassword
      });

      if (res.success) {
        setPhoneOtpStep(true);
        setPhoneOtpTarget(res.data?.phoneNumber || cleanPhone);
        setPhoneOtpCountdown(60);
        if (res._devDebug?.otp) {
          setDevDebugPhoneOtp(res._devDebug.otp);
        }
        setProfileMsg({ type: 'success', text: res.message || 'Verification code sent!' });
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Failed to send phone verification code.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Error sending phone verification code.' });
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  // Handle Phone OTP Verification
  const handleVerifyPhoneOtp = async (e) => {
    if (e) e.preventDefault();
    if (!phoneOtp || phoneOtp.trim().length !== 6) {
      setProfileMsg({ type: 'error', text: 'Please enter the complete 6-digit verification code.' });
      return;
    }

    try {
      setVerifyingPhoneOtp(true);
      setProfileMsg(null);

      const res = await apiClient.post('/users/phone/verify-otp', {
        phoneNumber: phoneOtpTarget,
        otp: phoneOtp.trim()
      });

      if (res.success && res.data?.user) {
        const updated = res.data.user;
        setProfile((prev) => ({
          ...prev,
          phone_number: updated.phone_number,
          is_phone_verified: updated.is_phone_verified
        }));
        updateUser({
          phone_number: updated.phone_number,
          is_phone_verified: updated.is_phone_verified
        });

        // Reset phone management state
        setPhoneOtpStep(false);
        setPhoneOtp('');
        setNewPhoneNumber('');
        setPhonePassword('');
        setShowPhoneChange(false);
        setDevDebugPhoneOtp(null);

        setProfileMsg({ type: 'success', text: res.message || 'Phone number verified and linked successfully!' });
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Invalid verification code.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Error verifying phone code.' });
    } finally {
      setVerifyingPhoneOtp(false);
    }
  };

  // Handle Phone Number Removal
  const handleRemovePhone = async () => {
    const password = window.prompt('Enter your current password to confirm removing your phone number:');
    if (!password) return;

    try {
      setRemovingPhone(true);
      setProfileMsg(null);

      const res = await apiClient.delete('/users/phone', {
        data: { currentPassword: password }
      });

      if (res.success && res.data?.user) {
        setProfile((prev) => ({
          ...prev,
          phone_number: null,
          is_phone_verified: false
        }));
        updateUser({
          phone_number: null,
          is_phone_verified: false
        });
        setShowPhoneChange(false);
        setProfileMsg({ type: 'success', text: 'Phone number removed from your account.' });
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Failed to remove phone number.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Error removing phone number.' });
    } finally {
      setRemovingPhone(false);
    }
  };

  // Handle Avatar Selection & Upload
  const handleAvatarSelect = async (e) => {
    if (guardDemoAction('edit_profile')) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (isDemoUser) {
      setAvatarError('🔒 Profile photo cannot be changed on official demo accounts.');
      return;
    }

    // Validate size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image is too large. Maximum allowed size is 2MB.');
      return;
    }

    // Validate type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Unsupported image format. Please select JPEG, PNG, WEBP, or GIF.');
      return;
    }

    setAvatarError(null);
    setUploadingAvatar(true);

    // Create instant local preview
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      // Build FormData for multipart/form-data upload
      const formData = new FormData();
      formData.append('avatar', file);

      // apiClient.put handles FormData automatically (without setting Content-Type to application/json)
      const res = await apiClient.put('/users/avatar', formData);

      if (res.success && res.data?.user) {
        setProfile((prev) => ({ ...prev, avatar_url: res.data.user.avatar_url }));
        updateUser({ avatar_url: res.data.user.avatar_url });
        setProfileMsg({ type: 'success', text: 'Avatar changed successfully!' });
      } else {
        setAvatarError(res.error || 'Failed to upload avatar.');
        setAvatarPreview(null);
      }
    } catch (err) {
      setAvatarError(err.message || 'Error uploading avatar.');
      setAvatarPreview(null);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Load active sessions when editing is opened
  useEffect(() => {
    if (isEditing && isOwnProfile && !sessionsLoaded) {
      fetchActiveSessions();
    }
  }, [isEditing, isOwnProfile, sessionsLoaded]);

  // Password strength calculator
  const calculatePasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, label: '', color: '', percent: 0 };
    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: '#ef4444', percent: 25 };
    if (score === 2) return { score: 2, label: 'Fair', color: '#f59e0b', percent: 50 };
    if (score === 3) return { score: 3, label: 'Good', color: '#3b82f6', percent: 75 };
    return { score: 4, label: 'Strong', color: '#10b981', percent: 100 };
  };

  // Relative timestamp for last active session
  const formatLastActive = (dateStr) => {
    if (!dateStr) return 'Active recently';
    const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSec < 60) return 'Active just now';
    if (diffSec < 3600) return `Active ${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `Active ${Math.floor(diffSec / 3600)}h ago`;
    return `Active ${Math.floor(diffSec / 86400)}d ago`;
  };

  // Fetch active sessions from PostgreSQL
  const fetchActiveSessions = async () => {
    try {
      setLoadingSessions(true);
      const res = await apiClient.get('/users/security/sessions');
      if (res.success && res.data) {
        setSessions(res.data.sessions || []);
        setSessionsLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch active sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setPassErrorMsg(null);

    if (!passCurrent) {
      setPassErrorMsg('Please enter your current password.');
      return;
    }
    if (!passNew || passNew.length < 8) {
      setPassErrorMsg('New password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(passNew) || !/[a-z]/.test(passNew) || !/[0-9]/.test(passNew) || !/[!@#$%^&*(),.?":{}|<>]/.test(passNew)) {
      setPassErrorMsg('New password must include uppercase, lowercase, a number, and a special character.');
      return;
    }
    if (passNew !== passConfirm) {
      setPassErrorMsg('New password and confirm password do not match.');
      return;
    }
    if (passCurrent === passNew) {
      setPassErrorMsg('New password must be different from your current password.');
      return;
    }

    try {
      setChangingPassword(true);
      const res = await apiClient.post('/users/security/password', {
        currentPassword: passCurrent,
        newPassword: passNew,
        confirmPassword: passConfirm,
        logoutOtherDevices: logoutOthersOnPassChange
      });

      if (res.success) {
        setProfileMsg({ type: 'success', text: res.message || 'Password updated successfully!' });
        setPassCurrent('');
        setPassNew('');
        setPassConfirm('');
        setShowPasswordChange(false);
        setPassErrorMsg(null);
        fetchActiveSessions();
      } else {
        setPassErrorMsg(res.error || 'Failed to update password.');
      }
    } catch (err) {
      setPassErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Revoke a single remote session
  const handleRevokeSession = async (sessionId) => {
    try {
      setRevokingSessionId(sessionId);
      const res = await apiClient.delete(`/users/security/sessions/${sessionId}`);
      if (res.success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setProfileMsg({ type: 'success', text: res.message || 'Device session revoked successfully.' });
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Failed to revoke session.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to revoke session.' });
    } finally {
      setRevokingSessionId(null);
    }
  };

  // Log out all other sessions - Opens modern confirm modal
  const handleLogoutOthers = () => {
    setConfirmAction({
      title: 'Log Out Other Sessions?',
      description: 'Are you sure you want to log out of all other devices?',
      confirmText: 'Log Out Others',
      variant: 'warning',
      onConfirm: async () => {
        try {
          setLoggingOutOthers(true);
          const res = await apiClient.post('/users/security/sessions/logout-others');
          if (res.success) {
            setSessions((prev) => prev.filter((s) => s.is_current));
            setProfileMsg({ type: 'success', text: res.message || 'Logged out of all other devices.' });
            setConfirmAction(null);
          } else {
            setProfileMsg({ type: 'error', text: res.error || 'Failed to log out of other devices.' });
          }
        } catch (err) {
          setProfileMsg({ type: 'error', text: err.message || 'Failed to log out of other devices.' });
        } finally {
          setLoggingOutOthers(false);
        }
      }
    });
  };

  // Log out all devices (including current one) - Opens modern confirm modal
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
            logout();
          }
        } catch (err) {
          setProfileMsg({ type: 'error', text: err.message || 'Failed to log out of all devices.' });
        } finally {
          setLoggingOutAll(false);
        }
      }
    });
  };

  // Load privacy settings when editing is opened
  useEffect(() => {
    if (isEditing && isOwnProfile && !privacyLoaded) {
      fetchPrivacySettings();
    }
  }, [isEditing, isOwnProfile, privacyLoaded]);

  // Fetch privacy settings from PostgreSQL
  const fetchPrivacySettings = async () => {
    try {
      setLoadingPrivacy(true);
      const res = await apiClient.get('/users/privacy');
      if (res.success && res.data?.privacy) {
        setPrivacySettings(res.data.privacy);
        setPrivacyLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch privacy settings:', err);
    } finally {
      setLoadingPrivacy(false);
    }
  };

  // Update privacy settings
  const handleUpdatePrivacy = async (updatedFields) => {
    const newSettings = { ...privacySettings, ...updatedFields };
    setPrivacySettings(newSettings);
    try {
      setSavingPrivacy(true);
      const res = await apiClient.put('/users/privacy', newSettings);
      if (res.success) {
        setPrivacySettings(res.data.privacy);
        setProfileMsg({ type: 'success', text: 'Privacy settings updated successfully.' });
        if (updatedFields.is_private !== undefined) {
          setProfile((prev) => ({ ...prev, is_private: updatedFields.is_private }));
          updateUser({ is_private: updatedFields.is_private });
        }
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Failed to update privacy settings.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update privacy settings.' });
    } finally {
      setSavingPrivacy(false);
    }
  };

  // Load notification settings when editing is opened (Phase 8)
  useEffect(() => {
    if (isEditing && isOwnProfile && !notifLoaded) {
      fetchNotificationSettings();
    }
  }, [isEditing, isOwnProfile, notifLoaded]);

  // Fetch notification settings from PostgreSQL
  const fetchNotificationSettings = async () => {
    try {
      setLoadingNotif(true);
      const res = await apiClient.get('/users/notifications/settings');
      if (res.success && res.data?.notifications) {
        setNotificationSettings(res.data.notifications);
        setNotifLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch notification settings:', err);
    } finally {
      setLoadingNotif(false);
    }
  };

  // Update notification settings
  const handleUpdateNotificationSetting = async (updatedFields) => {
    const newSettings = { ...notificationSettings, ...updatedFields };
    setNotificationSettings(newSettings);
    try {
      setSavingNotif(true);
      const res = await apiClient.put('/users/notifications/settings', newSettings);
      if (res.success && res.data?.notifications) {
        setNotificationSettings(res.data.notifications);
        setProfileMsg({ type: 'success', text: 'Notification preferences updated successfully.' });
      } else {
        setProfileMsg({ type: 'error', text: res.error || 'Failed to update notification preferences.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update notification preferences.' });
    } finally {
      setSavingNotif(false);
    }
  };

  // Handle Account Deactivation (Phase 9)
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
        // Clear auth context and redirect to login
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

  // Handle Permanent Account Deletion (Phase 10)
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
        // Clear auth context and redirect
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

  if (loading) {
    return (
      <div className="profile-loading-state">
        <div className="spinner"></div>
        <p>Loading profile from PostgreSQL...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-error-container">
        <h2>User Not Found</h2>
        <p>{error || `User @${usernameToFetch} does not exist in the database.`}</p>
      </div>
    );
  }

  const avatarSrc = avatarPreview || profile.avatar_url;

  return (
    <div className="profile-container">
      {/* Floating Toast Notification (Fixed viewport position & auto-dismisses in 5s) */}
      {profileMsg && (
        <div className={`toast-notification ${profileMsg.type}`} role="alert">
          <span className="toast-icon">{profileMsg.type === 'success' ? '✓' : '⚠️'}</span>
          <span className="toast-text">{profileMsg.text}</span>
          <button
            type="button"
            className="toast-close-btn"
            onClick={() => setProfileMsg(null)}
            title="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* Profile Header Section */}
      <section className="profile-header">
        {/* Avatar Area with Instagram-Style Interactive Ring & Badge */}
        <div className="profile-avatar-wrapper">
          <div
            className={`profile-avatar-ring ${isOwnProfile ? 'interactive-ring' : ''}`}
            onClick={() => isOwnProfile && setShowAvatarModal(true)}
            title={isOwnProfile ? 'Click to change profile picture' : undefined}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={profile.username}
                className="profile-avatar-img"
              />
            ) : (
              <div className="profile-avatar-fallback">
                {profile.username?.charAt(0).toUpperCase()}
              </div>
            )}
            {isOwnProfile && (
              <div className="profile-avatar-overlay">
                <Camera size={22} className="overlay-camera-icon" />
                <span className="overlay-text">Edit Photo</span>
              </div>
            )}
          </div>

          {/* Sleek Single Camera Badge (Replaces cluttered floating buttons) */}
          {isOwnProfile && (
            <button
              type="button"
              className="profile-avatar-camera-badge"
              title={isDemoUser ? 'Profile photo is locked on demo accounts' : 'Change or remove profile picture'}
              onClick={() => {
                if (isDemoUser) {
                  setAvatarError('Profile photo cannot be changed on official demo accounts.');
                  return;
                }
                setShowAvatarModal(true);
              }}
              disabled={uploadingAvatar || removingAvatar || isDemoUser}
            >
              {uploadingAvatar || removingAvatar ? (
                <span className="badge-spinner" />
              ) : (
                <span className="badge-camera-icon">{isDemoUser ? <Lock size={12} /> : <Camera size={13} />}</span>
              )}
            </button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarSelect}
          />
        </div>

        {/* User Info & Statistics */}
        <div className="profile-details">
          <div className="profile-top-row">
            <div className="profile-username-wrap">
              <h1 className="profile-username">@{profile.username}</h1>
              {profile.is_private && (
                <span className="profile-badge-private" title="Private Account"><Lock size={12} /></span>
              )}
            </div>

            <div className="profile-action-buttons">
              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    className="btn-profile-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => {
                      if (guardDemoAction('edit_profile')) return;
                      if (isDemoUser) {
                        setAvatarError('Profile editing is locked on official demo accounts.');
                        return;
                      }
                      setIsEditing(!isEditing);
                    }}
                    title="Edit profile details"
                  >
                    {isEditing ? 'Cancel' : <><Edit3 size={14} /> Edit Profile</>}
                  </button>
                  <button
                    type="button"
                    className="btn-profile-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => onOpenSettings && onOpenSettings('privacy')}
                    title="Settings & Privacy"
                    aria-label="Settings & Privacy"
                  >
                    <Settings size={14} /> Settings
                  </button>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`btn-follow-toggle ${isFollowing ? 'following' : 'follow'}`}
                    onClick={handleToggleFollow}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>

                  <button
                    type="button"
                    className="btn-profile-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => onOpenDirectMessage && onOpenDirectMessage(profile.username)}
                    title={`Send direct message to @${profile.username}`}
                    aria-label={`Send direct message to @${profile.username}`}
                  >
                    <MessageCircle size={14} /> Message
                  </button>
                </div>
              )}
            </div>
          </div>

          {avatarError && <div className="avatar-error-badge">⚠️ {avatarError}</div>}

          {/* Social Stats Counters */}
          <ul className="profile-stats-list">
            <li className="profile-stat-item">
              <strong className="stat-count">{stats.posts}</strong>
              <span className="stat-label">posts</span>
            </li>
            <li
              className="profile-stat-item clickable-stat"
              onClick={() => setFollowModal({ type: 'followers', username: profile.username })}
              title="View followers"
            >
              <strong className="stat-count">{stats.followers}</strong>
              <span className="stat-label">followers</span>
            </li>
            <li
              className="profile-stat-item clickable-stat"
              onClick={() => setFollowModal({ type: 'following', username: profile.username })}
              title="View accounts followed"
            >
              <strong className="stat-count">{stats.following}</strong>
              <span className="stat-label">following</span>
            </li>
          </ul>

          {/* Bio & Details Display (When not in edit mode) */}
          {!isEditing ? (
            <div className="profile-bio-box">
              {profile.full_name && <h2 className="profile-full-name">{profile.full_name}</h2>}
              {profile.bio ? (
                <p className="profile-bio-text">{profile.bio}</p>
              ) : (
                isOwnProfile && (
                  <p className="profile-bio-placeholder">
                    No bio yet.{' '}
                    <button
                      type="button"
                      className="inline-link"
                      onClick={() => setIsEditing(true)}
                    >
                      Add a bio
                    </button>{' '}
                    to tell people about yourself!
                  </p>
                )
              )}

              {/* Location and Website Links */}
              {(profile.location || profile.website) && (
                <div className="profile-extra-info">
                  {profile.location && (
                    <span className="profile-info-pill">
                      <span>📍</span> {profile.location}
                    </span>
                  )}
                  {profile.website && (
                    <span className="profile-info-pill">
                      <span>🔗</span> <a
                        href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="profile-website-link"
                      >
                        {profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    </span>
                  )}
                </div>
              )}

              {/* Metadata Pills */}
              <div className="profile-meta-pills">
                <span className="profile-meta-pill">
                  <span className="pill-icon"><Calendar size={13} /></span>
                  <span>Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                </span>
                {profile.date_of_birth && isOwnProfile && (
                  <span className="profile-meta-pill">
                    <span className="pill-icon"><Calendar size={13} /></span>
                    <span>Born {new Date(profile.date_of_birth).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </span>
                )}
                {isOwnProfile && (profile.email || currentUser?.email) && (
                  <span
                    className={`profile-meta-pill pill-interactive ${profile.is_email_verified ? 'pill-verified' : 'pill-unverified'}`}
                    onClick={() => (onOpenSettings ? onOpenSettings('contact') : setIsEditing(true))}
                    title={profile.is_email_verified ? 'Email is verified - Manage in Settings' : 'Email is unverified - Click to verify'}
                  >
                    <span className="pill-icon"><Mail size={13} /></span>
                    <span className="pill-text">{profile.email || currentUser?.email}</span>
                    <span className="pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {profile.is_email_verified ? <><Check size={11} /> Verified</> : <><AlertCircle size={11} /> Verify</>}
                    </span>
                  </span>
                )}
                {isOwnProfile && profile.phone_number && (
                  <span
                    className={`profile-meta-pill pill-interactive ${profile.is_phone_verified ? 'pill-verified' : 'pill-unverified'}`}
                    onClick={() => (onOpenSettings ? onOpenSettings('contact') : setIsEditing(true))}
                    title={profile.is_phone_verified ? 'Phone is verified - Manage in Settings' : 'Phone is unverified - Click to verify'}
                  >
                    <span className="pill-icon"><Phone size={13} /></span>
                    <span className="pill-text">{profile.phone_number}</span>
                    <span className="pill-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {profile.is_phone_verified ? <><Check size={11} /> Verified</> : <><AlertCircle size={11} /> Unverified</>}
                    </span>
                  </span>
                )}
                <span className="profile-meta-pill pill-security">
                  <span className="pill-icon"><ShieldCheck size={13} /></span>
                  <span>Verified Session</span>
                </span>
              </div>
            </div>
          ) : (
            /* Inline Edit Profile Form */
            <form onSubmit={handleSaveProfile} className="profile-edit-form">
              {isDemoUser && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  color: '#f87171',
                  fontSize: '13px'
                }}>
                  🔒 Profile details are locked on official demo accounts.
                </div>
              )}
              <div className="edit-form-field">
                <div className="field-header-row">
                  <label htmlFor="editUsername">Username</label>
                  <span className="char-counter">@{editUsername || ''}</span>
                </div>
                <input
                  type="text"
                  id="editUsername"
                  maxLength={30}
                  placeholder="username"
                  value={editUsername || ''}
                  onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30))}
                  required
                  disabled={savingProfile || isDemoUser}
                />
                <span className="field-hint" style={{ color: isDemoUser ? '#f87171' : undefined }}>
                  {isDemoUser
                    ? '🔒 Username cannot be modified on official demo accounts.'
                    : '3–30 characters, letters, numbers, and underscores only.'}
                </span>
              </div>

              <div className="edit-form-field">
                <div className="field-header-row">
                  <label htmlFor="editFullName">Full Name</label>
                  <span className="char-counter">{(editFullName || '').length}/100</span>
                </div>
                <input
                  type="text"
                  id="editFullName"
                  maxLength={100}
                  placeholder="Your full name"
                  value={editFullName || ''}
                  onChange={(e) => setEditFullName(e.target.value.slice(0, 100))}
                  disabled={savingProfile || isDemoUser}
                />
              </div>

              <div className="edit-form-field">
                <div className="field-header-row">
                  <label htmlFor="editBio">Bio</label>
                  <span className={`char-counter ${150 - (editBio || '').length <= 15 ? 'warning' : ''}`}>
                    {(editBio || '').length}/150 ({Math.max(0, 150 - (editBio || '').length)} left)
                  </span>
                </div>
                <textarea
                  id="editBio"
                  maxLength={150}
                  rows={3}
                  placeholder="Share a short bio (max 150 characters)..."
                  value={editBio || ''}
                  disabled={savingProfile || isDemoUser}
                  onChange={(e) => {
                    const text = e.target.value;
                    // Strict clamp to 150 characters
                    setEditBio(text.length > 150 ? text.slice(0, 150) : text);
                  }}
                  onPaste={(e) => {
                    // Prevent pasting content beyond 150 characters
                    const pasted = e.clipboardData.getData('text');
                    const target = e.target;
                    const selLen = target.selectionEnd - target.selectionStart;
                    const currentLen = target.value.length;
                    const availableSpace = 150 - (currentLen - selLen);

                    if (availableSpace <= 0) {
                      e.preventDefault();
                      return;
                    }

                    if (pasted.length > availableSpace) {
                      e.preventDefault();
                      const allowedPaste = pasted.slice(0, availableSpace);
                      const start = target.selectionStart;
                      const end = target.selectionEnd;
                      const nextText = target.value.slice(0, start) + allowedPaste + target.value.slice(end);
                      setEditBio(nextText.slice(0, 150));
                    }
                  }}
                ></textarea>
              </div>

              <div className="edit-form-row">
                <div className="edit-form-field" style={{ flex: 1 }}>
                  <div className="field-header-row">
                    <label htmlFor="editWebsite">Website</label>
                  </div>
                  <input
                    type="url"
                    id="editWebsite"
                    maxLength={255}
                    placeholder="https://example.com"
                    value={editWebsite || ''}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    disabled={savingProfile || isDemoUser}
                  />
                </div>

                <div className="edit-form-field" style={{ flex: 1 }}>
                  <div className="field-header-row">
                    <label htmlFor="editLocation">Location</label>
                    <span className="char-counter">{(editLocation || '').length}/100</span>
                  </div>
                  <input
                    type="text"
                    id="editLocation"
                    maxLength={100}
                    placeholder="City, Country"
                    value={editLocation || ''}
                    onChange={(e) => setEditLocation(e.target.value.slice(0, 100))}
                    disabled={savingProfile || isDemoUser}
                  />
                </div>
              </div>

              <div className="edit-form-field">
                <div className="field-header-row">
                  <label htmlFor="editDob">Date of Birth</label>
                </div>
                <input
                  type="date"
                  id="editDob"
                  value={editDob || ''}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEditDob(e.target.value)}
                  disabled={savingProfile || isDemoUser}
                />
              </div>

              {/* Link to dedicated Settings & Privacy Center */}
              <div className="profile-edit-settings-link-box">
                <div className="profile-edit-settings-link-text">
                  <strong>Account, Security & Privacy Settings</strong>
                  <p>Manage your Email, Phone OTP, Password, Active Sessions, Privacy and Notifications in the Settings Center.</p>
                </div>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => onOpenSettings && onOpenSettings('privacy')}
                >
                  ⚙️ Open Settings →
                </button>
              </div>

              <div className="edit-form-actions">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={savingProfile || (editBio || '').length > 150 || (editFullName || '').length > 100 || !(editUsername || '').trim() || isDemoUser}
                >
                  {isDemoUser ? '🔒 Profile Locked (Demo)' : (savingProfile ? 'Saving...' : 'Save Changes')}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditUsername(profile?.username || '');
                    setEditFullName(profile?.full_name || '');
                    setEditBio(profile?.bio || '');
                    setEditWebsite(profile?.website || '');
                    setEditLocation(profile?.location || '');
                    setEditDob(profile?.date_of_birth ? String(profile.date_of_birth).split('T')[0] : '');
                    setIsEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Grid Tabs: Posts & Saved (Saved is private to own profile) */}
      <div className="profile-tabs-bar">
        <button
          type="button"
          className={`tab-item ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
          aria-label={`Posts (${userPosts.length})`}
        >
          <Grid size={15} />
          <span>POSTS</span>
          <span className="tab-badge">{userPosts.length}</span>
        </button>
        {isOwnProfile && (
          <button
            type="button"
            className={`tab-item ${activeTab === 'saved' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('saved');
              fetchSavedPosts();
            }}
            aria-label={`Saved posts (${savedPosts.length})`}
          >
            <Bookmark size={15} />
            <span>SAVED</span>
            <span className="tab-badge">{savedPosts.length}</span>
          </button>
        )}
      </div>

      {/* Locked Private Account Banner for Non-Followers */}
      {profile.is_locked ? (
        <div className="private-profile-locked">
          <div className="private-lock-icon">
            <Lock size={32} strokeWidth={1.75} />
          </div>
          <h3 className="private-lock-title">This Account is Private</h3>
          <p className="private-lock-desc">Follow this account to see their photos and videos.</p>
        </div>
      ) : (
        <>
          {/* Active Tab: User Posts Grid or Empty State */}
          {activeTab === 'posts' && (
            loadingPosts ? (
              <div className="profile-posts-loading">
                <div className="spinner"></div>
                <p>Loading photos...</p>
              </div>
            ) : userPosts.length > 0 ? (
              <div className="profile-posts-grid">
                {userPosts.map((post) => (
                  <div
                    key={post.id}
                    className="grid-post-item"
                    onClick={() => setSelectedPost(post)}
                  >
                    <img
                      src={post.image_url}
                      alt={post.caption || 'User photo'}
                      className="grid-post-img"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="grid-post-overlay">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Heart size={14} fill="currentColor" strokeWidth={0} /> {post.likes_count}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <MessageCircle size={14} fill="currentColor" strokeWidth={0} /> {post.comments_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="profile-posts-empty">
                <div className="empty-camera-icon">
                  <Camera size={32} strokeWidth={1.5} />
                </div>
                <h3>No Posts Yet</h3>
                <p>When {isOwnProfile ? 'you share photos' : `@${profile.username} shares photos`}, they will appear here.</p>
                {isOwnProfile && onOpenCreatePost && (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={onOpenCreatePost}
                    style={{ marginTop: '14px' }}
                  >
                    Share Your First Photo
                  </button>
                )}
              </div>
            )
          )}

          {/* Active Tab: Saved Posts Grid (Phase 12) */}
          {activeTab === 'saved' && isOwnProfile && (
            loadingSaved ? (
              <div className="profile-posts-loading">
                <div className="spinner"></div>
                <p>Loading saved photos...</p>
              </div>
            ) : savedPosts.length > 0 ? (
              <div className="profile-posts-grid">
                {savedPosts.map((post) => (
                  <div
                    key={post.id}
                    className="grid-post-item"
                    onClick={() => setSelectedPost(post)}
                  >
                    <img
                      src={post.image_url}
                      alt={post.caption || 'Saved photo'}
                      className="grid-post-img"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="grid-post-overlay">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Heart size={14} fill="currentColor" strokeWidth={0} /> {post.likes_count}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <MessageCircle size={14} fill="currentColor" strokeWidth={0} /> {post.comments_count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="profile-posts-empty">
                <div className="empty-camera-icon">
                  <Bookmark size={32} strokeWidth={1.5} />
                </div>
                <h3>Save Photos</h3>
                <p>Save photos you want to see again. No one is notified, and only you can see what you've saved.</p>
              </div>
            )
          )}
        </>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <div className="modal-backdrop" onClick={() => setSelectedPost(null)}>
          <div className="modal-card post-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div
                className="detail-modal-author"
                onClick={() => {
                  if (selectedPost.username && selectedPost.username !== profile.username) {
                    setSelectedPost(null);
                    if (onNavigateToProfile) onNavigateToProfile(selectedPost.username);
                  }
                }}
                style={{ cursor: selectedPost.username && selectedPost.username !== profile.username ? 'pointer' : 'default' }}
              >
                {selectedPost.avatar_url || profile.avatar_url ? (
                  <img
                    src={selectedPost.avatar_url || profile.avatar_url}
                    alt={selectedPost.username || profile.username}
                    className="nav-avatar-mini"
                  />
                ) : (
                  <span className="nav-avatar-fallback-mini">
                    {(selectedPost.username || profile.username)?.charAt(0).toUpperCase()}
                  </span>
                )}
                <strong>@{selectedPost.username || profile.username}</strong>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedPost(null)}
                title="Close post details"
                aria-label="Close post details"
              >
                ✕
              </button>
            </div>

            <div className="detail-modal-media">
              <img src={selectedPost.image_url} alt={selectedPost.caption || 'Post image'} />
            </div>

            <div className="detail-modal-content">
              {selectedPost.caption && (
                <p className="detail-modal-caption">
                  <strong>@{selectedPost.username || profile.username}</strong>{' '}
                  {formatCaptionWithHashtags(
                    selectedPost.caption,
                    (tag) => {
                      setSelectedPost(null);
                      setActiveHashtag(tag);
                    },
                    onNavigateToProfile
                  )}
                </p>
              )}
              <div className="detail-modal-footer">
                <div className="detail-modal-stats">
                  <button
                    type="button"
                    className={`post-action-btn ${selectedPost.is_liked ? 'liked' : ''}`}
                    onClick={() => handleToggleLike(selectedPost.id)}
                    title={selectedPost.is_liked ? 'Unlike post' : 'Like post'}
                    aria-label={selectedPost.is_liked ? 'Unlike post' : 'Like post'}
                  >
                    <span className="heart-icon-wrapper">
                      <Heart
                        size={20}
                        fill={selectedPost.is_liked ? '#ef4444' : 'none'}
                        color={selectedPost.is_liked ? '#ef4444' : 'currentColor'}
                        strokeWidth={2}
                      />
                    </span>
                    <span className="action-counter">{selectedPost.likes_count}</span>
                  </button>
                  <button
                    type="button"
                    className="post-action-btn"
                    onClick={() => setCommentsPost(selectedPost)}
                    title="View comments"
                    aria-label={`View comments thread, ${selectedPost.comments_count} comments`}
                  >
                    <MessageCircle size={20} color="currentColor" strokeWidth={2} />
                    <span className="action-counter">{selectedPost.comments_count}</span>
                  </button>
                  <button
                    type="button"
                    className={`post-action-btn post-save-btn ${selectedPost.is_saved ? 'saved' : ''}`}
                    onClick={() => handleToggleSave(selectedPost.id)}
                    title={selectedPost.is_saved ? 'Remove from saved' : 'Save post'}
                    aria-label={selectedPost.is_saved ? 'Remove from saved' : 'Save post'}
                  >
                    <Bookmark
                      size={20}
                      fill={selectedPost.is_saved ? 'currentColor' : 'none'}
                      color="currentColor"
                      strokeWidth={2}
                    />
                  </button>
                </div>
                {currentUser && currentUser.id === selectedPost.user_id && (
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => handleDeletePost(selectedPost.id)}
                    title="Delete post"
                    aria-label="Delete post"
                  >
                    <Trash2 size={15} />
                    <span>Delete Post</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal (Triggered from Profile post modal) */}
      <CommentsModal
        post={commentsPost}
        isOpen={!!commentsPost}
        onClose={() => setCommentsPost(null)}
        onCommentCountChange={(postId, newCount) => {
          setUserPosts((prev) =>
            prev.map((p) => (p.id === postId ? { ...p, comments_count: newCount } : p))
          );
          if (selectedPost && selectedPost.id === postId) {
            setSelectedPost((prev) => ({ ...prev, comments_count: newCount }));
          }
        }}
      />

      {/* Followers / Following List Modal (Phase 7) */}
      <FollowListModal
        isOpen={!!followModal}
        username={followModal?.username}
        type={followModal?.type}
        onClose={() => setFollowModal(null)}
        onNavigateToProfile={(username) => {
          setFollowModal(null);
          if (onNavigateToProfile) onNavigateToProfile(username);
        }}
      />

      {/* Hashtag Feed Modal (Phase 13) */}
      <HashtagFeedModal
        isOpen={!!activeHashtag}
        tag={activeHashtag}
        onClose={() => setActiveHashtag(null)}
        onNavigateToProfile={onNavigateToProfile}
        onHashtagClick={(tag) => setActiveHashtag(tag)}
      />

      {/* Account Deactivation Modal (Phase 9) */}
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
                <label htmlFor="deactivateReasonSelect">Why are you taking a break?</label>
                <select
                  id="deactivateReasonSelect"
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
                <label htmlFor="deactivatePasswordInput">To continue, enter your current password</label>
                <div className="password-input-wrapper">
                  <input
                    id="deactivatePasswordInput"
                    type={showDeactivatePassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter your current password"
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

      {/* Permanent Account Deletion Modal (Phase 10) */}
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
                <label htmlFor="deleteConfirmationInput">
                  Type your username <strong>@{profile?.username || currentUser?.username}</strong> to confirm:
                </label>
                <input
                  id="deleteConfirmationInput"
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
                <label htmlFor="deletePasswordInput">Enter your current password:</label>
                <div className="password-input-wrapper">
                  <input
                    id="deletePasswordInput"
                    type={showDeletePassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter your current password"
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

      {/* Instagram-style Change Profile Photo Modal Sheet */}
      {showAvatarModal && (
        <div className="avatar-modal-backdrop" onClick={() => setShowAvatarModal(false)}>
          <div className="avatar-modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="avatar-modal-header">
              <div className="avatar-modal-thumb-ring">
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" className="avatar-modal-thumb-img" />
                ) : (
                  <div className="avatar-modal-thumb-fallback">
                    {profile.username?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <h3 className="avatar-modal-title">Change Profile Photo</h3>
              <p className="avatar-modal-subtitle">Upload a photo from your device or remove current photo.</p>
            </div>

            <div className="avatar-modal-buttons">
              <button
                type="button"
                className="avatar-modal-btn btn-photo-upload"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  if (isDemoUser) {
                    setAvatarError('Profile photo cannot be changed on official demo accounts.');
                    setShowAvatarModal(false);
                    return;
                  }
                  setShowAvatarModal(false);
                  fileInputRef.current?.click();
                }}
                disabled={isDemoUser}
              >
                <Upload size={16} /> Upload New Photo
              </button>

              {profile.avatar_url && !profile.avatar_url.includes('default-') && (
                <button
                  type="button"
                  className="avatar-modal-btn btn-photo-remove"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={() => {
                    if (isDemoUser) {
                      setAvatarError('Profile photo cannot be removed on official demo accounts.');
                      setShowAvatarModal(false);
                      return;
                    }
                    setShowAvatarModal(false);
                    handleRemoveAvatar();
                  }}
                  disabled={removingAvatar || isDemoUser}
                >
                  <Trash2 size={16} /> Remove Current Photo
                </button>
              )}

              <button
                type="button"
                className="avatar-modal-btn btn-photo-cancel"
                onClick={() => setShowAvatarModal(false)}
              >
                Cancel
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
