import type { Game } from "../../game/types";
import { CueTracker, MusicDirector, type Cue } from "./director";
import {
  MOODS,
  ambientPhrase,
  type Mood,
  type Phrase,
  type Note,
} from "./music";

export type AudioSettings = {
  effects: boolean;
  music: boolean;
  ai: boolean;
  effectsVolume: number;
  musicVolume: number;
};
const DEFAULTS: AudioSettings = {
  effects: true,
  music: true,
  ai: true,
  effectsVolume: 0.65,
  musicVolume: 0.3,
};
const SAMPLES = [
  "dice-throw-1",
  "dice-throw-2",
  "card-slide-1",
  "chips-stack-1",
  "impactWood_light_000",
  "impactWood_light_001",
  "impactWood_medium_000",
  "impactSoft_medium_000",
  "impactMetal_medium_000",
  "handleCoins",
  "handleCoins2",
  "cloth1",
];
const midi = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12);

export class GameAudio extends EventTarget {
  settings: AudioSettings;
  enabled = false;
  readonly director = new MusicDirector();
  modelStatus: "off" | "loading" | "ready" | "failed" = "off";
  playingAI = false;
  generated = 0;
  generationMs = 0;
  samplesLoaded = 0;
  audioError = false;
  private context?: AudioContext;
  private master?: GainNode;
  private effectsBus?: GainNode;
  private musicBus?: GainNode;
  private duckBus?: GainNode;
  private buffers = new Map<string, AudioBuffer>();
  private loading?: Promise<void>;
  private tracker = new CueTracker();
  private game: Game | null = null;
  private gameId = "";
  private worker?: Worker;
  private timeout?: ReturnType<typeof setTimeout>;
  private timer?: ReturnType<typeof setInterval>;
  private pending = false;
  private requestId = 0;
  private readyPhrase?: Phrase;
  private phrase?: Phrase;
  private nextBar = 0;
  private bar = 0;
  private mood?: Mood;
  private cueTimes = new Map<Cue, number>();
  private sources = new Set<AudioScheduledSourceNode>();
  private preview?: { mood: Mood; until: number };
  private channel?: BroadcastChannel;
  private autoStart: boolean;

  constructor(private profile: "phone" | "desktop" | "tv") {
    super();
    this.settings = { ...DEFAULTS };
    this.autoStart = profile !== "phone";
    try {
      const saved = localStorage.getItem(`estate-audio-power-${profile}`);
      if (saved !== null) this.autoStart = saved === "on";
    } catch {}
    try {
      const saved = JSON.parse(
        localStorage.getItem(`estate-audio-${profile}`) || "{}",
      );
      for (const key of ["effects", "music", "ai"] as const)
        if (typeof saved[key] === "boolean") this.settings[key] = saved[key];
      for (const key of ["effectsVolume", "musicVolume"] as const)
        if (typeof saved[key] === "number" && Number.isFinite(saved[key]))
          this.settings[key] = Math.max(0, Math.min(1, saved[key]));
    } catch {
      /* A private browser can still play without saving preferences. */
    }
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("estate-audio-owner");
      this.channel.onmessage = () => {
        if (this.enabled) this.disable(false);
      };
    }
    document.addEventListener("visibilitychange", this.visibility);
    // A back/forward-cache restore reuses this instance; keep it resumable.
    window.addEventListener("pagehide", this.pageHide);
    document.addEventListener("pointerdown", this.firstInteraction);
    document.addEventListener("keydown", this.firstInteraction);
  }
  private firstInteraction = (event: Event) => {
    if (!this.autoStart || this.enabled || document.hidden) return;
    if ((event.target as Element | null)?.closest?.('[data-audio="power"]'))
      return;
    this.autoStart = false;
    void this.enable();
  };
  private pageHide = () => this.disable(false);
  private rememberPower(on: boolean) {
    this.autoStart = on;
    try {
      localStorage.setItem(
        `estate-audio-power-${this.profile}`,
        on ? "on" : "off",
      );
    } catch {}
  }
  private changed() {
    this.dispatchEvent(new Event("change"));
  }
  get waitingForGesture() {
    return this.autoStart && !this.enabled;
  }
  get active() {
    return (
      this.enabled && !document.hidden && this.context?.state === "running"
    );
  }
  get contextState() {
    return this.context?.state || "not-started";
  }
  get previewing() {
    return !!this.preview;
  }
  get currentMood() {
    return this.preview?.mood || this.director.current.mood;
  }
  private visibility = () => {
    if (document.hidden) {
      this.stopSounds();
      void this.context?.suspend();
    } else if (this.enabled) {
      this.nextBar = 0;
      void this.context
        ?.resume()
        .then(() => this.changed())
        .catch(() => this.changed());
    }
    this.changed();
  };

  async enable() {
    this.channel?.postMessage("claim");
    this.audioError = false;
    try {
      if (!this.context || this.context.state === "closed") {
        const ctx = (this.context = new AudioContext({
          latencyHint: "interactive",
        }));
        this.master = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 18;
        limiter.ratio.value = 5;
        this.master.gain.value = 0.8;
        this.master.connect(limiter);
        limiter.connect(ctx.destination);
        this.effectsBus = ctx.createGain();
        this.effectsBus.connect(this.master);
        this.musicBus = ctx.createGain();
        this.duckBus = ctx.createGain();
        this.musicBus.connect(this.duckBus);
        this.duckBus.connect(this.master);
        ctx.onstatechange = () => this.changed();
      }
      // resume is invoked synchronously inside the user's click gesture.
      await this.context.resume();
      this.enabled = true;
      this.rememberPower(true);
      this.applyGains();
      this.nextBar = 0;
      this.loading ||= this.loadSamples();
      this.timer ||= setInterval(() => this.tick(), 80);
      this.startModel();
      this.tick();
    } catch {
      this.audioError = true;
      this.enabled = false;
    }
    this.changed();
  }
  disable(remember = true) {
    this.autoStart = false;
    if (remember) this.rememberPower(false);
    this.enabled = false;
    this.stopSounds();
    if (this.context) void this.context.suspend();
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.stopModel();
    this.changed();
  }
  set<K extends keyof AudioSettings>(key: K, value: AudioSettings[K]) {
    this.settings[key] = value;
    try {
      localStorage.setItem(
        `estate-audio-${this.profile}`,
        JSON.stringify(this.settings),
      );
    } catch {}
    this.applyGains();
    if (key === "ai" || key === "music") {
      this.stopModel();
      this.phrase = undefined;
      this.readyPhrase = undefined;
      this.playingAI = false;
      this.startModel();
    }
    this.changed();
  }
  private applyGains() {
    if (!this.context) return;
    const t = this.context.currentTime;
    this.effectsBus!.gain.setTargetAtTime(
      this.settings.effects ? this.settings.effectsVolume : 0,
      t,
      0.03,
    );
    this.musicBus!.gain.setTargetAtTime(
      this.settings.music ? this.settings.musicVolume : 0,
      t,
      0.15,
    );
  }
  private async loadSamples() {
    await Promise.allSettled(
      SAMPLES.map(async (name) => {
        const response = await fetch(`/audio/${name}.wav`);
        if (!response.ok) throw new Error("Missing sound");
        const buffer = await this.context!.decodeAudioData(
          await response.arrayBuffer(),
        );
        this.buffers.set(name, buffer);
        this.samplesLoaded++;
        this.changed();
      }),
    );
    this.changed();
  }

  reconnect() {
    this.tracker.reset();
  }
  update(game: Game | null) {
    if ((game?.id || "") !== this.gameId) {
      this.gameId = game?.id || "";
      this.director.reset();
      this.preview = undefined;
    }
    this.game = game;
    this.director.update(game, performance.now());
    const cues = this.tracker.ingest(game); // Always advance, even when muted.
    for (const cue of cues) this.cue(cue);
    this.changed();
  }
  previewMood(mood: Mood) {
    this.preview = { mood, until: performance.now() + 25_000 };
    this.nextBar = this.context ? this.context.currentTime + 0.1 : 0;
    // Existing notes finish naturally. The next bar introduces the new harmony.
    this.nextBar = Math.max(this.nextBar, this.lastScheduledEnd);
    this.changed();
  }
  endPreview() {
    this.preview = undefined;
    this.changed();
  }

  private sample(name: string, time: number, gain: number, rate = 1) {
    const buffer = this.buffers.get(name);
    if (!buffer || !this.context) return false;
    const source = this.context.createBufferSource(),
      volume = this.context.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    volume.gain.value = gain;
    source.connect(volume);
    volume.connect(this.effectsBus!);
    source.start(time);
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      volume.disconnect();
    };
    return true;
  }
  private tone(
    pitch: number,
    time: number,
    duration: number,
    gain: number,
    bus: AudioNode,
    type: OscillatorType = "sine",
    attack = 0.012,
  ) {
    const ctx = this.context!,
      oscillator = ctx.createOscillator(),
      envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = midi(pitch);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + attack);
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      time + Math.max(attack + 0.02, duration),
    );
    oscillator.connect(envelope);
    envelope.connect(bus);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.05);
    this.sources.add(oscillator);
    oscillator.onended = () => {
      this.sources.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
  private stopSounds() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {}
    }
    this.sources.clear();
    this.nextBar = 0;
    this.lastScheduledEnd = 0;
    this.bar = 0;
    this.cueTimes.clear();
  }
  private chime(notes: number[], time: number, gain = 0.12) {
    notes.forEach((n, i) =>
      this.tone(n, time + i * 0.12, 0.6, gain, this.effectsBus!),
    );
  }
  private duck(time: number, length = 0.7) {
    const gain = this.duckBus!.gain;
    gain.cancelScheduledValues(time);
    gain.setTargetAtTime(0.4, time, 0.025);
    gain.setTargetAtTime(1, time + length, 0.3);
  }
  cue(cue: Cue, preview = false) {
    if (
      !this.active ||
      !this.settings.effects ||
      this.settings.effectsVolume <= 0
    )
      return;
    const ctx = this.context!,
      time = ctx.currentTime + 0.015,
      last = this.cueTimes.get(cue) ?? -Infinity;
    if (time - last < (cue === "step" ? 0.09 : preview ? 0.2 : 0.4)) return;
    this.cueTimes.set(cue, time);
    const variation = 1 + (Math.random() - 0.5) * 0.09;
    const play = (name: string, gain = 0.6, offset = 0) =>
      this.sample(name, time + offset, gain, variation);
    switch (cue) {
      case "step":
        if (
          !play(
            Math.random() < 0.5
              ? "impactWood_light_000"
              : "impactWood_light_001",
            0.35,
          )
        )
          this.chime([67], time, 0.05);
        // A quick upward pluck makes each tabletop landing feel buoyant.
        this.tone(79, time, 0.09, 0.025, this.effectsBus!);
        break;
      case "dice":
        if (!play(Math.random() < 0.5 ? "dice-throw-1" : "dice-throw-2", 0.8))
          this.chime([55, 60, 57], time, 0.05);
        break;
      case "purchase":
        play("handleCoins", 0.8);
        this.chime([76, 79], time + 0.12, 0.07);
        break;
      case "payment":
        if (!play("handleCoins2", 0.45)) this.chime([72, 67], time, 0.06);
        break;
      case "deal":
        play("cloth1", 0.25);
        play("impactSoft_medium_000", 0.4, 0.1);
        this.chime([64, 71, 76], time + 0.15, 0.012);
        break;
      case "offer":
        this.chime([72, 76], time, 0.07);
        break;
      case "card":
        if (!play("card-slide-1", 0.7)) this.chime([79], time, 0.04);
        break;
      case "bid":
        if (!play("chips-stack-1", 0.6)) this.chime([72], time, 0.06);
        break;
      case "sold":
        play("impactWood_medium_000", 0.75);
        play("handleCoins2", 0.5, 0.16);
        break;
      case "build":
        play("impactWood_medium_000", 0.45);
        play("impactWood_light_000", 0.5, 0.14);
        break;
      case "go":
        this.chime([72, 76, 79, 84], time, 0.09);
        break;
      case "turn":
        this.chime([67, 72], time, 0.045);
        break;
      case "jail":
        if (!play("impactMetal_medium_000", 0.65))
          this.chime([48, 43], time, 0.08);
        break;
      case "debt":
        this.chime([57, 56], time, 0.09);
        break;
      case "bankrupt":
        this.chime([64, 60, 57, 52], time, 0.08);
        break;
      case "victory":
        this.chime([60, 64, 67, 72, 76, 79], time, 0.13);
        break;
    }
    if (!["step", "turn", "bid"].includes(cue)) this.duck(time, 0.65);
  }

  private startModel() {
    if (
      !this.enabled ||
      !this.settings.music ||
      !this.settings.ai ||
      this.worker ||
      this.modelStatus === "failed"
    )
      return;
    this.modelStatus = "loading";
    try {
      const worker = (this.worker = new Worker(
        new URL("./music.worker.ts", import.meta.url),
        { type: "module" },
      ));
      worker.onmessage = (event) => {
        if (this.worker !== worker) return;
        clearTimeout(this.timeout);
        const data = event.data;
        if (data.type === "ready") {
          this.modelStatus = "ready";
          this.compose();
        } else if (data.type === "phrase") {
          this.pending = false;
          if (data.id === this.requestId && data.mood === this.currentMood)
            this.readyPhrase = { mood: data.mood, notes: data.notes as Note[] };
          this.generated++;
          this.generationMs = data.duration;
          if (!this.readyPhrase) this.compose();
        } else this.failModel();
        this.changed();
      };
      worker.onerror = () => this.failModel();
      worker.postMessage({
        type: "init",
        modelUrl: new URL("/music-model", location.href).href,
      });
      this.timeout = setTimeout(() => this.failModel(), 30_000);
    } catch {
      this.failModel();
    }
    this.changed();
  }
  retryModel() {
    this.stopModel();
    this.startModel();
    this.changed();
  }
  private stopModel() {
    this.worker?.terminate();
    this.worker = undefined;
    clearTimeout(this.timeout);
    this.pending = false;
    this.modelStatus = "off";
  }
  private failModel() {
    this.stopModel();
    this.modelStatus = "failed";
    this.readyPhrase = undefined;
    this.changed();
  }
  private compose() {
    if (
      !this.active ||
      !this.worker ||
      this.pending ||
      this.modelStatus !== "ready" ||
      this.readyPhrase?.mood === this.currentMood
    )
      return;
    this.pending = true;
    this.worker.postMessage({
      type: "compose",
      mood: this.currentMood,
      id: ++this.requestId,
    });
    this.timeout = setTimeout(() => this.failModel(), 25_000);
  }
  private lastScheduledEnd = 0;
  private tick() {
    if (!this.active) return;
    if (this.preview && performance.now() > this.preview.until) {
      this.preview = undefined;
      this.changed();
    }
    const previous = this.director.current.mood;
    this.director.update(this.game, performance.now());
    if (previous !== this.director.current.mood) this.changed();
    if (!this.settings.music || !this.context) return;
    const now = this.context.currentTime;
    this.compose();
    if (this.nextBar > now + 0.18) return;
    if (this.nextBar < now) this.nextBar = now + 0.05; // Never replay a backlog after tab sleep.
    const mood = this.currentMood;
    if (mood !== this.mood) {
      this.mood = mood;
      this.bar = 0;
      this.phrase = undefined;
    }
    if (this.bar === 0 || !this.phrase) {
      this.playingAI = this.settings.ai && this.readyPhrase?.mood === mood;
      this.phrase = this.playingAI ? this.readyPhrase : ambientPhrase(mood);
      this.readyPhrase = undefined;
      this.compose();
      this.changed();
    }
    const score = MOODS[mood],
      beat = 60 / score.bpm,
      start = this.nextBar,
      chord = score.voicings[this.bar];
    // Warm, slow-attack pads and a soft bass leave room for family conversation.
    chord
      .slice(1)
      .forEach((p) =>
        this.tone(p, start, beat * 4 + 0.25, 0.1, this.musicBus!, "sine", 0.3),
      );
    this.tone(
      chord[0] - 12,
      start,
      beat * 2.7,
      0.14,
      this.musicBus!,
      "sine",
      0.06,
    );
    if (mood === "tense" || mood === "crisis")
      for (let b = 0; b < 4; b++) {
        this.tone(
          chord[0],
          start + b * beat,
          beat * 0.4,
          0.1,
          this.musicBus!,
          "triangle",
          0.02,
        );
        if (mood === "crisis")
          this.tone(
            chord[0] + 12,
            start + (b + 0.5) * beat,
            0.15,
            0.045,
            this.musicBus!,
          );
      }
    const notes = this.phrase!.notes.filter(
      (n) => n.start >= this.bar * 16 && n.start < (this.bar + 1) * 16,
    );
    notes.forEach((n, i) => {
      if (mood === "calm" && i % 2) return; // More space in the relaxed arrangement.
      const t = start + ((n.start - this.bar * 16) * beat) / 4;
      const duration = Math.min(
        beat * 2,
        Math.max(0.15, ((n.end - n.start) * beat) / 4),
      );
      this.tone(
        n.pitch,
        t,
        duration,
        0.15 * score.density,
        this.musicBus!,
        "triangle",
      );
      this.tone(
        n.pitch + 12,
        t,
        Math.min(0.3, duration),
        0.025 * score.density,
        this.musicBus!,
      );
    });
    this.nextBar += beat * 4;
    this.lastScheduledEnd = this.nextBar;
    this.bar = (this.bar + 1) % 4;
  }
  dispose() {
    this.disable(false);
    document.removeEventListener("pointerdown", this.firstInteraction);
    document.removeEventListener("keydown", this.firstInteraction);
    window.removeEventListener("pagehide", this.pageHide);
    this.channel?.close();
    document.removeEventListener("visibilitychange", this.visibility);
    void this.context?.close();
  }
}
