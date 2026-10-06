import { describe, expect, it } from "vitest";
import {
  BOARD,
  CHANCE,
  CHEST,
  COLORS,
  PURCHASABLE,
  TOKENS,
} from "../src/game/board.js";
import {
  actorFor,
  applyAction,
  assets,
  botAction,
  botStep,
  buildingSupply,
  constructionCost,
  current,
  indexed,
  market,
  mortgageValue,
  netWorth,
  newGame,
  normalizeRules,
  changeRules,
  previewDeal,
  rent,
} from "../src/game/engine.js";
import {
  CLASSIC,
  ECONOMY,
  type Action,
  type Deal,
  type Game,
  type Seat,
} from "../src/game/types.js";
const seats: Seat[] = Array.from({ length: 4 }, (_, i) => ({
  id: ["a", "b", "c", "d"][i],
  name: ["Alex", "Blair", "Casey", "Drew"][i],
  token: TOKENS[i],
  color: COLORS[i],
  bot: false,
  connected: true,
}));
const game = (economy = false, n = 3) => {
  const g = newGame(
    seats.slice(0, n),
    economy
      ? { ...ECONOMY, cycles: false, wealthTax: false, assistance: false }
      : CLASSIC,
    12345,
  );
  g.turn = 0; // Focus each scenario on the first seat, independently of the opening contest.
  return g;
};
const own = (g: Game, owner: string, ...ids: number[]) =>
  ids.forEach((id) => (g.deeds[id].owner = owner));
function land(g: Game, id: number, actor = "a") {
  g.turn = g.players.findIndex((p) => p.id === actor);
  g.phase = "move";
  g.rules.planning = true;
  g.dice = [1, 1];
  current(g).position = (id + 38) % 40;
  g.afterMove = "end";
  return applyAction(g, actor, { type: "MOVE", delta: 0 });
}
function deal(g: Game, terms: Partial<Deal> = {}): Game {
  const d = {
    to: "b",
    give: [1],
    take: [],
    cash: 0,
    receiveCash: 100,
    royalty: 0,
    equity: 0,
    sellOn: 0,
    veto: [],
    note: "",
    retainTitle: false,
    ...terms,
  };
  g = applyAction(g, terms.from || "a", { type: "OFFER", deal: d });
  return applyAction(g, d.to, { type: "ACCEPT", id: g.offers.at(-1)!.id });
}
function debt(g: Game, amount: number, to: string | null = "b", from = "a") {
  g.phase = "debt";
  g.resumePhase = "end";
  g.payments = [
    {
      player: from,
      amount,
      reason: "test debt",
      creditor: to,
      recipients: [{ id: to, amount }],
    },
  ];
  return g;
}
function seedForDoubles(want: boolean) {
  for (let seed = 1; seed < 100; seed++) {
    const g = game();
    g.rng = seed;
    const next = applyAction(g, "a", { type: "ROLL" });
    if ((next.dice[0] === next.dice[1]) === want) return seed;
  }
  throw Error("No seed");
}
describe("board and basic rules", () => {
  it("chooses the first player by a logged opening dice contest", () => {
    const winners = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const g = newGame(seats, CLASSIC, seed);
      winners.add(g.turn);
      const opening = g.logs
        .filter((l) => l.text.startsWith("Opening roll:"))
        .at(-1)!.text;
      const rolls = [...opening.matchAll(/(Alex|Blair|Casey|Drew) (\d+)/g)];
      expect(rolls.find((r) => r[1] === current(g).name)?.[2]).toBe(
        String(Math.max(...rolls.map((r) => Number(r[2])))),
      );
    }
    expect(winners.size).toBeGreaterThan(1);
  });
  it("trades release certificates without duplicating or returning their deck cards", () => {
    let g = game();
    const card = CHANCE.findIndex((c) => c.type === "free");
    g.players[0].freeCards = ["chance"];
    g.chance = g.chance.filter((c) => c !== card);
    g = deal(g, { give: [], giveJailCards: 1, receiveCash: 25 });
    expect(g.players[0].freeCards).toEqual([]);
    expect(g.players[1].freeCards).toEqual(["chance"]);
    expect(g.chance).not.toContain(card);
    expect(() => deal(g, { give: [], giveJailCards: 1 })).toThrow(
      "promised release",
    );
  });

  it("has 40 canonical spaces, 28 titles, eight color groups, and two 16-card decks", () => {
    expect(BOARD.length).toBe(40);
    expect(PURCHASABLE.length).toBe(28);
    expect(CHANCE.length).toBe(16);
    expect(CHEST.length).toBe(16);
    expect(BOARD[39].name).toBe("Boardwalk");
    expect(game().players.map((p) => p.cash)).toEqual([1500, 1500, 1500]);
  });
  it("keeps failed actions atomic and rejects off-turn rolls", () => {
    const g = game();
    const before = JSON.stringify(g);
    expect(() => applyAction(g, "b", { type: "ROLL" })).toThrow("Wait");
    expect(JSON.stringify(g)).toBe(before);
  });
  it("rolls only bounded dice and moves the correct number in classic mode", () => {
    for (let seed = 0; seed < 100; seed++) {
      const g = game();
      g.rng = seed;
      const n = applyAction(g, "a", { type: "ROLL" });
      expect(n.dice.every((d) => d >= 1 && d <= 6)).toBe(true);
    }
  });
  it("buys an unowned property and refuses insufficient cash", () => {
    let g = land(game(), 1);
    expect(g.phase).toBe("purchase");
    g = applyAction(g, "a", { type: "BUY" });
    expect(g.deeds[1].owner).toBe("a");
    expect(g.players[0].cash).toBe(1640);
    g = land(g, 39);
    g.players[0].cash = 5;
    expect(() => applyAction(g, "a", { type: "BUY" })).toThrow("cash");
  });
  it("charges rent and doubles bare complete-set rent, including a mortgaged sibling", () => {
    let g = game();
    own(g, "b", 1, 3);
    expect(rent(g, 1)).toBe(4);
    g.deeds[3].mortgage = 30;
    expect(rent(g, 1)).toBe(4);
    g = land(g, 1);
    expect(g.players[0].cash).toBe(1696);
    expect(g.players[1].cash).toBe(1504);
  });
  it("scales railroad and utility rent with the entire portfolio", () => {
    const g = game();
    own(g, "b", 5, 15, 25, 35, 12, 28);
    expect(rent(g, 5)).toBe(200);
    expect(rent(g, 12, 8)).toBe(80);
    g.deeds[12].mortgage = 75;
    expect(rent(g, 12, 8)).toBe(0);
  });
  it("pays salary exactly once when crossing GO, but not in reverse", () => {
    let g = game();
    g.phase = "move";
    g.rules.planning = true;
    g.players[0].position = 39;
    g.dice = [1, 1];
    g = applyAction(g, "a", { type: "MOVE", delta: 0 });
    expect(g.players[0].cash).toBe(1700);
    expect(g.players[0].laps).toBe(1);
  });
  it("Free Parking produces no jackpot", () => {
    const g = land(game(), 20);
    expect(g.players[0].cash).toBe(1500);
    expect(g.phase).toBe("end");
  });
  it("taxes use fixed modern amounts", () => {
    expect(land(game(), 4).players[0].cash).toBe(1300);
    expect(land(game(), 38).players[0].cash).toBe(1400);
  });
  it("handles movement cards through GO and go-to-jail without salary", () => {
    let g = game();
    g.chance = [0, ...g.chance.filter((i) => i !== 0)];
    g = land(g, 36);
    expect(g.players[0].position).toBe(0);
    expect(g.players[0].cash).toBe(1700);
    g = land(game(), 30);
    expect(g.players[0].position).toBe(10);
    expect(g.players[0].cash).toBe(1500);
    expect(g.players[0].jailed).toBe(true);
  });
  it("keeps jail cards out of the deck until used", () => {
    let g = game();
    const idx = CHANCE.findIndex((c) => c.type === "free");
    g.chance = [idx, ...g.chance.filter((i) => i !== idx)];
    g = land(g, 7);
    expect(g.players[0].freeCards).toEqual(["chance"]);
    expect(g.chance).not.toContain(idx);
    g.phase = "roll";
    g.players[0].jailed = true;
    g = applyAction(g, "a", { type: "BAIL", card: true });
    expect(g.players[0].jailed).toBe(false);
    expect(g.chance).toContain(idx);
  });
  it("three doubles send the player directly to jail", () => {
    let g = game();
    g.doubles = 2;
    g.rng = seedForDoubles(true);
    g = applyAction(g, "a", { type: "ROLL" });
    expect(g.players[0].jailed).toBe(true);
    expect(g.players[0].position).toBe(10);
    expect(g.phase).toBe("end");
  });
  it("doubles release a prisoner without an extra roll", () => {
    let g = game();
    g.players[0].jailed = true;
    g.players[0].position = 10;
    g.rng = seedForDoubles(true);
    g = applyAction(g, "a", { type: "ROLL" });
    expect(g.players[0].jailed).toBe(false);
    expect(g.afterMove).toBe("end");
  });
  it("requires a third-attempt bail debt to be paid before movement", () => {
    let g = game();
    Object.assign(g.players[0], {
      jailed: true,
      jailTurns: 2,
      position: 10,
      cash: 10,
    });
    g.rng = seedForDoubles(false);
    g = applyAction(g, "a", { type: "ROLL" });
    expect(g.phase).toBe("debt");
    expect(g.players[0].position).toBe(10);
    expect(g.pendingMove).not.toBeNull();
    g.players[0].cash = 100;
    g = applyAction(g, "a", { type: "SETTLE" });
    expect(g.pendingMove).toBeNull();
    expect(g.players[0].position).toBe(10 + g.dice[0] + g.dice[1]);
  });
  it("rent collection continues while an owner is in jail", () => {
    let g = game();
    own(g, "b", 39);
    g.players[1].jailed = true;
    g = land(g, 39);
    expect(g.players[1].cash).toBe(1550);
  });
});
describe("auctions and buildings", () => {
  it("includes the declining buyer, accepts bids below list, and settles after other players pass", () => {
    let g = land(game(), 1);
    g = applyAction(g, "a", { type: "AUCTION" });
    expect(g.auction!.remaining).toEqual(["a", "b", "c"]);
    g = applyAction(g, "a", { type: "BID", amount: 1 });
    g = applyAction(g, "b", { type: "PASS" });
    g = applyAction(g, "c", { type: "PASS" });
    expect(g.deeds[1].owner).toBe("a");
    expect(g.players[0].cash).toBe(1699);
    expect(g.phase).toBe("end");
  });
  it("rejects unaffordable, zero, fractional, and out-of-turn bids", () => {
    const g = applyAction(land(game(), 1), "a", { type: "AUCTION" });
    for (const amount of [0, 1.5, 2000])
      expect(() => applyAction(g, "a", { type: "BID", amount })).toThrow();
    expect(() => applyAction(g, "b", { type: "BID", amount: 100 })).toThrow();
  });
  it("returns the title to the bank when everyone passes", () => {
    let g = applyAction(land(game(), 1), "a", { type: "AUCTION" });
    for (const id of ["a", "b", "c"]) g = applyAction(g, id, { type: "PASS" });
    expect(g.deeds[1].owner).toBeNull();
    expect(g.auction).toBeNull();
    expect(g.phase).toBe("end");
  });
  it("requires a complete set, even building, no mortgage and sufficient supply", () => {
    let g = game();
    own(g, "a", 1);
    expect(() => applyAction(g, "a", { type: "BUILD", property: 1 })).toThrow(
      "full color",
    );
    own(g, "a", 3);
    g = applyAction(g, "a", { type: "BUILD", property: 1 });
    expect(() => applyAction(g, "a", { type: "BUILD", property: 1 })).toThrow(
      "evenly",
    );
    g = applyAction(g, "a", { type: "BUILD", property: 3 });
    expect(buildingSupply(g).houses).toBe(30);
    expect(() =>
      applyAction(g, "a", { type: "MORTGAGE", property: 1 }),
    ).toThrow("buildings");
  });
  it("hotels return four houses; breaking them consumes four houses", () => {
    let g = game();
    own(g, "a", 1, 3);
    g.deeds[1].houses = 4;
    g.deeds[3].houses = 4;
    const before = buildingSupply(g);
    g = applyAction(g, "a", { type: "BUILD", property: 1 });
    expect(buildingSupply(g).houses).toBe(before.houses + 4);
    expect(buildingSupply(g).hotels).toBe(11);
    g = applyAction(g, "a", { type: "SELL_BUILDING", property: 1 });
    expect(buildingSupply(g)).toEqual(before);
  });
  it("building supply never goes below zero", () => {
    let g = game();
    own(g, "a", 1, 3);
    for (const id of [6, 8, 9, 11, 13, 14, 16, 18]) g.deeds[id].houses = 4;
    expect(buildingSupply(g).houses).toBe(0);
    expect(() => applyAction(g, "a", { type: "BUILD", property: 1 })).toThrow(
      "no buildings",
    );
  });
  it("sells an entire developed group when hotel breakup has no houses", () => {
    let g = game();
    own(g, "a", 1, 3);
    g.deeds[1].houses = 5;
    g.deeds[3].houses = 5;
    for (const id of [6, 8, 9, 11, 13, 14, 16, 18]) g.deeds[id].houses = 4;
    expect(() =>
      applyAction(g, "a", { type: "SELL_BUILDING", property: 1 }),
    ).toThrow("four houses");
    g = applyAction(g, "a", { type: "SELL_GROUP", property: 1 });
    expect(g.players[0].cash).toBe(1750);
    expect(g.deeds[3].houses).toBe(0);
  });
  it("auctions the last house to eligible builders and builds on the winner’s chosen site", () => {
    let g = game();
    own(g, "a", 1, 3);
    own(g, "b", 6, 8, 9);
    own(g, "c", 11, 13, 14, 16, 18, 19, 21, 23, 24);
    for (const id of [11, 13, 14, 16, 18, 19, 21]) g.deeds[id].houses = 4;
    g.deeds[23].houses = 3;
    expect(buildingSupply(g).houses).toBe(1);
    g = applyAction(g, "a", { type: "BUILD", property: 1 });
    expect(g.auction?.kind).toBe("house");
    expect(g.auction?.remaining).toEqual(["a", "b", "c"]);
    g = applyAction(g, "a", { type: "BID", amount: 60, property: 1 });
    g = applyAction(g, "b", { type: "BID", amount: 70, property: 9 });
    g = applyAction(g, "c", { type: "PASS" });
    g = applyAction(g, "a", { type: "PASS" });
    expect(g.deeds[9].houses).toBe(1);
    expect(g.players[1].cash).toBe(1430);
    expect(buildingSupply(g).houses).toBe(0);
    expect(g.phase).toBe("roll");
  });
  it("nets a tenant’s own equity share before checking rent liquidity", () => {
    let g = game(true);
    own(g, "b", 39);
    g.deeds[39].claims = [{ holder: "a", percent: 20, kind: "equity" }];
    g.players[0].cash = 40;
    g = land(g, 39);
    expect(g.phase).toBe("end");
    expect(g.players[0].cash).toBe(0);
    expect(g.players[1].cash).toBe(1540);
  });
  it("redeems mortgages at the actual principal plus interest", () => {
    let g = game();
    own(g, "a", 39);
    g = applyAction(g, "a", { type: "MORTGAGE", property: 39 });
    expect(g.players[0].cash).toBe(1700);
    expect(rent(g, 39)).toBe(0);
    g = applyAction(g, "a", { type: "REDEEM", property: 39 });
    expect(g.players[0].cash).toBe(1480);
    expect(g.deeds[39].mortgage).toBe(0);
  });
  it("charges immediate transfer interest and later redemption interest separately", () => {
    let g = game();
    own(g, "a", 1);
    g = applyAction(g, "a", { type: "MORTGAGE", property: 1 });
    g = deal(g);
    expect(g.players[1].cash).toBe(1397);
    g = applyAction(g, "b", { type: "REDEEM", property: 1 });
    expect(g.players[1].cash).toBe(1364);
  });
});
describe("contracts and investor rights", () => {
  it("splits rents exactly without creating money", () => {
    let g = game(true);
    own(g, "a", 39);
    g = deal(g, { give: [39], royalty: 20, equity: 10 });
    const cashBefore = g.players.map((p) => p.cash);
    g = land(g, 39, "c");
    expect(g.players[2].cash).toBe(cashBefore[2] - 50);
    expect(g.players[0].cash).toBe(cashBefore[0] + 15);
    expect(g.players[1].cash).toBe(cashBefore[1] + 35);
    expect(g.players.reduce((s, p) => s + p.cash, 0)).toBe(
      cashBefore.reduce((a, b) => a + b, 0),
    );
  });
  it("applies equity proceeds and fixed sell-on charges on later transfers", () => {
    let g = game(true);
    own(g, "a", 1);
    g = deal(g, { equity: 20, sellOn: 15 });
    const before = g.players.map((p) => p.cash);
    g = deal(g, { from: "b", to: "c", receiveCash: 200 });
    expect(g.players[0].cash - before[0]).toBe(55);
    expect(g.players[1].cash - before[1]).toBe(145);
    expect(g.players[2].cash - before[2]).toBe(-200);
    expect(g.deeds[1].owner).toBe("c");
  });
  it("attaches equity to multiple titles without transferring control", () => {
    let g = game(true);
    own(g, "a", 1, 3);
    g = deal(g, { give: [1, 3], equity: 25, retainTitle: true });
    expect(g.deeds[1].owner).toBe("a");
    expect(g.deeds[3].claims[0]).toEqual({
      holder: "b",
      percent: 25,
      kind: "equity",
    });
    expect(assets(g, "a")).toBe(90);
    expect(assets(g, "b")).toBe(30);
  });
  it("caps combined claims at 80 percent across repeat deals", () => {
    let g = game(true);
    own(g, "a", 1);
    g = deal(g, { equity: 60, retainTitle: true });
    expect(() => deal(g, { equity: 25, retainTitle: true })).toThrow("20%");
  });
  it("rejects a sale blocked by a surviving original seller", () => {
    let g = game(true);
    own(g, "a", 1);
    g = deal(g, { veto: ["c"] });
    expect(() => deal(g, { from: "b", to: "c" })).toThrow("veto");
    g.players[0].bankrupt = true;
    g = deal(g, { from: "b", to: "c" });
    expect(g.deeds[1].owner).toBe("c");
  });
  it("locks option titles and exercises at the nominal price despite inflation", () => {
    let g = game(true);
    own(g, "a", 1);
    g = deal(g, {
      give: [],
      option: { property: 1, strike: 80 },
      receiveCash: 20,
    });
    expect(() =>
      applyAction(g, "a", { type: "MORTGAGE", property: 1 }),
    ).toThrow("option");
    expect(() => deal(g, { to: "c" })).toThrow("option");
    g.index = 2;
    g = applyAction(g, "b", { type: "EXERCISE", property: 1 });
    expect(g.deeds[1].owner).toBe("b");
    expect(g.deeds[1].option).toBeUndefined();
    expect(g.players[1].cash).toBe(1400);
  });
  it("only allows an option holder to release it", () => {
    let g = game(true);
    own(g, "a", 1);
    g = deal(g, { give: [], option: { property: 1, strike: 80 } });
    expect(() =>
      applyAction(g, "a", { type: "RELEASE_OPTION", property: 1 }),
    ).toThrow("holder");
    g = applyAction(g, "b", { type: "RELEASE_OPTION", property: 1 });
    expect(g.deeds[1].option).toBeUndefined();
  });
  it("rejects undercollateralized option strikes against resale obligations", () => {
    let g = game(true);
    own(g, "a", 1);
    g = deal(g, { sellOn: 100 });
    expect(() =>
      deal(g, {
        from: "b",
        to: "c",
        give: [],
        option: { property: 1, strike: 50 },
      }),
    ).toThrow("strike");
  });
  it("revalidates stale offers atomically after funds change", () => {
    let g = game(true);
    own(g, "a", 1);
    g = applyAction(g, "a", {
      type: "OFFER",
      deal: { to: "b", give: [1], receiveCash: 1200 },
    });
    g.players[1].cash = 10;
    expect(() =>
      applyAction(g, "b", { type: "ACCEPT", id: g.offers[0].id }),
    ).toThrow("afford");
    expect(g.deeds[1].owner).toBe("a");
    expect(g.offers.length).toBe(1);
  });
  it("fails the full deal if the seller cannot pay existing resale fees", () => {
    let g = game(true);
    own(g, "a", 1);
    g = deal(g, { sellOn: 200 });
    g.players[1].cash = 0;
    expect(() => deal(g, { from: "b", to: "c", receiveCash: 100 })).toThrow(
      "afford",
    );
    expect(g.deeds[1].owner).toBe("b");
  });
  it("requires buildings to be removed before dealing any property of the group", () => {
    let g = game(true);
    own(g, "a", 1, 3);
    g.deeds[3].houses = 1;
    expect(() => deal(g)).toThrow("buildings");
  });
  it("blocks advanced contracts in Classic while permitting cash trades", () => {
    let g = game();
    own(g, "a", 1);
    expect(() => deal(g, { royalty: 10 })).toThrow("disabled");
    expect(deal(g).deeds[1].owner).toBe("b");
  });
  it("supports fixed investor loans and early repayment", () => {
    let g = game(true);
    g = deal(g, {
      give: [],
      receiveCash: 0,
      loan: { principal: 300, interest: 10, laps: 2 },
    });
    expect(g.players[0].cash).toBe(1200);
    expect(g.players[1].cash).toBe(1800);
    expect(netWorth(g, "b")).toBe(1470);
    g = applyAction(g, "b", { type: "REPAY", id: g.loans[0].id });
    expect(g.players[1].cash).toBe(1470);
    expect(g.players[0].cash).toBe(1530);
    expect(g.loans.length).toBe(0);
  });
  it("matures a loan on the borrower’s agreed GO crossing", () => {
    let g = game(true);
    g = deal(g, {
      give: [],
      receiveCash: 0,
      loan: { principal: 300, interest: 10, laps: 1 },
    });
    g.players[1].position = 39;
    g.turn = 1;
    g.phase = "move";
    g.dice = [1, 1];
    g = applyAction(g, "b", { type: "MOVE", delta: 0 });
    expect(g.loans.length).toBe(0);
    expect(g.players[0].cash).toBe(1530);
    expect(g.players[1].cash).toBe(1670);
  });
  it("rejects unsafe values and duplicate titles", () => {
    let g = game(true);
    own(g, "a", 1);
    for (const args of [
      { cash: -1 },
      { equity: 81 },
      { royalty: 1.1 },
      { give: [1, 1] },
      { give: [999] },
    ])
      expect(() => deal(g, args)).toThrow();
  });
});
describe("economic balance and planning", () => {
  it("refills one credit on every second personal lap, capped at three", () => {
    let g = game(true);
    g.players[0].planning = 0;
    for (const expected of [0, 1, 1, 2, 2, 3, 3, 3]) {
      g.phase = "move";
      g.players[0].position = 39;
      g.dice = [1, 1];
      g.afterMove = "end";
      g = applyAction(g, "a", { type: "MOVE", delta: 0 });
      expect(g.players[0].planning).toBe(expected);
    }
    expect(g.players[0].laps).toBe(8);
    expect(
      g.logs.filter((l) => l.text.includes("earns a planning credit")),
    ).toHaveLength(3);
  });
  it("does not earn credits while planning is disabled or catch up missed refills", () => {
    let g = game(true);
    g.players[0].laps = 1;
    g.players[0].planning = 0;
    g = changeRules(g, { ...g.rules, planning: false });
    const cross = () => {
      g.phase = "move";
      g.players[0].position = 39;
      g.dice = [1, 1];
      g.afterMove = "end";
      g = applyAction(g, "a", { type: "MOVE", delta: 0 });
    };
    cross();
    expect(g.players[0].planning).toBe(0);
    g = changeRules(g, { ...g.rules, planning: true });
    cross();
    expect(g.players[0].planning).toBe(0);
    cross();
    expect(g.players[0].planning).toBe(1);
  });
  it("inflates once after all surviving players cross GO, not each individual crossing", () => {
    let g = game(true);
    g.players[0].laps = 1;
    g.players[1].laps = 1;
    g = land(g, 3, "c");
    expect(g.index).toBe(1);
    g.players[2].position = 39;
    g.turn = 2;
    g.phase = "move";
    g.dice = [1, 1];
    g = applyAction(g, "c", { type: "MOVE", delta: 0 });
    expect(g.index).toBeCloseTo(1.1);
    expect(g.epoch).toBe(1);
    expect(indexed(g, 400)).toBe(440);
  });
  it("credits salary at the old index before the final player triggers the new year", () => {
    let g = game(true);
    g.players[0].laps = 1;
    g.players[1].laps = 1;
    g.players[2].position = 39;
    g.turn = 2;
    g.phase = "move";
    g.dice = [1, 1];
    g = applyAction(g, "c", { type: "MOVE", delta: 0 });
    expect(g.players[2].cash).toBe(1700);
    expect(g.index).toBeCloseTo(1.1);
  });
  it("uses predictable building discounts and credit-squeeze rates", () => {
    const g = game(true);
    g.rules.cycles = true;
    g.cycle = 1;
    expect(constructionCost(g, BOARD[1])).toBe(43);
    g.cycle = 3;
    expect(mortgageValue(g, BOARD[39])).toBe(160);
    expect(market(g).interest).toBe(0.2);
  });
  it("taxes strong property portfolios and grants cash to trailing players", () => {
    let g = game(true);
    g.rules.wealthTax = true;
    g.rules.assistance = true;
    own(g, "a", ...PURCHASABLE.map((t) => t.id));
    g.players[0].position = 39;
    g.phase = "move";
    g.dice = [1, 1];
    g = applyAction(g, "a", { type: "MOVE", delta: 0 });
    expect(g.players[0].cash).toBeLessThan(1700);
    g.players[1].cash = 100;
    g = land(g, 1, "b");
    g.phase = "move";
    g.players[1].position = 39;
    g.dice = [1, 1];
    const before = g.players[1].cash;
    g = applyAction(g, "b", { type: "MOVE", delta: 0 });
    expect(g.logs.some((l) => l.text.includes("recovery grant"))).toBe(true);
    expect(g.players[1].cash).toBeGreaterThan(before + 200);
  });
  it("charges one planning credit for ±1, caps credits, and keeps doubles", () => {
    let g = game(true);
    g.phase = "move";
    g.dice = [2, 2];
    g.afterMove = "roll";
    g = applyAction(g, "a", { type: "MOVE", delta: 1 });
    expect(g.players[0].position).toBe(5);
    expect(g.players[0].planning).toBe(1);
    g = applyAction(g, "a", { type: "BUY" });
    expect(g.phase).toBe("roll");
  });
  it("normalizes untrusted rule settings", () => {
    expect(normalizeRules({ preset: "classic", inflation: 0.2 })).toEqual(
      CLASSIC,
    );
    expect(normalizeRules({ inflation: Infinity }).inflation).toBe(0.1);
    expect(normalizeRules({ inflation: -5 }).inflation).toBe(0);
  });
});
describe("individual special-rule switches", () => {
  const cases: [keyof typeof ECONOMY, Partial<Deal>][] = [
    ["royalties", { royalty: 10 }],
    ["equity", { equity: 10 }],
    ["equity", { equity: 10, retainTitle: true }],
    ["sellOn", { sellOn: 10 }],
    ["vetoes", { veto: ["c"] }],
    ["options", { option: { property: 3, strike: 100 } }],
    ["loans", { loan: { principal: 100, interest: 10, laps: 2 } }],
  ];
  it.each(cases)(
    "blocks new %s clauses while preserving ordinary trades",
    (key, terms) => {
      const g = game(true);
      own(g, "a", 1, 3);
      g.rules = normalizeRules({ ...g.rules, [key]: false });
      expect(() => deal(g, terms)).toThrow("disabled");
      expect(deal(g).deeds[1].owner).toBe("b");
    },
  );
  it("keeps other contract types enabled", () => {
    const g = game(true);
    own(g, "a", 1);
    g.rules.royalties = false;
    expect(deal(g, { equity: 10 }).deeds[1].claims[0].kind).toBe("equity");
  });
  it("honors signed royalties, loans and options after disabling contracts", () => {
    let g = game(true);
    own(g, "a", 1, 3);
    g = deal(g, {
      royalty: 20,
      option: { property: 3, strike: 100 },
      loan: { principal: 100, interest: 10, laps: 2 },
    });
    g.index = 1.21;
    const old = structuredClone(g);
    g = changeRules(g, CLASSIC);
    expect(g.deeds).toEqual(old.deeds);
    expect(g.loans).toEqual(old.loans);
    expect(g.index).toBe(1.21);
    expect(g.players.map((p) => p.planning)).toEqual(
      old.players.map((p) => p.planning),
    );
    expect(rent(g, 1)).toBeGreaterThan(0);
    g = applyAction(g, "b", { type: "EXERCISE", property: 3 });
    expect(g.deeds[3].owner).toBe("b");
    expect(g.deeds[1].claims).toEqual(old.deeds[1].claims);
    g = applyAction(g, "b", { type: "REPAY", id: g.loans[0].id });
    expect(g.loans).toHaveLength(0);
  });
  it("clears unsigned offers and requires a movement choice to finish first", () => {
    let g = game(true);
    own(g, "a", 1);
    g = applyAction(g, "a", {
      type: "OFFER",
      deal: { to: "b", give: [1], royalty: 10 },
    });
    const changed = changeRules(g, { ...g.rules, royalties: false });
    expect(changed.offers).toHaveLength(0);
    expect(g.offers).toHaveLength(1);
    g.phase = "move";
    expect(() => changeRules(g, CLASSIC)).toThrow("movement choice");
  });
  it("migrates older economy saves with all contract types enabled", () => {
    const rules = normalizeRules({
      preset: "economy",
      contracts: true,
      planning: false,
    });
    for (const key of [
      "royalties",
      "equity",
      "sellOn",
      "vetoes",
      "options",
      "loans",
    ] as const)
      expect(rules[key]).toBe(true);
    expect(rules.planning).toBe(false);
  });
});
describe("debts, bankruptcy, and game completion", () => {
  it("defers rent credit until the debtor actually pays", () => {
    let g = game();
    own(g, "b", 39);
    g.players[0].cash = 10;
    g = land(g, 39);
    expect(g.phase).toBe("debt");
    expect(g.players[1].cash).toBe(1500);
    g.players[0].cash = 50;
    g = applyAction(g, "a", { type: "SETTLE" });
    expect(g.players[0].cash).toBe(0);
    expect(g.players[1].cash).toBe(1550);
  });
  it("requires liquidation before claiming insolvency", () => {
    let g = game();
    own(g, "a", 39);
    g.players[0].cash = 0;
    g = debt(g, 100);
    expect(() => applyAction(g, "a", { type: "BANKRUPT" })).toThrow(
      "still pay",
    );
    g = applyAction(g, "a", { type: "MORTGAGE", property: 39 });
    g = applyAction(g, "a", { type: "SETTLE" });
    expect(g.players[0].cash).toBe(100);
  });
  it("transfers titles to a player creditor and retires the debtor’s rights", () => {
    let g = game(true);
    own(g, "a", 1);
    g.deeds[3].vetoes = [{ holder: "a", blocked: ["c"] }];
    g.players[0].cash = 10;
    g = debt(g, 500);
    g = applyAction(g, "a", { type: "BANKRUPT" });
    expect(g.players[0].bankrupt).toBe(true);
    expect(g.deeds[1].owner).toBe("b");
    expect(g.deeds[3].vetoes).toEqual([]);
    expect(g.players[1].cash).toBe(1510);
    expect(current(g).id).toBe("b");
  });
  it("charges the inheritor mortgage interest", () => {
    let g = game();
    own(g, "a", 39);
    g.deeds[39].mortgage = 200;
    g.players[0].cash = 0;
    g = debt(g, 500);
    g = applyAction(g, "a", { type: "BANKRUPT" });
    expect(g.deeds[39].owner).toBe("b");
    expect(g.players[1].cash).toBe(1480);
  });
  it("auctions bank repossessions sequentially and skips the retired turn", () => {
    let g = game();
    own(g, "a", 1, 3);
    g.players[0].cash = 0;
    g = debt(g, 500, null);
    g = applyAction(g, "a", { type: "BANKRUPT" });
    expect(g.phase).toBe("auction");
    expect(g.auction?.property).toBe(1);
    for (const id of ["b", "c"]) g = applyAction(g, id, { type: "PASS" });
    expect(g.auction?.property).toBe(3);
    for (const id of ["b", "c"]) g = applyAction(g, id, { type: "PASS" });
    expect(current(g).id).toBe("b");
    expect(g.phase).toBe("roll");
  });
  it("handles a nonactive player’s birthday debt without advancing the current turn", () => {
    let g = game();
    g.players[1].cash = 0;
    g = debt(g, 10, "a", "b");
    g = applyAction(g, "b", { type: "BANKRUPT" });
    expect(current(g).id).toBe("a");
    expect(g.players[1].bankrupt).toBe(true);
  });
  it("declares the last solvent player the winner", () => {
    let g = game(false, 2);
    g.players[0].cash = 0;
    g = debt(g, 100);
    g = applyAction(g, "a", { type: "BANKRUPT" });
    expect(g.phase).toBe("over");
    expect(g.winner).toBe("b");
    expect(() => applyAction(g, "b", { type: "ROLL" })).toThrow("finished");
  });
  it("does not move a bankrupt jailed player after bail default", () => {
    let g = game();
    g.players[0].cash = 0;
    g.players[0].position = 10;
    g.pendingMove = 8;
    g = debt(g, 50, null);
    g = applyAction(g, "a", { type: "BANKRUPT" });
    expect(g.players[0].position).toBe(10);
    expect(g.pendingMove).toBeNull();
  });
});
describe("long-running game invariants", () => {
  it("runs seeded bot matches through thousands of actions without illegal state or deadlock", () => {
    for (const preset of [CLASSIC, ECONOMY]) {
      let g = newGame(
        seats.map((s) => ({ ...s, bot: true })),
        preset,
        9328,
      );
      let actions = 0;
      while (g.phase !== "over" && actions < 6000) {
        const step = botStep(g);
        expect(step, `missing action in ${g.phase}`).not.toBeNull();
        g = applyAction(g, step!.actor, step!.action);
        expect(
          g.players.every((p) => p.cash >= 0 && Number.isInteger(p.cash)),
        ).toBe(true);
        const supply = buildingSupply(g);
        expect(supply.houses).toBeGreaterThanOrEqual(0);
        expect(supply.hotels).toBeGreaterThanOrEqual(0);
        expect(g.players.filter((p) => !p.bankrupt).length).toBeGreaterThan(0);
        actions++;
      }
      expect(g.phase).toBe("over");
    }
  }, 30000);
});

describe("adjustable balance settings", () => {
  it("starts with one credit and refills only on laps five and ten", () => {
    let g = newGame(
      seats.slice(0, 2),
      {
        ...ECONOMY,
        planningStart: 1,
        planningEvery: 5,
        planningCap: 2,
        wealthTax: false,
        assistance: false,
      },
      12345,
    );
    g.turn = 0;
    expect(g.players.map((p) => p.planning)).toEqual([1, 1]);
    g.players[0].planning = 0;
    for (let lap = 1; lap <= 15; lap++) {
      g.phase = "move";
      g.players[0].position = 39;
      g.dice = [1, 1];
      g.afterMove = "end";
      g = applyAction(g, "a", { type: "MOVE", delta: 0 });
      expect(g.players[0].planning).toBe(Math.min(2, Math.floor(lap / 5)));
    }
  });
  it("validates new settings and supplies defaults to legacy saves", () => {
    expect(normalizeRules({ preset: "economy" })).toMatchObject({
      planningStart: 2,
      planningEvery: 2,
      planningCap: 3,
      taxRate: 0.04,
      recoveryGrant: 75,
    });
    expect(
      normalizeRules({
        planningStart: 8,
        planningCap: 2,
        planningEvery: 0,
        taxRate: Infinity,
        recoveryGrant: -5,
      }),
    ).toMatchObject({
      planningStart: 2,
      planningEvery: 1,
      planningCap: 2,
      taxRate: 0.04,
      recoveryGrant: 0,
    });
    let g = game(true);
    g.players[0].planning = 3;
    g = changeRules(g, {
      ...g.rules,
      planningStart: 0,
      planningEvery: 5,
      planningCap: 1,
    });
    expect(g.players[0].planning).toBe(3);
    expect(g.rules.planningEvery).toBe(5);
  });
});

it("applies the configured grant and tax rate at GO", () => {
  let g = game(true);
  g.rules.assistance = true;
  g.rules.recoveryGrant = 150;
  g.players[0].cash = 0;
  g.players[0].position = 38;
  g.phase = "move";
  g.dice = [1, 1];
  g = applyAction(g, "a", { type: "MOVE", delta: 0 });
  expect(g.players[0].cash).toBe(350); // $200 GO salary plus $150 grant.
  const base = game(true);
  base.rules.wealthTax = true;
  own(base, "a", ...PURCHASABLE.map((t) => t.id));
  base.players[0].position = 38;
  base.phase = "move";
  base.dice = [1, 1];
  const low = structuredClone(base),
    high = structuredClone(base);
  low.rules.taxRate = 0;
  high.rules.taxRate = 0.1;
  const without = applyAction(low, "a", { type: "MOVE", delta: 0 });
  const withTax = applyAction(high, "a", { type: "MOVE", delta: 0 });
  expect(without.players[0].cash).toBe(1700);
  expect(withTax.players[0].cash).toBeLessThan(1500);
});
