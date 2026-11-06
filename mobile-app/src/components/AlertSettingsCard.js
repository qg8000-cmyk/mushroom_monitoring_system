import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { apiGet, apiPut, devicePath } from '../lib/api';
import { DEFAULT_ALERT_PREFS, loadAlertPrefs, saveAlertPrefs } from '../lib/alertPrefs';
import { configureAlertChannels, criticalChannelId, playAlertSound } from '../lib/alertSounds';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { palette } from '../theme/palette';
import { useScale } from '../theme/scale';
import { cardShadow, useTheme } from '../theme/useTheme';

function Choice({ label, selected, onPress, t, sp }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? palette.forestDeep : t.bg,
          borderColor: selected ? palette.forestDeep : t.border,
        },
      ]}
    >
      <Text style={{ color: selected ? 'white' : t.text, fontWeight: '800', fontSize: sp(12) }}>{label}</Text>
    </Pressable>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAILS = 10;

export default function AlertSettingsCard({ deviceId }) {
  const t = useTheme();
  const { dp, sp } = useScale();
  const [prefs, setPrefs] = useState(DEFAULT_ALERT_PREFS);
  const [emails, setEmails] = useState([]);
  const [draft, setDraft] = useState('');
  const [emailOn, setEmailOn] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    loadAlertPrefs().then(setPrefs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!deviceId) return undefined;
    let live = true;
    apiGet(devicePath(deviceId, 'notify'))
      .then((v) => {
        if (!live || !v) return;
        const list = Array.isArray(v.emails)
          ? v.emails.filter((e) => typeof e === 'string' && e.includes('@'))
          : typeof v.email === 'string' && v.email
            ? [v.email]
            : [];
        setEmails(list);
        setEmailOn(v.enabled === true);
        setSmtpConfigured(v.smtpConfigured === true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [deviceId]);

  async function updatePrefs(patch) {
    const next = await saveAlertPrefs({ ...prefs, ...patch });
    setPrefs(next);
    await configureAlertChannels();
    if (deviceId) {
      await registerForPushNotificationsAsync(deviceId, criticalChannelId(next)).catch(() => {});
    }
    return next;
  }

  function addDraftEmail() {
    const next = draft.trim().toLowerCase();
    if (!EMAIL_RE.test(next)) {
      Alert.alert('Email alerts', 'Enter a valid address.');
      return;
    }
    if (emails.includes(next)) {
      Alert.alert('Email alerts', 'That address is already on the list.');
      return;
    }
    if (emails.length >= MAX_EMAILS) {
      Alert.alert('Email alerts', `You can add at most ${MAX_EMAILS} addresses.`);
      return;
    }
    setEmails([...emails, next]);
    setDraft('');
  }

  function removeEmail(addr) {
    setEmails(emails.filter((e) => e !== addr));
  }

  async function saveEmail() {
    let list = emails;
    const extra = draft.trim().toLowerCase();
    if (extra) {
      if (!EMAIL_RE.test(extra)) {
        Alert.alert('Email alerts', 'Enter a valid address, or tap Add first.');
        return;
      }
      if (!list.includes(extra)) {
        if (list.length >= MAX_EMAILS) {
          Alert.alert('Email alerts', `You can add at most ${MAX_EMAILS} addresses.`);
          return;
        }
        list = [...list, extra];
        setEmails(list);
      }
      setDraft('');
    }
    if (emailOn && list.length === 0) {
      Alert.alert('Email alerts', 'Add at least one address, or turn email alerts off.');
      return;
    }
    setSavingEmail(true);
    try {
      const saved = await apiPut(devicePath(deviceId, 'notify'), { emails: list, enabled: emailOn });
      setEmails(Array.isArray(saved?.emails) ? saved.emails : emails);
      setSmtpConfigured(saved?.smtpConfigured === true);
      Alert.alert(
        'Email alerts saved',
        saved?.smtpConfigured
          ? 'Each address will be emailed when a reading leaves its target range and again when it returns to normal.'
          : 'Saved on the server. SMTP is not configured yet, so messages will not send until SMTP_HOST and SMTP_FROM are set.'
      );
    } catch (e) {
      Alert.alert('Save failed', String(e?.message || e));
    } finally {
      setSavingEmail(false);
    }
  }

  return (
    <View style={{ gap: dp(12) }}>
      <Text style={{ color: t.text, fontSize: sp(18), fontWeight: '800' }}>Email alerts</Text>
      <View style={[styles.card, { backgroundColor: t.surface, padding: dp(14), borderRadius: dp(20), gap: dp(8) }, cardShadow(t.isDark)]}>
        <View style={styles.switchRow}>
          <Text style={{ color: t.text, fontSize: sp(14), fontWeight: '800', flex: 1 }}>
            Email when a reading leaves range or returns to normal
          </Text>
          <Switch value={emailOn} onValueChange={setEmailOn} thumbColor={palette.forestGreen} />
        </View>
        <Text style={{ color: t.sub, fontSize: sp(12) }}>
          Add every address that should get those messages. A reminder is also sent if a reading stays out of range for 10 minutes.
        </Text>
        {emails.map((addr) => (
          <View key={addr} style={[styles.emailRow, { borderColor: t.border, backgroundColor: t.bg }]}>
            <Text style={{ color: t.text, fontSize: sp(14), fontWeight: '700', flex: 1 }}>{addr}</Text>
            <Pressable onPress={() => removeEmail(addr)} hitSlop={8}>
              <Text style={{ color: palette.forestGreen, fontWeight: '800', fontSize: sp(12) }}>Remove</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="grower@example.com"
            placeholderTextColor={t.placeholder}
            style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg, fontSize: sp(15), flex: 1 }]}
            onSubmitEditing={addDraftEmail}
          />
          <Pressable onPress={addDraftEmail} style={styles.addBtn}>
            <Text style={{ color: 'white', fontWeight: '800', fontSize: sp(13) }}>Add</Text>
          </Pressable>
        </View>
        {!smtpConfigured ? (
          <Text style={{ color: t.sub, fontSize: sp(12) }}>
            The API process also needs SMTP_HOST and SMTP_FROM before mail can leave the server.
          </Text>
        ) : null}
        <Pressable onPress={saveEmail} disabled={savingEmail} style={[styles.save, { opacity: savingEmail ? 0.6 : 1 }]}>
          <Text style={{ color: 'white', fontWeight: '800', fontSize: sp(14) }}>
            {savingEmail ? 'Saving…' : 'Save email alerts'}
          </Text>
        </Pressable>
      </View>

      <Text style={{ color: t.text, fontSize: sp(18), fontWeight: '800' }}>Alert sounds</Text>
      <View style={[styles.card, { backgroundColor: t.surface, padding: dp(14), borderRadius: dp(20), gap: dp(10) }, cardShadow(t.isDark)]}>
        <Text style={{ color: t.text, fontSize: sp(14), fontWeight: '800' }}>Warning sound</Text>
        <Text style={{ color: t.sub, fontSize: sp(12) }}>Plays when a reading moves near the edge of its target range.</Text>
        <View style={styles.choices}>
          <Choice label="Chime" selected={prefs.warningSound === 'chime'} onPress={() => updatePrefs({ warningSound: 'chime' })} t={t} sp={sp} />
          <Choice label="Off" selected={prefs.warningSound === 'off'} onPress={() => updatePrefs({ warningSound: 'off' })} t={t} sp={sp} />
          <Pressable onPress={() => playAlertSound('warning', { ...prefs, warningSound: 'chime', overrideSilent: false })} style={[styles.choice, { borderColor: t.border }]}>
            <Text style={{ color: t.text, fontWeight: '800', fontSize: sp(12) }}>Preview</Text>
          </Pressable>
        </View>

        <Text style={{ color: t.text, fontSize: sp(14), fontWeight: '800', marginTop: dp(6) }}>Critical sound</Text>
        <Text style={{ color: t.sub, fontSize: sp(12) }}>Plays when temperature, humidity, or CO₂ leaves the target range.</Text>
        <View style={styles.choices}>
          <Choice label="Alarm" selected={prefs.criticalSound === 'alarm'} onPress={() => updatePrefs({ criticalSound: 'alarm' })} t={t} sp={sp} />
          <Choice label="Off" selected={prefs.criticalSound === 'off'} onPress={() => updatePrefs({ criticalSound: 'off' })} t={t} sp={sp} />
          <Pressable
            onPress={() => playAlertSound('critical', { ...prefs, criticalSound: 'alarm', overrideSilent: false })}
            style={[styles.choice, { borderColor: t.border }]}
          >
            <Text style={{ color: t.text, fontWeight: '800', fontSize: sp(12) }}>Preview</Text>
          </Pressable>
        </View>

        <View style={styles.switchRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: t.text, fontSize: sp(14), fontWeight: '800' }}>Override silent mode</Text>
            <Text style={{ color: t.sub, fontSize: sp(12), marginTop: 2 }}>
              Critical alerts use the alarm channel and can sound while the phone is muted. On Android, allow this app to bypass Do Not Disturb.
            </Text>
          </View>
          <Switch
            value={prefs.overrideSilent}
            onValueChange={(v) => updatePrefs({ overrideSilent: v })}
            thumbColor={palette.forestGreen}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBtn: {
    backgroundColor: palette.forestDeep,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontWeight: '600',
  },
  save: {
    backgroundColor: palette.forestGreen,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
});
