import type { Game } from "../../game/types";
import { rent } from "../../game/engine";
import type { Mood } from "./music";

export type Cue =
  | "step"
  | "dice"
  | "purchase"
  | "payment"
  | "deal"
  | "offer"
  | "card"
  | "bid"
  | "sold"
  | "build"
  | "go"
  | "turn"
  | "jail"
  | "debt"
  | "bankrupt"
  | "victory";
export type Direction = { mood: Mood; reason: string };
export function directionFor(game: Game | null): Direction {
  if (!game) return { mood: "calm", reason: "A quiet table, ready to play." };
  if (game.phase === "over")
    return { mood: "victory", reason: "The game has a winner." };
  if (game.phase === "debt")
    return { mood: "crisis", reason: "A player cannot cover a payment." };
  const active = game.players.filter((p) => !p.bankrupt);
  if (active.some((p) => p.cash < 80 * game.index))
    return { mood: "tense", reason: "A player has very little cash left." };
  if (
    active.some((p) =>
      game.loans.some(
        (l) =>
          l.borrower === p.id && l.dueLap <= p.laps + 1 && l.due > p.cash * 0.7,
      ),
    )
  )
    return { mood: "tense", reason: "A large loan repayment is approaching." };
  // Use the public board and dice probabilities, not the secret next roll.
  const player = game.players[game.turn];
  let danger = 0;
  if (player && !player.jailed)
    for (let roll = 2; roll <= 12; roll++) {
      const id = (player.position + roll) % 40,
        deed = game.deeds[id];
      if (
        deed?.owner &&
        deed.owner !== player.id &&
        rent(game, id, roll) > player.cash * 0.65
      )
        danger += (6 - Math.abs(7 - roll)) / 36;
    }
  if (danger >= 0.2)
    return {
      mood: "tense",
      reason: "Expensive rent is within reach of the next roll.",
    };
  if (game.phase === "auction")
    return { mood: "trade", reason: "An auction is in progress." };
  // Logs are observations; user-written names and notes are never interpreted as instructions.
  const recent = game.logs.slice(-5);
  if (
    recent.some((l) => l.kind === "deal" && / signed a deal[.:]/.test(l.text))
  )
    return { mood: "trade", reason: "A deal has just been completed." };
  return {
    mood: "calm",
    reason: "Cash reserves are comfortable and no payment is overdue.",
  };
}

const severity: Record<Mood, number> = {
  calm: 0,
  trade: 1,
  tense: 2,
  crisis: 3,
  victory: 4,
};
export class MusicDirector {
  current: Direction = directionFor(null);
  private changed = -Infinity;
  update(game: Game | null, now: number): Direction {
    const next = directionFor(game);
    // Escalate immediately; let a stressful passage resolve before calming down.
    if (
      !game ||
      next.mood === this.current.mood ||
      severity[next.mood] > severity[this.current.mood] ||
      now - this.changed >= 12_000
    ) {
      if (next.mood !== this.current.mood) this.changed = now;
      this.current = next;
    } else {
      this.current = {
        ...this.current,
        reason: "Letting the previous musical mood settle.",
      };
    }
    return this.current;
  }
  reset() {
    this.current = directionFor(null);
    this.changed = -Infinity;
  }
}

export function cueForLog(log: Game["logs"][number]): Cue | null {
  switch (log.kind) {
    case "dice":
      return "dice";
    case "purchase":
      return "purchase";
    case "payment":
      return "payment";
    case "card":
      return "card";
    case "build":
      return "build";
    case "income":
      return log.text.includes(" crossed Launch.") ? "go" : null;
    case "turn":
      return "turn";
    case "debt":
      return log.text.includes(" is bankrupt") ? "bankrupt" : "debt";
    case "auction":
      return log.text.includes(" wins ")
        ? "sold"
        : log.text.includes(" bids $")
          ? "bid"
          : null;
    case "deal":
      return / signed a deal[.:]/.test(log.text)
        ? "deal"
        : log.text.includes(" proposed a deal to ")
          ? "offer"
          : log.text.includes(" exercised the option")
            ? "purchase"
            : null;
    case "event":
      return log.text.endsWith(" enters Review.") ? "jail" : null;
    default:
      return null;
  }
}

export class CueTracker {
  private gameId = "";
  private lastId = -1;
  private winner: string | null = null;
  reset() {
    this.gameId = "";
    this.lastId = -1;
    this.winner = null;
  }
  ingest(game: Game | null): Cue[] {
    if (!game) {
      this.reset();
      return [];
    }
    const lastId = game.logs.at(-1)?.id ?? -1;
    if (game.id !== this.gameId || lastId < this.lastId) {
      this.gameId = game.id;
      this.lastId = lastId;
      this.winner = game.winner;
      return []; // Joining, restoring or reconnecting never replays history.
    }
    const cues = game.logs
      .filter((l) => l.id > this.lastId)
      .map(cueForLog)
      .filter((c): c is Cue => !!c);
    if (game.winner && !this.winner) cues.push("victory");
    this.winner = game.winner;
    this.lastId = lastId;
    return [...new Set(cues)].slice(-6); // Bound rapid batches of rent distributions.
  }
}
