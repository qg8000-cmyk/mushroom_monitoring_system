import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, navigateRoot } from '../components/ui';
import { apiPut, devicePath, pingServer } from '../lib/api';
import { DEFAULT_SERVER_BASE_URL, getServerBaseUrl, setServerBaseUrl, useServerConfig } from '../lib/config';
import { FEATURES } from '../lib/features';
import { changeLocalCreds, getLocalCreds } from '../lib/localAuth';
import { useSharedNurseryLive } from '../lib/NurseryLiveContext';
import AlertSettingsCard from '../components/AlertSettingsCard';
import { palette } from '../theme/palette';
import { cardShadow, useTheme } from '../theme/useTheme';

function Field({ label, value, onChangeText, placeholder, keyboardType, t }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.help, { color: t.sub }]}>{label}</Text>
      <TextInput
        value={value == null ? '' : String(value)}
        onChangeText={onChangeText}
        editable
        keyboardType={keyboardType || 'numeric'}
        placeholder={placeholder}
        placeholderTextColor={t.placeholder}
        style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
      />
    </View>
  );
}

function InfoRow({ icon, label, value, onPress, t }) {
  const inner = (
    <View style={styles.infoRow}>
      <View style={[styles.smallIcon, { backgroundColor: t.mint }]}>
        <Ionicons name={icon} size={16} color={palette.forestGreen} />
      </View>
      <Text style={[styles.infoLabel, { color: t.sub }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: t.text }]} numberOfLines={1}>
        {value}
      </Text>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={t.sub} /> : null}
    </View>
  );
  if (!onPress) return inner;
  return <Pressable onPress={onPress}>{inner}</Pressable>;
}

export default function SettingsScreen({ deviceIdState, onSignOut }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { deviceId, setDeviceId, loading: deviceIdLoading } = deviceIdState;
  const serverConfig = useServerConfig();
  const { derived, control, live, refreshControl } = useSharedNurseryLive();

  const [pendingServerUrl, setPendingServerUrl] = useState('');
  const [pendingApiKey, setPendingApiKey] = useState('');
  const [savingServer, setSavingServer] = useState(false);
  const [pendingDeviceId, setPendingDeviceId] = useState(deviceId);
  const [co2Threshold, setCo2Threshold] = useState('');
  const [tempFanOnC, setTempFanOnC] = useState('');
  const [humFanOnPct, setHumFanOnPct] = useState('');
  const [co2MinPpm, setCo2MinPpm] = useState('');
  const [tempMinC, setTempMinC] = useState('');
  const [humMinPct, setHumMinPct] = useState('');
  const [intakeFanEnabled, setIntakeFanEnabled] = useState(true);
  const [sprinklerEnabled, setSprinklerEnabled] = useState(true);
  const [sprinklerOnHumPct, setSprinklerOnHumPct] = useState('');
  const [sprinklerOffHumPct, setSprinklerOffHumPct] = useState('');
  const [sprinklerMaxOnSec, setSprinklerMaxOnSec] = useState('');
  const [sprinklerMinOffSec, setSprinklerMinOffSec] = useState('');
  const [heaterEnabled, setHeaterEnabled] = useState(true);
  const [heaterOnTempC, setHeaterOnTempC] = useState('');
  const [heaterOffTempC, setHeaterOffTempC] = useState('');
  const [heaterMaxOnSec, setHeaterMaxOnSec] = useState('');
  const [heaterMinOffSec, setHeaterMinOffSec] = useState('');
  const [saving, setSaving] = useState(false);
  const [adminUser, setAdminUser] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [changingCreds, setChangingCreds] = useState(false);
  const [deviceSsid, setDeviceSsid] = useState('');
  const [deviceWifiPass, setDeviceWifiPass] = useState('');
  const [savingWifi, setSavingWifi] = useState(false);
  const [tab, setTab] = useState('ranges');

  useEffect(() => {
    if (serverConfig.hydrated) {
      setPendingServerUrl(serverConfig.baseUrl || '');
      setPendingApiKey(serverConfig.apiKey || '');
    }
  }, [serverConfig.hydrated, serverConfig.baseUrl, serverConfig.apiKey]);

  useEffect(() => setPendingDeviceId(deviceId), [deviceId]);
  useEffect(() => {
    const liveSsid = live?.value?.wifiSsid;
    const controlSsid = control?.value?.wifiSsid;
    const next = typeof liveSsid === 'string' && liveSsid.trim()
      ? liveSsid
      : typeof controlSsid === 'string' && controlSsid.trim()
        ? controlSsid
        : '';
    if (next && !deviceSsid) setDeviceSsid(next);
  }, [live?.value?.wifiSsid, control?.value?.wifiSsid, deviceSsid]);
  useEffect(() => {
    getLocalCreds()
      .then((c) => setAdminUser(c.username))
      .catch(() => {});
  }, []);

  const hydratedFor = useRef(null);
  const rangesDirty = useRef(false);
  useEffect(() => {
    hydratedFor.current = null;
    rangesDirty.current = false;
  }, [deviceId]);

  function editRange(setter) {
    return (text) => {
      rangesDirty.current = true;
      setter(text);
    };
  }

  useEffect(() => {
    const v = control.value;
    if (!v || typeof v !== 'object') return;
    if (!deviceId || rangesDirty.current || hydratedFor.current === deviceId) return;
    hydratedFor.current = deviceId;
    setCo2Threshold(typeof v.co2ThresholdPpm === 'number' ? String(v.co2ThresholdPpm) : '');
    setTempFanOnC(typeof v.tempFanOnC === 'number' ? String(v.tempFanOnC) : '');
    setHumFanOnPct(typeof v.humFanOnPct === 'number' ? String(v.humFanOnPct) : '');
    setCo2MinPpm(typeof v.co2MinPpm === 'number' ? String(v.co2MinPpm) : '');
    setTempMinC(typeof v.tempMinC === 'number' ? String(v.tempMinC) : '');
    setHumMinPct(typeof v.humMinPct === 'number' ? String(v.humMinPct) : '');
    setIntakeFanEnabled(typeof v.intakeFanEnabled === 'boolean' ? v.intakeFanEnabled : true);
    setSprinklerEnabled(typeof v.sprinklerEnabled === 'boolean' ? v.sprinklerEnabled : true);
    setSprinklerOnHumPct(typeof v.sprinklerOnHumPct === 'number' ? String(v.sprinklerOnHumPct) : '');
    setSprinklerOffHumPct(typeof v.sprinklerOffHumPct === 'number' ? String(v.sprinklerOffHumPct) : '');
    setSprinklerMaxOnSec(typeof v.sprinklerMaxOnSec === 'number' ? String(v.sprinklerMaxOnSec) : '');
    setSprinklerMinOffSec(typeof v.sprinklerMinOffSec === 'number' ? String(v.sprinklerMinOffSec) : '');
    setHeaterEnabled(typeof v.heaterEnabled === 'boolean' ? v.heaterEnabled : true);
    setHeaterOnTempC(typeof v.heaterOnTempC === 'number' ? String(v.heaterOnTempC) : '');
    setHeaterOffTempC(typeof v.heaterOffTempC === 'number' ? String(v.heaterOffTempC) : '');
    setHeaterMaxOnSec(typeof v.heaterMaxOnSec === 'number' ? String(v.heaterMaxOnSec) : '');
    setHeaterMinOffSec(typeof v.heaterMinOffSec === 'number' ? String(v.heaterMinOffSec) : '');
  }, [control.value, deviceId]);

  const DEFAULTS = {
    co2Max: 2000, co2Min: 1000,
    tempMax: 27, tempMin: 21,
    humMax: 90, humMin: 80,
    sprinklerOn: 78, sprinklerOff: 85,
    sprinklerMaxOn: 60, sprinklerMinOff: 300,
    heaterOn: 21, heaterOff: 23,
    heaterMaxOn: 900, heaterMinOff: 60,
  };

  function numField(raw, fallback) {
    const s = String(raw ?? '').trim().replace(',', '.');
    if (!s) return fallback;
    return Number(s);
  }

  function validate() {
    const nextDeviceId = pendingDeviceId.trim();
    if (!nextDeviceId) return { ok: false, message: 'Device ID is required.' };
    const thr = numField(co2Threshold, DEFAULTS.co2Max);
    if (!Number.isFinite(thr)) return { ok: false, message: 'CO₂ max must be a number.' };
    const co2Lo = numField(co2MinPpm, DEFAULTS.co2Min);
    if (!Number.isFinite(co2Lo)) return { ok: false, message: 'CO₂ min must be a number.' };
    if (co2Lo >= thr) return { ok: false, message: 'CO₂ min must be less than CO₂ max.' };
    const tMax = numField(tempFanOnC, DEFAULTS.tempMax);
    if (!Number.isFinite(tMax)) return { ok: false, message: 'Temp max must be a number.' };
    const tLo = numField(tempMinC, DEFAULTS.tempMin);
    if (!Number.isFinite(tLo)) return { ok: false, message: 'Temp min must be a number.' };
    if (tLo >= tMax) return { ok: false, message: 'Temp min must be less than temp max.' };
    const h = numField(humFanOnPct, DEFAULTS.humMax);
    if (!Number.isFinite(h)) return { ok: false, message: 'Humidity max must be a number.' };
    const hLo = numField(humMinPct, DEFAULTS.humMin);
    if (!Number.isFinite(hLo)) return { ok: false, message: 'Humidity min must be a number.' };
    if (hLo >= h) return { ok: false, message: 'Humidity min must be less than humidity max.' };
    return { ok: true, message: '' };
  }

  const canSave = useMemo(() => validate().ok, [
    pendingDeviceId, co2Threshold, tempFanOnC, humFanOnPct, co2MinPpm, tempMinC, humMinPct,
    sprinklerOnHumPct, sprinklerOffHumPct, sprinklerMaxOnSec, sprinklerMinOffSec,
    heaterOnTempC, heaterOffTempC, heaterMaxOnSec, heaterMinOffSec,
  ]);

  async function persistSwitches(patch) {
    if (!deviceId) return;
    try {
      await apiPut(devicePath(deviceId, 'control'), patch);
      await refreshControl?.();
    } catch (e) {
      Alert.alert('Save failed', String(e?.message || e));
    }
  }

  async function putControl(id, body) {
    try {
      return await apiPut(devicePath(id, 'control'), body, { timeoutMs: 30000 });
    } catch (e) {
      const msg = String(e?.message || e);
      const base = getServerBaseUrl();
      const stale =
        /HTTP 404/i.test(msg) ||
        (base && base.includes('mushroom-nursery-server.onrender.com'));
      if (stale && base !== DEFAULT_SERVER_BASE_URL) {
        await setServerBaseUrl(DEFAULT_SERVER_BASE_URL);
        return apiPut(devicePath(id, 'control'), body, { timeoutMs: 30000 });
      }
      throw new Error(`${msg}\n(${base || 'no server URL'})`);
    }
  }

  async function save() {
    const v = validate();
    if (!v.ok) {
      Alert.alert('Invalid settings', v.message);
      return;
    }
    setSaving(true);
    try {
      const nextDeviceId = pendingDeviceId.trim();
      if (nextDeviceId !== deviceId) await setDeviceId(nextDeviceId);
      const co2Max = numField(co2Threshold, DEFAULTS.co2Max);
      const co2Lo = numField(co2MinPpm, DEFAULTS.co2Min);
      const tMax = numField(tempFanOnC, DEFAULTS.tempMax);
      const tLo = numField(tempMinC, DEFAULTS.tempMin);
      const hMax = numField(humFanOnPct, DEFAULTS.humMax);
      const hLo = numField(humMinPct, DEFAULTS.humMin);
      const saved = await putControl(nextDeviceId, {
        co2ThresholdPpm: co2Max,
        tempFanOnC: tMax,
        humFanOnPct: hMax,
        co2MinPpm: co2Lo,
        tempMinC: tLo,
        humMinPct: hLo,
        intakeFanEnabled,
        sprinklerEnabled,
        sprinklerOnHumPct: hLo,
        sprinklerOffHumPct: hLo + Math.max(2, (hMax - hLo) / 2),
        sprinklerMaxOnSec: numField(sprinklerMaxOnSec, DEFAULTS.sprinklerMaxOn),
        sprinklerMinOffSec: numField(sprinklerMinOffSec, DEFAULTS.sprinklerMinOff),
        heaterEnabled: FEATURES.heater ? heaterEnabled : false,
        heaterOnTempC: tLo,
        heaterOffTempC: tMax > tLo ? tLo + (tMax - tLo) / 2 : tLo + 1,
        heaterMaxOnSec: numField(heaterMaxOnSec, DEFAULTS.heaterMaxOn),
        heaterMinOffSec: numField(heaterMinOffSec, DEFAULTS.heaterMinOff),
        // Saving ranges means automatic control — release any leftover overrides
        // (e.g. exhaust held OFF) so the new max can actually move the relays.
        autoMode: true,
        manualOverride: false,
        manualFanOn: false,
        manualIntakeFanOverride: false,
        manualIntakeFanOn: false,
        manualSprinklerOverride: false,
        manualSprinklerOn: false,
        manualHeaterOverride: false,
        manualHeaterOn: false,
      });
      setCo2Threshold(String(co2Max));
      setCo2MinPpm(String(co2Lo));
      setTempFanOnC(String(tMax));
      setTempMinC(String(tLo));
      setHumFanOnPct(String(hMax));
      setHumMinPct(String(hLo));
      rangesDirty.current = false;
      hydratedFor.current = nextDeviceId;
      await refreshControl?.();
      const keptTemp = saved?.tempFanOnC;
      const rejected = typeof keptTemp === 'number' && keptTemp !== tMax;
      Alert.alert(
        rejected ? 'Range not kept by server' : 'Target ranges saved',
        rejected
          ? `You entered ${tLo}–${tMax} °C but the API still has ${saved.tempMinC}–${saved.tempFanOnC} °C. Deploy the latest server so any min/max is allowed, then Save again.`
          : `Automatic climate will follow ${tLo}–${tMax} °C, humidity ${hLo}–${hMax}%, CO₂ ${co2Lo}–${co2Max} ppm.`
      );
    } catch (e) {
      Alert.alert('Save failed', String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function commitServerConfig(url) {
    await serverConfig.update({ baseUrl: url, apiKey: pendingApiKey });
    Alert.alert('Connection saved', 'This phone will use the new API address. Target ranges were not changed.');
    refreshControl?.();
  }

  async function saveServerConfig() {
    const url = pendingServerUrl.trim();
    if (!url) return Alert.alert('Invalid server URL', 'URL cannot be empty.');
    if (!/^https?:\/\//i.test(url)) return Alert.alert('Invalid server URL', 'URL must start with http:// or https://');
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)) {
      return Alert.alert(
        'Use the LAN IP',
        'localhost is this phone, not your PC. Use http://192.168.x.x:3000 (the address that works in the phone browser).'
      );
    }
    setSavingServer(true);
    try {
      await pingServer(url);
      await commitServerConfig(url);
    } catch (e) {
      const message = String(e?.message || e);
      Alert.alert('Cannot reach server', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save anyway', onPress: () => commitServerConfig(url) },
      ]);
    } finally {
      setSavingServer(false);
    }
  }

  async function saveDeviceWifi() {
    const ssid = deviceSsid.trim();
    if (!ssid) return Alert.alert('Wi‑Fi name required', 'Enter the SSID the nursery should join.');
    setSavingWifi(true);
    const body = `ssid=${encodeURIComponent(ssid)}&pass=${encodeURIComponent(deviceWifiPass)}`;
    const localUrls = ['http://192.168.4.1/wifi', 'http://192.168.4.100/wifi'];
    let localOk = false;
    for (const url of localUrls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (res.ok) {
          localOk = true;
          break;
        }
      } catch {
        /* phone is not on the setup hotspot */
      }
    }
    try {
      if (derived.online) {
        const saved = await apiPut(devicePath(deviceId, 'wifi'), { ssid, password: deviceWifiPass });
        setDeviceWifiPass('');
        Alert.alert('Wi‑Fi sent', saved?.message || `The nursery will join “${ssid}”.`);
        refreshControl?.();
        return;
      }
      if (localOk) {
        setDeviceWifiPass('');
        Alert.alert(
          'Saved on the device',
          `The nursery will try to join “${ssid}”. Stay on MushroomNursery-Setup, wait 15 seconds, then reload http://192.168.4.1 — it should say Connected.`
        );
        return;
      }
      Alert.alert(
        'Device is offline',
        'Turn off mobile data. Join Wi‑Fi named MushroomNursery-Setup (not your house Wi‑Fi). Then open Chrome and go to http://192.168.4.1 — not this app. If that name is missing from Wi‑Fi list, the new firmware is not on the ESP32 yet.'
      );
    } catch (e) {
      Alert.alert('Could not update Wi‑Fi', String(e?.message || e));
    } finally {
      setSavingWifi(false);
    }
  }

  if (deviceIdLoading) {
    return (
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={palette.forestGreen} />
      </View>
    );
  }

  const tabs = [
    { id: 'ranges', label: 'Ranges' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'wifi', label: 'Wi‑Fi' },
    { id: 'phone', label: 'Phone' },
    { id: 'account', label: 'Account' },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <AppHeader title="Settings" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBarWrap}
          contentContainerStyle={styles.tabBar}
        >
          {tabs.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[
                  styles.tab,
                  {
                    backgroundColor: active ? palette.forestDeep : t.surface,
                    borderColor: active ? palette.forestDeep : t.border,
                  },
                ]}
              >
                <Text style={[styles.tabText, { color: active ? 'white' : t.sub }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: 36 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {tab === 'ranges' ? (
            <>
          <Text style={[styles.section, { color: t.text }]}>Target ranges</Text>
          <Text style={[styles.hint, { color: t.sub }]}>
            Min and max for the grow room. This is what the fans{FEATURES.heater ? ', mister, and heater' : ' and mister'} follow. Use the green button below — not Save connection.
          </Text>
          <View style={[styles.card, { backgroundColor: t.surface }, cardShadow(t.isDark)]}>
            <InfoRow icon="cloud-outline" label="CO₂" value={`${co2MinPpm || DEFAULTS.co2Min} – ${co2Threshold || DEFAULTS.co2Max} ppm`} t={t} />
            <View style={styles.row}>
              <Field label="Min" value={co2MinPpm} onChangeText={editRange(setCo2MinPpm)} placeholder="1000" keyboardType="numeric" t={t} />
              <Field label="Max" value={co2Threshold} onChangeText={editRange(setCo2Threshold)} placeholder="2000" keyboardType="numeric" t={t} />
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: t.surface }, cardShadow(t.isDark)]}>
            <InfoRow icon="water-outline" label="Humidity" value={`${humMinPct || DEFAULTS.humMin} – ${humFanOnPct || DEFAULTS.humMax} %`} t={t} />
            <View style={styles.row}>
              <Field label="Min" value={humMinPct} onChangeText={editRange(setHumMinPct)} placeholder="80" keyboardType="numeric" t={t} />
              <Field label="Max" value={humFanOnPct} onChangeText={editRange(setHumFanOnPct)} placeholder="90" keyboardType="numeric" t={t} />
            </View>
          </View>
          <View style={[styles.card, { backgroundColor: t.surface }, cardShadow(t.isDark)]}>
            <InfoRow icon="thermometer-outline" label="Temperature" value={`${tempMinC || DEFAULTS.tempMin} – ${tempFanOnC || DEFAULTS.tempMax} °C`} t={t} />
            <View style={styles.row}>
              <Field label="Min" value={tempMinC} onChangeText={editRange(setTempMinC)} placeholder="21" keyboardType="numeric" t={t} />
              <Field label="Max" value={tempFanOnC} onChangeText={editRange(setTempFanOnC)} placeholder="27" keyboardType="numeric" t={t} />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: t.surface }, cardShadow(t.isDark)]}>
            <Text style={[styles.label, { color: t.text }]}>{FEATURES.heater ? 'Mister & heater timing' : 'Mister timing'}</Text>
            <Text style={[styles.hint, { color: t.sub, marginTop: 0 }]}>Saved together with the ranges above.</Text>
            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: t.text }]}>Intake fan enabled</Text>
              <Switch
                value={intakeFanEnabled}
                onValueChange={(v) => {
                  setIntakeFanEnabled(v);
                  persistSwitches({ intakeFanEnabled: v });
                }}
                thumbColor={palette.forestGreen}
              />
            </View>
            <View style={[styles.switchRow, { marginTop: 8 }]}>
              <Text style={[styles.label, { color: t.text }]}>Mister enabled</Text>
              <Switch
                value={sprinklerEnabled}
                onValueChange={(v) => {
                  setSprinklerEnabled(v);
                  persistSwitches({ sprinklerEnabled: v });
                }}
                thumbColor={palette.forestGreen}
              />
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <Field label="Mister ON %" value={sprinklerOnHumPct} onChangeText={setSprinklerOnHumPct} placeholder="78" keyboardType="decimal-pad" t={t} />
              <Field label="Mister OFF %" value={sprinklerOffHumPct} onChangeText={setSprinklerOffHumPct} placeholder="85" keyboardType="decimal-pad" t={t} />
            </View>
            <View style={[styles.row, { marginTop: 10 }]}>
              <Field label="Max burst (s)" value={sprinklerMaxOnSec} onChangeText={setSprinklerMaxOnSec} placeholder="60" keyboardType="numeric" t={t} />
              <Field label="Cooldown (s)" value={sprinklerMinOffSec} onChangeText={setSprinklerMinOffSec} placeholder="300" keyboardType="numeric" t={t} />
            </View>
            {FEATURES.heater ? (
              <>
                <View style={[styles.switchRow, { marginTop: 14 }]}>
                  <Text style={[styles.label, { color: t.text }]}>Heater enabled</Text>
                  <Switch
                    value={heaterEnabled}
                    onValueChange={(v) => {
                      setHeaterEnabled(v);
                      persistSwitches({ heaterEnabled: v });
                    }}
                    thumbColor={palette.forestGreen}
                  />
                </View>
                <View style={[styles.row, { marginTop: 10 }]}>
                  <Field label="Heater ON °C" value={heaterOnTempC} onChangeText={setHeaterOnTempC} placeholder="21" keyboardType="decimal-pad" t={t} />
                  <Field label="Heater OFF °C" value={heaterOffTempC} onChangeText={setHeaterOffTempC} placeholder="23" keyboardType="decimal-pad" t={t} />
                </View>
                <View style={[styles.row, { marginTop: 10 }]}>
                  <Field label="Max burst (s)" value={heaterMaxOnSec} onChangeText={setHeaterMaxOnSec} placeholder="900" keyboardType="numeric" t={t} />
                  <Field label="Cooldown (s)" value={heaterMinOffSec} onChangeText={setHeaterMinOffSec} placeholder="60" keyboardType="numeric" t={t} />
                </View>
              </>
            ) : null}
          </View>

          {!canSave ? (
            <Text style={[styles.hint, { color: t.sub }]}>{validate().message}</Text>
          ) : null}
          <Pressable
            onPress={save}
            disabled={saving}
            style={[styles.saveBtn, { opacity: saving ? 0.5 : 1 }]}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving ranges…' : 'Save target ranges'}</Text>
          </Pressable>
            </>
          ) : null}

          {tab === 'alerts' ? (
            <>
          <AlertSettingsCard deviceId={deviceId} />
          <Text style={[styles.section, { color: t.text }]}>Alert history</Text>
          <View style={[styles.card, { backgroundColor: t.surface }, cardShadow(t.isDark)]}>
            <InfoRow
              icon="notifications-outline"
              label="Open in-app alert log"
              value="Open"
              t={t}
              onPress={() => navigateRoot(navigation, 'Alerts')}
            />
          </View>
            </>
          ) : null}

          {tab === 'wifi' ? (
            <>
          <Text style={[styles.section, { color: t.text }]}>Device Wi‑Fi</Text>
          <Text style={[styles.hint, { color: t.sub }]}>
            Changes the nursery ESP32 network, not this phone. First-time setup: join MushroomNursery-Setup, then open http://192.168.4.1 in Chrome.
          </Text>
          <View style={[styles.card, { backgroundColor: t.surface }, cardShadow(t.isDark)]}>
            <InfoRow
              icon="wifi-outline"
              label="Current network"
              value={
                control?.value?.wifiPending
                  ? `Switching to ${control?.value?.wifiSsid || deviceSsid}…`
                  : live?.value?.wifiSsid || derived.online
                    ? live?.value?.wifiSsid || 'Online'
                    : 'Offline'
              }
              t={t}
            />
            <Text style={[styles.help, { color: t.sub, marginTop: 8 }]}>Wi‑Fi name (SSID)</Text>
            <TextInput
              value={deviceSsid}
              onChangeText={setDeviceSsid}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Home-WiFi"
              placeholderTextColor={t.placeholder}
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
            />
            <Text style={[styles.help, { color: t.sub, marginTop: 8 }]}>Wi‑Fi password</Text>
            <TextInput
              value={deviceWifiPass}
              onChangeText={setDeviceWifiPass}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={t.placeholder}
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
            />
            <Pressable
              onPress={saveDeviceWifi}
              disabled={savingWifi}
              style={[styles.saveBtn, { marginTop: 12, opacity: savingWifi ? 0.7 : 1 }]}
            >
              <Text style={styles.saveBtnText}>{savingWifi ? 'Sending…' : 'Save device Wi‑Fi'}</Text>
            </Pressable>
          </View>
            </>
          ) : null}

          {tab === 'phone' ? (
            <>
          <Text style={[styles.section, { color: t.text }]}>Phone connection</Text>
          <Text style={[styles.hint, { color: t.sub }]}>
            Only for this phone: which nursery it talks to. This does not change temperature, humidity, or CO₂ targets.
          </Text>
          <View style={[styles.card, { backgroundColor: t.surface }, cardShadow(t.isDark)]}>
            <InfoRow icon="hardware-chip-outline" label="Device ID" value={pendingDeviceId || '—'} t={t} />
            <TextInput
              value={pendingDeviceId}
              onChangeText={setPendingDeviceId}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="nursery-01"
              placeholderTextColor={t.placeholder}
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
            />
            <InfoRow icon="wifi-outline" label="Device status" value={derived.online ? 'Online' : 'Offline'} t={t} />
            <Text style={[styles.help, { color: t.sub, marginTop: 8 }]}>API address</Text>
            <Text style={[styles.hint, { color: t.sub, marginTop: 0 }]}>
              Local server example: http://192.168.1.10:3000 — include the port. A browser can open HTTP; this app needs a rebuild to allow it.
            </Text>
            <TextInput
              value={pendingServerUrl}
              onChangeText={setPendingServerUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={DEFAULT_SERVER_BASE_URL}
              placeholderTextColor={t.placeholder}
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
            />
            <Text style={[styles.help, { color: t.sub, marginTop: 8 }]}>API key (optional)</Text>
            <TextInput
              value={pendingApiKey}
              onChangeText={setPendingApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="••••"
              placeholderTextColor={t.placeholder}
              style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]}
            />
            <Pressable
              onPress={saveServerConfig}
              style={[styles.secondaryBtn, { borderColor: t.border, opacity: savingServer ? 0.7 : 1 }]}
            >
              <Text style={[styles.secondaryBtnText, { color: t.text }]}>
                {savingServer ? 'Saving…' : 'Save connection'}
              </Text>
            </Pressable>
          </View>
            </>
          ) : null}

          {tab === 'account' ? (
            <>
          <Text style={[styles.section, { color: t.text }]}>Admin account</Text>
          <View style={[styles.card, { backgroundColor: t.surface }, cardShadow(t.isDark)]}>
            <Text style={[styles.help, { color: t.sub }]}>Username</Text>
            <TextInput value={adminUser} onChangeText={setAdminUser} autoCapitalize="none" style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]} />
            <Text style={[styles.help, { color: t.sub, marginTop: 8 }]}>Current password</Text>
            <TextInput value={currentPass} onChangeText={setCurrentPass} secureTextEntry style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]} />
            <Text style={[styles.help, { color: t.sub, marginTop: 8 }]}>New password</Text>
            <TextInput value={newPass} onChangeText={setNewPass} secureTextEntry style={[styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }]} />
            <Pressable
              onPress={async () => {
                setChangingCreds(true);
                try {
                  await changeLocalCreds({ currentPassword: currentPass, nextUsername: adminUser, nextPassword: newPass || currentPass });
                  setCurrentPass('');
                  setNewPass('');
                  Alert.alert('Saved', 'Admin username/password updated on this phone.');
                } catch (e) {
                  Alert.alert('Update failed', String(e?.message || e));
                } finally {
                  setChangingCreds(false);
                }
              }}
              style={[styles.saveBtn, { marginTop: 12, opacity: changingCreds ? 0.7 : 1 }]}
            >
              <Text style={styles.saveBtnText}>{changingCreds ? 'Saving…' : 'Save login'}</Text>
            </Pressable>
            <Pressable onPress={onSignOut} style={[styles.saveBtn, { marginTop: 10, backgroundColor: '#C45C4A' }]}>
              <Text style={styles.saveBtnText}>Sign out</Text>
            </Pressable>
          </View>
            </>
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 12 },
  tabBarWrap: { flexGrow: 0, flexShrink: 0 },
  tabBar: { paddingHorizontal: 20, paddingBottom: 10, gap: 8, alignItems: 'center' },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabText: { fontSize: 13, fontWeight: '800' },
  section: { fontSize: 18, fontWeight: '800', marginTop: 8 },
  hint: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: -4 },
  card: { borderRadius: 20, padding: 14, gap: 8 },
  label: { fontSize: 14, fontWeight: '700' },
  help: { fontSize: 12, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '600', marginTop: 4 },
  row: { flexDirection: 'row', gap: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  smallIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { flex: 1, fontSize: 14, fontWeight: '700' },
  infoValue: { fontSize: 13, fontWeight: '800', maxWidth: 160 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveBtn: { backgroundColor: palette.forestGreen, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
  secondaryBtn: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  secondaryBtnText: { fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
