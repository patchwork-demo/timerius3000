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
}

interface PresetHistory {
  recent: number[];
  freq: Record<number, number>;
}

const KEYS = {
  timers: "t3k_timers",
  settings: "t3k_settings",
  presets: "t3k_presets",
} as const;

export function loadTimers(): Timer[] {
  try {
    const raw = localStorage.getItem(KEYS.timers);
    if (!raw) return [];
    const timers: Timer[] = JSON.parse(raw);
    // Pause any timers that were running — can't tick while the tab was closed
    return timers.map((t) =>
      t.status === "running" ? { ...t, status: "paused" } : t
    );
  } catch {
    return [];
  }
}

export function saveTimers(timers: Timer[]): void {
  localStorage.setItem(KEYS.timers, JSON.stringify(timers));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEYS.settings);
    if (!raw) return { activeAudioId: null, volume: 0.7 };
    return { activeAudioId: null, volume: 0.7, ...JSON.parse(raw) };
  } catch {
    return { activeAudioId: null, volume: 0.7 };
  }
}

export function saveSettings(patch: Partial<Settings>): void {
  const current = loadSettings();
  localStorage.setItem(KEYS.settings, JSON.stringify({ ...current, ...patch }));
}

function loadPresets(): PresetHistory {
  try {
    const raw = localStorage.getItem(KEYS.presets);
    if (!raw) return { recent: [], freq: {} };
    return JSON.parse(raw);
  } catch {
    return { recent: [], freq: {} };
  }
}

function savePresets(p: PresetHistory): void {
  localStorage.setItem(KEYS.presets, JSON.stringify(p));
}

export function recordPresetUse(duration: number): void {
  const p = loadPresets();
  // recent: prepend, keep unique, cap at 3
  p.recent = [duration, ...p.recent.filter((d) => d !== duration)].slice(0, 3);
  // freq: increment
  p.freq[duration] = (p.freq[duration] ?? 0) + 1;
  savePresets(p);
}

export function getRecentPresets(): number[] {
  return loadPresets().recent;
}

export function getMostUsedPresets(): number[] {
  const { freq } = loadPresets();
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([d]) => Number(d));
}
