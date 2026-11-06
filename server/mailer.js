const nodemailer = require('nodemailer');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 10;

let transport = null;
let transportKey = '';

function smtpConfigured() {
  return Boolean(process.env.SMTP_URL || process.env.SMTP_HOST);
}

function fromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || '';
}

function getTransport() {
  const key = [
    process.env.SMTP_URL || '',
    process.env.SMTP_HOST || '',
    process.env.SMTP_PORT || '',
    process.env.SMTP_USER || '',
    process.env.SMTP_SECURE || '',
  ].join('|');
  if (transport && transportKey === key) return transport;
  transportKey = key;
  if (process.env.SMTP_URL) {
    transport = nodemailer.createTransport(process.env.SMTP_URL);
    return transport;
  }
  if (!process.env.SMTP_HOST) {
    transport = null;
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === '1' || port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
      : undefined,
  });
  return transport;
}

function notifyAddresses(notify) {
  const out = [];
  const add = (raw) => {
    const e = String(raw || '').trim().toLowerCase();
    if (!EMAIL_RE.test(e) || out.includes(e) || out.length >= MAX_EMAILS) return;
    out.push(e);
  };
  if (!notify || typeof notify !== 'object') return out;
  if (Array.isArray(notify.emails)) notify.emails.forEach(add);
  add(notify.email);
  return out;
}

function readingLines(reading) {
  const temp = typeof reading?.tempC === 'number' ? `${reading.tempC.toFixed(1)}°C` : '—';
  const hum = typeof reading?.humPct === 'number' ? `${Math.round(reading.humPct)}%` : '—';
  const co2 = typeof reading?.co2ppm === 'number' ? `${Math.round(reading.co2ppm)} ppm` : '—';
  return [`Temperature: ${temp}`, `Humidity: ${hum}`, `CO₂: ${co2}`];
}

async function sendAlertEmail({ to, deviceId, subject, message, extraLines, reading }) {
  const list = notifyAddresses({ emails: Array.isArray(to) ? to : [to] });
  if (!list.length) return false;
  const tx = getTransport();
  const from = fromAddress();
  if (!tx || !from) {
    console.warn('[email] SMTP is not configured (set SMTP_HOST and SMTP_FROM)');
    return false;
  }
  const text = [
    message,
    '',
    ...(extraLines || []),
    extraLines && extraLines.length ? '' : null,
    `Device: ${deviceId}`,
    ...readingLines(reading),
  ]
    .filter((line) => line != null)
    .join('\n');

  await tx.sendMail({
    from,
    to: list.join(', '),
    subject: subject || `Nursery alert: ${message}`,
    text,
  });
  return true;
}

/** One message per sustained breach. */
async function sendBreachEmail({ to, deviceId, message, durationMin, reading }) {
  return sendAlertEmail({
    to,
    deviceId,
    message,
    subject: `Nursery alert: ${message}`,
    extraLines: [
      `This reading has stayed outside the target range for ${durationMin} minutes.`,
    ],
    reading,
  });
}

function dispatchNotifyEmails(deviceId, notify, { subject, message, extraLines }, reading) {
  const addrs = notifyAddresses(notify);
  if (!notify || notify.enabled !== true || !addrs.length) return;
  sendAlertEmail({
    to: addrs,
    deviceId,
    subject,
    message,
    extraLines,
    reading,
  })
    .then((sent) => {
      if (sent) console.log(`[email] device=${deviceId} to=${addrs.length} ${subject || message}`);
    })
    .catch((e) => {
      console.warn(`[email] device=${deviceId} send failed:`, e.message);
    });
}

module.exports = {
  EMAIL_RE,
  MAX_EMAILS,
  smtpConfigured,
  notifyAddresses,
  sendAlertEmail,
  sendBreachEmail,
  dispatchNotifyEmails,
};
