// Sound, synthesised, no assets: a few oscillator blips through the Web Audio API.
// The context is created on the first user gesture, so the game never plays before
// the player touches it, and the screenshot scenes stay silent.
export function createAudio() {
  let context = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, start, duration, type, volume) {
    const ctx = ensure();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0, ctx.currentTime + start);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.05);
  }

  return {
    /** Call from any user gesture so the context is allowed to start. */
    unlock() {
      ensure();
    },
    pickup() {
      tone(880, 0, 0.12, 'sine', 0.18);
      tone(1318, 0.07, 0.16, 'sine', 0.15);
    },
    star() {
      tone(523, 0, 0.14, 'triangle', 0.2);
      tone(659, 0.1, 0.14, 'triangle', 0.2);
      tone(784, 0.2, 0.2, 'triangle', 0.2);
      tone(1046, 0.3, 0.3, 'triangle', 0.18);
    },
    coin() {
      tone(1567, 0, 0.1, 'sine', 0.14);
    },
    smoke() {
      tone(220, 0, 0.35, 'sawtooth', 0.06);
      tone(165, 0.1, 0.35, 'sawtooth', 0.05);
    },
    hack() {
      tone(440, 0, 0.08, 'square', 0.08);
      tone(660, 0.09, 0.08, 'square', 0.08);
      tone(880, 0.18, 0.14, 'square', 0.08);
    },
    alarm() {
      tone(620, 0, 0.16, 'square', 0.07);
    },
    caught() {
      tone(392, 0, 0.2, 'sawtooth', 0.14);
      tone(311, 0.18, 0.2, 'sawtooth', 0.14);
      tone(233, 0.36, 0.45, 'sawtooth', 0.14);
    },
    win() {
      tone(523, 0, 0.16, 'triangle', 0.18);
      tone(659, 0.12, 0.16, 'triangle', 0.18);
      tone(784, 0.24, 0.16, 'triangle', 0.18);
      tone(1046, 0.36, 0.4, 'triangle', 0.18);
    },
  };
}
