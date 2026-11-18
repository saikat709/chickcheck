// Synthesized Web Audio chime for critical farm alerts without external MP3 assets

class SoundAlertManager {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("chickcheck_sound_enabled");
      this.soundEnabled = stored === "true";
    }
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (typeof window !== "undefined") {
      localStorage.setItem("chickcheck_sound_enabled", enabled ? "true" : "false");
    }
    if (enabled && !this.audioCtx && typeof window !== "undefined") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  public playCriticalChime() {
    if (!this.soundEnabled || typeof window === "undefined") return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const ctx = this.audioCtx;
      const now = ctx.currentTime;

      // Two-tone chime: High tone (880Hz) then higher tone (1175Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1175, now + 0.15);

      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.4);

      // Second secondary echo tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(1175, now + 0.2);
      osc2.frequency.exponentialRampToValueAtTime(1396, now + 0.35);

      gain2.gain.setValueAtTime(0.2, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.2);
      osc2.stop(now + 0.6);
    } catch (e) {
      console.warn("Unable to play synthesized audio chime:", e);
    }
  }
}

export const soundManager = new SoundAlertManager();
