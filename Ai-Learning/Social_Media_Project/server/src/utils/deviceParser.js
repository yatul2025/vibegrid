/**
 * src/utils/deviceParser.js
 * =========================
 * Parses User-Agent header and IP address to extract human-readable
 * device type, browser, operating system, and approximate network location.
 */

/**
 * Parse client User-Agent string
 * @param {string} userAgent 
 * @returns {{ device: string, browser: string, os: string }}
 */
const parseUserAgent = (userAgent = '') => {
  const ua = userAgent || '';

  // 1. Detect Device Type
  let device = 'Desktop';
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    device = 'Tablet';
  } else if (/Mobile|iPhone|iPod|Android.*Mobile|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    device = 'Mobile';
  }

  // 2. Detect Operating System
  let os = 'Unknown OS';
  if (/iPhone OS|iPad OS|iOS|iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
  } else if (/Mac OS X|macOS/i.test(ua)) {
    os = 'macOS';
  } else if (/Windows NT 10.0|Windows NT 11.0/i.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
  } else if (/CrOS/i.test(ua)) {
    os = 'Chrome OS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // 3. Detect Browser
  let browser = 'Unknown Browser';
  if (/Edg\/|Edge\//i.test(ua)) {
    const match = ua.match(/Edg(?:e)?\/([0-9]+)/i);
    browser = `Edge ${match ? match[1] : ''}`.trim();
  } else if (/OPR\/|Opera\//i.test(ua)) {
    const match = ua.match(/(?:OPR|Opera)\/([0-9]+)/i);
    browser = `Opera ${match ? match[1] : ''}`.trim();
  } else if (/Chrome\/([0-9]+)/i.test(ua) && !/Chromium|Edg|OPR/i.test(ua)) {
    const match = ua.match(/Chrome\/([0-9]+)/i);
    browser = `Chrome ${match ? match[1] : ''}`.trim();
  } else if (/Safari\/([0-9]+)/i.test(ua) && !/Chrome|Chromium|Android/i.test(ua)) {
    const match = ua.match(/Version\/([0-9]+)/i);
    browser = `Safari ${match ? match[1] : ''}`.trim();
  } else if (/Firefox\/([0-9]+)/i.test(ua)) {
    const match = ua.match(/Firefox\/([0-9]+)/i);
    browser = `Firefox ${match ? match[1] : ''}`.trim();
  }

  return { device, browser, os };
};

/**
 * Extract clean IP address from express request
 * @param {import('express').Request} req 
 * @returns {string}
 */
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  let ip = forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || req.ip || '127.0.0.1';

  // Normalize IPv6 mapped IPv4 (e.g. ::ffff:127.0.0.1)
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }

  // Clean localhost
  if (ip === '::1' || ip === '127.0.0.1') {
    ip = '127.0.0.1';
  }

  return ip;
};

/**
 * Extract approximate location
 * @param {string} ip 
 * @returns {string}
 */
const getApproxLocation = (ip) => {
  if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip === 'localhost') {
    return 'Local Development';
  }
  return 'Online (Active)';
};

module.exports = {
  parseUserAgent,
  getClientIp,
  getApproxLocation
};
