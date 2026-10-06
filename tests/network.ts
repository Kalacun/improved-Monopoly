import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { ECONOMY } from "../src/game/types.js";
import { actorFor } from "../src/game/engine.js";
const port = 4317,
  base = `http://127.0.0.1:${port}`,
  dir = path.join(mkdtempSync(path.join(tmpdir(), "estate-test-")), ".data");
let proc: ChildProcess;
async function start() {
  proc = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dir,
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let logs = "";
  proc.stderr?.on("data", (d) => (logs += String(d)));
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(base + "/api/health");
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Server failed to start: " + logs);
}
async function stop() {
  await new Promise<void>((r) => {
    proc.once("exit", () => r());
    proc.kill("SIGTERM");
  });
}
class Client {
  ws: WebSocket;
  messages: any[] = [];
  token = "";
  id = "";
  code = "";
  room: any;
  constructor() {
    this.ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    this.ws.on("message", (data) => {
      const m = JSON.parse(String(data));
      this.messages.push(m);
      if (m.type === "session") {
        this.id = m.id;
        this.code = m.code;
        this.token = m.token;
      }
      if (m.type === "state") this.room = m.room;
    });
  }
  async open() {
    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
    return this;
  }
  async send(payload: unknown, test: (m: any) => boolean) {
    const offset = this.messages.length;
    this.ws.send(JSON.stringify(payload));
    for (let i = 0; i < 100; i++) {
      const found = this.messages.slice(offset).find(test);
      if (found) return found;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw Error("Timed out: " + JSON.stringify(payload));
  }
  close() {
    this.ws.close();
  }
}
let host: Client | undefined,
  guest: Client | undefined,
  extra: Client | undefined;
try {
  await start();
  host = await new Client().open();
  guest = await new Client().open();
  extra = await new Client().open();
  await host.send(
    { type: "create", mode: "lan", name: "Host" },
    (m) => m.type === "state",
  );
  await guest.send(
    { type: "join", code: host.code, invite: host.room.invite, name: "Guest" },
    (m) => m.type === "state",
  );
  await extra.send(
    { type: "join", code: host.code, invite: host.room.invite, name: "Third" },
    (m) => m.type === "state",
  );
  assert.equal(extra.room.seats.length, 3);
  const denied = await guest.send(
    { type: "start", rules: ECONOMY },
    (m) => m.type === "error",
  );
  assert.match(denied.message, /host/);
  const ruleDenied = await guest.send(
    { type: "rules", rules: { ...ECONOMY, royalties: false } },
    (m) => m.type === "error",
  );
  assert.match(ruleDenied.message, /host/);
  await host.send(
    { type: "rules", rules: { ...ECONOMY, royalties: false } },
    (m) => m.type === "state" && m.room.rules?.royalties === false,
  );
  await host.send(
    { type: "start", rules: ECONOMY },
    (m) => m.type === "state" && m.room.game,
  );
  assert.equal(host.room.game.rng, 0);
  assert.deepEqual(host.room.game.chance, []);
  assert.equal(host.room.credentials, undefined);
  await guest.send(
    { type: "seat", id: guest.id, name: "  Guest Renamed  " },
    (m) =>
      m.type === "state" &&
      m.room.game.players.some(
        (p: any) => p.id === guest!.id && p.name === "Guest Renamed",
      ),
  );
  assert.equal(
    guest.room.seats.find((s: any) => s.id === guest!.id).name,
    "Guest Renamed",
  );
  const renameDenied = await guest.send(
    { type: "seat", id: host.id, name: "Spoofed" },
    (m) => m.type === "error",
  );
  assert.match(renameDenied.message, /own seat/);
  const blankDenied = await guest.send(
    { type: "seat", id: guest.id, name: "   " },
    (m) => m.type === "error",
  );
  assert.match(blankDenied.message, /name/);
  await host.send(
    {
      type: "rules",
      rules: {
        ...ECONOMY,
        royalties: false,
        options: false,
        planningStart: 1,
        planningEvery: 5,
        planningCap: 2,
      },
    },
    (m) => m.type === "state" && m.room.game.rules.royalties === false,
  );
  assert.equal(host.room.game.rules.options, false);
  assert.equal(host.room.game.rules.planningEvery, 5);
  assert.equal(host.room.game.rules.planningCap, 2);
  const spoof = await guest.send(
    { type: "action", actor: host.id, action: { type: "ROLL" } },
    (m) => m.type === "error",
  );
  assert.match(spoof.message, /another player/);
  const outOfTurn = [host, guest, extra].find(
    (c) => c.id !== actorFor(host!.room.game),
  )!;
  const wrongTurn = await outOfTurn.send(
    { type: "action", action: { type: "ROLL" } },
    (m) => m.type === "error",
  );
  assert.match(wrongTurn.message, /turn/);
  const clients = [host, guest, extra];
  let steps = 0;
  while (steps++ < 90) {
    const g = host.room.game;
    const actor = actorFor(g);
    const client = clients.find((c) => c.id === actor)!;
    let action: any;
    switch (g.phase) {
      case "roll":
        action = { type: "ROLL" };
        break;
      case "move":
        action = { type: "MOVE", delta: 0 };
        break;
      case "purchase":
        action = { type: "AUCTION" };
        break;
      case "auction":
        action = g.auction.high
          ? { type: "PASS" }
          : { type: "BID", amount: 10 };
        break;
      case "end":
        action = { type: "END" };
        break;
      case "debt":
        action = { type: "BANKRUPT" };
        break;
      default:
        throw Error("Unexpected phase");
    }
    const revision = g.revision;
    await client.send(
      { type: "action", action },
      (m) => m.type === "state" && m.room.game?.revision > revision,
    );
    for (
      let n = 0;
      n < 100 && clients.some((c) => c.room.game?.revision !== revision + 1);
      n++
    )
      await new Promise((r) => setTimeout(r, 10));
    assert.ok(
      clients.every((c) => c.room.game.revision === revision + 1),
      "All clients must see identical revisions",
    );
    assert.equal(
      JSON.stringify(host.room.game),
      JSON.stringify(guest.room.game),
    );
  }
  const asset = readFileSync("public/models/sample-tower.stl");
  const upload = await fetch(base + "/api/model", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Room": host.code,
      "X-Session": guest.token,
      "X-Seat": guest.id,
      "X-Format": "stl",
    },
    body: asset,
  });
  assert.equal(upload.status, 200);
  const { url } = await upload.json();
  const bytes = await (await fetch(base + url)).arrayBuffer();
  assert.equal(bytes.byteLength, asset.byteLength);
  for (
    let n = 0;
    n < 100 && !host.room.seats.find((s: any) => s.id === guest!.id).model;
    n++
  )
    await new Promise((r) => setTimeout(r, 10));
  assert.equal(host.room.seats.find((s: any) => s.id === guest!.id).model, url);
  const unauthorized = await fetch(base + "/api/model", {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Room": host.code,
      "X-Session": guest.token,
      "X-Seat": host.id,
      "X-Format": "stl",
    },
    body: asset,
  });
  assert.equal(unauthorized.status, 400);
  const creds = {
    host: { id: host.id, token: host.token, code: host.code },
    guest: { id: guest.id, token: guest.token, code: guest.code },
  };
  const revision = host.room.game.revision;
  host.close();
  guest.close();
  extra.close();
  await stop();
  await start();
  host = await new Client().open();
  guest = await new Client().open();
  await host.send({ type: "join", ...creds.host }, (m) => m.type === "state");
  await guest.send({ type: "join", ...creds.guest }, (m) => m.type === "state");
  assert.equal(host.room.game.revision, revision);
  assert.equal(host.id, creds.host.id);
  assert.equal(host.room.game.rules.royalties, false);
  assert.equal(host.room.game.rules.options, false);
  assert.equal(host.room.game.rules.planningEvery, 5);
  assert.equal(host.room.game.rules.planningCap, 2);
  assert.equal(
    guest.room.game.players.find((p: any) => p.id === guest!.id).name,
    "Guest Renamed",
  );
  assert.equal(
    guest.room.seats.find((s: any) => s.id === guest!.id).model,
    url,
  );
  assert.equal((await fetch(base + url)).status, 200);
  console.log(
    "PASS: 90 synchronized multiplayer actions; authorized in-game rename; host-only rule changes; rename/rules persistence; turn and seat authorization; concealed random state; shared STL upload; server restart and seat reconnection.",
  );
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  host?.close();
  guest?.close();
  extra?.close();
  if (proc! && !proc!.killed) await stop();
}
