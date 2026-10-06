import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { actorFor } from "../src/game/engine.js";

// Set TEST_REMOTE_URL to exercise exactly the same protocol through a real Cloudflare tunnel.
const remote = process.env.TEST_REMOTE_URL;
const base = remote || "http://127.0.0.1:4318";
const dataDir = mkdtempSync(path.join(tmpdir(), "estate-party-"));
let proc: ChildProcess | undefined;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
class Peer {
  ws = new WebSocket(base.replace(/^http/, "ws") + "/ws");
  messages: any[] = [];
  room: any;
  session: any;
  constructor() {
    this.ws.on("message", (data) => {
      const m = JSON.parse(String(data));
      this.messages.push(m);
      if (m.type === "state") this.room = m.room;
      if (m.type === "session") this.session = m;
    });
  }
  async ready() {
    await new Promise<void>((yes, no) => {
      this.ws.once("open", yes);
      this.ws.once("error", no);
    });
    return this;
  }
  async send(payload: unknown, type = "state") {
    const offset = this.messages.length;
    this.ws.send(JSON.stringify(payload));
    for (let i = 0; i < 200; i++) {
      const m = this.messages.slice(offset).find((m) => m.type === type);
      if (m) return m;
      await pause(25);
    }
    throw Error("Timed out awaiting " + type);
  }
  close() {
    this.ws.close();
  }
}
const peers: Peer[] = [];
async function peer() {
  const p = await new Peer().ready();
  peers.push(p);
  return p;
}
try {
  if (!remote) {
    proc = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: "4318",
        DATA_DIR: dataDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        ready = (await fetch(base + "/api/health")).ok;
      } catch {}
      if (ready) break;
      await pause(100);
    }
    assert.ok(ready, "server must start");
    assert.equal(
      (
        await fetch(base + "/api/hosting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicUrl: "https://attacker.example" }),
        })
      ).status,
      403,
    );
    const key = readFileSync(path.join(dataDir, "hosting-key"), "utf8").trim();
    const publish = await fetch(base + "/api/hosting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ publicUrl: "https://family.example.com" }),
    });
    assert.equal(publish.status, 200);
    assert.equal(
      (await (await fetch(base + "/api/info")).json()).publicUrl,
      "https://family.example.com",
    );
  }
  const tv = await peer();
  await tv.send({ type: "create", mode: "party" });
  assert.equal(
    tv.room.seats.length,
    0,
    "the television must not consume a player seat",
  );
  assert.equal(tv.session.director, true);
  const { code, invite } = tv.room;
  const a = await peer(),
    b = await peer(),
    display = await peer();
  assert.match(
    (await a.send({ type: "join", code, name: "Phone A" }, "error")).message,
    /invitation/,
  );
  await a.send({ type: "join", code, invite, name: "Phone A" });
  await b.send({ type: "join", code, invite, name: "Phone B" });
  assert.equal(b.room.seats.length, 2);
  assert.equal(b.room.host, tv.session.id);
  assert.ok(a.session.recovery.length === 12);
  await display.send({ type: "watch", code, invite });
  assert.equal(
    display.session,
    undefined,
    "display must not obtain a player credential",
  );
  assert.match(
    (await display.send({ type: "start" }, "error")).message,
    /read-only/,
  );
  assert.match((await a.send({ type: "start" }, "error")).message, /host/);
  await tv.send({ type: "start" });
  assert.equal(tv.room.game.players.length, 2);
  assert.match(
    (await tv.send({ type: "action", action: { type: "ROLL" } }, "error"))
      .message,
    /phone/,
  );
  // Negotiate entirely from the player connections. The TV never receives an offer's terms.
  await a.send({
    type: "action",
    action: {
      type: "OFFER",
      deal: { to: b.session.id, cash: 25, note: "Phone deal" },
    },
  });
  await pause(100);
  assert.equal(tv.room.game.offers.length, 0);
  assert.equal(display.room.game.offers.length, 0);
  const offer = b.room.game.offers.find((o: any) => o.from === a.session.id);
  assert.ok(offer);
  await b.send({ type: "action", action: { type: "ACCEPT", id: offer.id } });
  assert.equal(
    b.room.game.players.find((p: any) => p.id === b.session.id).cash,
    1525,
  );
  // Reclaim the same seat without old-origin browser storage (new tunnel/device).
  const aId = a.session.id,
    recovery = a.session.recovery;
  a.close();
  const returning = await peer();
  assert.match(
    (
      await returning.send(
        { type: "join", code, invite, recovery: "BAD-CODE" },
        "error",
      )
    ).message,
    /not recognized/,
  );
  await returning.send({ type: "join", code, recovery });
  assert.equal(returning.session.id, aId);
  assert.equal(
    returning.room.seats.length,
    2,
    "recovery must not allocate another seat",
  );
  const players = [returning, b];
  for (let step = 0; step < 20; step++) {
    const g = returning.room.game;
    const actor = players.find((p) => p.session.id === actorFor(g))!;
    const action =
      g.phase === "roll"
        ? { type: "ROLL" }
        : g.phase === "move"
          ? { type: "MOVE", delta: 0 }
          : g.phase === "purchase"
            ? { type: "AUCTION" }
            : g.phase === "auction"
              ? { type: "PASS" }
              : g.phase === "end"
                ? { type: "END" }
                : null;
    assert.ok(action, "supported active phase");
    await actor.send({ type: "action", action });
    const revision = actor.room.game.revision;
    for (
      let n = 0;
      n < 100 &&
      [tv, display, ...players].some((p) => p.room.game.revision !== revision);
      n++
    )
      await pause(20);
    assert.ok(
      [tv, display, ...players].every((p) => p.room.game.revision === revision),
      "TV and every phone must synchronize",
    );
  }
  assert.equal((await returning.send({ type: "ping" }, "pong")).type, "pong");
  console.log(
    `PASS ${remote ? "Cloudflare HTTPS/WSS" : "local"}: seatless TV host, QR invitation authorization, read-only display, phone-only actions, private TV offers, phone deal acceptance, recovery across origins, 20 synchronized actions, heartbeat.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const p of peers) p.close();
  if (proc)
    await new Promise<void>((resolve) => {
      proc!.once("exit", () => resolve());
      proc!.kill("SIGTERM");
    });
}
