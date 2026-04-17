export interface Timer {
  id: string;
  label: string;
  duration: number;
  remaining: number;
  status: "idle" | "running" | "paused" | "finished";
  loop: boolean;
}

export interface Settings {
  activeAudioId: number | null;
  volume: number;
  loopCount: number;
  loopFade: boolean;
  loopGapSeconds: number;
}

const PRESET_SCHEMA_VERSION = 2 as const;

interface PresetHistoryV2 {
  version: typeof PRESET_SCHEMA_VERSION;
  recent: number[];
  /** Counts only "Add and start" from the add-timer modal (not card Start). */
  freq: Record<number, number>;
}

const KEYS = {
  timers: "t3k_timers",
  settings: "t3k_settings",
  presets: "t3k_presets",
} as const;

interface SavedTimers {
  timers: Timer[];
  savedAt: number;
}

function emptyPresets(): PresetHistoryV2 {
  return { version: PRESET_SCHEMA_VERSION, recent: [], freq: {} };
}

function loadPresets(): PresetHistoryV2 {
  try {
    const raw = localStorage.getItem(KEYS.presets);
    if (!raw) return emptyPresets();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return emptyPresets();
    const o = parsed as Record<string, unknown>;
    const recent = Array.isArray(o.recent)
      ? (o.recent as unknown[]).filter((d): d is number => typeof d === "number" && Number.isFinite(d))
      : [];

    if (o.version === PRESET_SCHEMA_VERSION && o.freq !== null && typeof o.freq === "object" && !Array.isArray(o.freq)) {
      const freq: Record<number, number> = {};
      for (const [k, v] of Object.entries(o.freq as Record<string, unknown>)) {
        const dur = Number(k);
        const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
        if (dur > 0 && n > 0) freq[dur] = n;
      }
      return { version: PRESET_SCHEMA_VERSION, recent, freq };
    }

    // Legacy: same key shape but freq counted adds — drop freq, keep recent, persist v2
    const migrated: PresetHistoryV2 = { version: PRESET_SCHEMA_VERSION, recent, freq: {} };
    savePresets(migrated);
    return migrated;
  } catch {
    return emptyPresets();
  }
}

function savePresets(p: PresetHistoryV2): void {
  localStorage.setItem(KEYS.presets, JSON.stringify(p));
}

/** Last 3 unique durations committed from the add-timer modal (newest = first = left in UI). */
export function recordRecentPresetDuration(duration: number): void {
  const p = loadPresets();
  p.recent = [duration, ...p.recent.filter((d) => d !== duration)].slice(0, 3);
  savePresets(p);
}

/** Increment popular (modal "Add and start" only). */
export function recordModalTimerStart(duration: number): void {
  const p = loadPresets();
  p.freq[duration] = (p.freq[duration] ?? 0) + 1;
  savePresets(p);
}

export function getRecentPresets(): number[] {
  return loadPresets().recent;
}

const POPULAR_LIMIT = 6;

export function getMostUsedPresets(): number[] {
  const { freq } = loadPresets();
  return Object.entries(freq)
    .sort(([da, a], [db, b]) => {
      if (b !== a) return b - a;
      return Number(db) - Number(da);
    })
    .slice(0, POPULAR_LIMIT)
    .map(([d]) => Number(d));
}

function applyElapsed(timer: Timer, elapsed: number): Timer {
  if (elapsed <= 0 || timer.status !== "running") return timer;

  if (elapsed < timer.remaining) {
    return { ...timer, remaining: timer.remaining - elapsed };
  }

  // Timer expired during downtime
  if (timer.loop) {
    const pastFirst = elapsed - timer.remaining;
    const posInCycle = pastFirst % timer.duration;
    return { ...timer, remaining: timer.duration - posInCycle };
  }

  return { ...timer, remaining: 0, status: "finished" };
}

export function loadTimers(): Timer[] {
  try {
    const raw = localStorage.getItem(KEYS.timers);
    if (!raw) return [];
    const saved: SavedTimers = JSON.parse(raw);
    // Support old format (plain array)
    const timers: Timer[] = Array.isArray(saved) ? saved : saved.timers;
    const elapsed = Array.isArray(saved)
      ? 0
      : Math.floor((Date.now() - saved.savedAt) / 1000);
    return timers.map((t) => applyElapsed(t, elapsed));
  } catch {
    return [];
  }
}

export function saveTimers(timers: Timer[]): void {
  const payload: SavedTimers = { timers, savedAt: Date.now() };
  localStorage.setItem(KEYS.timers, JSON.stringify(payload));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    const defaults: Settings = { activeAudioId: null, volume: 0.7, loopCount: 1, loopFade: false, loopGapSeconds: 0 };
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { activeAudioId: null, volume: 0.7, loopCount: 1, loopFade: false, loopGapSeconds: 0 };
  }
}

export function saveSettings(patch: Partial<Settings>): void {
  const current = loadSettings();
  localStorage.setItem(KEYS.settings, JSON.stringify({ ...current, ...patch }));
}
