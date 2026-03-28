const nodemailer = require('nodemailer');
const env = require('../config/env');

function logOtpToConsole(email, code, purpose) {
  console.log(`[ORBIT OTP] ${purpose} → ${email}: ${code}`);
}

function otpEmailBodies(code, purpose) {
  const subject =
    purpose === 'signup' ? 'Your ORBIT verification code' : 'Your ORBIT sign-in code';
  const text = `Your verification code is: ${code}\n\nIt expires in 10 minutes. If you did not request this, you can ignore this email.`;
  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #0f172a;">
  <p>Your ORBIT verification code is:</p>
  <p style="font-size: 28px; font-weight: 700; letter-spacing: 0.2em; margin: 16px 0;">${code}</p>
  <p style="color: #64748b; font-size: 14px;">This code expires in 10 minutes. If you didn’t request it, you can ignore this email.</p>
  <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">— ORBIT</p>
</body>
</html>`.trim();
  return { subject, text, html };
}

/**
 * Build Nodemailer transport from env (same rules as OTP send).
 * @returns {import('nodemailer').Transporter | null}
 */
function buildSmtpTransport() {
  if (!env.SMTP_HOST || !env.SMTP_USER) return null;
  const pass = String(env.SMTP_PASS || '').trim();
  if (!pass) return null;

  const useGmailService = /gmail\.com/i.test(env.SMTP_HOST || '');
  if (useGmailService) {
    return nodemailer.createTransport({
      service: 'Gmail',
      auth: { user: env.SMTP_USER.trim(), pass },
    });
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    secure: env.SMTP_SECURE === 'true',
    auth: { user: env.SMTP_USER.trim(), pass },
  });
}

/** Verify SMTP credentials (for `npm run test:smtp`). */
async function verifySmtpConnection() {
  const t = buildSmtpTransport();
  if (!t) {
    throw new Error('SMTP not configured: need SMTP_HOST, SMTP_USER, and SMTP_PASS');
  }
  await t.verify();
}

async function sendViaResend(to, subject, text, html) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [to],
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend HTTP ${res.status}: ${body}`);
  }
}

/**
 * Sends OTP: Resend (if RESEND_API_KEY), else SMTP, else console.
 * Never throws — OTP flow must still succeed if delivery fails.
 */
async function sendOtpEmail(email, code, purpose) {
  const { subject, text, html } = otpEmailBodies(code, purpose);
  const from = env.MAIL_FROM;

  if (env.RESEND_API_KEY) {
    try {
      await sendViaResend(email, subject, text, html);
      console.log(`[ORBIT OTP] Sent via Resend to ${email} (from ${from})`);
      return;
    } catch (err) {
      console.error('[ORBIT OTP] Resend failed, trying SMTP / console:', err.message || err);
    }
  }

  const transporter = buildSmtpTransport();
  if (transporter) {
    try {
      const fromAddr = (from || env.SMTP_USER).trim();
      await transporter.sendMail({
        from: fromAddr,
        to: email,
        subject,
        text,
        html,
      });
      console.log(`[ORBIT OTP] Sent via SMTP to ${email} (from ${fromAddr})`);
      return;
    } catch (err) {
      const smtp = err.response || err.responseCode;
      console.error(
        '[ORBIT OTP] SMTP send failed:',
        err.message || err,
        smtp ? `(server: ${smtp})` : ''
      );
      if (/Invalid login|535|534|authentication failed/i.test(String(err.message))) {
        console.error(
          '[ORBIT OTP] Hint: For Gmail / Google Workspace you must use a 16-character App Password, not your normal password. Google Account → Security → 2-Step Verification → App passwords.'
        );
      }
    }
  } else if (env.SMTP_HOST && env.SMTP_USER && !String(env.SMTP_PASS || '').trim()) {
    console.warn('[ORBIT OTP] SMTP_USER is set but SMTP_PASS is empty — cannot send mail.');
  }

  logOtpToConsole(email, code, purpose);
}

module.exports = { sendOtpEmail, buildSmtpTransport, verifySmtpConnection };
