// No samples, fonts, or remote assets. All sound is synthesized after a user gesture.
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private voices: GainNode[] = [];
  private noise: AudioBuffer | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private lastBlast = 0;
  enabled = false;
  foreground = true;
  masterVolume = 0.4;
  musicVolume = 0.15;
  sfxVolume = 0.5;
  async start() {
    if (!this.context) {
      const c = new AudioContext();
      this.context = c;
      this.master = c.createGain();
      this.sfx = c.createGain();
      this.music = c.createGain();
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -12;
      limiter.knee.value = 12;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      this.sfx.connect(this.master);
      this.music.connect(this.master);
      this.master.connect(limiter);
      limiter.connect(c.destination);
      const noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
        data = noise.getChannelData(0);
      let seed = 17;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = seed / 2147483648 - 1;
      }
      this.noise = noise;
      for (const [index, freq] of [1500, 350, 6500, 2400].entries()) {
        const source = c.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        const filter = c.createBiquadFilter();
        filter.type = index === 2 ? 'highpass' : 'bandpass';
        filter.frequency.value = freq;
        filter.Q.value = 0.6;
        const gain = c.createGain();
        gain.gain.value = 0;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfx);
        source.start();
        this.sources.push(source);
        this.voices.push(gain);
      }
      for (const [i, freq] of [110, 164.81, 220, 293.66].entries()) {
        const oscillator = c.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        const gain = c.createGain();
        gain.gain.value = 0.035;
        const lfo = c.createOscillator(),
          depth = c.createGain();
        lfo.frequency.value = 0.017 + i * 0.009;
        depth.gain.value = 0.02;
        lfo.connect(depth);
        depth.connect(gain.gain);
        oscillator.connect(gain);
        gain.connect(this.music);
        oscillator.start();
        lfo.start();
        this.sources.push(oscillator, lfo);
      }
    }
    this.enabled = true;
    await this.context.resume();
    this.updateVolumes();
  }
  updateVolumes() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.master?.gain.setTargetAtTime(
      this.enabled && this.foreground ? this.masterVolume : 0,
      now,
      0.1,
    );
    this.sfx?.gain.setTargetAtTime(this.sfxVolume, now, 0.1);
    this.music?.gain.setTargetAtTime(this.musicVolume, now, 0.1);
  }
  stop() {
    this.enabled = false;
    this.updateVolumes();
  }
  activity(levels: readonly number[]) {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime;
    this.voices.forEach((gain, i) =>
      gain.gain.setTargetAtTime(Math.min(0.12, Math.sqrt(levels[i] ?? 0) * 0.025), now, 0.12),
    );
    if ((levels[2] ?? 0) > 0.3 && now - this.lastBlast > 0.35) {
      this.lastBlast = now;
      const source = this.context.createBufferSource();
      source.buffer = this.noise;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 180;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfx!);
      source.start();
      source.stop(now + 0.7);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    }
  }
  click() {
    if (!this.context || !this.enabled) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.frequency.value = 580;
    g.gain.setValueAtTime(0.025, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.045);
    o.connect(g);
    g.connect(this.sfx!);
    o.start();
    o.stop(c.currentTime + 0.05);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  get state() {
    return this.context?.state ?? 'uninitialized';
  }
  dispose() {
    for (const source of this.sources) source.stop();
    this.sources = [];
    void this.context?.close();
    this.context = null;
  }
}
