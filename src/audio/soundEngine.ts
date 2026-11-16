// Procedural Web Audio API Sound Engine & Background Music Synthesizer

class SoundEngine {
  private ctx: AudioContext | null = null;
  public musicEnabled: boolean = true;
  public sfxEnabled: boolean = true;
  private musicInterval: number | null = null;
  private isPlayingMusic: boolean = false;
  private stepIndex: number = 0;

  // Authentic recorded golf audio sample buffers
  private samples: Record<string, AudioBuffer | null> = {
    soft: null,
    medium: null,
    hard: null,
    metal: null,
    bounce: null,
  };
  private loadingSamples: boolean = false;

  constructor() {
    // Load saved settings if available
    try {
      const savedMusic = localStorage.getItem('minigolf_music');
      const savedSfx = localStorage.getItem('minigolf_sfx');
      if (savedMusic !== null) this.musicEnabled = JSON.parse(savedMusic);
      if (savedSfx !== null) this.sfxEnabled = JSON.parse(savedSfx);
    } catch {
      // ignore storage errors
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private async loadBuffer(url: string, ctx: AudioContext): Promise<AudioBuffer | null> {
    try {
      const resp = await fetch(url);
      if (!resp.ok) return null;
      const arrayBuf = await resp.arrayBuffer();
      return await new Promise<AudioBuffer>((resolve, reject) => {
        ctx.decodeAudioData(arrayBuf, resolve, reject);
      });
    } catch {
      return null;
    }
  }

  public preloadSamples() {
    if (this.loadingSamples) return;
    this.loadingSamples = true;
    const ctx = this.ensureContext();
    if (!ctx) {
      this.loadingSamples = false;
      return;
    }

    Promise.all([
      this.loadBuffer('/assets/audio/putt_soft.wav', ctx),
      this.loadBuffer('/assets/audio/putt_medium.wav', ctx),
      this.loadBuffer('/assets/audio/putt_hard.wav', ctx),
      this.loadBuffer('/assets/audio/putt_metal.wav', ctx),
      this.loadBuffer('/assets/audio/ball_bounce.wav', ctx),
    ]).then(([soft, medium, hard, metal, bounce]) => {
      this.samples.soft = soft;
      this.samples.medium = medium;
      this.samples.hard = hard;
      this.samples.metal = metal;
      this.samples.bounce = bounce;
    }).catch(() => {
      this.loadingSamples = false;
    });
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    try {
      localStorage.setItem('minigolf_music', JSON.stringify(enabled));
    } catch {}
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  }

  public setSfxEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
    try {
      localStorage.setItem('minigolf_sfx', JSON.stringify(enabled));
    } catch {}
  }

  public startMusic() {
    if (!this.musicEnabled || this.isPlayingMusic) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.isPlayingMusic = true;
    // Cheerful sunny meadow marimba progression (C major / G major / F major pentatonic)
    const melodyNotes = [
      523.25, 659.25, 783.99, 659.25, 880.0, 783.99, 659.25, 587.33,
      523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 392.0,
      440.0, 523.25, 659.25, 880.0, 783.99, 659.25, 523.25, 587.33,
      659.25, 783.99, 880.0, 1046.5, 783.99, 659.25, 587.33, 523.25,
    ];
    const bassNotes = [
      261.63, 261.63, 196.0, 196.0, 220.0, 220.0, 174.61, 196.0,
    ];

    this.musicInterval = window.setInterval(() => {
      if (!this.musicEnabled || !this.ctx || this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const noteFreq = melodyNotes[this.stepIndex % melodyNotes.length];

      // Play soft marimba note on most beats
      if (this.stepIndex % 2 === 0 || this.stepIndex % 7 === 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(noteFreq, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.032, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.34);
      }

      // Soft warm bass on every 4th step
      if (this.stepIndex % 4 === 0) {
        const bassFreq = bassNotes[Math.floor(this.stepIndex / 4) % bassNotes.length];
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(bassFreq, now);

        bGain.gain.setValueAtTime(0.001, now);
        bGain.gain.linearRampToValueAtTime(0.025, now + 0.03);
        bGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.55);

        bOsc.connect(bGain);
        bGain.connect(this.ctx.destination);
        bOsc.start(now);
        bOsc.stop(now + 0.58);
      }

      this.stepIndex++;
    }, 240);
  }

  public stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicInterval !== null) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  public playClick() {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.06);
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playPutt(powerRatio: number) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const clamped = Math.max(0.08, Math.min(1, powerRatio));

    // Choose primary sample based on strike power
    let buffer: AudioBuffer | null = null;
    if (clamped < 0.38) {
      buffer = this.samples.soft || this.samples.medium;
    } else if (clamped < 0.72) {
      buffer = this.samples.medium || this.samples.hard;
    } else {
      buffer = this.samples.hard || this.samples.medium;
    }

    if (buffer) {
      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      // Authentic dynamic pitch modulation based on stroke power (0.95 to 1.06)
      source.playbackRate.setValueAtTime(0.95 + clamped * 0.11, now);

      const gain = ctx.createGain();
      // Balanced, punchy volume scaled with strike power
      const vol = 0.50 + clamped * 0.50;
      gain.gain.setValueAtTime(vol, now);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);

      // On powerful drives (> 0.60), layer a subtle metallic ping from the club face
      if (clamped > 0.60 && this.samples.metal) {
        const metalSource = ctx.createBufferSource();
        metalSource.buffer = this.samples.metal;
        metalSource.playbackRate.setValueAtTime(0.98 + (clamped - 0.60) * 0.15, now);
        const metalGain = ctx.createGain();
        metalGain.gain.setValueAtTime(0.24 * clamped, now);
        metalSource.connect(metalGain);
        metalGain.connect(ctx.destination);
        metalSource.start(now);
      }
      return;
    }

    // Procedural fallback if audio files are still loading or offline
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + clamped * 140, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);

    gain.gain.setValueAtTime(0.18 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  public playWallBounce(intensity: number = 0.6) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.samples.bounce) {
      const now = ctx.currentTime;
      const source = ctx.createBufferSource();
      source.buffer = this.samples.bounce;
      const normalizedIntensity = Math.max(0.1, Math.min(1, intensity));
      source.playbackRate.setValueAtTime(0.94 + normalizedIntensity * 0.12, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.25 + normalizedIntensity * 0.45, now);

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(now);
      return;
    }

    // Procedural fallback
    const now = ctx.currentTime;
    const vol = Math.max(0.05, Math.min(1, intensity)) * 0.14;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.065);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playBumperBounce() {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.11);

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playHoleSink() {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Cup rattle (3 quick woody pops) + celebratory ascending chime
    [0, 0.06, 0.11].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280 + idx * 90, now + offset);
      osc.frequency.exponentialRampToValueAtTime(140 + idx * 40, now + offset + 0.05);
      gain.gain.setValueAtTime(0.14, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.06);
    });

    // Victory fanfare notes
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const t = now + 0.18 + i * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  public playStarPop(starIndex: number) {
    if (!this.sfxEnabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Ascending magical crystal bell notes for Star 1, Star 2, Star 3
    const baseFreqs = [587.33, 739.99, 880.0]; // D5, F#5, A5
    const shimmerFreqs = [1174.66, 1479.98, 1760.0]; // D6, F#6, A6
    const idx = Math.max(0, Math.min(2, starIndex));

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(baseFreqs[idx] * 0.85, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreqs[idx], now + 0.045);
    gain1.gain.setValueAtTime(0.16, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // High crystal sparkle overtone
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(shimmerFreqs[idx], now + 0.03);
    osc2.frequency.exponentialRampToValueAtTime(shimmerFreqs[idx] * 1.06, now + 0.28);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.linearRampToValueAtTime(0.1, now + 0.04);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.03);
    osc2.stop(now + 0.36);
  }
}

export const soundEngine = new SoundEngine();
