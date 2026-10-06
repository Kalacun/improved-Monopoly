import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameAudio } from "../src/client/audio/engine";

// Exercise audio lifecycle failures without relying on a physical speaker or browser autoplay.
const sources: ReturnType<typeof source>[] = [];
const workers: FakeWorker[] = [];
const param = () => ({
  value: 0,
  setTargetAtTime: vi.fn(),
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
});
function source() {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    frequency: param(),
    playbackRate: param(),
    onended: null,
  };
}
class FakeContext {
  currentTime = 0;
  state = "suspended";
  destination = {};
  createGain() {
    return { gain: param(), connect: vi.fn(), disconnect: vi.fn() };
  }
  createDynamicsCompressor() {
    return {
      threshold: param(),
      knee: param(),
      ratio: param(),
      connect: vi.fn(),
    };
  }
  createOscillator() {
    const s = source();
    sources.push(s);
    return s;
  }
  createBufferSource() {
    const s = source();
    sources.push(s);
    return s;
  }
  async resume() {
    this.state = "running";
  }
  async suspend() {
    this.state = "suspended";
  }
  async close() {
    this.state = "closed";
  }
  async decodeAudioData() {
    return {};
  }
}
class FakeWorker {
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    workers.push(this);
  }
}
let audio: GameAudio;
let doc: EventTarget & { hidden: boolean };
beforeEach(() => {
  vi.useFakeTimers();
  sources.length = 0;
  workers.length = 0;
  doc = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("location", { href: "http://localhost:4320/" });
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
    })),
  );
  audio = new GameAudio("tv");
});
afterEach(() => {
  audio.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("audio lifecycle", () => {
  it("waits for a gesture before loading sound or the music model", async () => {
    expect(audio.enabled).toBe(false);
    expect(workers).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    await audio.enable();
    expect(audio.active).toBe(true);
    expect(workers).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(12);
  });
  it("starts the default soundtrack on the first computer interaction", async () => {
    doc.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    expect(audio.active).toBe(true);
    expect(workers).toHaveLength(1);
    audio.disable();
    doc.dispatchEvent(new Event("keydown"));
    await Promise.resolve();
    expect(audio.active).toBe(false);
  });
  it("keeps phone controllers quiet by default", async () => {
    audio.dispose();
    audio = new GameAudio("phone");
    doc.dispatchEvent(new Event("pointerdown"));
    await Promise.resolve();
    expect(audio.enabled).toBe(false);
    expect(workers).toHaveLength(0);
  });
  it("continues with ambient music on worker failure and permits an explicit retry", async () => {
    await audio.enable();
    workers[0].onerror?.();
    expect(workers[0].terminate).toHaveBeenCalled();
    expect(audio.modelStatus).toBe("failed");
    expect(audio.active).toBe(true);
    audio.retryModel();
    expect(workers).toHaveLength(2);
    expect(audio.modelStatus).toBe("loading");
  });
  it("terminates a model that never finishes loading", async () => {
    await audio.enable();
    await vi.advanceTimersByTimeAsync(30_001);
    expect(audio.modelStatus).toBe("failed");
    expect(workers[0].terminate).toHaveBeenCalled();
    expect(audio.active).toBe(true);
  });
  it("stops scheduled sounds when muted or hidden rather than replaying them later", async () => {
    await audio.enable();
    audio.cue("purchase");
    expect(sources.length).toBeGreaterThan(0);
    audio.disable();
    expect(audio.active).toBe(false);
    expect(
      sources.every((s) => s.stop.mock.calls.some((args) => args.length === 0)),
    ).toBe(true);
    sources.length = 0;
    await audio.enable();
    audio.cue("dice");
    doc.hidden = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(audio.active).toBe(false);
    expect(
      sources.every((s) => s.stop.mock.calls.some((args) => args.length === 0)),
    ).toBe(true);
  });
  it("keeps the neural model unloaded when AI or music is disabled", async () => {
    audio.set("ai", false);
    await audio.enable();
    expect(workers).toHaveLength(0);
    expect(audio.active).toBe(true);
    audio.set("music", false);
    audio.set("ai", true);
    expect(workers).toHaveLength(0);
    audio.set("music", true);
    expect(workers).toHaveLength(1);
  });
});
