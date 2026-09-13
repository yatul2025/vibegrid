/**
 * server/src/utils/mailer.js
 * ==========================
 * Email delivery utility using Nodemailer & Gmail SMTP.
 */

let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  console.warn('[Mailer Warning] nodemailer module not found:', err.message);
}

const config = require('../config/env');

let transporter = null;

if (nodemailer && config.email.user && config.email.pass) {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email.user,
        pass: config.email.pass
      }
    });
  } catch (err) {
    console.error('[Mailer Transporter Init Error]', err.message);
  }
}

/**
 * Sends a 6-digit login verification code via email.
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP string
 * @returns {Promise<{ sent: boolean, simulated?: boolean, error?: string, messageId?: string }>}
 */
const sendLoginOtpEmail = async (toEmail, otp) => {
  // If email credentials are not configured, simulate delivery in development
  if (!transporter || !config.email.user || !config.email.pass) {
    console.log('\n' + '='.repeat(60));
    console.log(' [EMAIL OTP SIMULATION — No Gmail Credentials Set]');
    console.log(` To: ${toEmail}`);
    console.log(` Login OTP Code: ${otp}`);
    console.log(' (Add EMAIL_USER & EMAIL_PASS to server/.env for real delivery)');
    console.log('='.repeat(60) + '\n');
    return { sent: false, simulated: true, otp };
  }

  try {
    const info = await transporter.sendMail({
      from: `"VibeGrid Security" <${config.email.user}>`,
      to: toEmail,
      subject: `${otp} is your VibeGrid login verification code`,
      text: `Your VibeGrid verification code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>VibeGrid Login Verification</title>
        </head>
        <body style="margin: 0; padding: 24px; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 480px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; padding: 32px 24px; color: #f8fafc;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #ffffff; font-weight: 800; font-size: 22px; border-radius: 12px;">V</div>
              <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 14px 0 4px 0;">VibeGrid Security</h1>
              <p style="font-size: 13px; color: #94a3b8; margin: 0;">Two-Factor Login Verification</p>
            </div>

            <div style="background: #1e293b; border-radius: 12px; padding: 24px 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 16px 0;">Enter this 6-digit code on the login screen to access your account:</p>
              <div style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #6366f1; background: rgba(99, 102, 241, 0.1); padding: 12px 24px; border-radius: 10px; font-family: 'Courier New', Courier, monospace;">
                ${otp}
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin: 16px 0 0 0;">⏱️ This code expires in <strong>10 minutes</strong>.</p>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.6; text-align: center; margin: 0;">
              If you didn't request this code, you can safely ignore this email or change your password if you suspect unauthorized access.
            </p>
          </div>
        </body>
        </html>
      `
    });

    console.log(`[EMAIL OTP] Successfully delivered to ${toEmail}. MessageId: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL OTP ERROR] Failed sending to ${toEmail}:`, error.message);
    return { sent: false, error: error.message };
  }
};

/**
 * Sends a 6-digit account registration confirmation code via email.
 * @param {string} toEmail - Recipient email address
 * @param {string} otp - 6-digit OTP string
 * @returns {Promise<{ sent: boolean, simulated?: boolean, error?: string, messageId?: string }>}
 */
const sendSignupOtpEmail = async (toEmail, otp) => {
  if (!transporter || !config.email.user || !config.email.pass) {
    console.log('\n' + '='.repeat(60));
    console.log(' [SIGNUP EMAIL OTP SIMULATION — No Gmail Credentials Set]');
    console.log(` To: ${toEmail}`);
    console.log(` Signup OTP Code: ${otp}`);
    console.log('='.repeat(60) + '\n');
    return { sent: false, simulated: true, otp };
  }

  try {
    const info = await transporter.sendMail({
      from: `"VibeGrid Welcome" <${config.email.user}>`,
      to: toEmail,
      subject: `${otp} is your VibeGrid account verification code`,
      text: `Welcome to VibeGrid! Your account verification code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to VibeGrid - Verify Email</title>
        </head>
        <body style="margin: 0; padding: 24px; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 480px; margin: 0 auto; background: #0f172a; border-radius: 16px; border: 1px solid #1e293b; padding: 32px 24px; color: #f8fafc;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #ffffff; font-weight: 800; font-size: 22px; border-radius: 12px;">V</div>
              <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 14px 0 4px 0;">Welcome to VibeGrid!</h1>
              <p style="font-size: 13px; color: #94a3b8; margin: 0;">Email Verification Required</p>
            </div>

            <div style="background: #1e293b; border-radius: 12px; padding: 24px 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(255, 255, 255, 0.05);">
              <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 16px 0;">Enter this 6-digit code to verify your email and activate your account:</p>
              <div style="display: inline-block; font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #ec4899; background: rgba(236, 72, 153, 0.1); padding: 12px 24px; border-radius: 10px; font-family: 'Courier New', Courier, monospace;">
                ${otp}
              </div>
              <p style="font-size: 12px; color: #94a3b8; margin: 16px 0 0 0;">⏱️ This code expires in <strong>10 minutes</strong>.</p>
            </div>

            <p style="font-size: 12px; color: #64748b; line-height: 1.6; text-align: center; margin: 0;">
              If you did not attempt to sign up for VibeGrid, please ignore this email.
            </p>
          </div>
        </body>
        </html>
      `
    });

    console.log(`[SIGNUP OTP] Successfully delivered to ${toEmail}. MessageId: ${info.messageId}`);
    return { sent: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[SIGNUP OTP Error] Failed to deliver to ${toEmail}:`, error.message);
    return { sent: false, error: error.message };
  }
};

module.exports = {
  sendLoginOtpEmail,
  sendSignupOtpEmail
};
