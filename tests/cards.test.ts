import { describe, expect, it } from "vitest";
import { applyAction, newGame } from "../src/game/engine";
import { CHANCE, CHEST } from "../src/game/board";
import { CLASSIC, type Game, type Seat } from "../src/game/types";
import {
  CardTracker,
  recentCards,
  cardMarkup,
  cardPanel,
} from "../src/client/cards";
import { translate } from "../src/client/i18n";

const seats: Seat[] = ["a", "b"].map((id) => ({
  id,
  name: id,
  token: "Top hat",
  color: "#123456",
  bot: false,
  connected: true,
}));
function setup() {
  const g = newGame(seats, CLASSIC, 100);
  g.turn = 0;
  g.rules.planning = true;
  g.phase = "move";
  g.dice = [1, 1];
  g.players[0].position = 34;
  g.afterMove = "end";
  g.chance = [8, ...g.chance.filter((i) => i !== 8)];
  g.chest = [1, ...g.chest.filter((i) => i !== 1)];
  return g;
}
const draw = (g: Game) => applyAction(g, "a", { type: "MOVE", delta: 0 });
describe("readable Chance and Community Chest cards", () => {
  it("preserves both cards in a chained Chance → Community Chest draw", () => {
    const g = draw(setup());
    expect(g.cardDraws?.map((c) => c.deck)).toEqual(["chance", "chest"]);
    expect(g.cardDraws?.map((c) => c.text)).toEqual([
      CHANCE[8].text,
      CHEST[1].text,
    ]);
    expect(g.cardDraws?.every((c) => c.player === "a")).toBe(true);
    expect(g.players[0].position).toBe(33);
    expect(g.players[0].cash).toBe(1700);
    expect(g.lastCard?.text).toBe(CHEST[1].text);
  });
  it("retains readable history after ending the turn and restoring a save", () => {
    let g = draw(setup());
    expect(cardPanel(g)).toContain('class="event-card');
    const rollingAgain = { ...g, lastCard: null };
    expect(cardPanel(rollingAgain)).toContain('class="event-card');
    g = applyAction(g, "a", { type: "END" });
    expect(cardPanel(g)).not.toContain('class="event-card');
    expect(cardPanel(g)).toContain('data-cards="history"');
    expect(g.lastCard).toBeNull();
    expect(recentCards(JSON.parse(JSON.stringify(g)))).toHaveLength(2);
  });
  it("opens each new card once and does not replay on join/reconnect", () => {
    const tracker = new CardTracker(),
      before = setup();
    expect(tracker.ingest(before)).toEqual([]);
    const after = draw(before);
    expect(tracker.ingest(after)).toHaveLength(2);
    expect(tracker.ingest(after)).toEqual([]);
    tracker.reset();
    expect(tracker.ingest(after)).toEqual([]);
  });
  it("supports old saves and falls back to their public journal", () => {
    const before = setup();
    delete before.cardDraws;
    const after = draw(before);
    expect(recentCards(after)).toHaveLength(2);
    delete after.cardDraws;
    expect(recentCards(after).map((c) => c.text)).toEqual([
      CHANCE[8].text,
      CHEST[1].text,
    ]);
  });
  it("records the draw-time inflation factor and bounds retained history", () => {
    const before = setup();
    before.index = 1.5;
    before.cardDraws = Array.from({ length: 24 }, (_, i) => ({
      id: -25 + i,
      deck: "chance",
      text: "Earlier card",
      player: "a",
      index: 1,
    }));
    const g = draw(before);
    expect(g.cardDraws).toHaveLength(24);
    expect(g.cardDraws?.at(-1)?.index).toBe(1.5);
    expect(g.players[0].cash).toBe(1800);
  });
  it("escapes names/card content and translates every card to Slovene", () => {
    const g = draw(setup());
    g.players[0].name = "<img src=x onerror=alert(1)>";
    expect(cardMarkup(g.cardDraws![0], g)).not.toContain("<img");
    for (const card of [...CHANCE, ...CHEST])
      expect(translate(card.text, "sl")).not.toBe(card.text);
    expect(CHANCE.filter((c) => c.type === "nearestRail")).toHaveLength(2);
    expect(CHANCE).toHaveLength(16);
    expect(CHEST).toHaveLength(16);
  });
});
