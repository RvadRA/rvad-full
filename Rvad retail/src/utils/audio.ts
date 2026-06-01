class SoundEngine {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private voiceEnabled: boolean = true;

  constructor() {
    // Lazy initialisation of AudioContext because browsers block audio until user interaction
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('retail_sound_enabled');
      this.soundEnabled = stored !== 'false';
      const voiceStored = localStorage.getItem('retail_voice_enabled');
      this.voiceEnabled = voiceStored !== 'false';
    }
  }

  private getContext(): AudioContext | null {
    if (!this.soundEnabled) return null;
    if (typeof window === 'undefined') return null;
    
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    
    return this.ctx;
  }

  toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('retail_sound_enabled', String(this.soundEnabled));
    return this.soundEnabled;
  }

  isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  toggleVoice(): boolean {
    this.voiceEnabled = !this.voiceEnabled;
    localStorage.setItem('retail_voice_enabled', String(this.voiceEnabled));
    return this.voiceEnabled;
  }

  isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  speak(text: string) {
    if (!this.soundEnabled || !this.voiceEnabled) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
      // Cancel previous scheduled speech to avoid lag
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ru-RU';
      utterance.rate = 1.05; // slightly swift for fast POS scanning
      utterance.pitch = 1.0;
      utterance.volume = 0.6; // gentle context volume
      
      // Select appropriate Russian speaking voice
      const voices = window.speechSynthesis.getVoices();
      const ruVoice = voices.find(v => v.lang.startsWith('ru') || v.lang.includes('RU'));
      if (ruVoice) {
        utterance.voice = ruVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS narration error:", e);
    }
  }

  /**
   * Crisp register laser scanning chirp. High pitch sweeping sine wave.
   */
  playScanSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1900, ctx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  }

  /**
   * Nostalgic premium cash register bell chime with dynamic paper printer noise.
   */
  playCheckoutSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Chime Note 1: E6 Note
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    // Chime Note 2: B5 Note
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now);
    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    // Simulated thermal printer sweep (high-passed white noise envelope)
    try {
      const bufferSize = ctx.sampleRate * 0.12; 
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, now);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.02, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.13);
    } catch (e) {
      // Clean fallback if buffer creation breaks
    }

    osc1.start(now);
    osc1.stop(now + 0.55);
    osc2.start(now);
    osc2.stop(now + 0.45);
  }

  /**
   * Action warning sound (invalid scan, out of stock, failure limit)
   */
  playError() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const playBuzz = (startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, startTime);
      
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.01);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    playBuzz(now, 0.1);
    playBuzz(now + 0.13, 0.1);
  }

  /**
   * Elegant tactile key click for typing and UI buttons.
   */
  playClick() {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.015);

    gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.015);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.02);
  }

  /**
   * Ascending high melody on successful authorization/login.
   */
  playAuthSuccess() {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 Harmonic Arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + (idx * 0.06));
      
      gainNode.gain.setValueAtTime(0.0, now);
      gainNode.gain.linearRampToValueAtTime(0.08, now + (idx * 0.06) + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + (idx * 0.06) + 0.22);
      
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      osc.start(now + (idx * 0.06));
      osc.stop(now + (idx * 0.06) + 0.25);
    });
  }
}

export const soundEngine = new SoundEngine();
