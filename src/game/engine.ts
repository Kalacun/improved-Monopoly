import { BOARD, CHANCE, CHEST, PURCHASABLE, type Tile } from "./board.js";
import {
  CLASSIC,
  ECONOMY,
  type Action,
  type Auction,
  type Deal,
  type Game,
  type Payment,
  type Phase,
  type Player,
  type Rules,
  type Seat,
} from "./types.js";
export const CYCLES = [
  {
    name: "Steady market",
    rent: 1,
    build: 1,
    mortgage: 1,
    interest: 0.1,
    description: "Normal rents, construction costs, and mortgage terms.",
  },
  {
    name: "Building boom",
    rent: 1,
    build: 0.85,
    mortgage: 1,
    interest: 0.1,
    description: "New construction costs 15% less. Plan your complete sets.",
  },
  {
    name: "Expansion",
    rent: 1.1,
    build: 1,
    mortgage: 1,
    interest: 0.1,
    description: "All rents rise 10%. Revenue shares benefit too.",
  },
  {
    name: "Credit squeeze",
    rent: 1,
    build: 1,
    mortgage: 0.8,
    interest: 0.2,
    description:
      "New mortgages raise 20% less cash; redemption interest is 20%.",
  },
  {
    name: "Recession",
    rent: 0.85,
    build: 1,
    mortgage: 1,
    interest: 0.1,
    description: "Rents fall 15%. A predictable window to rebuild cash.",
  },
];
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
export const money = (n: number) => Math.round(n);
export const current = (g: Game) => g.players[g.turn];
export const player = (g: Game, id: string) => {
  const p = g.players.find((p) => p.id === id);
  assert(p, "Player not found.");
  return p;
};
export const market = (g: Game) => CYCLES[g.rules.cycles ? g.cycle : 0];
export const indexed = (g: Game, n: number) => money(n * g.index);
export const group = (tile: Tile) =>
  BOARD.filter((t) => t.group && t.group === tile.group);
export const ownsSet = (g: Game, id: string, t: Tile) =>
  !!t.group && group(t).every((t) => g.deeds[t.id].owner === id);
export const constructionCost = (g: Game, t: Tile) =>
  money((t.build || 0) * g.index * market(g).build);
export const mortgageValue = (g: Game, t: Tile) =>
  money((t.price || 0) * g.index * 0.5 * market(g).mortgage);
export const redemptionCost = (g: Game, id: number) =>
  g.deeds[id].mortgage +
  Math.ceil(
    (g.deeds[id].mortgage * Math.round(market(g).interest * 100)) / 100,
  );
export function assets(g: Game, id: string) {
  let value = 0;
  for (const t of PURCHASABLE) {
    const d = g.deeds[t.id],
      base = indexed(g, (t.price || 0) + (t.build || 0) * d.houses),
      equity = d.claims.filter((c) => c.kind === "equity");
    if (d.owner === id)
      value +=
        base * (1 - equity.reduce((s, c) => s + c.percent, 0) / 100) -
        d.mortgage;
    value +=
      (base *
        equity
          .filter((c) => c.holder === id)
          .reduce((s, c) => s + c.percent, 0)) /
      100;
  }
  return money(value);
}
export const netWorth = (g: Game, id: string) =>
  money(
    player(g, id).cash +
      assets(g, id) +
      g.loans.reduce(
        (s, l) =>
          s + (l.lender === id ? l.due : 0) - (l.borrower === id ? l.due : 0),
        0,
      ),
  );
export function rent(g: Game, id: number, dice = 7) {
  const t = BOARD[id],
    d = g.deeds[id];
  if (!d?.owner || d.mortgage) return 0;
  let base = 0;
  if (t.kind === "property")
    base =
      t.rent![d.houses] * (d.houses === 0 && ownsSet(g, d.owner, t) ? 2 : 1);
  if (t.kind === "railroad")
    base =
      25 *
      2 **
        (BOARD.filter(
          (t) => t.kind === "railroad" && g.deeds[t.id].owner === d.owner,
        ).length -
          1);
  if (t.kind === "utility")
    base =
      dice *
      (BOARD.filter(
        (t) => t.kind === "utility" && g.deeds[t.id].owner === d.owner,
      ).length === 2
        ? 10
        : 4);
  return money(base * g.index * market(g).rent);
}
function random(g: Game) {
  let t = (g.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  g.rng >>>= 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function shuffle(g: Game, arr: number[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random(g) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function log(g: Game, text: string, kind = "event") {
  g.logs.push({ id: (g.logs.at(-1)?.id || 0) + 1, text, kind });
  if (g.logs.length > 100) g.logs.shift();
}
export function normalizeRules(input: unknown): Rules {
  const r = input as Partial<Rules> | null;
  if (r?.preset === "classic") return { ...CLASSIC };
  const bounded = (
    key: keyof Rules,
    min: number,
    max: number,
    whole = true,
  ) => {
    const v = r?.[key];
    const n =
      typeof v === "number" && Number.isFinite(v) ? v : Number(ECONOMY[key]);
    return Math.max(min, Math.min(max, whole ? Math.floor(n) : n));
  };
  const planningCap = bounded("planningCap", 1, 10);
  return {
    ...ECONOMY,
    planningCap,
    planningStart: Math.min(planningCap, bounded("planningStart", 0, 10)),
    planningEvery: bounded("planningEvery", 1, 20),
    taxRate: bounded("taxRate", 0, 0.2, false),
    recoveryGrant: bounded("recoveryGrant", 0, 500),
    inflation:
      typeof r?.inflation === "number" && Number.isFinite(r.inflation)
        ? Math.max(0, Math.min(0.2, r.inflation))
        : 0.1,
    ...Object.fromEntries(
      [
        "cycles",
        "wealthTax",
        "planning",
        "contracts",
        "assistance",
        "royalties",
        "equity",
        "sellOn",
        "vetoes",
        "options",
        "loans",
      ].map((k) => [
        k,
        typeof r?.[k as keyof Rules] === "boolean" ? r[k as keyof Rules] : true,
      ]),
    ),
  };
}
export function changeRules(game: Game, input: unknown): Game {
  assert(
    game.phase !== "move",
    "Finish the current movement choice before changing rules.",
  );
  const g = structuredClone(game);
  g.rules = normalizeRules(input);
  g.cycle = g.rules.cycles ? g.epoch % CYCLES.length : 0;
  g.offers = [];
  g.revision++;
  log(
    g,
    "The host updated the special rules. Unsigned offers were cleared; signed agreements remain in force. Accumulated inflation and credit balances are preserved.",
    "system",
  );
  return g;
}
export function newGame(
  seats: Seat[],
  rules: Rules = ECONOMY,
  seed = Date.now(),
): Game {
  assert(seats.length >= 2 && seats.length <= 6, "Play with 2–6 players.");
  const g: Game = {
    version: 1,
    id: String(seed),
    rules: normalizeRules(rules),
    players: seats.map((s) => ({
      ...s,
      cash: 1500,
      position: 0,
      laps: 0,
      jailed: false,
      jailTurns: 0,
      bankrupt: false,
      planning: normalizeRules(rules).planningStart,
      freeCards: [],
    })),
    deeds: {},
    turn: 0,
    turnNumber: 1,
    phase: "roll",
    dice: [1, 1],
    doubles: 0,
    rolledInJail: false,
    afterMove: "end",
    pendingMove: null,
    payments: [],
    resumePhase: "end",
    auction: null,
    offers: [],
    loans: [],
    index: 1,
    cycle: 0,
    epoch: 0,
    chance: [],
    chest: [],
    rng: seed >>> 0,
    logs: [],
    lastCard: null,
    cardDraws: [],
    winner: null,
    revision: 0,
  };
  for (const t of PURCHASABLE)
    g.deeds[t.id] = {
      owner: null,
      houses: 0,
      mortgage: 0,
      claims: [],
      sellOn: [],
      vetoes: [],
    };
  g.chance = shuffle(
    g,
    CHANCE.map((_, i) => i),
  );
  g.chest = shuffle(
    g,
    CHEST.map((_, i) => i),
  );
  log(g, `${seats.map((s) => s.name).join(", ")} joined the table.`, "system");
  let contenders = g.players.map((_, i) => i);
  while (contenders.length > 1) {
    const rolls = contenders.map((index) => ({
      index,
      total: 2 + Math.floor(random(g) * 6) + Math.floor(random(g) * 6),
    }));
    const high = Math.max(...rolls.map((r) => r.total));
    log(
      g,
      `Opening roll: ${rolls.map((r) => `${g.players[r.index].name} ${r.total}`).join(", ")}.`,
      "system",
    );
    contenders = rolls.filter((r) => r.total === high).map((r) => r.index);
  }
  g.turn = contenders[0];
  log(g, `${current(g).name} starts. Play continues in seating order.`, "turn");
  return g;
}
function payment(
  g: Game,
  from: string,
  amount: number,
  to: string | null,
  reason: string,
  recipients?: Payment["recipients"],
) {
  if (to === "bank") to = null;
  if (recipients) {
    amount -= recipients
      .filter((r) => r.id === from)
      .reduce((sum, r) => sum + r.amount, 0);
    recipients = recipients.filter((r) => r.id !== from);
  }
  if (amount > 0)
    g.payments.push({
      player: from,
      amount: money(amount),
      recipients: recipients || [{ id: to, amount: money(amount) }],
      reason,
      creditor: to,
    });
}
function flush(g: Game) {
  while (g.payments.length) {
    const debt = g.payments[0],
      p = player(g, debt.player);
    if (p.bankrupt) {
      g.payments.shift();
      continue;
    }
    if (p.cash < debt.amount) {
      g.phase = "debt";
      log(
        g,
        `${p.name} needs $${debt.amount - p.cash} more for ${debt.reason}.`,
        "debt",
      );
      return;
    }
    p.cash -= debt.amount;
    for (const r of debt.recipients)
      if (r.id && r.id !== "bank" && !player(g, r.id).bankrupt)
        player(g, r.id).cash += r.amount;
    g.payments.shift();
    log(g, `${p.name} paid $${debt.amount}: ${debt.reason}.`, "payment");
  }
  g.phase = g.resumePhase;
  if (g.pendingMove !== null) {
    const steps = g.pendingMove;
    g.pendingMove = null;
    move(g, steps);
  }
}
function finishLanding(g: Game) {
  g.resumePhase = g.afterMove;
  flush(g);
}
function updateEconomy(g: Game) {
  const epoch = Math.min(
    ...g.players.filter((p) => !p.bankrupt).map((p) => p.laps),
  );
  while (g.epoch < epoch) {
    g.epoch++;
    g.index *= 1 + g.rules.inflation;
    g.cycle = g.rules.cycles ? g.epoch % CYCLES.length : 0;
    log(
      g,
      `Economic year ${g.epoch + 1}: prices ×${g.index.toFixed(2)}. ${market(g).name}.`,
      "economy",
    );
  }
}
function passGo(g: Game, p: Player) {
  p.laps++;
  const salary = indexed(g, 200);
  p.cash += salary;
  log(g, `${p.name} crossed GO. +$${salary}.`, "income");
  if (
    g.rules.planning &&
    p.laps % g.rules.planningEvery === 0 &&
    p.planning < g.rules.planningCap
  ) {
    p.planning++;
    log(
      g,
      `${p.name} earns a planning credit for completing lap ${p.laps} (${p.planning}/${g.rules.planningCap}).`,
      "strategy",
    );
  }
  if (g.rules.wealthTax) {
    const all = g.players
      .filter((p) => !p.bankrupt)
      .map((p) => assets(g, p.id))
      .sort((a, b) => a - b);
    const median =
        (all[Math.floor((all.length - 1) / 2)] +
          all[Math.floor(all.length / 2)]) /
        2,
      excess = assets(g, p.id) - median - indexed(g, 500);
    payment(
      g,
      p.id,
      Math.max(0, money(excess * g.rules.taxRate)),
      null,
      "progressive real-estate tax",
    );
  }
  if (g.rules.assistance) {
    const worth = g.players
        .filter((q) => !q.bankrupt)
        .map((q) => netWorth(g, q.id))
        .sort((a, b) => a - b),
      median =
        (worth[Math.floor((worth.length - 1) / 2)] +
          worth[Math.floor(worth.length / 2)]) /
        2;
    if (netWorth(g, p.id) < median * 0.75) {
      const grant = indexed(g, g.rules.recoveryGrant);
      p.cash += grant;
      log(g, `${p.name} receives a $${grant} recovery grant.`, "income");
    }
  }
  for (const l of g.loans.filter(
    (l) => l.borrower === p.id && l.dueLap <= p.laps,
  )) {
    payment(g, p.id, l.due, l.lender, "maturing investor loan");
    g.loans = g.loans.filter((q) => q.id !== l.id);
  }
  updateEconomy(g);
}
function goToJail(g: Game, p: Player) {
  p.position = 10;
  p.jailed = true;
  p.jailTurns = 0;
  g.doubles = 0;
  g.afterMove = "end";
  log(g, `${p.name} enters Review.`);
  finishLanding(g);
}
function move(g: Game, steps: number) {
  const p = current(g),
    old = p.position;
  p.position = (old + steps + 40) % 40;
  if (steps > 0 && old + steps >= 40) passGo(g, p);
  log(g, `${p.name} arrives at ${BOARD[p.position].name}.`);
  land(g);
}
function advance(g: Game, target: number) {
  const p = current(g);
  move(g, (target - p.position + 40) % 40);
}
function draw(g: Game, deck: "chance" | "chest") {
  const cards = deck === "chance" ? CHANCE : CHEST,
    index = g[deck].shift()!;
  const card = cards[index],
    p = current(g);
  if (card.type !== "free") g[deck].push(index);
  g.lastCard = { deck, text: card.text };
  log(
    g,
    `${deck === "chance" ? "Chance" : "Community Chest"}: ${card.text}`,
    "card",
  );
  // Record before resolving: a movement card can immediately draw another card.
  g.cardDraws = [
    ...(g.cardDraws || []),
    {
      id: g.logs.at(-1)!.id,
      deck,
      text: card.text,
      turnNumber: g.turnNumber,
      player: p.id,
      index: g.index,
    },
  ].slice(-24);
  switch (card.type) {
    case "move":
      advance(g, card.value!);
      return;
    case "back":
      move(g, -card.value!);
      return;
    case "nearestRail": {
      const target =
        BOARD.find((t) => t.kind === "railroad" && t.id > p.position)?.id ?? 5;
      const old = p.position;
      p.position = target;
      if (target < old) passGo(g, p);
      land(g, 2);
      return;
    }
    case "nearestUtility": {
      const target = p.position < 12 ? 12 : p.position < 28 ? 28 : 12;
      if (target < p.position) passGo(g, p);
      p.position = target;
      const dice =
        1 + Math.floor(random(g) * 6) + 1 + Math.floor(random(g) * 6);
      land(g, 1, dice);
      return;
    }
    case "cash":
      if (card.value! > 0) {
        p.cash += indexed(g, card.value!);
      } else payment(g, p.id, indexed(g, -card.value!), null, card.text);
      break;
    case "each":
      for (const other of g.players.filter(
        (q) => q.id !== p.id && !q.bankrupt,
      )) {
        if (card.value! < 0)
          payment(g, p.id, indexed(g, -card.value!), other.id, card.text);
        else payment(g, other.id, indexed(g, card.value!), p.id, card.text);
      }
      break;
    case "jail":
      goToJail(g, p);
      return;
    case "free":
      p.freeCards.push(deck);
      break;
    case "repairs": {
      let cost = 0;
      for (const t of PURCHASABLE) {
        const d = g.deeds[t.id];
        if (d.owner === p.id)
          cost += d.houses === 5 ? card.hotel! : d.houses * card.value!;
      }
      payment(g, p.id, indexed(g, cost), null, card.text);
      break;
    }
  }
  finishLanding(g);
}
function land(g: Game, multiplier = 1, utilityDice?: number) {
  const p = current(g),
    t = BOARD[p.position],
    d = g.deeds[t.id];
  if (t.price) {
    if (!d.owner) {
      g.resumePhase = "purchase";
      flush(g);
      return;
    }
    if (d.owner !== p.id && !d.mortgage) {
      const total = utilityDice
        ? money(utilityDice * 10 * g.index * market(g).rent)
        : rent(g, t.id, g.dice[0] + g.dice[1]) * multiplier;
      const recipients: Payment["recipients"] = [];
      let remainder = total;
      for (const c of d.claims) {
        if (player(g, c.holder).bankrupt) continue;
        const share = Math.floor((total * c.percent) / 100);
        recipients.push({ id: c.holder, amount: share });
        remainder -= share;
      }
      recipients.push({ id: d.owner, amount: remainder });
      payment(g, p.id, total, d.owner, `rent at ${t.name}`, recipients);
    }
    finishLanding(g);
    return;
  }
  switch (t.kind) {
    case "tax":
      payment(g, p.id, indexed(g, t.tax!), null, t.name);
      break;
    case "chance":
      draw(g, "chance");
      return;
    case "chest":
      draw(g, "chest");
      return;
    case "goToJail":
      goToJail(g, p);
      return;
  }
  finishLanding(g);
}
function nextTurn(g: Game) {
  do {
    g.turn = (g.turn + 1) % g.players.length;
  } while (current(g).bankrupt);
  g.turnNumber++;
  g.phase = "roll";
  g.doubles = 0;
  g.lastCard = null;
  g.rolledInJail = false;
  g.afterMove = "end";
  log(g, `${current(g).name}'s turn.`, "turn");
}
function startAuction(g: Game, property: number, queue: number[] = []) {
  const bidders = g.players.filter((p) => !p.bankrupt).map((p) => p.id);
  g.auction = {
    property,
    high: 0,
    leader: null,
    remaining: bidders,
    actor: bidders.includes(current(g).id) ? current(g).id : bidders[0],
    queue,
  };
  g.phase = "auction";
  log(g, `${BOARD[property].name} is open for bids.`, "auction");
}
function progressAuction(g: Game, previous: string) {
  const a = g.auction!;
  if ((a.leader && a.remaining.length === 1) || a.remaining.length === 0) {
    if (a.leader) {
      const p = player(g, a.leader);
      p.cash -= a.high;
      if (a.kind === "house" || a.kind === "hotel") {
        g.deeds[a.winningTarget!].houses++;
        log(
          g,
          `${p.name} wins the last ${a.kind} for $${a.high}, built on ${BOARD[a.winningTarget!].name}.`,
          "auction",
        );
      } else {
        g.deeds[a.property].owner = p.id;
        log(
          g,
          `${p.name} wins ${BOARD[a.property].name} for $${a.high}.`,
          "auction",
        );
      }
    } else
      log(
        g,
        a.targets
          ? `No bids: the last ${a.kind} remains in the bank.`
          : `${BOARD[a.property].name} returns to the bank without a bid.`,
        "auction",
      );
    const queue = a.queue;
    g.auction = null;
    if (queue.length) startAuction(g, queue[0], queue.slice(1));
    else {
      g.resumePhase = a.resume || g.afterMove;
      flush(g);
      if (current(g).bankrupt && g.phase !== "debt") nextTurn(g);
    }
    return;
  }
  const order = g.players.map((p) => p.id),
    start = order.indexOf(previous);
  for (let i = 1; i <= order.length; i++) {
    const id = order[(start + i) % order.length];
    if (a.remaining.includes(id) && id !== a.leader) {
      a.actor = id;
      return;
    }
  }
}
export function buildingSupply(g: Game) {
  let houses = 32,
    hotels = 12;
  for (const d of Object.values(g.deeds)) {
    if (d.houses === 5) hotels--;
    else houses -= d.houses;
  }
  return { houses, hotels };
}
function propertyId(v: unknown): number {
  assert(
    typeof v === "number" &&
      Number.isInteger(v) &&
      v >= 0 &&
      v < 40 &&
      !!BOARD[v].price,
    "Choose a valid property.",
  );
  return v;
}
function integer(v: unknown, min = 0, max = 10000000): number {
  assert(
    typeof v === "number" && Number.isSafeInteger(v) && v >= min && v <= max,
    `Enter a whole number between ${min} and ${max}.`,
  );
  return v;
}
const list = (v: unknown): number[] => {
  assert(Array.isArray(v) && v.length <= 28, "Invalid property list.");
  const ids = v.map(propertyId);
  assert(
    new Set(ids).size === ids.length,
    "A property cannot be listed twice.",
  );
  return ids;
};
const tradeWindow = (g: Game) => ["roll", "end", "debt"].includes(g.phase);
function clearBuildings(g: Game, id: string) {
  for (const t of PURCHASABLE) {
    const d = g.deeds[t.id];
    if (d.owner === id) {
      player(g, id).cash += Math.floor(
        indexed(g, (t.build || 0) * d.houses) / 2,
      );
      d.houses = 0;
    }
  }
}
function bankrupt(g: Game, id: string) {
  const debt = g.payments[0];
  assert(
    g.phase === "debt" && debt?.player === id,
    "Bankruptcy is available when you cannot pay a debt.",
  );
  const p = player(g, id);
  assert(p.cash < debt.amount, "You can settle this debt.");
  const liquidation =
    p.cash +
    PURCHASABLE.reduce((sum, t) => {
      const d = g.deeds[t.id];
      return (
        sum +
        (d.owner === id
          ? Math.floor(indexed(g, (t.build || 0) * d.houses) / 2) +
            (!d.mortgage && !d.option ? mortgageValue(g, t) : 0)
          : 0)
      );
    }, 0);
  assert(
    liquidation < debt.amount,
    "You can still pay by selling buildings and mortgaging property. Raise the cash before declaring bankruptcy.",
  );
  if (current(g).id === id) g.pendingMove = null;
  clearBuildings(g, id);
  if (p.cash >= debt.amount) {
    flush(g);
    return;
  }
  const creditor =
      debt.creditor && !player(g, debt.creditor).bankrupt
        ? debt.creditor
        : null,
    available = p.cash;
  let paid = 0;
  debt.recipients.forEach((r, i) => {
    const amount =
      i === debt.recipients.length - 1
        ? available - paid
        : Math.floor((available * r.amount) / debt.amount);
    paid += amount;
    if (r.id && !player(g, r.id).bankrupt) player(g, r.id).cash += amount;
  });
  p.cash = 0;
  p.bankrupt = true;
  g.payments = g.payments.filter((d) => d.player !== id);
  g.offers = g.offers.filter((d) => d.from !== id && d.to !== id);
  const auctions: number[] = [];
  for (const t of PURCHASABLE) {
    const d = g.deeds[t.id];
    d.claims = d.claims.filter((c) => c.holder !== id);
    d.sellOn = d.sellOn.filter((c) => c.holder !== id);
    d.vetoes = d.vetoes.filter((c) => c.holder !== id);
    if (d.option?.holder === id) delete d.option;
    if (d.owner === id) {
      d.owner = creditor;
      if (creditor && d.mortgage)
        payment(
          g,
          creditor,
          Math.ceil(d.mortgage * 0.1),
          null,
          "interest on inherited mortgage",
        );
      if (!creditor) {
        d.mortgage = 0;
        d.claims = [];
        d.sellOn = [];
        d.vetoes = [];
        delete d.option;
        auctions.push(t.id);
      }
    }
  }
  for (const deck of p.freeCards) {
    if (creditor) player(g, creditor).freeCards.push(deck);
    else
      g[deck].push(
        (deck === "chance" ? CHANCE : CHEST).findIndex(
          (c) => c.type === "free",
        ),
      );
  }
  p.freeCards = [];
  g.loans = g.loans.filter((l) => l.borrower !== id);
  for (const l of g.loans) if (l.lender === id) l.lender = creditor || "bank";
  log(
    g,
    `${p.name} is bankrupt${creditor ? `; assets pass to ${player(g, creditor).name}` : ""}.`,
    "debt",
  );
  const alive = g.players.filter((p) => !p.bankrupt);
  if (alive.length === 1) {
    g.winner = alive[0].id;
    g.phase = "over";
    return;
  }
  updateEconomy(g);
  if (auctions.length) {
    startAuction(g, auctions[0], auctions.slice(1));
    return;
  }
  g.resumePhase = current(g).bankrupt ? "end" : g.resumePhase;
  flush(g);
  if (current(g).bankrupt && g.phase !== "debt") nextTurn(g);
}
function parseDeal(g: Game, id: string, v: unknown): Deal {
  const d = v as Partial<Deal>;
  assert(d && typeof d === "object", "Invalid deal.");
  assert(
    typeof d.to === "string" && d.to !== id && !player(g, d.to).bankrupt,
    "Choose another active player.",
  );
  const out: Deal = {
    id: `d${g.revision}-${id}`,
    from: id,
    to: d.to,
    give: list(d.give || []),
    take: list(d.take || []),
    cash: integer(d.cash || 0),
    receiveCash: integer(d.receiveCash || 0),
    giveJailCards: integer(d.giveJailCards || 0, 0, 2),
    takeJailCards: integer(d.takeJailCards || 0, 0, 2),
    royalty: integer(d.royalty || 0, 0, 50),
    equity: integer(d.equity || 0, 0, 80),
    sellOn: integer(d.sellOn || 0),
    veto: [],
    note: typeof d.note === "string" ? d.note.slice(0, 160) : "",
    retainTitle: d.retainTitle === true,
  };
  if (d.veto) {
    assert(Array.isArray(d.veto) && d.veto.length <= 6, "Invalid veto.");
    out.veto = d.veto.map((id) => {
      assert(
        typeof id === "string" && !!g.players.find((p) => p.id === id),
        "Invalid veto player.",
      );
      return id;
    });
  }
  if (d.option)
    out.option = {
      property: propertyId(d.option.property),
      strike: integer(d.option.strike, 1),
    };
  if (d.loan)
    out.loan = {
      principal: integer(d.loan.principal, 1),
      interest: integer(d.loan.interest, 0, 25),
      laps: integer(d.loan.laps, 1, 5),
    };
  assert(
    g.rules.contracts ||
      (!out.royalty &&
        !out.equity &&
        !out.sellOn &&
        !out.veto.length &&
        !out.option &&
        !out.loan &&
        !out.retainTitle),
    "Advanced contracts are disabled at this table.",
  );
  for (const [enabled, used, title] of [
    [g.rules.royalties, out.royalty, "Royalties"],
    [g.rules.equity, out.equity || out.retainTitle, "Equity stakes"],
    [g.rules.sellOn, out.sellOn, "Sell-on payments"],
    [g.rules.vetoes, out.veto.length, "Resale vetoes"],
    [g.rules.options, out.option, "Purchase options"],
    [g.rules.loans, out.loan, "Investor loans"],
  ])
    assert(enabled !== false || !used, `${title} are disabled at this table.`);
  assert(
    out.give.length ||
      out.take.length ||
      out.cash ||
      out.receiveCash ||
      out.giveJailCards ||
      out.takeJailCards ||
      out.option ||
      out.loan,
    "Add something to your offer.",
  );
  return out;
}
function validateTransfer(
  g: Game,
  id: number,
  from: string,
  to: string,
  exercise = false,
) {
  const t = BOARD[id],
    d = g.deeds[id];
  assert(d.owner === from, `${t.name} is no longer owned by the seller.`);
  assert(
    !group(t).some((t) => g.deeds[t.id].houses > 0),
    "Sell all buildings in the color group before trading.",
  );
  assert(
    !d.option || exercise,
    "This property is reserved by a purchase option.",
  );
  assert(
    !d.vetoes.some(
      (v) => !player(g, v.holder).bankrupt && v.blocked.includes(to),
    ),
    `A resale veto prevents transfer of ${t.name} to that player.`,
  );
}
function transfer(
  g: Game,
  ids: number[],
  from: string,
  to: string,
  gross: number,
  retain = false,
) {
  const total = ids.reduce((s, id) => s + BOARD[id].price!, 0);
  let allocated = 0;
  ids.forEach((id, i) => {
    const d = g.deeds[id],
      sale =
        i === ids.length - 1
          ? gross - allocated
          : Math.floor((gross * BOARD[id].price!) / total);
    allocated += sale;
    if (!retain) {
      for (const c of d.claims.filter((c) => c.kind === "equity")) {
        const amount = Math.floor((sale * c.percent) / 100);
        player(g, from).cash -= amount;
        player(g, c.holder).cash += amount;
      }
      for (const c of d.sellOn) {
        player(g, from).cash -= c.amount;
        player(g, c.holder).cash += c.amount;
      }
      if (d.mortgage) player(g, to).cash -= Math.ceil(d.mortgage * 0.1);
      d.owner = to;
    }
  });
}
function executeDeal(g: Game, d: Deal) {
  const from = player(g, d.from),
    to = player(g, d.to);
  assert(!from.bankrupt && !to.bankrupt, "A party has left the game.");
  assert(
    from.freeCards.length >= (d.giveJailCards || 0) &&
      to.freeCards.length >= (d.takeJailCards || 0),
    "A player no longer holds the promised release certificates.",
  );
  const sentCards = from.freeCards.splice(0, d.giveJailCards || 0);
  const receivedCards = to.freeCards.splice(0, d.takeJailCards || 0);
  from.freeCards.push(...receivedCards);
  to.freeCards.push(...sentCards);
  for (const id of d.give) validateTransfer(g, id, d.from, d.to);
  for (const id of d.take) validateTransfer(g, id, d.to, d.from);
  assert(
    !d.give.some((id) => d.take.includes(id)),
    "A property cannot appear on both sides.",
  );
  if (d.retainTitle)
    assert(
      d.equity > 0 && !d.royalty && !d.sellOn && !d.veto.length,
      "Stake-only deals require equity, with no royalty, resale fee, or veto.",
    );
  for (const id of d.give)
    assert(
      g.deeds[id].claims.reduce((s, c) => s + c.percent, 0) +
        d.royalty +
        d.equity <=
        80,
      "At least 20% of rent must remain with the title owner.",
    );
  if (d.option) {
    const id = d.option.property;
    validateTransfer(g, id, d.from, d.to);
    assert(
      !d.give.includes(id) && !d.take.includes(id),
      "An option must reserve a property outside the title transfers.",
    );
    assert(
      !g.deeds[id].mortgage,
      "Redeem the mortgage before granting an option.",
    );
    const deed = g.deeds[id];
    assert(
      d.option.strike *
        (1 -
          deed.claims
            .filter((c) => c.kind === "equity")
            .reduce((s, c) => s + c.percent, 0) /
            100) >=
        deed.sellOn.reduce((s, c) => s + c.amount, 0),
      "The strike must cover existing equity and resale obligations.",
    );
  }
  if (d.loan)
    assert(
      !g.loans.some((l) => l.lender === d.from && l.borrower === d.to),
      "Only one outstanding loan per lender–borrower pair.",
    );
  from.cash += d.receiveCash - d.cash;
  to.cash += d.cash - d.receiveCash;
  transfer(g, d.give, d.from, d.to, d.receiveCash, d.retainTitle);
  transfer(g, d.take, d.to, d.from, d.cash);
  for (const id of d.give) {
    const deed = g.deeds[id];
    if (d.royalty)
      deed.claims.push({ holder: d.from, percent: d.royalty, kind: "royalty" });
    if (d.equity)
      deed.claims.push({
        holder: d.retainTitle ? d.to : d.from,
        percent: d.equity,
        kind: "equity",
      });
    if (d.sellOn) deed.sellOn.push({ holder: d.from, amount: d.sellOn });
    if (d.veto.length) deed.vetoes.push({ holder: d.from, blocked: d.veto });
  }
  if (d.option)
    g.deeds[d.option.property].option = {
      holder: d.to,
      strike: d.option.strike,
    };
  if (d.loan) {
    from.cash -= d.loan.principal;
    to.cash += d.loan.principal;
    g.loans.push({
      id: d.id,
      lender: d.from,
      borrower: d.to,
      principal: d.loan.principal,
      due: money(d.loan.principal * (1 + d.loan.interest / 100)),
      dueLap: to.laps + d.loan.laps,
    });
  }
  assert(
    g.players.every((p) => p.cash >= 0),
    "A player cannot afford this deal, including existing equity payouts, resale clauses, and mortgage interest.",
  );
  log(
    g,
    `${from.name} and ${to.name} signed a deal${d.note ? `: ${d.note}` : "."}`,
    "deal",
  );
}
export function previewDeal(
  g: Game,
  d: Deal,
): { cash: Record<string, number>; error?: string } {
  const copy = structuredClone(g);
  try {
    executeDeal(copy, d);
    return {
      cash: Object.fromEntries(
        copy.players.map((p) => [p.id, p.cash - player(g, p.id).cash]),
      ),
    };
  } catch (e) {
    return { cash: {}, error: (e as Error).message };
  }
}
export function applyAction(state: Game, actor: string, a: Action): Game {
  const g = structuredClone(state);
  assert(
    a && typeof a === "object" && typeof a.type === "string",
    "Invalid action.",
  );
  assert(g.phase !== "over", "The game has finished.");
  const p = player(g, actor);
  assert(!p.bankrupt, "This player is bankrupt.");
  const active = current(g).id === actor;
  const turnAction = () => assert(active, "Wait for your turn.");
  switch (a.type) {
    case "ROLL": {
      turnAction();
      assert(g.phase === "roll", "You cannot roll now.");
      g.lastCard = null;
      g.dice = [1 + Math.floor(random(g) * 6), 1 + Math.floor(random(g) * 6)];
      const doubles = g.dice[0] === g.dice[1],
        steps = g.dice[0] + g.dice[1];
      log(g, `${p.name} rolled ${g.dice[0]} + ${g.dice[1]}.`, "dice");
      if (p.jailed) {
        g.rolledInJail = true;
        g.afterMove = "end";
        p.jailTurns++;
        if (doubles) {
          p.jailed = false;
          p.jailTurns = 0;
          move(g, steps);
        } else if (p.jailTurns >= 3) {
          p.jailed = false;
          p.jailTurns = 0;
          payment(
            g,
            p.id,
            indexed(g, 50),
            null,
            "review release after three attempts",
          );
          g.pendingMove = steps;
          g.resumePhase = "end";
          flush(g);
        } else {
          g.phase = "end";
          log(g, `${p.name} remains in Review (${p.jailTurns}/3 attempts).`);
        }
        break;
      }
      g.doubles = doubles ? g.doubles + 1 : 0;
      if (g.doubles === 3) {
        goToJail(g, p);
        break;
      }
      g.afterMove = doubles ? "roll" : "end";
      if (g.rules.planning && p.planning > 0) g.phase = "move";
      else move(g, steps);
      break;
    }
    case "MOVE": {
      turnAction();
      assert(g.phase === "move", "Roll the dice first.");
      const delta = integer(a.delta ?? 0, -1, 1);
      if (delta) {
        assert(
          p.planning > 0 && g.rules.planning,
          "No planning credits remain.",
        );
        p.planning--;
        log(
          g,
          `${p.name} spends a planning credit to move ${delta > 0 ? "+1" : "−1"} space.`,
          "strategy",
        );
      }
      move(g, g.dice[0] + g.dice[1] + delta);
      break;
    }
    case "BUY": {
      turnAction();
      assert(g.phase === "purchase", "There is no purchase pending.");
      const d = g.deeds[p.position],
        price = indexed(g, BOARD[p.position].price!);
      assert(!d.owner, "This property is already owned.");
      assert(p.cash >= price, "Not enough cash. Start an auction instead.");
      p.cash -= price;
      d.owner = p.id;
      log(
        g,
        `${p.name} bought ${BOARD[p.position].name} for $${price}.`,
        "purchase",
      );
      finishLanding(g);
      break;
    }
    case "AUCTION":
      turnAction();
      assert(g.phase === "purchase", "There is no purchase pending.");
      startAuction(g, p.position);
      break;
    case "BID": {
      const au = g.auction;
      assert(
        g.phase === "auction" && au && au.actor === actor,
        "Wait for your auction turn.",
      );
      const amount = integer(a.amount, au.high + 1);
      assert(p.cash >= amount, "Your bid exceeds available cash.");
      if (au.targets) {
        const target =
          a.property === undefined
            ? au.targets[actor][0]
            : propertyId(a.property);
        assert(
          au.targets[actor].includes(target),
          "Choose one of your eligible building sites.",
        );
        au.winningTarget = target;
      }
      au.high = amount;
      au.leader = actor;
      log(g, `${p.name} bids $${amount}.`, "auction");
      progressAuction(g, actor);
      break;
    }
    case "PASS": {
      const au = g.auction;
      assert(
        g.phase === "auction" && au && au.actor === actor,
        "Wait for your auction turn.",
      );
      au.remaining = au.remaining.filter((id) => id !== actor);
      progressAuction(g, actor);
      break;
    }
    case "END":
      turnAction();
      assert(g.phase === "end", "Finish the current action first.");
      nextTurn(g);
      break;
    case "BAIL": {
      turnAction();
      assert(
        g.phase === "roll" && p.jailed,
        "You can leave Review before rolling.",
      );
      if (a.card) {
        assert(p.freeCards.length > 0, "You have no release certificate.");
        const deck = p.freeCards.shift()!;
        g[deck].push(
          (deck === "chance" ? CHANCE : CHEST).findIndex(
            (c) => c.type === "free",
          ),
        );
      } else {
        assert(p.cash >= indexed(g, 50), "You need enough cash to pay bail.");
        p.cash -= indexed(g, 50);
      }
      p.jailed = false;
      p.jailTurns = 0;
      log(g, `${p.name} leaves Review.`);
      break;
    }
    case "BUILD": {
      assert(
        ["roll", "end"].includes(g.phase),
        "Build between rolls or turns.",
      );
      const id = propertyId(a.property),
        t = BOARD[id],
        d = g.deeds[id];
      assert(
        d.owner === actor && ownsSet(g, actor, t),
        "Own the full color group before building.",
      );
      assert(
        !group(t).some((t) => g.deeds[t.id].mortgage || g.deeds[t.id].option),
        "Redeem mortgages and release options in this group first.",
      );
      assert(d.houses < 5, "This property already has a hotel.");
      assert(
        group(t).every((t) => g.deeds[t.id].houses >= d.houses),
        "Build evenly across the color group.",
      );
      const supply = buildingSupply(g);
      assert(
        d.houses === 4 ? supply.hotels > 0 : supply.houses > 0,
        "The bank has no buildings of this type available.",
      );
      const cost = constructionCost(g, t);
      assert(p.cash >= cost, "Not enough cash to build.");
      if ((d.houses === 4 ? supply.hotels : supply.houses) === 1) {
        const kind = d.houses === 4 ? "hotel" : "house",
          targets: Record<string, number[]> = {};
        for (const q of g.players.filter((q) => !q.bankrupt)) {
          const eligible = PURCHASABLE.filter((tile) => {
            const dd = g.deeds[tile.id];
            return (
              dd.owner === q.id &&
              ownsSet(g, q.id, tile) &&
              (kind === "hotel" ? dd.houses === 4 : dd.houses < 4) &&
              group(tile).every(
                (s) =>
                  !g.deeds[s.id].mortgage &&
                  !g.deeds[s.id].option &&
                  g.deeds[s.id].houses >= dd.houses,
              )
            );
          }).map((t) => t.id);
          if (eligible.length) targets[q.id] = eligible;
        }
        if (Object.keys(targets).length > 1) {
          g.auction = {
            kind,
            property: id,
            high: 0,
            leader: null,
            remaining: Object.keys(targets),
            actor,
            targets,
            queue: [],
            resume: g.phase,
          };
          g.phase = "auction";
          log(
            g,
            `The last ${kind} is auctioned among eligible builders.`,
            "auction",
          );
          break;
        }
      }
      p.cash -= cost;
      d.houses++;
      log(
        g,
        `${p.name} built ${d.houses === 5 ? "a hotel" : "a house"} on ${t.name}.`,
        "build",
      );
      break;
    }
    case "SELL_BUILDING": {
      assert(
        tradeWindow(g),
        "Sell buildings between actions or to settle debt.",
      );
      const id = propertyId(a.property),
        t = BOARD[id],
        d = g.deeds[id];
      assert(d.owner === actor && d.houses > 0, "You have no building here.");
      assert(
        group(t).every((t) => g.deeds[t.id].houses <= d.houses),
        "Sell buildings evenly.",
      );
      assert(
        d.houses !== 5 || buildingSupply(g).houses >= 4,
        "The bank needs four houses to break up a hotel. Sell the entire group instead.",
      );
      p.cash += Math.floor(indexed(g, t.build!) / 2);
      d.houses--;
      break;
    }
    case "SELL_GROUP": {
      assert(
        tradeWindow(g),
        "Sell buildings between actions or to settle debt.",
      );
      const id = propertyId(a.property),
        t = BOARD[id];
      assert(ownsSet(g, actor, t), "You do not own this group.");
      for (const tile of group(t)) {
        const d = g.deeds[tile.id];
        p.cash += Math.floor(indexed(g, tile.build! * d.houses) / 2);
        d.houses = 0;
      }
      break;
    }
    case "MORTGAGE": {
      assert(
        tradeWindow(g) || g.phase === "auction",
        "Mortgage between actions or during an auction.",
      );
      const id = propertyId(a.property),
        t = BOARD[id],
        d = g.deeds[id];
      assert(
        d.owner === actor && !d.mortgage,
        "Choose your unmortgaged property.",
      );
      assert(
        !group(t).some((t) => g.deeds[t.id].houses),
        "Sell all buildings in this color group first.",
      );
      assert(
        !d.option,
        "A property reserved by an option cannot be mortgaged.",
      );
      d.mortgage = mortgageValue(g, t);
      p.cash += d.mortgage;
      log(g, `${p.name} mortgaged ${t.name} for $${d.mortgage}.`);
      break;
    }
    case "REDEEM": {
      assert(tradeWindow(g), "Redeem between actions.");
      const id = propertyId(a.property),
        d = g.deeds[id];
      assert(
        d.owner === actor && d.mortgage > 0,
        "Choose your mortgaged property.",
      );
      const cost = redemptionCost(g, id);
      assert(p.cash >= cost, "Not enough cash to redeem.");
      p.cash -= cost;
      d.mortgage = 0;
      break;
    }
    case "OFFER": {
      assert(tradeWindow(g), "Negotiate between actions.");
      assert(
        g.offers.filter((o) => o.from === actor).length < 5,
        "Withdraw an existing offer first (maximum five).",
      );
      const d = parseDeal(g, actor, a.deal);
      const preview = previewDeal(g, d);
      assert(!preview.error, preview.error || "Invalid deal.");
      g.offers.push(d);
      p.lastOfferTurn = g.turnNumber;
      log(g, `${p.name} proposed a deal to ${player(g, d.to).name}.`, "deal");
      break;
    }
    case "ACCEPT": {
      assert(tradeWindow(g), "Accept between actions.");
      const d = g.offers.find((o) => o.id === a.id);
      assert(d && d.to === actor, "This offer is not addressed to you.");
      executeDeal(g, d);
      g.offers = g.offers.filter((o) => o.id !== d.id);
      break;
    }
    case "REJECT": {
      const d = g.offers.find((o) => o.id === a.id);
      assert(d && (d.to === actor || d.from === actor), "Offer not found.");
      g.offers = g.offers.filter((o) => o.id !== d.id);
      break;
    }
    case "EXERCISE": {
      assert(tradeWindow(g), "Exercise options between actions.");
      const id = propertyId(a.property),
        d = g.deeds[id],
        o = d.option;
      assert(o?.holder === actor && d.owner, "You do not hold this option.");
      const from = d.owner;
      validateTransfer(g, id, from, actor, true);
      assert(p.cash >= o.strike, "Not enough cash for the fixed strike price.");
      p.cash -= o.strike;
      player(g, from).cash += o.strike;
      transfer(g, [id], from, actor, o.strike);
      assert(
        g.players.every((p) => p.cash >= 0),
        "The seller must fund their existing resale obligations before exercise.",
      );
      delete d.option;
      log(
        g,
        `${p.name} exercised the option on ${BOARD[id].name} for $${o.strike}.`,
        "deal",
      );
      break;
    }
    case "RELEASE_OPTION": {
      const id = propertyId(a.property);
      assert(
        g.deeds[id].option?.holder === actor,
        "Only the option holder can release it.",
      );
      delete g.deeds[id].option;
      break;
    }
    case "REPAY": {
      assert(tradeWindow(g), "Repay loans between actions.");
      const l = g.loans.find((l) => l.id === a.id && l.borrower === actor);
      assert(l, "Loan not found.");
      assert(p.cash >= l.due, "Not enough cash.");
      p.cash -= l.due;
      if (l.lender !== "bank") player(g, l.lender).cash += l.due;
      g.loans = g.loans.filter((q) => q.id !== l.id);
      break;
    }
    case "SETTLE":
      assert(
        g.phase === "debt" && g.payments[0]?.player === actor,
        "There is no debt for you to settle.",
      );
      assert(p.cash >= g.payments[0].amount, "Raise enough cash first.");
      flush(g);
      if (current(g).bankrupt && g.phase !== "debt") nextTurn(g);
      break;
    case "BANKRUPT":
      bankrupt(g, actor);
      break;
    default:
      throw new Error("Unknown action.");
  }
  g.revision++;
  return g;
}
export function actorFor(g: Game) {
  if (g.phase === "auction") return g.auction!.actor;
  if (g.phase === "debt") return g.payments[0].player;
  return current(g).id;
}
export function botAction(g: Game, id: string): Action | null {
  const p = player(g, id);
  if (!p.bot || actorFor(g) !== id || g.phase === "over") return null;
  const tryAction = (a: Action) => {
    try {
      applyAction(g, id, a);
      return a;
    } catch {
      return null;
    }
  };
  if (g.phase === "roll") return { type: "ROLL" };
  if (g.phase === "move") return { type: "MOVE", delta: 0 };
  if (g.phase === "purchase")
    return {
      type:
        p.cash >= indexed(g, BOARD[p.position].price!) + 150
          ? "BUY"
          : "AUCTION",
    };
  if (g.phase === "auction") {
    const au = g.auction!,
      bid = au.high + 10;
    return {
      type:
        bid <=
        Math.min(p.cash - 100, indexed(g, BOARD[au.property].price! * 1.15))
          ? "BID"
          : "PASS",
      amount: bid,
    };
  }
  if (g.phase === "debt") {
    if (p.cash >= g.payments[0].amount) return { type: "SETTLE" };
    for (const t of PURCHASABLE) {
      const a = tryAction({ type: "SELL_BUILDING", property: t.id });
      if (a) return a;
    }
    for (const t of PURCHASABLE) {
      if (g.deeds[t.id].owner === id && g.deeds[t.id].houses)
        return { type: "SELL_GROUP", property: t.id };
      const a = tryAction({ type: "MORTGAGE", property: t.id });
      if (a) return a;
    }
    return { type: "BANKRUPT" };
  }
  if (g.phase === "end") {
    if (p.lastOfferTurn !== g.turnNumber) {
      const targets = PURCHASABLE.filter(
        (t) =>
          t.group &&
          g.deeds[t.id].owner &&
          g.deeds[t.id].owner !== id &&
          group(t).some((t) => g.deeds[t.id].owner === id) &&
          !group(t).some((t) => g.deeds[t.id].houses || g.deeds[t.id].option),
      );
      targets.sort(
        (a, b) =>
          group(b).filter((t) => g.deeds[t.id].owner === id).length -
          group(a).filter((t) => g.deeds[t.id].owner === id).length,
      );
      for (const t of targets) {
        const price = indexed(g, t.price! * 2);
        if (p.cash >= price + 250) {
          const a = tryAction({
            type: "OFFER",
            deal: {
              to: g.deeds[t.id].owner,
              give: [],
              take: [t.id],
              cash: price,
              receiveCash: 0,
              note: "A fair price for the next piece of my portfolio.",
            },
          });
          if (a) return a;
        }
      }
    }
    for (const t of PURCHASABLE) {
      if (p.cash > constructionCost(g, t) + 350) {
        const a = tryAction({ type: "BUILD", property: t.id });
        if (a) return a;
      }
    }
    return { type: "END" };
  }
  return null;
}

export function botStep(g: Game): { actor: string; action: Action } | null {
  if (tradeWindow(g)) {
    for (const d of g.offers) {
      if (!player(g, d.to).bot) continue;
      let accept = false;
      const simple =
        !d.royalty &&
        !d.equity &&
        !d.sellOn &&
        !d.veto.length &&
        !d.option &&
        !d.loan &&
        !d.retainTitle;
      if (simple) {
        try {
          const next = applyAction(g, d.to, { type: "ACCEPT", id: d.id });
          const score = (state: Game) =>
            netWorth(state, d.to) +
            PURCHASABLE.filter(
              (t) =>
                state.deeds[t.id].owner === d.to && ownsSet(state, d.to, t),
            ).reduce((sum, t) => sum + indexed(state, t.price! * 2), 0);
          accept = score(next) >= score(g) && player(next, d.to).cash >= 100;
        } catch {}
      }
      return {
        actor: d.to,
        action: { type: accept ? "ACCEPT" : "REJECT", id: d.id },
      };
    }
  }
  const actor = actorFor(g),
    action = botAction(g, actor);
  return action ? { actor, action } : null;
}
