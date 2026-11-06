const { breachMessage, listBreaches } = require('./actions');
const { notifyAddresses, sendBreachEmail } = require('./mailer');

const BREACH_MS = 10 * 60 * 1000;

/**
 * Track how long each metric stays outside its target range.
 * When a breach reaches 10 consecutive minutes, send one email and
 * wait until the reading recovers before arming the next one.
 * Returns the breaches that just crossed the threshold.
 */
function noteBreaches(breachState, reading, control, now) {
  const active = new Map(listBreaches(reading, control).map((b) => [b.metric, b]));
  const due = [];
  for (const metric of ['co2', 'temp', 'hum']) {
    const hit = active.get(metric);
    const prev = breachState[metric] || { sinceMs: null, emailed: false };
    if (!hit) {
      breachState[metric] = { sinceMs: null, emailed: false };
      continue;
    }
    if (prev.sinceMs == null) {
      breachState[metric] = { sinceMs: now, emailed: false, direction: hit.direction };
      continue;
    }
    // Direction flipped (low → high) without a recovery sample: restart the clock.
    if (prev.direction && prev.direction !== hit.direction) {
      breachState[metric] = { sinceMs: now, emailed: false, direction: hit.direction };
      continue;
    }
    const elapsed = now - prev.sinceMs;
    if (!prev.emailed && elapsed >= BREACH_MS) {
      breachState[metric] = { sinceMs: prev.sinceMs, emailed: true, direction: hit.direction };
      due.push({
        ...hit,
        durationMs: elapsed,
        message: breachMessage(hit.metric, hit.direction, hit.value, reading, control),
      });
    }
  }
  return due;
}

function dispatchBreachEmails(deviceId, notify, due, reading) {
  if (!due.length) return;
  const addrs = notifyAddresses(notify);
  if (!notify || notify.enabled !== true || !addrs.length) {
    console.log(`[email] device=${deviceId} breach ready but email alerts are off`);
    return;
  }
  for (const item of due) {
    const durationMin = Math.max(10, Math.round(item.durationMs / 60000));
    sendBreachEmail({
      to: addrs,
      deviceId,
      message: item.message,
      durationMin,
      reading,
    })
      .then((sent) => {
        if (sent) console.log(`[email] device=${deviceId} sent ${item.metric} ${item.direction}`);
      })
      .catch((e) => {
        console.warn(`[email] device=${deviceId} send failed:`, e.message);
      });
  }
}

module.exports = {
  BREACH_MS,
  noteBreaches,
  dispatchBreachEmails,
};
