import { getAudio } from "./db";
import { loadSettings } from "./storage";

let currentCtx: AudioContext | null = null;
/** Resolves the promise returned by the in-flight `playAlarm()` (natural end or `stopAlarm()`). */
let settlePlaybackPromise: (() => void) | null = null;

function notifyPlaybackFinished(): void {
  settlePlaybackPromise?.();
  settlePlaybackPromise = null;
}

export function stopAlarm(): void {
  if (currentCtx) {
    currentCtx.close();
    currentCtx = null;
  }
  notifyPlaybackFinished();
}

function scheduleFallbackBeeps(
  ctx: AudioContext,
  count: number,
  volume: number,
  loopFade: boolean,
  gapSeconds: number,
): Promise<void> {
  const beepDur = 0.6;
  const done: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    const loopVol =
      loopFade && count > 1 ? volume * (1 - 0.5 * (i / (count - 1))) : volume;
    const when = ctx.currentTime + i * (beepDur + gapSeconds);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = loopVol;
    osc.connect(gain);
    gain.connect(ctx.destination);
    done.push(
      new Promise<void>((resolve) => {
        osc.onended = () => resolve();
      }),
    );
    osc.start(when);
    osc.stop(when + beepDur);
  }
  return Promise.all(done).then(() => void 0);
}

export async function playAlarm(): Promise<void> {
  stopAlarm();

  const playbackFinished = new Promise<void>((resolve) => {
    settlePlaybackPromise = resolve;
  });

  const settings = loadSettings();
  const volume = settings.volume ?? 0.7;
  const count = Math.max(1, settings.loopCount ?? 1);
  const loopFade = settings.loopFade ?? false;
  const gapSeconds = settings.loopGapSeconds ?? 0;

  const ctx = new AudioContext();
  currentCtx = ctx;

  try {
    if (settings.activeAudioId === null) {
      await scheduleFallbackBeeps(ctx, count, volume, loopFade, gapSeconds);
      return;
    }

    try {
      const entry = await getAudio(settings.activeAudioId);
      if (!entry) {
        await scheduleFallbackBeeps(ctx, count, volume, loopFade, gapSeconds);
        return;
      }

      const arrayBuf = await entry.blob.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);

      const snippetStart = entry.snippetStart ?? 0;
      const snippetEnd = entry.snippetEnd ?? audioBuf.duration;
      const snippetDuration = Math.max(0.1, snippetEnd - snippetStart);

      const ended: Promise<void>[] = [];
      for (let i = 0; i < count; i++) {
        const loopVol =
          loopFade && count > 1 ? volume * (1 - 0.5 * (i / (count - 1))) : volume;
        const when = ctx.currentTime + i * (snippetDuration + gapSeconds);
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = audioBuf;
        gain.gain.value = loopVol;
        source.connect(gain);
        gain.connect(ctx.destination);
        ended.push(
          new Promise<void>((resolve) => {
            source.onended = () => resolve();
          }),
        );
        source.start(when, snippetStart, snippetDuration);
      }
      await Promise.all(ended);
    } catch {
      await scheduleFallbackBeeps(ctx, count, volume, loopFade, gapSeconds);
    }
  } finally {
    notifyPlaybackFinished();
  }

  await playbackFinished;
}
