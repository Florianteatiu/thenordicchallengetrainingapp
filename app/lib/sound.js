let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// Call from a user tap so iOS allows sound later on.
export function unlockAudio() {
  audio();
}

export function beep({ freq = 880, duration = 0.12, volume = 0.25 } = {}) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.frequency.value = freq;
  osc.type = "sine";
  gain.gain.setValueAtTime(volume, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + duration);
}

export function tick() {
  beep({ freq: 660, duration: 0.1 });
}

export function go() {
  beep({ freq: 1175, duration: 0.35, volume: 0.3 });
}

export function vibrate(pattern = [180, 80, 180]) {
  navigator.vibrate?.(pattern);
}

// Keeps the phone screen on while a timer runs (where supported).
export async function keepAwake() {
  try {
    return await navigator.wakeLock?.request("screen");
  } catch {
    return null;
  }
}
