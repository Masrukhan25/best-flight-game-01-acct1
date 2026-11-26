// Island Courier — tiny synthesised sound. No audio files, no network: a
// sawtooth engine hum through a low-pass filter, a blip for rings, a thud
// for touchdowns and noise for a crash. Everything is guarded, and the audio
// context only starts after a real user gesture.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
    } catch {
      ctx = null;
    }
  }

  function setEngine(throttle, flying) {
    if (!ctx || !engineGain || muted) return;
    const t = ctx.currentTime;
    engineGain.gain.setTargetAtTime(flying ? 0.02 + throttle * 0.035 : 0, t, 0.1);
    engineOsc.frequency.setTargetAtTime(55 + throttle * 85, t, 0.1);
  }

  function blip(freq = 880, dur = 0.12) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Silence is fine; never let sound break the game.
    }
  }

  function noiseBurst(dur, volume) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch {
      // Silence is fine.
    }
  }

  function thud() {
    noiseBurst(0.2, 0.25);
  }

  // Cannon shot: a short descending zap.
  function pew() {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.09);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      // Silence is fine.
    }
  }

  // Explosion: a long low noise burst plus a sine that drops from a thump
  // to a sub-bass rumble.
  function boom() {
    if (!ctx || muted) return;
    try {
      noiseBurst(0.9, 0.5);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.7);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.75);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // Silence is fine.
    }
  }

  function crash() {
    noiseBurst(0.6, 0.4);
    blip(90, 0.4);
  }

  function toggleMute() {
    muted = !muted;
    if (engineGain) engineGain.gain.value = 0;
    return muted;
  }

  return { ensure, setEngine, blip, thud, crash, pew, boom, toggleMute };
}
