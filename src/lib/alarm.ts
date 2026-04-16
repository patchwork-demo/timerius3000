import { getAudio } from "./db";
import { loadSettings } from "./storage";

function scheduleFallbackBeeps(
  ctx: AudioContext,
  count: number,
  volume: number,
  loopFade: boolean,
  gapSeconds: number,
): void {
  const beepDur = 0.6;
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
    osc.start(when);
    osc.stop(when + beepDur);
  }
}

export async function playAlarm(): Promise<void> {
  const settings = loadSettings();
  const volume = settings.volume ?? 0.7;
  const count = Math.max(1, settings.loopCount ?? 1);
  const loopFade = settings.loopFade ?? false;
  const gapSeconds = settings.loopGapSeconds ?? 0;

  const ctx = new AudioContext();

  if (settings.activeAudioId === null) {
    scheduleFallbackBeeps(ctx, count, volume, loopFade, gapSeconds);
    return;
  }

  try {
    const entry = await getAudio(settings.activeAudioId);
    if (!entry) {
      scheduleFallbackBeeps(ctx, count, volume, loopFade, gapSeconds);
      return;
    }

    const arrayBuf = await entry.blob.arrayBuffer();
    const audioBuf = await ctx.decodeAudioData(arrayBuf);

    const snippetStart = entry.snippetStart ?? 0;
    const snippetEnd = entry.snippetEnd ?? audioBuf.duration;
    const snippetDuration = Math.max(0.1, snippetEnd - snippetStart);

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
      source.start(when, snippetStart, snippetDuration);
    }
  } catch {
    scheduleFallbackBeeps(ctx, count, volume, loopFade, gapSeconds);
  }
}
