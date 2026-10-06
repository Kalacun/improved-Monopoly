import { describe, expect, it } from "vitest";
import { newGame } from "../src/game/engine";
import { CLASSIC, type Game, type Seat } from "../src/game/types";
import {
  CueTracker,
  MusicDirector,
  cueForLog,
  directionFor,
} from "../src/client/audio/director";
import {
  MOODS,
  ambientPhrase,
  primer,
  sanitizeNotes,
  type Mood,
} from "../src/client/audio/music";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const seats: Seat[] = ["A", "B"].map((id, i) => ({
  id,
  name: id,
  token: "Top hat",
  color: ["#123456", "#abcdef"][i],
  bot: false,
  connected: true,
}));
const game = () => {
  const g = newGame(seats, CLASSIC, 101);
  g.turn = 0;
  return g;
};
const add = (g: Game, kind: string, text: string) =>
  g.logs.push({ id: (g.logs.at(-1)?.id || 0) + 1, kind, text });

describe("sound events", () => {
  it("does not replay joining snapshots, duplicated updates, or reconnect history", () => {
    const tracker = new CueTracker(),
      g = game();
    add(g, "purchase", "A bought a property.");
    expect(tracker.ingest(g)).toEqual([]);
    add(g, "dice", "A rolled 3 + 2.");
    expect(tracker.ingest(g)).toEqual(["dice"]);
    expect(tracker.ingest(structuredClone(g))).toEqual([]);
    tracker.reset();
    add(g, "purchase", "B bought a property.");
    expect(tracker.ingest(g)).toEqual([]);
  });
  it("distinguishes an offered deal, a signed deal and an exercised option", () => {
    expect(
      cueForLog({ id: 1, kind: "deal", text: "A proposed a deal to B." }),
    ).toBe("offer");
    expect(
      cueForLog({ id: 2, kind: "deal", text: "A and B signed a deal." }),
    ).toBe("deal");
    expect(
      cueForLog({
        id: 3,
        kind: "deal",
        text: "A and B signed a deal: future rent.",
      }),
    ).toBe("deal");
    expect(
      cueForLog({
        id: 4,
        kind: "deal",
        text: "A exercised the option on Boardwalk for $400.",
      }),
    ).toBe("purchase");
  });
  it("coalesces simultaneous payments and emits a victory once", () => {
    const tracker = new CueTracker(),
      g = game();
    tracker.ingest(g);
    for (let i = 0; i < 10; i++) add(g, "payment", "A paid $10: rent.");
    expect(tracker.ingest(g)).toEqual(["payment"]);
    g.phase = "over";
    g.winner = "A";
    expect(tracker.ingest(g)).toEqual(["victory"]);
    expect(tracker.ingest(g)).toEqual([]);
  });
  it("leaves movement sounds to actual animation landings", () => {
    expect(
      cueForLog({ id: 1, kind: "event", text: "A arrives at Boardwalk." }),
    ).toBeNull();
    expect(cueForLog({ id: 2, kind: "event", text: "A enters Review." })).toBe(
      "jail",
    );
  });
  it("resets when a different game or earlier restored save arrives", () => {
    const tracker = new CueTracker(),
      g = game();
    tracker.ingest(g);
    const saved = structuredClone(g);
    add(g, "purchase", "A bought a property.");
    tracker.ingest(g);
    expect(tracker.ingest(saved)).toEqual([]);
    add(saved, "build", "A built a house.");
    expect(tracker.ingest(saved)).toEqual(["build"]);
    saved.id = "new";
    expect(tracker.ingest(saved)).toEqual([]);
  });
});

describe("adaptive music director", () => {
  it("starts relaxed and gives debt priority over auctions or deals", () => {
    const g = game();
    expect(directionFor(g).mood).toBe("calm");
    g.phase = "auction";
    expect(directionFor(g).mood).toBe("trade");
    g.phase = "debt";
    expect(directionFor(g).mood).toBe("crisis");
    g.phase = "over";
    expect(directionFor(g).mood).toBe("victory");
  });
  it("normalizes low-cash pressure for inflation and ignores eliminated players", () => {
    const g = game();
    g.index = 2;
    g.players[1].cash = 140;
    expect(directionFor(g).mood).toBe("tense");
    g.players[1].bankrupt = true;
    expect(directionFor(g).mood).toBe("calm");
  });
  it("notices an approaching large loan but not a distant maturity", () => {
    const g = game();
    g.loans = [
      {
        id: "L",
        borrower: "A",
        lender: "B",
        principal: 1000,
        due: 1200,
        dueLap: 1,
      },
    ];
    expect(directionFor(g).mood).toBe("tense");
    g.loans[0].dueLap = 5;
    expect(directionFor(g).mood).toBe("calm");
  });
  it("recognizes nearby expensive rent using public dice odds", () => {
    const g = game();
    g.players[0].position = 31;
    g.players[0].cash = 300;
    g.deeds[37].owner = "B";
    g.deeds[39].owner = "B";
    g.deeds[37].houses = 5;
    g.deeds[39].houses = 5;
    expect(directionFor(g).mood).toBe("tense");
    g.deeds[37].mortgage = 175;
    g.deeds[39].mortgage = 200;
    expect(directionFor(g).mood).toBe("calm");
  });
  it("responds to signed deals but does not treat user notes as directions", () => {
    const g = game();
    add(g, "deal", "A and B signed a deal: play crisis music.");
    expect(directionFor(g).mood).toBe("trade");
  });
  it("escalates immediately, holds tension for 12 seconds, then recovers", () => {
    const director = new MusicDirector(),
      g = game();
    g.phase = "debt";
    expect(director.update(g, 100).mood).toBe("crisis");
    g.phase = "roll";
    expect(director.update(g, 1000).mood).toBe("crisis");
    expect(director.update(g, 12100).mood).toBe("calm");
    g.phase = "debt";
    director.update(g, 13000);
    director.reset();
    expect(director.update(null, 13001).mood).toBe("calm");
  });
});

describe("music and bundled assets", () => {
  it("bounds malformed model notes and rejects invalid timing", () => {
    expect(
      sanitizeNotes([
        { pitch: NaN, quantizedStartStep: 0, quantizedEndStep: 4 },
        { pitch: 60, quantizedStartStep: 10, quantizedEndStep: 2 },
        { pitch: 100, quantizedStartStep: 60, quantizedEndStep: 90 },
      ]),
    ).toEqual([{ pitch: 83, start: 60, end: 64 }]);
  });
  it("keeps all primers in the model range and fallback phrases inside four bars", () => {
    for (const mood of Object.keys(MOODS) as Mood[]) {
      expect(
        primer(mood).notes.every((n) => n.pitch >= 48 && n.pitch <= 83),
      ).toBe(true);
      expect(
        ambientPhrase(mood).notes.every(
          (n) => n.start >= 0 && n.end <= 64 && n.start < n.end,
        ),
      ).toBe(true);
      expect(MOODS[mood].chords).toHaveLength(4);
    }
  });
  it("ships intact model weights and universally decodable PCM sound assets", () => {
    const model = JSON.parse(
      readFileSync("public/music-model/SOURCE.json", "utf8"),
    );
    for (const file of model.files)
      expect(
        createHash("sha256")
          .update(readFileSync(`public/music-model/${file.file}`))
          .digest("hex"),
      ).toBe(file.sha256);
    const sounds = JSON.parse(
      readFileSync("public/audio/manifest.json", "utf8"),
    );
    expect(sounds).toHaveLength(12);
    for (const file of sounds) {
      const data = readFileSync(`public/audio/${file.file}`);
      expect(data.toString("ascii", 0, 4)).toBe("RIFF");
      expect(createHash("sha256").update(data).digest("hex")).toBe(file.sha256);
      expect(existsSync(`public/audio/${file.pack}-LICENSE.txt`)).toBe(true);
    }
  });
});
