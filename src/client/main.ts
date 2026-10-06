import "./style.css";
import { language, installLocalization, protectNames } from "./i18n";
import type { BoardScene } from "./scene";
import { GameAudio } from "./audio/engine";
import { installAudioUI } from "./audio/ui";
import { CardReader, cardPanel } from "./cards";
import QRCode from "qrcode";
import {
  SPECIAL_RULES,
  INFLATION_DESCRIPTION,
  INFLATION_WHY,
} from "../game/rulebook";
import { BOARD, PURCHASABLE, TOKENS, COLORS } from "../game/board";
import {
  actorFor,
  normalizeRules,
  assets,
  buildingSupply,
  constructionCost,
  current,
  indexed,
  market,
  mortgageValue,
  netWorth,
  previewDeal,
  redemptionCost,
  rent,
  CYCLES,
} from "../game/engine";
import {
  CLASSIC,
  ECONOMY,
  type Action,
  type Deal,
  type Game,
  type RoomView,
  type Rules,
  type Seat,
} from "../game/types";
const $ = (s: string) => document.querySelector<HTMLElement>(s)!;
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const cash = (v: number) =>
  (v < 0 ? "−" : "") +
  "$" +
  Math.abs(Math.round(v)).toLocaleString(language === "sl" ? "sl-SI" : "en-US");
const icon = (name: string) =>
  ({
    hat: "♜",
    dice: "⚄",
    arrow: "↗",
    link: "↗",
    help: "?",
    plus: "+",
    close: "×",
    check: "✓",
  })[name] || name;
const entry = new URLSearchParams(location.search);
let screenMode: "desktop" | "phone" | "tv" =
  entry.get("screen") === "tv"
    ? "tv"
    : entry.get("screen") === "phone"
      ? "phone"
      : entry.get("screen") === "desktop"
        ? "desktop"
        : matchMedia("(max-width: 700px)").matches
          ? "phone"
          : "desktop";
let displayOnly = entry.get("watch") === "1",
  publicUrl = "",
  recoveryCode = "",
  lastMessage = Date.now();
const screenClass = () => {
  document.body.classList.toggle("screen-phone", screenMode === "phone");
  document.body.classList.toggle("screen-tv", screenMode === "tv");
};
screenClass();
const audio = new GameAudio(screenMode);
let room: RoomView | null = null,
  me = "",
  secret = "",
  mode: "local" | "lan" | "party" = screenMode === "tv" ? "party" : "local",
  rules: Rules = { ...ECONOMY },
  tab = "turn",
  selected = 39,
  control = "",
  connected = false,
  socket: WebSocket,
  retry = 0,
  modelSeat = "",
  lastActor = "",
  addresses: string[] = [];
const knownSession = (code: string) => {
  try {
    return JSON.parse(localStorage.getItem("estate-sessions") || "{}")[code] as
      | {
          code: string;
          token: string;
          id: string;
          recovery?: string;
          director?: boolean;
        }
      | undefined;
  } catch {
    return undefined;
  }
};
const saved = () => {
  try {
    return JSON.parse(localStorage.getItem("estate-session") || "null") as {
      code: string;
      token: string;
      id: string;
      recovery?: string;
      director?: boolean;
    } | null;
  } catch {
    return null;
  }
};
$("#app").innerHTML =
  `<header class="header"><a class="brand" href="/" aria-label="Estate Exchange home"><span class="brand-mark">E<span>↗</span></span><span>ESTATE<span class="brand-sub">EXCHANGE</span></span></a><div class="header-center"><span class="live-dot"></span> A GAME OF OWNERSHIP</div><nav><label class="language-choice" translate="no"><span>Jezik / Language</span><select id="language" aria-label="Jezik / Language"><option value="en" ${language === "en" ? "selected" : ""}>English</option><option value="sl" ${language === "sl" ? "selected" : ""}>Slovenščina</option></select></label><button class="text-button sound-button" data-ui="sound" aria-label="Sound settings · muted">♫ <span>Sound</span></button><button class="text-button" data-ui="guide">How to play <span class="tiny-circle">?</span></button><span id="connection" class="connection">Connecting</span></nav></header>
<main class="layout"><section class="table-area"><div class="table-heading"><div><div class="eyebrow" id="table-eyebrow">YOUR NEXT GREAT INVESTMENT</div><h1 id="table-title">Fortune favors the deal.</h1></div><div id="table-badge" class="badge">THE ECONOMY EDITION <span>✦</span></div></div><div id="economy-strip" class="economy-strip"></div><div id="board" class="board"><div class="board-vignette"></div></div><div class="board-toolbar"><span class="board-gestures" data-help="Left-drag to rotate. Right-drag (or Control-drag) to move the board. Scroll to zoom. On touch screens, drag with one finger to rotate; use two fingers to move or pinch to zoom."><span class="mouse-icon">↔</span> Left-drag orbit <i>·</i> Right-drag move <i>·</i> Scroll zoom</span><div class="board-views" role="group" aria-label="Board views"><button data-ui="follow" aria-pressed="true" data-help="Follow the current player. Manual camera movement pauses following.">Follow turn</button><button data-ui="camera" data-help="Recenter the board and return to the default perspective." title="Reset camera" aria-label="Reset camera">⌂</button><button data-ui="top" data-help="Recenter the board and look down from above." title="Top view" aria-label="Top view">⊞</button><span class="view-divider" aria-hidden="true"></span><button class="side-view" data-ui="view-north" data-help="North side: face the edge between Free Parking and Go to Jail. Recenter and fit the whole board." title="North side · Free Parking to Go to Jail" aria-label="North side view">North</button><button class="side-view" data-ui="view-east" data-help="East side: face the edge between Go to Jail and GO. Recenter and fit the whole board." title="East side · Go to Jail to GO" aria-label="East side view">East</button><button class="side-view" data-ui="view-south" data-help="South side: face the edge between GO and Review. Recenter and fit the whole board." title="South side · GO to Review" aria-label="South side view">South</button><button class="side-view" data-ui="view-west" data-help="West side: face the edge between Review and Free Parking. Recenter and fit the whole board." title="West side · Review to Free Parking" aria-label="West side view">West</button></div></div><div id="lower-bar" class="lower-bar"></div></section><aside id="sidebar" class="sidebar"></aside></main>
<footer class="footer"><div class="info-symbol">i</div><span id="context-help" aria-live="polite">Every property has a story. Select a space to see its price, rent, and agreements.</span><span class="footer-brand">EST. 2026 <span>✦</span></span></footer><div id="toast" role="status"></div><dialog id="dialog"></dialog><input id="model-file" type="file" accept=".stl,.obj,.glb,.gltf" hidden>`;
let scene: BoardScene | undefined;
const cardReader = new CardReader();
let sceneLoading = false;
async function ensureScene() {
  if (scene || sceneLoading || screenMode === "phone") return;
  sceneLoading = true;
  try {
    const { BoardScene } = await import("./scene");
    scene = new BoardScene(
      $("#board"),
      (id) => {
        selected = id;
        scene!.select(id);
        if (room?.game) {
          tab = "portfolio";
          renderSidebar();
        } else showTile(id);
      },
      toast,
      () => audio.cue("step"),
    );
    scene.update(room?.game || null, room?.seats || demo);
    scene.select(selected);
  } catch (e) {
    $("#board").innerHTML =
      `<div class="webgl-error">3D graphics could not start. Enable hardware acceleration and use a recent Safari, Chrome, or Firefox.<br>${esc((e as Error).message)}</div>`;
  } finally {
    sceneLoading = false;
  }
}
const demo: Seat[] = [
  {
    id: "a",
    name: "Alex",
    token: "Drone",
    color: COLORS[0],
    bot: false,
    connected: true,
  },
  {
    id: "b",
    name: "Morgan",
    token: "Lighthouse",
    color: COLORS[1],
    bot: false,
    connected: true,
  },
  {
    id: "c",
    name: "Robin",
    token: "Fox",
    color: COLORS[2],
    bot: false,
    connected: true,
  },
];
void ensureScene();
function toast(message: string) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("visible");
  window.clearTimeout(Number(el.dataset.timer));
  el.dataset.timer = String(
    setTimeout(() => el.classList.remove("visible"), 5500),
  );
}
function send(payload: unknown) {
  if (!connected) {
    toast("The server is disconnected. Reconnecting…");
    return;
  }
  socket.send(JSON.stringify(payload));
}
function act(action: Action, actor = controlled()) {
  send({ type: "action", actor, action });
}
function controlled() {
  if (!room) return me;
  if (room.mode !== "local") return me;
  const g = room.game,
    active = g ? actorFor(g) : me;
  if (control && room.seats.some((s) => s.id === control && !s.bot))
    return control;
  return room.seats.some((s) => s.id === active && !s.bot) ? active : me;
}
function connect() {
  socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
  );
  socket.onopen = () => {
    connected = true;
    retry = 0;
    $("#connection").textContent = "● Connected";
    $("#connection").classList.add("online");
    lastMessage = Date.now();
    const code = room?.code || entry.get("room") || "";
    const s = knownSession(code);
    if (displayOnly && code)
      send({
        type: "watch",
        code,
        invite: room?.invite || entry.get("invite"),
      });
    else if (s) send({ type: "join", code: s.code, token: s.token });
    renderSidebar();
  };
  socket.onclose = () => {
    audio.reconnect();
    cardReader.reconnect();
    connected = false;
    $("#connection").textContent = "○ Reconnecting";
    $("#connection").classList.remove("online");
    setTimeout(connect, Math.min(1000 * 2 ** retry++, 10000));
  };
  socket.onmessage = (event) => {
    lastMessage = Date.now();
    const msg = JSON.parse(event.data);
    if (msg.type === "watching") {
      displayOnly = true;
      screenMode = "tv";
      screenClass();
      void ensureScene();
    }
    if (msg.type === "session") {
      me = msg.id;
      secret = msg.token;
      recoveryCode = msg.recovery || "";
      if (msg.director) {
        screenMode = "tv";
        screenClass();
        void ensureScene();
      }
      const session = {
        code: msg.code,
        token: msg.token,
        id: msg.id,
        recovery: msg.recovery,
        director: msg.director,
      };
      localStorage.setItem("estate-session", JSON.stringify(session));
      let stored: Record<string, unknown> = {};
      try {
        stored = JSON.parse(localStorage.getItem("estate-sessions") || "{}");
      } catch {}
      stored[msg.code] = session;
      localStorage.setItem("estate-sessions", JSON.stringify(stored));
      const url = new URL(location.href);
      url.searchParams.set("room", msg.code);
      url.searchParams.set("screen", screenMode);
      history.replaceState(null, "", url);
    }
    if (msg.type === "state") {
      room = msg.room;
      protectNames(room!.seats.map((s) => s.name));
      rules = normalizeRules(room!.game?.rules || room!.rules || ECONOMY);
      room!.rules = rules;
      if (room!.game) room!.game.rules = rules;
      const actor = room!.game ? actorFor(room!.game) : me;
      if (actor !== lastActor) {
        control = "";
        lastActor = actor;
      }
      render();
      scene?.update(room!.game, room!.seats);
      audio.update(room!.game);
      cardReader.update(room!.game, {
        screen: screenMode,
        me,
        local: room!.mode === "local",
        display: displayOnly,
      });
    }
    if (msg.type === "error") toast(msg.message);
    if (msg.type === "left") {
      room = null;
      audio.update(null);
      cardReader.update(null, {
        screen: screenMode,
        me,
        local: false,
        display: displayOnly,
      });
      displayOnly = false;
      control = "";
      entry.delete("room");
      entry.delete("invite");
      entry.delete("watch");
      history.replaceState(null, "", "/");
      render();
      scene?.update(null, demo);
    }
    if (msg.type === "export") {
      const blob = new Blob([JSON.stringify(msg.game, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `estate-${room!.code}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
}
connect();
async function refreshHosting() {
  try {
    const d = await (await fetch("/api/info")).json();
    const changed =
      publicUrl !== (d.publicUrl || "") ||
      JSON.stringify(addresses) !== JSON.stringify(d.addresses);
    addresses = d.addresses;
    publicUrl = d.publicUrl || "";
    if (changed && room && (screenMode === "tv" || !room.game)) renderSidebar();
  } catch {}
}
void refreshHosting();
setInterval(refreshHosting, 10000);
function heartbeat() {
  if (socket.readyState === WebSocket.OPEN) {
    if (Date.now() - lastMessage > 45000) socket.close();
    else send({ type: "ping" });
  }
}
setInterval(heartbeat, 15000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) heartbeat();
});
function button(label: string, ui: string, classes = "", extra = "") {
  return `<button class="${classes}" data-ui="${ui}" ${extra}>${label}</button>`;
}
function render() {
  const g = room?.game;
  $("#table-eyebrow").textContent = room
    ? `PRIVATE TABLE / ${room.code}`
    : "YOUR NEXT GREAT INVESTMENT";
  $("#table-title").textContent = g
    ? g.phase === "over"
      ? "The city has a new owner."
      : `${current(g).name}’s turn.`
    : "Fortune favors the deal.";
  $("#table-badge").innerHTML = g
    ? `${g.rules.preset === "classic" ? "CORE RULES" : "ECONOMY EDITION"} <span>✦</span>`
    : "THE ECONOMY EDITION <span>✦</span>";
  $("#economy-strip").innerHTML = g
    ? `<div><span class="status-dot"></span> ${esc(market(g).name)}</div><span>YEAR <b>${g.epoch + 1}</b></span><span>PRICE INDEX <b>×${g.index.toFixed(2)}</b></span><span data-help="A new economic year begins when every surviving player has crossed GO again.">LAPS <b>${Math.min(...g.players.filter((p) => !p.bankrupt).map((p) => p.laps))} / ${g.epoch + 1}</b></span>${button("Economy ↗", "economy", "strip-link")}`
    : `<div><span class="status-dot"></span> An original city. A new kind of deal.</div><span>2–6 PLAYERS</span><span>3D TABLETOP</span>`;
  $("#lower-bar").innerHTML = g
    ? g.players
        .map(
          (p) =>
            `<button class="player-pill ${p.id === current(g).id ? "active" : ""} ${p.bankrupt ? "eliminated" : ""}" data-ui="player" data-id="${p.id}" style="--player:${p.color}" data-help="${esc(p.name)} · Net worth ${cash(netWorth(g, p.id))} · ${p.laps} laps · ${p.bot ? "Computer" : "Human"}"><span class="player-token">${["✥", "♜", "◆", "☄", "◇", "▣"][TOKENS.indexOf(p.token)] || "◇"}</span><span><strong>${esc(p.name)}${p.bot ? " <small>AI</small>" : ""}</strong><b>${p.bankrupt ? "BANKRUPT" : cash(p.cash)}</b></span>${p.jailed ? "<em>REVIEW</em>" : ""}</button>`,
        )
        .join("")
    : `<div class="feature-note"><span>01</span><div><b>Build your portfolio</b><small>A city of possibilities.</small></div></div><div class="feature-note"><span>02</span><div><b>Make your own deals</b><small>Royalties, stakes &amp; options.</small></div></div><div class="feature-note"><span>03</span><div><b>Play your way</b><small>Friends, bots, or your local network.</small></div></div>`;
  renderSidebar();
}
function renderSidebar() {
  if (!room) {
    renderWelcome();
    return;
  }
  if (displayOnly || (room.mode === "party" && me === room.host && room.game)) {
    renderTV();
    return;
  }
  if (!room.game) {
    renderLobby();
    return;
  }
  const g = room.game,
    actor = controlled(),
    p = g.players.find((p) => p.id === actor)!,
    active = actorFor(g),
    isActing = active === actor && !p.bot,
    offers = g.offers.filter((d) => d.to === actor).length;
  $("#sidebar").innerHTML =
    `<div class="sidebar-top"><span class="eyebrow">AT THE TABLE</span><button class="text-button tiny" data-ui="table-menu">TABLE OPTIONS</button></div>${
      room.mode === "local"
        ? `<label class="control-seat">Controlling <select id="control-seat" aria-label="Controlling">${g.players
            .filter((p) => !p.bot && !p.bankrupt)
            .map(
              (p) =>
                `<option value="${p.id}" ${p.id === actor ? "selected" : ""}>${esc(p.name)}</option>`,
            )
            .join("")}</select></label>`
        : `<div class="control-seat">Playing as <b>${esc(p.name)}</b> <span class="seat-color" style="background:${p.color}"></span></div>`
    }
 ${button("Rename player", "rename", "text-button tiny", `data-id="${actor}"`)}${screenMode === "phone" ? `<div class="phone-summary"><b>${cash(p.cash)}</b><span>${esc(BOARD[p.position].name)}</span>${offers ? `<button data-ui="tab" data-tab="deals">${offers} incoming offer${offers > 1 ? "s" : ""} →</button>` : ""}</div>` : ""}
 <div class="tabs" role="tablist">${["turn", "portfolio", "deals"].map((t) => `<button role="tab" aria-selected="${tab === t}" class="${tab === t ? "selected" : ""}" data-ui="tab" data-tab="${t}">${t[0].toUpperCase() + t.slice(1)}${t === "deals" && offers ? ` <span class="count">${offers}</span>` : ""}</button>`).join("")}</div><div class="sidebar-body">${tab === "turn" ? turnPanel(g, actor, isActing) : tab === "portfolio" ? portfolioPanel(g, actor) : dealsPanel(g, actor)}</div>`;
}
function renderWelcome() {
  const s = saved(),
    code = new URLSearchParams(location.search).get("room") || "";
  if (code && (entry.get("invite") || screenMode === "phone" || displayOnly)) {
    const previous = knownSession(code);
    $("#sidebar").innerHTML =
      `<div class="welcome"><span class="eyebrow">TABLE ${esc(code)}</span><h2>${displayOnly ? "Shared TV display" : "Your seat is waiting."}</h2><p>${displayOnly ? "Connecting to the shared board…" : "The board is on the TV. Your decisions and deals happen here."}</p>${!displayOnly ? `<label class="field">YOUR NAME<input id="your-name" maxlength="22" placeholder="Your name" autocomplete="nickname"></label><form id="join-form"><input id="join-code" type="hidden" value="${esc(code)}"><details class="recovery-entry"><summary>Returning player? Recover your seat</summary><label class="field">RECOVERY CODE<input name="recovery" maxlength="20" autocomplete="off" placeholder="Your 12-character code"></label></details><button class="primary full" ${!connected ? "disabled" : ""}>Join table →</button></form>${previous ? button("Reconnect my saved seat", "resume-room", "secondary full") : ""}` : ""}</div>`;
    return;
  }
  $("#sidebar").innerHTML =
    `<div class="welcome"><span class="eyebrow">WELCOME TO THE EXCHANGE</span><h2>A seat at<br>the table.</h2><p>Buy the block. Strike a deal.<br>Build a fortune that lasts.</p><div class="segmented">${button("This computer", "mode", mode === "local" ? "chosen" : "", 'data-mode="local"')}${button("With friends", "mode", mode === "lan" ? "chosen" : "", 'data-mode="lan"')}${button("TV + phones", "mode", mode === "party" ? "chosen" : "", 'data-mode="party"')}</div><label class="field">YOUR NAME<input id="your-name" maxlength="22" placeholder="Alex" value="Alex" autocomplete="nickname"></label>${button(mode === "party" ? "Create family table <span>↗</span>" : mode === "local" ? "Set up a table <span>↗</span>" : "Host online table <span>↗</span>", "create", "primary full", !connected ? "disabled" : "")}<div class="divider"><span>OR JOIN YOUR FRIENDS</span></div><form id="join-form" class="join-row"><input id="join-code" aria-label="Table code" placeholder="TABLE CODE" maxlength="5" value="${esc(code)}"><button type="submit" title="Join table">↗</button></form>${s ? button(`Resume table ${esc(s.code)} →`, "resume", "resume-link") : ""}<div class="welcome-foot"><span class="tiny-circle">i</span><p>${mode === "local" ? "Play solo against bots, or pass the screen between friends." : "Share the invitation or scan the QR code. Phones need only a browser. TV + phones leaves all six seats for players."}</p></div></div><div class="edition-note"><span>✦</span> THE RULES YOU KNOW.<br><b>THE DEALS YOU HAVEN’T MADE.</b></div>`;
}
function renderLobby() {
  const r = room!,
    host = r.host === me;
  if (screenMode === "phone" && !host) {
    const self = r.seats.find((s) => s.id === me);
    $("#sidebar").innerHTML =
      `<div class="sidebar-top"><span class="eyebrow">TABLE ${r.code}</span>${button("Table options", "table-menu", "text-button tiny")}</div><div class="sidebar-body"><h2 class="panel-title">You’re in, ${esc(self?.name)}.</h2><p class="muted">Look at the TV for the board. The host will start when everyone has joined.</p><div class="waiting">${r.seats.length}/6 players at the table</div><div class="phone-lobby-players">${r.seats.map((s) => `<p><span class="seat-color" style="background:${s.color}"></span><b>${esc(s.name)}</b><span>${s.bot ? "Computer" : s.connected ? "Ready" : "Offline"}</span></p>`).join("")}</div>${button("Choose your figure", "token", "secondary full", `data-id="${me}"`)}${button("Save my recovery code", "recovery", "secondary full")}${button("Rename player", "rename", "text-button full", `data-id="${me}"`)}</div>`;
    return;
  }
  const scrollTop =
    document.querySelector("#sidebar .sidebar-body")?.scrollTop || 0;
  const tuningOpen = document.querySelector<HTMLDetailsElement>(
    "#sidebar .rule-tuning",
  )?.open;
  const focusedRule = document.activeElement?.closest(".rule-checklist")
    ? document.activeElement.getAttribute("name")
    : null;
  $("#sidebar").innerHTML =
    `<div class="sidebar-top"><span class="eyebrow">TABLE ${r.code}</span>${button("↗ Invite", "share", "text-button tiny")}${screenMode === "tv" ? button("Full screen", "fullscreen", "text-button tiny") : ""}</div><div class="sidebar-body"><h2 class="panel-title">Meet your rivals.</h2><p class="muted">${r.mode === "local" ? "Switch a seat to Human for pass-and-play." : "Everyone joins using the QR code or complete invitation link."}</p>${r.mode !== "local" ? joinCard() : ""}<div class="seat-list">${r.seats.map((s, i) => `<div class="seat-row" style="--player:${s.color}"><span class="seat-number">${String(i + 1).padStart(2, "0")}</span><div><b>${esc(s.name)}</b><small>${s.bot ? "COMPUTER" : s.connected ? "READY" : "OFFLINE"}</small></div>${host && s.id !== r.host && r.mode === "local" ? button(s.bot ? "AI ⇄" : "Human ⇄", "toggle-bot", "chip", `data-id="${s.id}"`) : ""}${s.id === me || (host && r.mode === "local") ? button("♟", "token", "icon-button", `data-id="${s.id}" title="Choose or import figure"`) : ""}${host && s.id !== r.host ? button("×", "remove-seat", "icon-button", `data-id="${s.id}" title="Remove seat"`) : ""}</div>`).join("")}</div>${host && r.seats.length < 6 ? `<div class="two-col">${button("+ Computer", "add-bot", "secondary")}${r.mode === "local" ? button("+ Human", "add-human", "secondary") : ""}</div>` : ""}
${host ? button("Let’s play <span>→</span>", "start", "primary full", r.seats.length < 2 ? "disabled" : "") : '<div class="waiting">Waiting for the host to start…</div>'} <div class="section-label">THE RULEBOOK</div><div class="preset-options"><button data-ui="preset" data-preset="economy" class="preset ${rules.preset === "economy" ? "chosen" : ""}" ${!host ? "disabled" : ""}><span>✦</span><div><b>Economy edition</b><small>Contracts, cycles &amp; more strategy</small></div><i>${rules.preset === "economy" ? "●" : "○"}</i></button><button data-ui="preset" data-preset="classic" class="preset ${rules.preset === "classic" ? "chosen" : ""}" ${!host ? "disabled" : ""}><span>♜</span><div><b>Core</b><small>Roll, buy, auction and build</small></div><i>${rules.preset === "classic" ? "●" : "○"}</i></button></div>${ruleChecklist(rules, !host, true)}${button("Why these rules?", "recommendations", "text-button full")}${button("Leave table", "leave", "text-button full quiet")}</div>`;
  fillQrs();
  if (focusedRule)
    document
      .querySelector<HTMLElement>(
        `#sidebar .rule-checklist [name="${focusedRule}"]`,
      )
      ?.focus({ preventScroll: true });
  const tuning = document.querySelector<HTMLDetailsElement>(
    "#sidebar .rule-tuning",
  );
  if (tuning && tuningOpen) tuning.open = true;
  const body = document.querySelector("#sidebar .sidebar-body");
  if (body) body.scrollTop = scrollTop;
}
function turnPanel(g: Game, actor: string, isActing: boolean) {
  const p = current(g),
    roll = g.dice[0] + g.dice[1];
  let content = g.rules.planning
    ? `<div class="credit-status" data-help="${esc(planningDescription(g.rules))} Review escape rolls cannot be adjusted; doubles still use the original dice."><b>${esc(p.name)} · ${p.planning}/${g.rules.planningCap} planning credits</b><span>Next refill: personal lap ${p.laps + (g.rules.planningEvery - (p.laps % g.rules.planningEvery))} · ${p.laps} completed</span>${button("How credits work", "credits", "text-button tiny")}</div>`
    : "";
  if (g.phase === "over")
    return `<div class="turn-card"><span class="eyebrow">THE LAST OWNER STANDING</span><h2>${esc(g.players.find((p) => p.id === g.winner)!.name)} wins.</h2><p>A city built. A fortune made.</p></div>${button("Save game record", "export", "secondary full")}${logPanel(g)}`;
  if (!isActing) {
    const who = g.players.find((p) => p.id === actorFor(g))!;
    content += `<div class="waiting"><span class="pulse"></span>${esc(who.name)} ${who.bot ? "is thinking…" : "is making a move."}</div>`;
  }
  if (g.phase === "roll") {
    content += `<div class="turn-card"><div class="eyebrow">${p.jailed ? "IN REVIEW · " + p.jailTurns + "/3 ATTEMPTS" : "THE CITY IS WAITING"}</div><h2>${p.jailed ? "Try your luck." : "Make your move."}</h2><p>${p.jailed ? "Roll doubles to leave. After three failed attempts, pay bail and move." : g.doubles ? "Doubles! You get another roll." : "Roll the dice and find your next opportunity."}</p><div class="dice-preview"><span>⚄</span><span>⚂</span></div>${button("Roll the dice <span>↗</span>", "roll", "primary full", !isActing ? "disabled" : "")}${p.jailed && isActing ? `<div class="two-col">${button(`Pay ${cash(indexed(g, 50))}`, "bail", "secondary")}${p.freeCards.length ? button("Use release certificate", "jail-card", "secondary") : ""}</div>` : ""}</div>`;
  }
  if (g.phase === "move") {
    content += `<div class="turn-card"><span class="eyebrow">ROLLED ${g.dice[0]} + ${g.dice[1]}</span><h2>A little foresight.</h2><p>Keep your roll, or spend one planning credit to adjust your destination.</p><div class="move-options">${[
      -1, 0, 1,
    ]
      .map((delta) => {
        const id = (p.position + roll + delta) % 40;
        return button(
          `<strong>${roll + delta}</strong><span>${esc(BOARD[id].name)}</span><small>${delta ? "1 credit" : "FREE"}</small>`,
          "move",
          delta === 0 ? "recommended" : "",
          `data-delta="${delta}" ${!isActing ? "disabled" : ""}`,
        );
      })
      .join(
        "",
      )}</div><p class="small centered">${p.planning} planning credit${p.planning !== 1 ? "s" : ""} remaining · +1 every ${g.rules.planningEvery} personal laps, up to ${g.rules.planningCap}</p></div>`;
  }
  if (g.phase === "purchase") {
    const t = BOARD[p.position];
    content += `<div class="turn-card purchase-card" style="--deed:${t.color || "#426951"}"><span class="eyebrow">ON THE MARKET</span><h2>${esc(t.name)}</h2><div class="big-price">${cash(indexed(g, t.price!))}<span>ASKING PRICE</span></div><p>Make it yours, or open bidding to everyone—including you.</p>${button("Buy property <span>+</span>", "buy", "primary full", !isActing || p.cash < indexed(g, t.price!) ? "disabled" : "")}${button("Send to auction →", "auction", "secondary full", !isActing ? "disabled" : "")}</div>`;
  }
  if (g.phase === "auction") {
    const a = g.auction!;
    content += `<div class="turn-card"><span class="eyebrow">LIVE AUCTION · ${a.remaining.length} BIDDERS</span><h2>${a.targets ? "The last " + a.kind : esc(BOARD[a.property].name)}</h2><div class="big-price">${cash(a.high)}<span>${a.leader ? esc(g.players.find((p) => p.id === a.leader)!.name) + " LEADS" : "OPENING BID"}</span></div><p>Raise by any whole amount. Passing withdraws you from this auction.</p><form id="bid-form">${a.targets && a.targets[actor] ? `<label class="field">BUILD ON<select id="auction-site">${a.targets[actor].map((id) => `<option value="${id}">${esc(BOARD[id].name)}</option>`).join("")}</select></label>` : ""}<label class="field">YOUR BID<input type="number" id="bid-amount" min="${a.high + 1}" step="1" value="${a.high + 10}" ${!isActing ? "disabled" : ""}></label><button class="primary full" ${!isActing ? "disabled" : ""}>Place bid <span>↗</span></button></form>${button("Pass on this property", "pass", "secondary full", !isActing ? "disabled" : "")}</div>`;
  }
  if (g.phase === "debt") {
    const d = g.payments[0],
      debtor = g.players.find((p) => p.id === d.player)!;
    content += `<div class="turn-card debt-card"><span class="eyebrow">A CASH FLOW PROBLEM</span><h2>Time to restructure.</h2><p>${esc(d.reason)}</p><div class="big-price">${cash(d.amount)}<span>PAYMENT DUE · CASH ${cash(debtor.cash)}</span></div><p>Mortgage property, sell buildings, or negotiate with another player.</p>${button("Settle payment", "settle", "primary full", !isActing || debtor.cash < d.amount ? "disabled" : "")}<div class="two-col">${button("Manage assets", "portfolio", "secondary")}${button("Make a deal", "new-deal", "secondary")}</div>${button("Declare bankruptcy", "bankrupt", "danger-link full", !isActing ? "disabled" : "")}</div>`;
  }
  if (g.phase === "end") {
    content += `<div class="turn-card"><span class="eyebrow">ROLLED ${g.dice[0]} + ${g.dice[1]}</span><h2>${esc(BOARD[p.position].name)}</h2><p>Your move is complete. Build, restructure, or negotiate before passing the dice.</p>${button("End turn <span>→</span>", "end", "primary full", !isActing ? "disabled" : "")}<div class="two-col">${button("Portfolio", "portfolio", "secondary")}${button("Make a deal", "new-deal", "secondary")}</div></div>`;
  }
  content = cardPanel(g) + content;
  return content + logPanel(g);
}
function logPanel(g: Game) {
  return `<div class="section-label activity-label">TABLE JOURNAL <span>TURN ${g.turnNumber}</span></div><div class="journal">${g.logs
    .slice(-5)
    .reverse()
    .map(
      (l, i) =>
        `<div class="journal-item ${i === 0 ? "latest" : ""}"><span>${l.kind === "deal" ? "↔" : l.kind === "income" ? "+" : l.kind === "dice" ? "⚄" : "·"}</span><p>${esc(l.text)}</p></div>`,
    )
    .join("")}</div>`;
}
function deedCard(g: Game, id: number, actor: string) {
  const t = BOARD[id],
    d = g.deeds[id];
  if (!d)
    return `<div class="deed-card"><h3>${esc(t.name)}</h3><p class="muted">${t.kind === "go" ? "Collect your indexed $200 salary when you cross GO." : t.kind === "parking" ? "A quiet moment. Free Parking pays no jackpot." : t.kind === "goToJail" ? "Move directly to Review without collecting GO." : t.kind === "tax" ? `Pay ${cash(indexed(g, t.tax!))} to the bank.` : t.kind === "jail" ? "Only visiting? Carry on. Reviewed players can still collect rent and trade." : "Draw a card when you land here."}</p></div>`;
  const owner = g.players.find((p) => p.id === d.owner),
    own = d.owner === actor,
    supply = buildingSupply(g);
  return `<div class="deed-card" style="--deed:${t.color || "#436857"}"><div class="deed-band">TITLE DEED <span>${d.mortgage ? "MORTGAGED" : d.houses === 5 ? "HOTEL" : d.houses ? d.houses + " HOUSES" : ""}</span></div><h3>${esc(t.name)}</h3><div class="deed-owner">${owner ? `Owned by <b style="color:${owner.color}">${esc(owner.name)}</b>` : "Available from the bank"}</div><div class="deed-stats"><div><small>LIST VALUE</small><b>${cash(indexed(g, t.price!))}</b></div><div><small>RENT ${t.kind === "utility" ? "AT 7 PIPS" : ""}</small><b>${cash(rent(g, id))}</b></div></div>${t.rent ? `<div class="rent-schedule">${t.rent.map((r, i) => `<div class="${i === d.houses ? "rent-current" : ""}"><span>${i === 0 ? "Site only" : i === 5 ? "With hotel" : i + " house" + (i > 1 ? "s" : "")}</span><b>${cash(Math.round(r * g.index * market(g).rent))}</b></div>`).join("")}<small>Unbuilt complete sets pay double. Mortgages pay no rent.</small></div>` : `<p class="small">${t.kind === "railroad" ? "Rent doubles for each additional railroad owned: $25 / $50 / $100 / $200, adjusted by the economy." : "Rent is 4 × dice, or 10 × dice with both utilities, adjusted by the economy."}</p>`}
 ${d.claims.length || d.sellOn.length || d.vetoes.length || d.option ? `<div class="claim-list"><b>ATTACHED AGREEMENTS</b>${d.claims.map((c) => `<p>${c.percent}% ${c.kind} → ${esc(g.players.find((p) => p.id === c.holder)?.name)}</p>`).join("")}${d.sellOn.map((c) => `<p>${cash(c.amount)} each resale → ${esc(g.players.find((p) => p.id === c.holder)?.name)}</p>`).join("")}${d.vetoes.map((v) => `<p>${esc(g.players.find((p) => p.id === v.holder)?.name)} vetoes sale to ${v.blocked.map((id) => esc(g.players.find((p) => p.id === id)?.name)).join(", ")}</p>`).join("")}${d.option ? `<p>Reserved: ${esc(g.players.find((p) => p.id === d.option!.holder)?.name)} may buy for ${cash(d.option.strike)}.</p>` : ""}</div>` : ""}
 ${own ? `<div class="property-actions">${t.kind === "property" ? button(`+ Build · ${cash(constructionCost(g, t))}`, "build", "secondary full", `data-property="${id}" data-help="Build evenly on a full color set. Bank supply: ${supply.houses} houses, ${supply.hotels} hotels."`) : ""}${button(d.mortgage ? `Redeem · ${cash(redemptionCost(g, id))}` : `Mortgage · +${cash(mortgageValue(g, t))}`, d.mortgage ? "redeem" : "mortgage", "secondary full", `data-property="${id}"`)}${d.houses ? `<div class="two-col">${button("Sell one building", "sell-building", "secondary", `data-property="${id}"`)}${button("Sell group buildings", "sell-group", "secondary", `data-property="${id}"`)}</div>` : ""}</div>` : ""}${d.option?.holder === actor ? `${button("Exercise option · " + cash(d.option.strike), "exercise", "primary full", `data-property="${id}"`)}${button("Release option", "release-option", "text-button full", `data-property="${id}"`)}` : ""}</div>`;
}
function portfolioPanel(g: Game, actor: string) {
  return `<div class="portfolio-heading"><div><small>YOUR NET WORTH</small><h2>${cash(netWorth(g, actor))}</h2></div><span>${PURCHASABLE.filter((t) => g.deeds[t.id].owner === actor).length}<small>DEEDS</small></span></div><label class="field">INSPECT A SPACE<select id="property-select">${BOARD.map((t) => `<option value="${t.id}" ${t.id === selected ? "selected" : ""}>${t.id.toString().padStart(2, "0")} · ${esc(t.name)}${g.deeds[t.id]?.owner === actor ? " · Yours" : ""}</option>`).join("")}</select></label>${deedCard(g, selected, actor)}<div class="section-label">YOUR PROPERTIES</div><div class="property-list">${
    PURCHASABLE.filter((t) => g.deeds[t.id].owner === actor)
      .map(
        (t) =>
          `<button data-ui="select-property" data-property="${t.id}"><span style="background:${t.color || "#557765"}"></span>${esc(t.name)}<b>${g.deeds[t.id].mortgage ? "M" : g.deeds[t.id].houses === 5 ? "H" : g.deeds[t.id].houses || "↗"}</b></button>`,
      )
      .join("") ||
    '<p class="muted">A blank canvas. Your first investment awaits.</p>'
  }</div>`;
}
function describeDeal(g: Game, d: Deal) {
  const names = (ids: number[]) =>
    ids.map((id) => esc(BOARD[id].name)).join(", ");
  return `<div class="deal-summary"><p><b>${esc(g.players.find((p) => p.id === d.from)?.name)} gives</b><br>${[d.give.length ? `${d.retainTitle ? d.equity + "% equity in " : ""}${names(d.give)}` : "", d.cash ? cash(d.cash) : ""].filter(Boolean).join(" + ") || "Contract rights below"}</p><p><b>${esc(g.players.find((p) => p.id === d.to)?.name)} gives</b><br>${[names(d.take), d.receiveCash ? cash(d.receiveCash) : ""].filter(Boolean).join(" + ") || "No upfront consideration"}</p>${d.giveJailCards || d.takeJailCards ? `<p>Review passes: proposer gives ${d.giveJailCards || 0}; recipient gives ${d.takeJailCards || 0}.</p>` : ""}${d.royalty ? `<p>Seller keeps <b>${d.royalty}% of each rent</b> on offered properties.</p>` : ""}${d.equity && !d.retainTitle ? `<p>Seller keeps <b>${d.equity}% equity</b>: rent and future sale proceeds.</p>` : ""}${d.sellOn ? `<p>Seller receives <b>${cash(d.sellOn)} per property at every future resale</b>.</p>` : ""}${d.veto.length ? `<p>Seller blocks resale to <b>${d.veto.map((id) => esc(g.players.find((p) => p.id === id)?.name)).join(", ")}</b> while still in the game.</p>` : ""}${d.option ? `<p>Buyer receives an <b>open-ended option</b> on ${esc(BOARD[d.option.property].name)} for a fixed <b>${cash(d.option.strike)}</b>. The title is reserved.</p>` : ""}${d.loan ? `<p>Seller lends <b>${cash(d.loan.principal)}</b>; buyer repays <b>${cash(d.loan.principal * (1 + d.loan.interest / 100))}</b> after ${d.loan.laps} of their GO crossings.</p>` : ""}${d.note ? `<p translate="no"><i>“${esc(d.note)}”</i></p>` : ""}</div>`;
}
function dealsPanel(g: Game, actor: string) {
  const offers = g.offers.filter((d) => d.to === actor || d.from === actor);
  return `<div class="deals-intro"><span class="eyebrow">GOOD DEALS CHANGE EVERYTHING</span><h2>Think beyond cash.</h2><p class="muted">${g.rules.contracts ? "Split the income. Reserve tomorrow’s opportunity. Find common ground." : "Swap properties and cash. Advanced contracts are disabled for this table."}</p>${button("Propose a deal <span>↗</span>", "new-deal", "primary full")}</div><div class="section-label">PENDING OFFERS <span>${offers.length}</span></div>${
    offers.length
      ? offers
          .map((d) => {
            const preview = previewDeal(g, d);
            return `<div class="offer-card"><div class="eyebrow">${d.to === actor ? "INCOMING" : "YOUR OFFER"}</div>${describeDeal(g, d)}${preview.error ? `<p class="form-error">${esc(preview.error)}</p>` : `<div class="settlement">Your cash change <b>${cash(preview.cash[actor] || 0)}</b></div>`}<div class="two-col">${d.to === actor ? button("Accept deal", "accept", "primary", `data-id="${d.id}" ${preview.error ? "disabled" : ""}`) : ""}${button(d.from === actor ? "Withdraw" : "Decline", "reject", "secondary", `data-id="${d.id}"`)}</div></div>`;
          })
          .join("")
      : '<div class="empty-state"><span>↔</span><p>No offers on the table.<br>A conversation could change that.</p></div>'
  }<div class="section-label">INVESTOR LOANS</div>${
    g.loans
      .filter((l) => l.borrower === actor || l.lender === actor)
      .map(
        (l) =>
          `<div class="loan-row"><p>${l.borrower === actor ? "You owe" : "You are owed"} <b>${cash(l.due)}</b><small>Due at borrower lap ${l.dueLap} · now ${g.players.find((p) => p.id === l.borrower)!.laps}</small></p>${l.borrower === actor ? button("Repay", "repay", "secondary", `data-id="${l.id}"`) : ""}</div>`,
      )
      .join("") || '<p class="small muted">No outstanding loans.</p>'
  }`;
}
function openDialog(html: string, wide = false) {
  const d = $("#dialog") as HTMLDialogElement;
  d.className = wide ? "wide" : "";
  d.innerHTML = `<button class="dialog-close" data-ui="close-dialog" aria-label="Close dialog">×</button>${html}`;
  if (!d.open) d.showModal();
}
function closeDialog() {
  ($("#dialog") as HTMLDialogElement).close();
}
function newDealDialog() {
  const g = room!.game!,
    actor = controlled(),
    targets = g.players.filter((p) => p.id !== actor && !p.bankrupt);
  if (!targets.length) {
    openDialog(
      `<span class="eyebrow">NEGOTIATING PARTNERS</span><h2>Bring a friend to the table.</h2><p>The computer players buy, bid, build, and manage debt. Complex contracts are negotiated between human seats; bots evaluate simple title and cash trades.</p><p>For a local game, set at least two seats to Human before starting. In pass-and-play, use the Controlling selector to review the other side’s offer.</p>${button("Got it", "close-dialog", "primary full")}`,
    );
    return;
  }
  const props = (owner: string) =>
    PURCHASABLE.filter((t) => g.deeds[t.id].owner === owner)
      .map(
        (t) =>
          `<label class="property-check"><input type="checkbox" name="${owner === actor ? "give" : "take"}" value="${t.id}"><i style="background:${t.color || "#587562"}"></i>${esc(t.name)}</label>`,
      )
      .join("") || '<p class="small muted">No properties yet.</p>';
  openDialog(
    `<span class="eyebrow">THE NEGOTIATING TABLE</span><h2>Structure your deal.</h2><p class="muted">Every clause is enforced by the game. Cash and strike prices stay fixed as inflation changes.</p><form id="deal-form"><label class="field">DEAL WITH<select id="deal-to" name="to">${targets.map((p) => `<option value="${p.id}">${esc(p.name)}${p.bot ? " (computer · simple trades)" : ""}</option>`).join("")}</select></label><div class="deal-columns"><section><h3>You offer</h3><div class="property-checks">${props(actor)}</div><label class="field">CASH YOU PAY<input type="number" name="cash" min="0" step="1" value="0"></label><label class="field">REVIEW PASSES YOU GIVE<input name="giveJailCards" type="number" min="0" max="2" step="1" value="0"></label></section><section><h3>You receive</h3><div class="property-checks" id="take-properties">${props(targets[0].id)}</div><label class="field">CASH THEY PAY<input type="number" name="receiveCash" min="0" step="1" value="0"></label><label class="field">REVIEW PASSES YOU RECEIVE<input name="takeJailCards" type="number" min="0" max="2" step="1" value="0"></label></section></div>
 ${
   g.rules.contracts
     ? `<div class="section-label">ADD YOUR TERMS <span>APPLIES TO YOUR OFFERED PROPERTIES</span></div><div class="terms-grid">
 <label class="term field" data-help="Royalties: the seller keeps a percentage of every rent, even after later sales. No payout on resale."><span>Royalties <i>%</i></span><input name="royalty" type="number" min="0" max="50" value="0"><small>Keep a share of every rent.</small></label>
 <label class="term field" data-help="Equity earns the stated share of rent and future sale proceeds. All outstanding rent rights are capped at 80%."><span>Equity stake <i>%</i></span><input name="equity" type="number" min="0" max="80" value="0"><small>Share rent and resale proceeds.</small></label>
 <label class="term field" data-help="A fixed fee paid to you by every future seller, per property. It persists until you leave the game."><span>Sell-on payment <i>$</i></span><input name="sellOn" type="number" min="0" value="0"><small>Get paid again at every resale.</small></label></div>
 <label class="check-line" data-help="Keep control of your selected properties and sell the stated equity percentage to the other player. Useful for raising cash across a portfolio."><input name="retainTitle" type="checkbox"> Sell only the equity stake; keep my titles</label>
 <details class="contract-details"><summary>Resale veto <span>+</span></summary><p class="small muted">These players cannot receive your offered titles while you remain in the game.</p><div class="check-row">${g.players
   .filter((p) => !p.bankrupt && p.id !== actor)
   .map(
     (p) =>
       `<label><input name="veto" type="checkbox" value="${p.id}"> ${esc(p.name)}</label>`,
   )
   .join("")}</div></details>
 <details class="contract-details"><summary>Future purchase option <span>+</span></summary><p class="small muted">Give your partner the right to buy one of your other properties at a fixed price, at any later action break. The title is reserved; it cannot be sold, mortgaged, or developed until the holder exercises or releases it.</p><div class="two-col"><label class="field">RESERVE PROPERTY<select name="optionProperty"><option value="">No option</option>${PURCHASABLE.filter(
   (t) => g.deeds[t.id].owner === actor,
 )
   .map((t) => `<option value="${t.id}">${esc(t.name)}</option>`)
   .join(
     "",
   )}</select></label><label class="field">FIXED STRIKE PRICE<input name="strike" type="number" min="1" value="200"></label></div></details>
 <details class="contract-details"><summary>Investor loan <span>+</span></summary><p class="small muted">You lend cash now. Your partner owes one fixed repayment after their chosen number of GO crossings. No compounding. Early repayment is allowed.</p><div class="terms-grid"><label class="field">PRINCIPAL<input name="principal" type="number" min="0" value="0"></label><label class="field">INTEREST %<input name="interest" type="number" min="0" max="25" value="10"></label><label class="field">BORROWER LAPS<input name="loanLaps" type="number" min="1" max="5" value="2"></label></div></details>`
     : ""
 }
 <label class="field note-field">A NOTE TO YOUR PARTNER<input name="note" maxlength="160" placeholder="An offer we can both build on…"></label><div id="deal-preview" class="deal-preview"></div><p class="small muted">Existing clauses follow the title. Cash for a multi-property sale is allocated by base list prices. Mortgage transfers charge the buyer 10% interest.</p><button class="primary full" type="submit">Send offer <span>→</span></button></form>`,
    true,
  );
  const fields: Record<string, string[]> = {
    royalties: ["royalty"],
    equity: ["equity", "retainTitle"],
    sellOn: ["sellOn"],
    vetoes: ["veto"],
    options: ["optionProperty", "strike"],
    loans: ["principal", "interest", "loanLaps"],
  };
  for (const [key, names] of Object.entries(fields))
    if (g.rules[key as keyof Rules] === false) {
      for (const name of names)
        for (const input of document.querySelectorAll<
          HTMLInputElement | HTMLSelectElement
        >(`#deal-form [name="${name}"]`)) {
          input.disabled = true;
          const section = input.closest<HTMLElement>(
            ".contract-details, .term, .check-line",
          );
          if (section && !section.dataset.disabled) {
            section.dataset.disabled = "true";
            const note = document.createElement("small");
            note.className = "rule-disabled-note";
            note.textContent = "Disabled by table rules";
            section.appendChild(note);
          }
        }
    }
  updateDealPreview();
}
function formDeal(): Deal {
  const f = $("#deal-form") as HTMLFormElement,
    data = new FormData(f),
    n = (key: string) => Number(data.get(key) || 0);
  return {
    id: "preview",
    from: controlled(),
    to: String(data.get("to")),
    give: data.getAll("give").map(Number),
    take: data.getAll("take").map(Number),
    cash: n("cash"),
    giveJailCards: n("giveJailCards"),
    takeJailCards: n("takeJailCards"),
    receiveCash: n("receiveCash"),
    royalty: n("royalty"),
    equity: n("equity"),
    sellOn: n("sellOn"),
    retainTitle: data.has("retainTitle"),
    veto: data.getAll("veto").map(String),
    option: data.get("optionProperty")
      ? { property: n("optionProperty"), strike: n("strike") }
      : undefined,
    loan: n("principal")
      ? {
          principal: n("principal"),
          interest: n("interest"),
          laps: n("loanLaps"),
        }
      : undefined,
    note: String(data.get("note") || ""),
  };
}
function updateDealPreview() {
  if (!room?.game || !document.querySelector("#deal-form")) return;
  const d = formDeal(),
    preview = previewDeal(room.game, d);
  if (
    room.game.players.find((p) => p.id === d.to)?.bot &&
    (d.royalty ||
      d.equity ||
      d.sellOn ||
      d.veto.length ||
      d.option ||
      d.loan ||
      d.retainTitle)
  )
    preview.error =
      "Computer players evaluate cash and title trades only. Choose a human partner for advanced contracts.";
  $("#deal-preview").innerHTML = preview.error
    ? `<b class="form-error">${esc(preview.error)}</b>`
    : `<span class="eyebrow">CASH AT SIGNING · INCLUDING EXISTING OBLIGATIONS</span>${room.game.players
        .filter(
          (p) => preview.cash[p.id] !== 0 || p.id === d.from || p.id === d.to,
        )
        .map(
          (p) =>
            `<div>${esc(p.name)}<b>${preview.cash[p.id] >= 0 ? "+" : ""}${cash(preview.cash[p.id])}</b></div>`,
        )
        .join("")}`;
}
function economyDialog() {
  const g = room?.game;
  openDialog(
    `<span class="eyebrow">A LIVING ECONOMY</span><h2>The next cycle is no secret.</h2><p>Each economic year begins when <b>every surviving player</b> has completed another lap. ${g ? `Your table’s inflation rate is <b>${Math.round(g.rules.inflation * 100)}%</b>.` : "The default inflation rate is 10%."} List prices, rents, salaries, taxes, cards, and building costs scale together. Cash balances and signed contracts stay nominal.</p><div class="cycle-list">${CYCLES.map((c, i) => `<div class="${i === (g?.cycle || 0) ? "current-cycle" : ""}"><span>0${i + 1}</span><section><b>${c.name}</b><p>${c.description}</p></section>${i === (g?.cycle || 0) ? "<i>NOW</i>" : ""}</div>`).join("")}</div><p class="small muted">${g && !g.rules.cycles ? "Economic cycles are disabled at this table." : "Cycles repeat in this order. Foreknowledge makes investment timing a decision."}</p><h3>A way back into the game</h3>${g ? `<p class="small muted">This table: property tax ${g.rules.wealthTax ? "on" : "off"} · recovery grants ${g.rules.assistance ? "on" : "off"} · planning credits ${g.rules.planning ? "on" : "off"}.</p>` : ""}<p>When enabled, on each GO crossing, a player pays ${Math.round((g?.rules || rules).taxRate * 100)}% of their real-estate value above the table median plus an indexed $500 allowance. A player below 75% of median net worth receives an indexed $${(g?.rules || rules).recoveryGrant} recovery grant.</p><p>Planning credits let you adjust a roll by one space. ${planningDescription(g?.rules || rules)} Credits are not money and cannot be traded. Normal movement costs nothing; a ±1 adjustment costs one credit. Review escape rolls cannot be adjusted, and the original dice still decide doubles. No credits accrue while this rule is disabled; extra refills at the cap are not banked. The dice still matter; the final choice is yours.</p>${button("Back to the table", "close-dialog", "primary full")}`,
  );
}
function guideDialog() {
  openDialog(
    `<span class="eyebrow">A QUICK TOUR</span><h2>Own a little. Negotiate a lot.</h2><div class="guide-grid"><section><h3>01 / The city game</h3><p>The opening dice contest decides who starts. Roll two dice, move clockwise, and collect $200 at GO. Buy unowned property or send it to an open auction. Everyone can bid, including the player who declined it. Rent is collected automatically.</p><p>Complete a color group to double its unbuilt rent and build evenly: four houses, then a hotel. The bank holds 32 houses and 12 hotels. Sell buildings for half the current indexed base cost. Mortgage bare titles for cash; pay principal plus interest to redeem.</p><p>Doubles earn another roll; three doubles send you to Review. Trade release certificates in the deal editor. Leave with a pass, $50, or doubles. The third failed attempt requires bail. You still receive rent in Review. Free Parking has no jackpot.</p></section><section><h3>02 / Agreements that last</h3><p><b>Royalties</b> share rental income. <b>Equity</b> shares rent and subsequent sale proceeds. Sell stakes across several properties while retaining the titles. Combined income rights are capped at 80% so the managing owner retains a reason to invest.</p><p><b>Options</b> reserve a property at a fixed price without expiry. <b>Sell-on payments</b> recur at each later sale. <b>Vetoes</b> block specified buyers until the clause holder is bankrupt. <b>Investor loans</b> add a fixed repayment date and financing decisions.</p><p>Inspect any title to see its obligations. Incoming offers show exact cash changes. Offers are revalidated when accepted. Buildings must be sold before transferring a color group’s properties.</p></section><section><h3>03 / Less luck, more planning</h3><p>Economy mode adds visible cycles, indexed inflation, a progressive property tax, recovery grants, and limited ±1 movement credits. Each module and each contract type can be switched off in the special-rules checklist before play or by the host in Table options. Existing signed agreements are honored. Fixed contract prices create interesting inflation exposure.</p><p>Foreseeable boom and recession years reward saving and timing. Diversifying stakes spreads the risk of a bad roll without replacing the property trading game.</p></section><section><h3>04 / Playing together</h3><p>Play solo, share one computer, host an online table, or choose TV + phones. Run npm run host to connect through Cloudflare, then share the invitation or scan the QR code. The computer shows the board while each phone controls its own player. All devices stay synchronized.</p><p>Import STL, OBJ, GLB, or embedded glTF figures using the piece button in the lobby or Table options. Models are centered and sized automatically. Maximum 8 MB / 500,000 vertices.</p><p>Bots handle buying, auctions, building, debt, and simple title/cash trades. Advanced negotiated contracts need human partners. Tables save automatically on the host. Use the same browser to resume, or save your private seat recovery code in Table options before a temporary Cloudflare address changes.</p></section></div><div class="guide-note"><b>Digital table conventions</b><p>Manage property and negotiate at action breaks. Auctions take clockwise bidding turns; passing is final. When the final available house or hotel has multiple eligible builders, it is auctioned among them. Estate Exchange uses the classic square board and familiar US property names, with its own artwork and fixed levy amounts.</p></div>${button("I’m ready", "close-dialog", "primary full")}`,
    true,
  );
}
function tokenDialog(id: string) {
  const s = room!.seats.find((s) => s.id === id);
  if (!s) return;
  modelSeat = id;
  openDialog(
    `<span class="eyebrow">YOUR FIGURE, YOUR SIGNATURE</span><h2>Choose your piece.</h2><p class="muted">${esc(s.name)}’s place in the city.</p><div class="token-picker">${TOKENS.map((t, i) => button(`<span>${["✥", "♜", "◆", "☄", "◇", "▣"][i]}</span>${t}`, "choose-token", s.token === t && !s.model ? "chosen" : "", `data-id="${s.id}" data-token="${t}"`)).join("")}</div><div class="section-label">OR BRING SOMETHING ORIGINAL</div><p>Import your own 3D figure. It will be scaled to the board and shared with every connected player.</p>${button("↑ Import a 3D model", "import-model", "secondary full")}<p class="small muted">STL (binary or ASCII), OBJ geometry, GLB, or embedded glTF. Up to 8 MB / 500,000 vertices. STL uses Z-up; other formats use Y-up. GLB preserves materials; STL and OBJ get your player’s metal finish.</p><p class="small"><a href="/models/sample-tower.stl" download>Download a sample STL tower ↗</a></p>`,
  );
}
function inviteUrl(view = "phone") {
  const origin =
    publicUrl ||
    (location.protocol === "https:"
      ? location.origin
      : addresses[0] || location.origin);
  const url = new URL(origin);
  url.searchParams.set("room", room!.code);
  url.searchParams.set("invite", room!.invite || "");
  url.searchParams.set("screen", view);
  url.searchParams.set("lang", language);
  if (view === "tv") url.searchParams.set("watch", "1");
  return url.href;
}
const qrCache = new Map<string, Promise<string>>();
function fillQrs() {
  document.querySelectorAll<HTMLImageElement>("img[data-qr]").forEach((img) => {
    const url = img.dataset.qr!;
    if (!qrCache.has(url))
      qrCache.set(
        url,
        QRCode.toDataURL(url, {
          width: 320,
          margin: 4,
          errorCorrectionLevel: "M",
        }),
      );
    void qrCache
      .get(url)!
      .then((data) => {
        if (img.isConnected) img.src = data;
      })
      .catch(() => {
        img.alt = "Use the invitation link below";
      });
  });
}
function joinCard() {
  const url = inviteUrl();
  return `<section class="join-card"><span class="eyebrow">${publicUrl ? "ONLINE · CLOUDFLARE" : "LOCAL NETWORK"}</span><h3>Scan to join on your phone</h3><img data-qr="${esc(url)}" width="200" height="200" alt="QR code to join table ${room!.code}"><b class="join-code">${room!.code}</b><p>${room!.mode === "party" ? "The TV has no player seat. Everyone joins on a phone." : "Open this invitation in any player’s browser."}</p><a class="invitation-url" href="${esc(url)}">${esc(url)}</a>${button("Copy invitation", "copy-link", "secondary full")}<small>${publicUrl ? "No app or VPN needed. Keep the host computer running." : "Same Wi-Fi only. Run npm run host for a Cloudflare Internet link."}</small></section>`;
}
function renderTV() {
  const r = room!,
    g = r.game;
  const p = g?.players.find((p) => p.id === actorFor(g));
  $("#sidebar").innerHTML =
    `<div class="sidebar-top"><span class="eyebrow">SHARED TABLE · ${r.code}</span>${button("Full screen", "fullscreen", "text-button tiny")}</div><div class="sidebar-body tv-status">${
      g
        ? `<div class="tv-turn"><span class="eyebrow">${g.phase === "over" ? "WINNER" : g.phase === "auction" ? "NEXT BIDDER" : "PLAY ON YOUR PHONE"}</span><h2>${esc(g.phase === "over" ? g.players.find((p) => p.id === g.winner)?.name : p?.name)}</h2><p>${g.phase === "over" ? "Owns the city." : g.phase === "move" ? "Choose your destination on your phone." : g.phase === "purchase" ? "Buy this title or open an auction." : g.phase === "auction" ? `${BOARD[g.auction!.property].name} · highest bid ${cash(g.auction!.high)}` : g.phase === "debt" ? "Raise funds or negotiate to settle the debt." : g.phase === "end" ? "Manage your portfolio, make a deal, or end your turn." : "Roll when you’re ready."}</p>${p && !r.seats.find((s) => s.id === p.id)?.connected && !p.bot ? '<p class="rule-disabled-note">Phone disconnected. Reopen the invitation to reconnect.</p>' : ""}<div class="tv-dice">${g.dice.join(" + ")}</div></div>${cardPanel(g)}<div class="tv-journal">${g.logs
            .slice(-4)
            .reverse()
            .map((l) => `<p>${esc(l.text)}</p>`)
            .join("")}</div>`
        : `<h2>Waiting for the players.</h2>${r.seats.map((s) => `<p>${esc(s.name)} · ${s.connected ? "Ready" : "Offline"}</p>`).join("")}`
    } ${joinCard()}${!displayOnly ? button("Table options", "table-menu", "secondary full") : button("Leave display", "leave", "text-button full")}</div>`;
  fillQrs();
}
function shareDialog() {
  openDialog(
    `<span class="eyebrow">BRING EVERYONE TO THE TABLE</span><h2>One board. Every phone.</h2>${joinCard()}<p><a href="${esc(inviteUrl("tv"))}" target="_blank" rel="noopener">Open a read-only TV display ↗</a></p><p class="small muted">Mirror this computer to the TV with HDMI, AirPlay, or your browser’s Cast tab feature. Phones stay on their own controls.</p>`,
  );
  fillQrs();
}
function renameDialog(id: string) {
  const seat = room!.seats.find((s) => s.id === id);
  if (!seat) return;
  openDialog(
    `<span class="eyebrow">YOUR SEAT AT THE TABLE</span><h2>Change player name</h2><p>Your properties, agreements, and saved seat stay with you. Everyone at the table will see the new name.</p><form id="rename-form" data-seat="${seat.id}"><label class="field">PLAYER NAME<input name="playerName" value="${esc(seat.name)}" maxlength="22" required autocomplete="nickname"></label><button class="primary full" type="submit">Save name</button></form>`,
  );
}
function ruleChecklist(r: Rules, readonly = false, lobby = false) {
  const contractKeys = [
    "royalties",
    "equity",
    "sellOn",
    "vetoes",
    "options",
    "loans",
  ];
  return `<fieldset class="rule-checklist" data-lobby="${lobby}" ${readonly ? "disabled" : ""}><legend>Special rules · choose individually</legend><label class="rule-check" data-help="${esc(INFLATION_DESCRIPTION)}"><input name="inflationEnabled" type="checkbox" role="switch" ${r.inflation > 0 ? "checked" : ""}><span><b>Inflation</b><small>${INFLATION_DESCRIPTION}</small></span></label><label class="inflation-rate">Rate per shared lap<select name="inflationRate" ${r.inflation <= 0 ? "disabled" : ""}>${[
    ...new Set([0.02, 0.05, 0.1, 0.15, 0.2, r.inflation || 0.1]),
  ]
    .sort((a, b) => a - b)
    .map(
      (v) =>
        `<option value="${v}" ${v === (r.inflation || 0.1) ? "selected" : ""}>${Math.round(v * 100)}%</option>`,
    )
    .join(
      "",
    )}</select></label><label class="rule-check" data-help="Master switch for new investor agreements. Turn individual contract types on or off below. Signed agreements remain valid."><input name="contracts" type="checkbox" role="switch" ${r.contracts ? "checked" : ""}><span><b>Investor contracts</b><small>Master switch for all six contract types below.</small></span></label>${SPECIAL_RULES.map((rule) => `<label class="rule-check" data-help="${esc(ruleDescription(rule.key, r) + " Why: " + rule.why)}"><input name="${rule.key}" type="checkbox" role="switch" ${r[rule.key] ? "checked" : ""} ${contractKeys.includes(rule.key) ? `data-contract-rule="true" ${!r.contracts ? "disabled" : ""}` : ""}><span><b>${rule.title}</b><small>${ruleDescription(rule.key, r)}</small></span></label>`).join("")}${tuningControls(r)}</fieldset>`;
}
function tuningControls(r: Rules) {
  const input = (
    key: string,
    label: string,
    value: number,
    min: number,
    max: number,
  ) =>
    `<label class="field">${label}<input type="number" name="${key}" value="${value}" min="${min}" max="${max}" step="1" required></label>`;
  return `<details class="rule-tuning"><summary>Tune the numbers</summary><p>Optional. Defaults are ready to play. Starting credits apply to new games; refill changes use each player's total completed laps. Existing balances are kept.</p><div class="tuning-grid">${input("planningStart", "Starting credits", r.planningStart, 0, 10)}${input("planningEvery", "Laps per new credit", r.planningEvery, 1, 20)}${input("planningCap", "Maximum saved credits", r.planningCap, 1, 10)}${input("taxRate", "Property tax (%)", Math.round(r.taxRate * 100), 0, 20)}${input("recoveryGrant", "Recovery grant ($)", r.recoveryGrant, 0, 500)}</div><p>Starting credits cannot exceed the maximum. Grant amounts rise with inflation.</p></details>`;
}
function updateRuleChecklist(container: HTMLElement) {
  const enabled = (
    container.querySelector('[name="contracts"]') as HTMLInputElement
  ).checked;
  container
    .querySelectorAll<HTMLInputElement>("[data-contract-rule]")
    .forEach((el) => (el.disabled = !enabled));
  (
    container.querySelector('[name="inflationRate"]') as HTMLSelectElement
  ).disabled = !(
    container.querySelector('[name="inflationEnabled"]') as HTMLInputElement
  ).checked;
}
function readRuleChecklist(container: HTMLElement): Rules {
  const checked = (key: string) =>
    (container.querySelector(`[name="${key}"]`) as HTMLInputElement).checked;
  return {
    ...ECONOMY,
    preset: "economy",
    ...Object.fromEntries(
      [
        "planningStart",
        "planningEvery",
        "planningCap",
        "taxRate",
        "recoveryGrant",
      ].map((key) => [
        key,
        Number(
          container.querySelector<HTMLInputElement>(`[name="${key}"]`)!.value,
        ) / (key === "taxRate" ? 100 : 1),
      ]),
    ),
    inflation: checked("inflationEnabled")
      ? Number(
          (
            container.querySelector(
              '[name="inflationRate"]',
            ) as HTMLSelectElement
          ).value,
        )
      : 0,
    contracts: checked("contracts"),
    ...Object.fromEntries(
      SPECIAL_RULES.map((rule) => [rule.key, checked(rule.key)]),
    ),
  };
}
function rulesDialog() {
  const host = room!.host === me;
  const moving = room!.game?.phase === "move";
  openDialog(
    `<span class="eyebrow">YOUR TABLE, YOUR RULES</span><h2>Special rules checklist</h2><p>${host ? "Choose the rules your group wants. Changes apply to future events; accumulated inflation and credit balances stay as they are. Signed contracts are honored. Applying changes clears unsigned offers." : "These are your table’s current settings. Only the host can change them."}</p>${moving && host ? '<p class="rule-disabled-note">Finish the current movement choice before applying changes.</p>' : ""}<form id="rules-form">${ruleChecklist(room!.game?.rules || rules, !host)}${host ? `<button class="primary full" type="submit" ${moving ? "disabled" : ""}>Apply special rules</button>` : ""}</form>${button("Recommendations & why", "recommendations", "text-button full")}`,
    true,
  );
}
function recommendationsDialog() {
  openDialog(
    `<span class="eyebrow">THE REASONS BEHIND THE RULES</span><h2>Choose your kind of economy.</h2><p>These rules are implemented. Start with planning credits, predictable cycles, progressive tax, and recovery grants. Add contracts as your group gets comfortable. Keep standard auctions: they give everyone a chance to compete for a title.</p><div class="recommendation-list"><section><h3>Inflation</h3><p>${INFLATION_DESCRIPTION}</p><p><b>Why it fits:</b> ${INFLATION_WHY}</p></section>${SPECIAL_RULES.map((rule) => `<section><h3>${rule.title}</h3><p>${ruleDescription(rule.key, rules)}</p><p><b>Why it fits:</b> ${rule.why}</p></section>`).join("")}</div><h3>Ideas for a future expansion · not implemented</h3><p><b>Expiring options:</b> a lower-cost option lasting 2–3 buyer laps would reduce permanent title lockups. <b>Right of first refusal:</b> let a former owner match a resale offer instead of banning buyers. <b>Public infrastructure projects:</b> contribute jointly toward a district bonus, giving rivals a reason to cooperate. These need separate pricing and balance work before enabling them.</p>${button("Back to the table", "close-dialog", "primary full")}`,
    true,
  );
}
function tableMenu() {
  openDialog(
    `<span class="eyebrow">PRIVATE TABLE ${room!.code}</span><h2>Your table, your rules.</h2><div class="menu-buttons">${button("Share table address ↗", "share", "secondary full")}${room!.seats.some((s) => s.id === controlled()) ? button("Change or import your figure", "token", "secondary full", `data-id="${controlled()}"`) : ""}${room!.host === me ? button("Export game record (JSON)", "export", "secondary full") : ""}${room!.seats.some((s) => s.id === controlled()) ? button("Rename player", "rename", "secondary full", `data-id="${controlled()}"`) : ""}${!displayOnly ? button("My seat recovery code", "recovery", "secondary full") : ""}${screenMode !== "tv" ? button(screenMode === "phone" ? "Show board on this device" : "Use phone controls", "screen-mode", "secondary full") : button("Full screen", "fullscreen", "secondary full")}${button("Special rules checklist", "rules", "secondary full")}${button("Rule recommendations & why", "recommendations", "secondary full")}${button("Read the rules", "guide", "secondary full")}${button("View economic outlook", "economy", "secondary full")}${
      room!.host === me && room!.mode !== "local"
        ? room!.seats
            .filter((s) => s.id !== me && (!s.connected || s.bot))
            .map((s) =>
              button(
                `${s.bot ? "Release bot control of" : "Let a bot play for"} ${esc(s.name)}`,
                "replace",
                "secondary full",
                `data-id="${s.id}"`,
              ),
            )
            .join("")
        : ""
    }${button("Leave table (automatically saved)", "leave", "text-button full")}</div>`,
  );
}
function showTile(id: number) {
  const t = BOARD[id];
  openDialog(
    `<span class="eyebrow">AROUND THE BOARD / ${id.toString().padStart(2, "0")}</span><h2>${esc(t.name)}</h2><p>${t.price ? `Base list price ${cash(t.price)}. ${t.rent ? `Base rent ${cash(t.rent[0])}; hotel rent ${cash(t.rent[5])}.` : t.kind === "railroad" ? "Railroad rent grows with each railroad you own." : "Utility rent depends on the dice."}` : "One of the familiar stops on your way around the city."}</p>${button("Back to the board", "close-dialog", "primary full")}`,
  );
}
$("#app").addEventListener("click", async (event) => {
  const el = (event.target as HTMLElement).closest<HTMLElement>("[data-ui]");
  if (!el || (el as HTMLButtonElement).disabled) return;
  const ui = el.dataset.ui!,
    id = el.dataset.id || "",
    property = Number(el.dataset.property);
  const actionMap: Record<string, string> = {
    roll: "ROLL",
    buy: "BUY",
    auction: "AUCTION",
    pass: "PASS",
    end: "END",
    settle: "SETTLE",
    build: "BUILD",
    mortgage: "MORTGAGE",
    redeem: "REDEEM",
    "sell-building": "SELL_BUILDING",
    "sell-group": "SELL_GROUP",
    exercise: "EXERCISE",
    "release-option": "RELEASE_OPTION",
    repay: "REPAY",
    accept: "ACCEPT",
    reject: "REJECT",
  };
  if (actionMap[ui]) {
    act({ type: actionMap[ui], property, id });
    return;
  }
  switch (ui) {
    case "fullscreen":
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch {
        toast(
          "Use your browser’s full-screen control, or mirror this window to the TV.",
        );
      }
      break;
    case "screen-mode": {
      const url = new URL(location.href);
      url.searchParams.set(
        "screen",
        screenMode === "phone" ? "desktop" : "phone",
      );
      location.href = url.href;
      break;
    }
    case "recovery":
      openDialog(
        `<span class="eyebrow">KEEP YOUR SEAT</span><h2>Your recovery code</h2><p>Save this privately. If the host’s public address changes or you switch browsers, scan the new table invitation and enter this code under Returning player.</p><div class="room-code recovery-code">${esc(recoveryCode || knownSession(room!.code)?.recovery || "Reconnect to generate a code")}</div><p>This restores your current seat and its permissions. Each player has their own code; don’t put it on the TV.</p>${button("Saved it", "close-dialog", "primary full")}`,
      );
      break;
    case "resume-room": {
      const session = knownSession(entry.get("room") || "");
      if (session) send({ type: "join", ...session });
      break;
    }
    case "mode":
      mode = el.dataset.mode as typeof mode;
      renderSidebar();
      break;
    case "create":
      send({
        type: "create",
        mode,
        name: ($("#your-name") as HTMLInputElement).value,
      });
      break;
    case "resume": {
      const s = saved();
      if (s) send({ type: "join", ...s });
      break;
    }
    case "leave":
      send({ type: "leave" });
      closeDialog();
      break;
    case "add-bot":
      send({
        type: "add",
        name: ["Morgan", "Robin", "Casey", "Jamie", "Sam"][
          Math.max(0, room!.seats.length - 1)
        ],
        bot: true,
      });
      break;
    case "add-human":
      send({
        type: "add",
        name: `Player ${room!.seats.length + 1}`,
        bot: false,
      });
      break;
    case "toggle-bot":
      send({
        type: "seat",
        id,
        bot: !room!.seats.find((s) => s.id === id)!.bot,
      });
      break;
    case "remove-seat":
      send({ type: "remove", id });
      break;
    case "preset":
      rules = { ...(el.dataset.preset === "classic" ? CLASSIC : ECONOMY) };
      send({ type: "rules", rules });
      break;
    case "start":
      send({ type: "start", rules });
      break;
    case "camera":
      scene?.home();
      break;
    case "top":
      scene?.home(true);
      break;
    case "view-north":
      scene?.view("north");
      break;
    case "view-east":
      scene?.view("east");
      break;
    case "view-south":
      scene?.view("south");
      break;
    case "view-west":
      scene?.view("west");
      break;
    case "close-dialog":
      closeDialog();
      break;
    case "follow":
      scene?.follow();
      break;
    case "credits":
      openDialog(
        `<span class="eyebrow">A LITTLE CONTROL OVER LUCK</span><h2>Planning credits</h2><p>${planningDescription(room?.game?.rules || rules)}</p><p>After a normal roll, the three buttons show your possible destinations. Keep the rolled distance for free, or spend one credit to choose the adjacent destination. No reroll, no cash cost, and no effect on doubles.</p><p>Refills follow personal laps, not shared economic years. The interval is shown above and can be changed under Tune the numbers. At the cap, extra credits are lost. They cannot be traded. Review escape rolls cannot be adjusted. While disabled, credits are kept but cannot be earned or spent.</p>${button("Back to the table", "close-dialog", "primary full")}`,
      );
      break;
    case "rename":
      renameDialog(id || controlled());
      break;
    case "rules":
      rulesDialog();
      break;
    case "recommendations":
      recommendationsDialog();
      break;
    case "guide":
      guideDialog();
      break;
    case "economy":
      economyDialog();
      break;
    case "share":
      shareDialog();
      break;
    case "table-menu":
      tableMenu();
      break;
    case "copy-link": {
      const url = inviteUrl();
      try {
        await navigator.clipboard.writeText(url);
        toast("Invitation link copied.");
      } catch {
        toast(
          "Copy one of the addresses above. Clipboard access is unavailable on this connection.",
        );
      }
      break;
    }
    case "tab":
      tab = el.dataset.tab!;
      renderSidebar();
      break;
    case "portfolio":
      tab = "portfolio";
      renderSidebar();
      break;
    case "select-property":
      selected = property;
      scene?.select(property);
      renderSidebar();
      break;
    case "player": {
      const p = room!.game!.players.find((p) => p.id === id)!;
      selected = p.position;
      scene?.select(selected);
      tab = "portfolio";
      renderSidebar();
      break;
    }
    case "move":
      act({ type: "MOVE", delta: Number(el.dataset.delta) });
      break;
    case "bail":
      act({ type: "BAIL" });
      break;
    case "jail-card":
      act({ type: "BAIL", card: true });
      break;
    case "new-deal":
      if (room?.game) newDealDialog();
      break;
    case "bankrupt":
      openDialog(
        `<span class="eyebrow">LEAVING THE MARKET</span><h2>Declare bankruptcy?</h2><p>Your buildings are liquidated. If that still cannot cover the debt, you leave the game and your assets pass to your creditor, or to bank auctions.</p><div class="two-col">${button("Keep negotiating", "close-dialog", "secondary")}${button("Declare bankruptcy", "confirm-bankrupt", "primary")}</div>`,
      );
      break;
    case "confirm-bankrupt":
      act({ type: "BANKRUPT" });
      closeDialog();
      break;
    case "token":
      tokenDialog(id || controlled());
      break;
    case "choose-token":
      send({ type: "seat", id, token: el.dataset.token });
      closeDialog();
      break;
    case "import-model":
      ($("#model-file") as HTMLInputElement).click();
      break;
    case "export":
      send({ type: "export" });
      break;
    case "replace":
      send({ type: "replace", id });
      closeDialog();
      break;
  }
});
$("#app").addEventListener("submit", (event) => {
  event.preventDefault();
  const f = event.target as HTMLFormElement;
  if (f.id === "rename-form") {
    const value = (
      f.elements.namedItem("playerName") as HTMLInputElement
    ).value.trim();
    if (!value) {
      toast("Enter a name (1–22 characters).");
      return;
    }
    send({ type: "seat", id: f.dataset.seat, name: value });
    closeDialog();
  }
  if (f.id === "rules-form") {
    send({ type: "rules", rules: readRuleChecklist(f) });
    closeDialog();
  }
  if (f.id === "join-form") {
    const code = ($("#join-code") as HTMLInputElement).value
        .trim()
        .toUpperCase(),
      s = knownSession(code) || saved();
    send({
      type: "join",
      code,
      name: ($("#your-name") as HTMLInputElement).value,
      token: s?.code === code ? s.token : undefined,
      invite: code === entry.get("room") ? entry.get("invite") : undefined,
      recovery: String(new FormData(f).get("recovery") || ""),
    });
  }
  if (f.id === "bid-form")
    act({
      type: "BID",
      amount: Number(($("#bid-amount") as HTMLInputElement).value),
      ...(document.querySelector("#auction-site")
        ? { property: Number(($("#auction-site") as HTMLSelectElement).value) }
        : {}),
    });
  if (f.id === "deal-form") {
    const d = formDeal();
    send({
      type: "action",
      actor: controlled(),
      action: { type: "OFFER", deal: d },
    });
    closeDialog();
    tab = "deals";
    renderSidebar();
  }
});
$("#app").addEventListener("change", (event) => {
  const el = event.target as HTMLInputElement;
  if (el.id === "language") {
    localStorage.setItem("estate-language", el.value);
    location.reload();
    return;
  }
  if (el.id === "control-seat") {
    control = el.value;
    renderSidebar();
  }
  if (el.id === "property-select") {
    selected = Number(el.value);
    scene?.select(selected);
    renderSidebar();
  }
  const checklist = el.closest<HTMLElement>(".rule-checklist");
  if (checklist) {
    updateRuleChecklist(checklist);
    if (checklist.dataset.lobby === "true") {
      rules = readRuleChecklist(checklist);
      send({ type: "rules", rules });
    }
  }
  if (el.id === "deal-to") {
    const g = room!.game!;
    $("#take-properties").innerHTML =
      PURCHASABLE.filter((t) => g.deeds[t.id].owner === el.value)
        .map(
          (t) =>
            `<label class="property-check"><input type="checkbox" name="take" value="${t.id}"><i style="background:${t.color || "#587562"}"></i>${esc(t.name)}</label>`,
        )
        .join("") || '<p class="small muted">No properties yet.</p>';
    updateDealPreview();
  }
});
$("#app").addEventListener("input", (event) => {
  if ((event.target as HTMLElement).closest("#deal-form")) updateDealPreview();
});
document.addEventListener("pointerover", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-help]",
  );
  if (target) $("#context-help").textContent = target.dataset.help!;
});
document.addEventListener("focusin", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    "[data-help]",
  );
  if (target) $("#context-help").textContent = target.dataset.help!;
});
$("#model-file").addEventListener("change", async (event) => {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file || !room) return;
  const { importModel, disposeObject } = await import("./models");
  const seat = room.seats.find((s) => s.id === modelSeat)!;
  try {
    if (file.size > 8 * 1024 * 1024)
      throw Error("Choose a model smaller than 8 MB.");
    toast("Checking your model…");
    const data = await file.arrayBuffer(),
      ext = file.name.split(".").pop()!.toLowerCase(),
      model = await importModel(data, ext, seat.color);
    disposeObject(model);
    const response = await fetch("/api/model", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Room": room.code,
        "X-Session": secret,
        "X-Seat": modelSeat,
        "X-Format": ext,
      },
      body: data,
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error);
    closeDialog();
    toast("Your new figure is on the table. Everyone can see it.");
  } catch (e) {
    toast((e as Error).message);
  } finally {
    input.value = "";
  }
});
($("#dialog") as HTMLDialogElement).addEventListener("click", (e) => {
  if (e.target === $("#dialog")) {
    const r = $("#dialog").getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeDialog();
  }
});
render();

document.addEventListener("camera-follow", (event) => {
  document
    .querySelector('[data-ui="follow"]')
    ?.setAttribute("aria-pressed", String((event as CustomEvent).detail));
});

function planningDescription(r: Rules) {
  return `Starting credits: ${r.planningStart}. Earn 1 every ${r.planningEvery} personal laps; save up to ${r.planningCap}. Spend 1 to move one space less or more after a normal roll.`;
}

installLocalization($("#app"));

function ruleDescription(key: string, r: Rules): string {
  if (key === "planning") return planningDescription(r);
  if (key === "wealthTax")
    return `At GO, pay ${Math.round(r.taxRate * 100)}% of property value above the table median plus an indexed $500 allowance.`;
  if (key === "assistance")
    return `At GO, receive an indexed $${r.recoveryGrant} if your net worth is below 75% of the surviving players’ median.`;
  return SPECIAL_RULES.find((rule) => rule.key === key)!.description;
}

installAudioUI(audio, openDialog);
