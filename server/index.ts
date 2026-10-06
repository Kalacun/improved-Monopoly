import express from "express";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { randomBytes } from "node:crypto";
import { networkInterfaces } from "node:os";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyAction,
  actorFor,
  botAction,
  botStep,
  newGame,
  normalizeRules,
  changeRules,
} from "../src/game/engine.js";
import { COLORS, TOKENS } from "../src/game/board.js";
import type { Action, Game, RoomView, Seat } from "../src/game/types.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = process.env.DATA_DIR || path.join(root, ".data");
mkdirSync(path.join(dataDir, "models"), { recursive: true });
type Room = RoomView & {
  credentials: Record<string, string>;
  recovery: Record<string, string>;
};
const rooms = new Map<string, Room>();
try {
  const saved = JSON.parse(
    readFileSync(path.join(dataDir, "rooms.json"), "utf8"),
  ) as Room[];
  for (const r of saved) {
    r.seats.forEach((s) => (s.connected = false));
    r.invite ||= randomBytes(16).toString("hex");
    r.recovery ||= {};
    for (const id of Object.keys(r.credentials))
      r.recovery[id] ||= randomBytes(6).toString("hex").toUpperCase();
    r.rules = normalizeRules(r.game?.rules || r.rules);
    if (r.game) r.game.rules = r.rules;
    rooms.set(r.code, r);
  }
} catch {}
function save() {
  const file = path.join(dataDir, "rooms.json");
  writeFileSync(file + ".tmp", JSON.stringify([...rooms.values()]));
  renameSync(file + ".tmp", file);
}
const app = express();
app.disable("x-powered-by");
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
server.on("upgrade", (req, socket, head) => {
  if (req.url?.split("?")[0] === "/ws")
    wss.handleUpgrade(req, socket, head, (ws) =>
      wss.emit("connection", ws, req),
    );
  else if (process.env.NODE_ENV === "production") socket.destroy();
});
app.use((req, res, next) => {
  if (
    /(?:^|\/)(?:\.data|\.npm-cache)(?:\/|$)/.test(decodeURIComponent(req.path))
  )
    return res.sendStatus(404);
  next();
});
const port = Number(process.env.PORT || 3000);
function publicOrigin(value: unknown): string {
  if (value === "" || value == null) return "";
  const url = new URL(String(value));
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw Error(
      "PUBLIC_URL must be an HTTPS origin, such as https://game.example.com",
    );
  return url.origin;
}
let publicUrl = publicOrigin(process.env.PUBLIC_URL);
const hostingKeyFile = path.join(dataDir, "hosting-key");
if (!existsSync(hostingKeyFile))
  writeFileSync(hostingKeyFile, randomBytes(32).toString("hex"), {
    mode: 0o600,
  });
const hostingKey = readFileSync(hostingKeyFile, "utf8").trim();
const addresses = () =>
  Object.values(networkInterfaces())
    .flatMap((v) => v || [])
    .filter((v) => v.family === "IPv4" && !v.internal)
    .map((v) => `http://${v.address}:${port}`);
app.get("/api/info", (_req, res) =>
  res.json({
    name: "Estate Exchange",
    version: 2,
    addresses: addresses(),
    publicUrl,
  }),
);
app.post("/api/hosting", express.json({ limit: "2kb" }), (req, res) => {
  if (req.headers.authorization !== `Bearer ${hostingKey}`)
    return res.sendStatus(403);
  try {
    publicUrl = publicOrigin(req.body?.publicUrl);
    res.json({ publicUrl });
  } catch {
    res.status(400).json({ error: "Expected an HTTPS origin." });
  }
});
app.use((_req, res, next) => {
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});
app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/models", express.static(path.join(root, "public/models")));
app.get("/api/models/:file", (req, res) => {
  if (!/^[a-f0-9]{32}\.(glb|gltf|stl|obj)$/.test(req.params.file))
    return res.sendStatus(404);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  res.sendFile(path.join(dataDir, "models", req.params.file), {
    dotfiles: "allow",
  });
});
app.post(
  "/api/model",
  express.raw({ type: "application/octet-stream", limit: "8mb" }),
  (req, res) => {
    try {
      const code = String(req.headers["x-room"] || ""),
        secret = String(req.headers["x-session"] || ""),
        seat = String(req.headers["x-seat"] || ""),
        ext = String(req.headers["x-format"] || "").toLowerCase(),
        r = rooms.get(code);
      if (!r) throw Error("Room not found.");
      const me = Object.entries(r.credentials).find(
        ([, token]) => token === secret,
      )?.[0];
      if (!me || !(me === seat || (me === r.host && r.mode === "local")))
        throw Error("You can only change your own token.");
      if (
        !["stl", "obj", "glb", "gltf"].includes(ext) ||
        !Buffer.isBuffer(req.body) ||
        req.body.length < 20
      )
        throw Error("Unsupported or empty model.");
      const s = r.seats.find((s) => s.id === seat);
      if (!s) throw Error("Seat not found.");
      const file = randomBytes(16).toString("hex") + "." + ext;
      writeFileSync(path.join(dataDir, "models", file), req.body);
      s.model = "/api/models/" + file;
      save();
      broadcast(r);
      res.json({ url: s.model });
    } catch (e) {
      res.status(400).json({ error: (e as Error).message });
    }
  },
);
const sessions = new Map<
  WebSocket,
  { room: string; id: string; display?: boolean }
>();
const alive = new WeakSet<WebSocket>();
setInterval(() => {
  for (const ws of wss.clients) {
    if (!alive.has(ws)) {
      ws.terminate();
      continue;
    }
    alive.delete(ws);
    ws.ping();
  }
}, 25000).unref();
function send(ws: WebSocket, payload: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}
function view(r: Room, display = false): RoomView {
  const game = r.game ? structuredClone(r.game) : null;
  if (game) {
    game.rng = 0;
    game.chance = [];
    game.chest = [];
    if (display) game.offers = [];
  }
  return {
    code: r.code,
    invite: r.invite,
    host: r.host,
    mode: r.mode,
    seats: r.seats,
    rules: r.game?.rules || r.rules,
    game,
  };
}
function broadcast(r: Room) {
  for (const [ws, s] of sessions)
    if (s.room === r.code && ws.readyState === WebSocket.OPEN)
      send(ws, {
        type: "state",
        room: view(r, s.display || !r.seats.some((p) => p.id === s.id)),
      });
}
const timers = new Map<string, ReturnType<typeof setTimeout>>();
function scheduleBot(r: Room) {
  if (
    timers.has(r.code) ||
    !r.game ||
    ![...sessions.values()].some((s) => s.room === r.code)
  )
    return;
  if (!botStep(r.game)) return;
  timers.set(
    r.code,
    setTimeout(() => {
      timers.delete(r.code);
      try {
        const step = botStep(r.game!);
        if (step) {
          r.game = applyAction(r.game!, step.actor, step.action);
          save();
          broadcast(r);
          scheduleBot(r);
        }
      } catch (e) {
        console.error("Bot action:", (e as Error).message);
      }
    }, 800),
  );
}
function attach(ws: WebSocket, r: Room, id: string) {
  sessions.set(ws, { room: r.code, id });
  const seat = r.seats.find((s) => s.id === id);
  if (seat) seat.connected = true;
  send(ws, {
    type: "session",
    code: r.code,
    id,
    token: r.credentials[id],
    recovery: r.recovery[id],
    director: !seat,
  });
  broadcast(r);
  scheduleBot(r);
}
function name(v: unknown) {
  if (typeof v !== "string" || !v.trim()) return "Player";
  return v.trim().slice(0, 22);
}
function newSeat(r: Room, n: unknown, bot = false) {
  if (r.seats.length >= 6) throw Error("This table is full (six seats).");
  const i = r.seats.length,
    id = randomBytes(8).toString("hex");
  const s: Seat = {
    id,
    name: name(n),
    token: TOKENS[i],
    color: COLORS[i],
    bot,
    connected: bot || r.mode === "local",
  };
  r.seats.push(s);
  r.credentials[id] = randomBytes(24).toString("hex");
  r.recovery[id] = randomBytes(6).toString("hex").toUpperCase();
  return s;
}
wss.on("connection", (ws) => {
  alive.add(ws);
  ws.on("pong", () => alive.add(ws));
  let count = 0,
    window = Date.now();
  ws.on("message", (raw) => {
    try {
      if (Date.now() - window > 10000) {
        window = Date.now();
        count = 0;
      }
      if (++count > 120) throw Error("Too many actions. Please wait a moment.");
      const msg = JSON.parse(raw.toString());
      if (!msg || typeof msg !== "object") throw Error("Invalid message.");
      if (msg.type === "ping") {
        send(ws, { type: "pong" });
        return;
      }
      if (msg.type === "watch") {
        if (sessions.has(ws)) throw Error("Leave your current table first.");
        const r = rooms.get(String(msg.code || "").toUpperCase());
        if (!r || !msg.invite || msg.invite !== r.invite)
          throw Error("Open the TV link shared by a player.");
        sessions.set(ws, {
          room: r.code,
          id: randomBytes(8).toString("hex"),
          display: true,
        });
        send(ws, { type: "watching", code: r.code });
        send(ws, { type: "state", room: view(r, true) });
        return;
      }
      if (msg.type === "create") {
        if (sessions.has(ws)) throw Error("Leave your current table first.");
        if (rooms.size >= 200)
          throw Error(
            "Server room limit reached. Ask the host to archive old saves.",
          );
        let code = "";
        do {
          code = randomBytes(3).toString("hex").slice(0, 5).toUpperCase();
        } while (rooms.has(code));
        const r: Room = {
          code,
          host: "",
          mode:
            msg.mode === "party"
              ? "party"
              : msg.mode === "lan"
                ? "lan"
                : "local",
          seats: [],
          rules: normalizeRules(null),
          game: null,
          credentials: {},
          recovery: {},
          invite: randomBytes(16).toString("hex"),
        };
        if (r.mode === "party") {
          r.host = randomBytes(8).toString("hex");
          r.credentials[r.host] = randomBytes(24).toString("hex");
          r.recovery[r.host] = randomBytes(6).toString("hex").toUpperCase();
        } else r.host = newSeat(r, msg.name || "Alex").id;
        if (r.mode === "local") {
          newSeat(r, "Morgan", true);
          newSeat(r, "Robin", true);
        }
        rooms.set(code, r);
        save();
        attach(ws, r, r.host);
        return;
      }
      if (msg.type === "join") {
        if (sessions.has(ws)) throw Error("Already at a table.");
        const r = rooms.get(String(msg.code || "").toUpperCase());
        if (!r) throw Error("Table not found. Check the code.");
        const match = Object.entries(r.credentials).find(
          ([id, token]) =>
            token === msg.token ||
            (typeof msg.recovery === "string" &&
              msg.recovery.replace(/[^a-f0-9]/gi, "").toUpperCase() ===
                r.recovery[id]),
        );
        let id = match?.[0];
        if (!id) {
          if (msg.recovery)
            throw Error(
              "Recovery code not recognized. Check your saved code; it belongs to this table only.",
            );
          if (!msg.invite || msg.invite !== r.invite)
            throw Error(
              "Scan the table QR code or use the complete invitation link. Returning players can enter their recovery code.",
            );
          if (r.game)
            throw Error(
              "This game has started. Rejoin from the browser used to claim your seat.",
            );
          if (r.mode === "local")
            throw Error(
              "This is a pass-and-play table. Create a LAN table for multiple computers.",
            );
          id = newSeat(r, msg.name).id;
        }
        save();
        attach(ws, r, id);
        return;
      }
      const session = sessions.get(ws);
      if (!session) throw Error("Create or join a table first.");
      const r = rooms.get(session.room)!;
      const host = session.id === r.host;
      if (msg.type === "leave") {
        sessions.delete(ws);
        const seat = r.seats.find((s) => s.id === session.id);
        if (seat)
          seat.connected = [...sessions.values()].some(
            (s) => s.room === r.code && s.id === seat.id,
          );
        broadcast(r);
        send(ws, { type: "left" });
        save();
        return;
      }
      if (session.display)
        throw Error("The TV display is read-only. Use your player phone.");
      if (msg.type === "add") {
        if (!host || r.game)
          throw Error("Only the host can add seats before starting.");
        newSeat(r, msg.name, msg.bot !== false);
      } else if (msg.type === "remove") {
        if (!host || r.game || msg.id === r.host)
          throw Error("That seat cannot be removed.");
        r.seats = r.seats.filter((s) => s.id !== msg.id);
        delete r.credentials[String(msg.id)];
        delete r.recovery[String(msg.id)];
        for (const [client, s] of sessions)
          if (s.room === r.code && s.id === msg.id) {
            sessions.delete(client);
            send(client, { type: "left" });
          }
      } else if (msg.type === "seat") {
        const id = String(msg.id),
          seat = r.seats.find((s) => s.id === id);
        if (
          !seat ||
          !(
            session.id === id ||
            (host && r.mode === "local") ||
            (host && seat.bot)
          )
        )
          throw Error("You can only edit your own seat.");
        if (msg.name !== undefined) {
          if (typeof msg.name !== "string" || !msg.name.trim())
            throw Error("Enter a name (1–22 characters).");
          const previous = seat.name;
          seat.name = name(msg.name);
          if (r.game && previous !== seat.name) {
            r.game.players.find((p) => p.id === id)!.name = seat.name;
            r.game.revision++;
            r.game.logs.push({
              id: (r.game.logs.at(-1)?.id || 0) + 1,
              text: `${previous} is now known as ${seat.name}.`,
              kind: "system",
            });
            if (r.game.logs.length > 100) r.game.logs.shift();
          }
        }
        if (typeof msg.token === "string" && TOKENS.includes(msg.token)) {
          seat.token = msg.token;
          delete seat.model;
          if (r.game)
            r.game.players.find((p) => p.id === id)!.token = msg.token;
        }
        if (typeof msg.bot === "boolean" && host && !r.game) seat.bot = msg.bot;
      } else if (msg.type === "rules") {
        if (!host) throw Error("Only the host can change the special rules.");
        const updated = normalizeRules(msg.rules);
        if (r.game) r.game = changeRules(r.game, updated);
        r.rules = updated;
      } else if (msg.type === "start") {
        if (!host || r.game) throw Error("Only the host can start a new game.");
        r.game = newGame(
          r.seats,
          normalizeRules(msg.rules || r.rules),
          randomBytes(4).readUInt32LE(),
        );
      } else if (msg.type === "action") {
        if (!r.game) throw Error("Start the game first.");
        if (!r.seats.some((s) => s.id === session.id))
          throw Error(
            "Join on your phone to play. This computer controls the display.",
          );
        const actor = String(msg.actor || session.id);
        if (
          actor !== session.id &&
          !(
            host &&
            r.mode === "local" &&
            r.seats.some((s) => s.id === actor && !s.bot)
          )
        )
          throw Error("You cannot act for another player.");
        if (r.game.players.find((p) => p.id === actor)?.bot)
          throw Error("This seat is controlled by the computer.");
        r.game = applyAction(r.game, actor, msg.action as Action);
      } else if (msg.type === "replace") {
        if (!host || !r.game)
          throw Error("Only the host can assign a substitute.");
        const s = r.seats.find((s) => s.id === msg.id);
        if (!s || s.id === r.host || (s.connected && !s.bot))
          throw Error("Only disconnected seats can be assigned to a bot.");
        s.bot = !s.bot;
        r.game.players.find((p) => p.id === s.id)!.bot = s.bot;
      } else if (msg.type === "export") {
        if (!host) throw Error("Only the host can export the save.");
        send(ws, { type: "export", game: r.game });
        return;
      } else throw Error("Unknown message.");
      save();
      broadcast(r);
      scheduleBot(r);
    } catch (e) {
      send(ws, { type: "error", message: (e as Error).message });
    }
  });
  ws.on("close", () => {
    const s = sessions.get(ws);
    sessions.delete(ws);
    if (s) {
      const r = rooms.get(s.room);
      const seat = r?.seats.find((p) => p.id === s.id);
      if (r && seat) {
        seat.connected = [...sessions.values()].some(
          (other) => other.room === s.room && other.id === s.id,
        );
        broadcast(r);
        save();
      }
    }
  });
  ws.on("error", () => {});
});
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.use((_req, res) => res.sendFile(path.join(root, "dist/index.html")));
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server, path: "/vite-hmr", clientPort: port },
    },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
server.on("error", async (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    let alreadyRunning = false;
    try {
      const response = await fetch(`http://localhost:${port}/api/info`, {
        signal: AbortSignal.timeout(1500),
      });
      const info = await response.json();
      alreadyRunning = response.ok && info.name === "Estate Exchange";
    } catch {}
    if (alreadyRunning) {
      console.log(
        `\nEstate Exchange is already running.\nOpen http://localhost:${port} in your browser to play.\nThe existing server and saved games have been left untouched.\n`,
      );
      process.exit(0);
    }
    console.error(
      `\nPort ${port} is being used by another application.\nChoose an unused port, for example: PORT=${port + 1} npm start\nThen open http://localhost:${port + 1} in your browser.\n`,
    );
  } else {
    console.error(`Unable to start Estate Exchange: ${error.message}`);
  }
  process.exit(1);
});
server.listen(port, "0.0.0.0", () => {
  console.log(`\nEstate Exchange is ready at http://localhost:${port}`);
  for (const url of addresses()) console.log(`LAN / virtual network: ${url}`);
  console.log(`Saves: ${dataDir}\n`);
});
process.on("SIGTERM", () => {
  save();
  server.close();
  process.exit(0);
});
