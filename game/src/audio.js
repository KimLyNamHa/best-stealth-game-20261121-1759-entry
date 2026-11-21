// Wren — Night Courier: all sound is made on the spot with WebAudio — small
// oscillator bleeps, no audio files. The context is created on the first user
// gesture, so the game never plays sound before the player starts it.

export function createAudio() {
  let context = null;
  let muted = false;

  function ensure() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    }
    if (context.state === 'suspended') context.resume();
    return context;
  }

  function tone(freq, seconds, type, gain, when = 0) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, ac.currentTime + when);
    amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + when + seconds);
    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start(ac.currentTime + when);
    osc.stop(ac.currentTime + when + seconds + 0.02);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    step(soft) {
      tone(soft ? 180 : 120, 0.05, 'sine', soft ? 0.03 : 0.06);
    },
    pickup() {
      tone(880, 0.12, 'sine', 0.12);
      tone(1318, 0.18, 'sine', 0.10, 0.08);
    },
    suspicious() {
      tone(440, 0.15, 'triangle', 0.10);
      tone(466, 0.15, 'triangle', 0.10, 0.12);
    },
    alert() {
      tone(330, 0.12, 'sawtooth', 0.08);
      tone(494, 0.12, 'sawtooth', 0.08, 0.10);
      tone(659, 0.2, 'sawtooth', 0.08, 0.20);
    },
    bark() {
      tone(220, 0.07, 'square', 0.10);
      tone(220, 0.07, 'square', 0.10, 0.12);
    },
    heard() {
      tone(520, 0.08, 'triangle', 0.07);
    },
    caught() {
      tone(196, 0.25, 'sawtooth', 0.12);
      tone(147, 0.4, 'sawtooth', 0.12, 0.18);
    },
    win() {
      tone(523, 0.15, 'sine', 0.12);
      tone(659, 0.15, 'sine', 0.12, 0.12);
      tone(784, 0.3, 'sine', 0.12, 0.24);
    },
  };
}
