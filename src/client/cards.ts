import type { CardDraw, Game } from "../game/types";

export function recentCards(game: Game): CardDraw[] {
  if (game.cardDraws?.length) return game.cardDraws;
  // Older saves/servers already have public card logs; keep those readable too.
  return game.logs
    .filter((l) => l.kind === "card")
    .flatMap((l) => {
      const match =
        /^(Chance|Community Chest|Market News|Civic Fund): (.*)$/s.exec(l.text);
      return match
        ? [
            {
              id: l.id,
              deck: ["Chance", "Market News"].includes(match[1])
                ? ("chance" as const)
                : ("chest" as const),
              text: match[2],
              player: "",
              index: 0,
            },
          ]
        : [];
    })
    .slice(-24);
}

export class CardTracker {
  private gameId = "";
  private lastLog = -1;
  reset() {
    this.gameId = "";
    this.lastLog = -1;
  }
  ingest(game: Game | null) {
    if (!game) {
      this.reset();
      return [];
    }
    const latest = game.logs.at(-1)?.id ?? -1;
    if (game.id !== this.gameId || latest < this.lastLog) {
      this.gameId = game.id;
      this.lastLog = latest;
      return [];
    }
    const fresh = recentCards(game).filter((c) => c.id > this.lastLog);
    this.lastLog = latest;
    return fresh;
  }
}

const esc = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function cardMarkup(card: CardDraw, game: Game) {
  const player = game.players.find((p) => p.id === card.player);
  return `<article class="event-card ${card.deck === "chance" ? "chance" : "chest"}"><div class="event-card-heading"><span>${card.deck === "chance" ? "CHANCE" : "COMMUNITY CHEST"}</span><span aria-hidden="true">${card.deck === "chance" ? "?" : "✦"}</span></div>
    ${player ? `<p class="card-drawer">${esc(player.name)} drew this card.</p>` : ""}
    <p class="event-card-text">${esc(card.text)}</p>
    ${card.index > 1 ? `<small>Printed cash amounts ×${card.index.toFixed(2)} when drawn.</small>` : ""}
    </article>`;
}

export function currentTurnCard(game: Game): CardDraw | undefined {
  const latest = recentCards(game).at(-1);
  if (!latest) return;
  if (latest.turnNumber !== undefined)
    return latest.turnNumber === game.turnNumber &&
      latest.player === game.players[game.turn]?.id
      ? latest
      : undefined;
  return game.lastCard ? latest : undefined;
}
export function cardPanel(game: Game) {
  const cards = recentCards(game);
  if (!cards.length) return "";
  const latest = currentTurnCard(game);
  return `<section class="recent-card-panel">${latest ? `<div class="section-label">LATEST CARD</div>${cardMarkup(latest, game)}` : ""}<button class="text-button full" data-cards="history">Read recent cards (${cards.length})</button></section>`;
}

type View = {
  screen: "desktop" | "phone" | "tv";
  me: string;
  local: boolean;
  display: boolean;
};
export class CardReader {
  private tracker = new CardTracker();
  private game: Game | null = null;
  private pending: CardDraw[] = [];
  private reading: CardDraw[] = [];
  private position = 0;
  private history = false;
  private dialog: HTMLDialogElement;
  constructor() {
    this.dialog = document.createElement("dialog");
    this.dialog.id = "card-reader";
    this.dialog.setAttribute("aria-label", "Drawn card");
    document.querySelector("#app")!.append(this.dialog);
    document.addEventListener("click", (event) => {
      const el = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-cards]",
      );
      if (!el || (el as HTMLButtonElement).disabled || !this.game) return;
      const action = el.dataset.cards;
      if (action === "history") {
        this.reading = [...recentCards(this.game)].reverse();
        this.position = 0;
        this.history = true;
        this.pending = [];
        this.show();
      } else if (action === "next") {
        if (this.position + 1 < this.reading.length) {
          this.position++;
          this.render();
        } else this.dismiss();
      } else if (action === "previous") {
        this.position = Math.max(0, this.position - 1);
        this.render();
      } else if (action === "close") this.dismiss();
    });
    this.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      this.dismiss();
    });
    // Never replace an open trade editor or other dialog to reveal a card.
    document
      .querySelector("#dialog")!
      .addEventListener("close", () => this.openPending());
  }
  reconnect() {
    this.tracker.reset();
  }
  update(game: Game | null, view: View) {
    if (!game || (this.game && game.id !== this.game.id)) {
      this.pending = [];
      this.reading = [];
      this.dialog.close();
    }
    this.game = game;
    const fresh = this.tracker.ingest(game);
    if (!game || view.display || view.screen === "tv") return;
    const relevant = fresh.filter(
      (card) =>
        view.local ||
        card.player === view.me ||
        (!card.player && game.players[game.turn]?.id === view.me),
    );
    if (this.dialog.open && !this.history) {
      this.reading.push(...relevant);
      if (relevant.length) this.render();
    } else {
      this.pending = [...this.pending, ...relevant].slice(-24);
      this.openPending();
    }
  }
  private openPending() {
    if (
      !this.pending.length ||
      this.dialog.open ||
      document.querySelector("#dialog[open]")
    )
      return;
    this.reading = this.pending;
    this.pending = [];
    this.position = 0;
    this.history = false;
    this.show();
  }
  private show() {
    if (!this.game || !this.reading.length) return;
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }
  private render() {
    if (!this.game) return;
    const hadFocus =
      this.dialog.open && this.dialog.contains(document.activeElement);
    this.dialog.innerHTML = `<button class="dialog-close" data-cards="close" aria-label="Close card">×</button><span class="eyebrow">${this.history ? "RECENT CARDS" : "YOU DREW A CARD"}</span>
      <h2>${this.history ? "Read the cards." : "Take a moment."}</h2>
      ${cardMarkup(this.reading[this.position], this.game)}
      <p class="card-resolution">The card’s effect is applied automatically. You can read it for as long as you like.</p>
      <div class="card-pagination"><span>${this.position + 1} / ${this.reading.length}</span>${this.position > 0 ? '<button class="text-button" data-cards="previous">Previous card</button>' : ""}</div>
      <button class="primary full" data-cards="next">${this.position + 1 < this.reading.length ? "Next card" : "Continue playing"}</button>`;
    if (hadFocus)
      this.dialog
        .querySelector<HTMLButtonElement>('[data-cards="next"]')
        ?.focus();
  }
  private dismiss() {
    this.reading = [];
    this.dialog.close();
    this.openPending();
  }
}
