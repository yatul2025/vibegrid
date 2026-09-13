/**
 * server/src/utils/avatar.js
 * =========================
 * Helper functions for gender-based default avatars
 */

function getDefaultAvatar(gender) {
  const g = (gender || '').toLowerCase();
  if (g === 'female') return '/uploads/avatars/default-female.svg';
  if (g === 'male') return '/uploads/avatars/default-male.svg';
  return '/uploads/avatars/default-avatar.svg';
}

function isDefaultAvatar(avatarUrl) {
  if (!avatarUrl) return true;
  return avatarUrl.includes('default-');
}

module.exports = {
  getDefaultAvatar,
  isDefaultAvatar
};
