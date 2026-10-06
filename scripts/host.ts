import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  readFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000);
const local = `http://127.0.0.1:${port}`;
const dataDir = process.env.DATA_DIR || path.join(root, ".data");
const executable = process.env.CLOUDFLARED_BIN || "cloudflared";
const permanent = process.argv.includes("--named");
let server: ChildProcess | undefined,
  tunnel: ChildProcess | undefined,
  sleepGuard: ChildProcess | undefined;
let controlKey = "",
  stopping = false,
  published = false;
let isolatedConfig = "";
const lockFile = path.join(dataDir, "host-launcher.pid");
let ownsLock = false;

function acquireLock() {
  mkdirSync(dataDir, { recursive: true });
  try {
    writeFileSync(lockFile, String(process.pid), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const pid = Number(readFileSync(lockFile, "utf8"));
    let running = true;
    try {
      if (!Number.isInteger(pid) || pid <= 0) running = false;
      else process.kill(pid, 0);
    } catch (probe) {
      running = (probe as NodeJS.ErrnoException).code !== "ESRCH";
    }
    if (running)
      throw Error(
        `Hosting is already running. Open http://localhost:${port}/?screen=tv or stop the existing host with Ctrl+C first.`,
      );
    rmSync(lockFile, { force: true });
    writeFileSync(lockFile, String(process.pid), { flag: "wx", mode: 0o600 });
  }
  ownsLock = true;
}

async function publish(publicUrl: string) {
  const result = await fetch(local + "/api/hosting", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${controlKey}`,
    },
    body: JSON.stringify({ publicUrl }),
    signal: AbortSignal.timeout(3000),
  });
  if (!result.ok)
    throw Error(
      "Could not register the invitation address. Restart the game server and try again.",
    );
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  if (published) await publish("").catch(() => {});
  tunnel?.kill("SIGTERM");
  sleepGuard?.kill("SIGTERM");
  if (server && server.exitCode === null) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        server?.kill("SIGKILL");
        resolve();
      }, 4000);
      server!.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      server!.kill("SIGTERM");
    });
  }
  if (isolatedConfig) rmSync(isolatedConfig, { recursive: true, force: true });
  if (ownsLock) rmSync(lockFile, { force: true });
  process.exit(code);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
try {
  if (spawnSync(executable, ["--version"], { stdio: "ignore" }).status !== 0)
    throw Error(
      "Install Cloudflare’s connector first: brew install cloudflared (Mac), or winget install --id Cloudflare.cloudflared (Windows). Then run npm run host again.",
    );
  if (permanent && (!process.env.TUNNEL_TOKEN || !process.env.PUBLIC_URL))
    throw Error(
      "Named hosting needs TUNNEL_TOKEN and PUBLIC_URL. See docs/HOSTING.md. Do not put your tunnel token in a shared invitation.",
    );
  acquireLock();
  let existing: { name?: string; version?: number } | undefined;
  try {
    existing = await (
      await fetch(local + "/api/info", { signal: AbortSignal.timeout(1500) })
    ).json();
  } catch {}
  if (
    existing &&
    (existing.name !== "Estate Exchange" || (existing.version || 0) < 2)
  )
    throw Error(
      `Port ${port} has an older server or another app. Stop it with Ctrl+C, then run npm run host again.`,
    );
  if (!existing) {
    server = spawn(
      process.execPath,
      process.env.ESTATE_PACKAGED === "1"
        ? [path.join(root, "bin", "server.mjs")]
        : ["--import", "tsx", "server/index.ts"],
      {
        cwd: root,
        env: {
          ...process.env,
          NODE_ENV: "production",
          PUBLIC_URL: permanent ? process.env.PUBLIC_URL : "",
        },
        stdio: "inherit",
      },
    );
    server.once("exit", () => {
      if (!stopping) {
        console.error("The game server stopped.");
        void stop(1);
      }
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        ready = (
          await fetch(local + "/api/health", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok;
      } catch {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready) throw Error("The game server did not become ready.");
  } else
    console.log(
      "Using the running Estate Exchange server; it will stay running when the tunnel closes.",
    );
  controlKey = readFileSync(path.join(dataDir, "hosting-key"), "utf8").trim();
  await publish("");
  // An explicit empty configuration keeps Quick Tunnels separate from any named-tunnel config.
  isolatedConfig = mkdtempSync(path.join(tmpdir(), "estate-tunnel-"));
  writeFileSync(path.join(isolatedConfig, "config.yml"), "{}\n");
  const args = permanent
    ? ["tunnel", "--no-autoupdate", "--protocol", "http2", "run"]
    : [
        "tunnel",
        "--config",
        path.join(isolatedConfig, "config.yml"),
        "--no-autoupdate",
        "--protocol",
        "http2",
        "--url",
        local,
      ];
  tunnel = spawn(executable, args, {
    cwd: root,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "",
    ready = false;
  const timer = setTimeout(() => {
    console.error(
      "Cloudflare has not connected after 60 seconds. Check Internet access and try again.",
    );
    void stop(1);
  }, 60000);
  const onOutput = (data: Buffer) => {
    const chunk = String(data);
    output = (output + chunk).slice(-16000);
    const url = permanent
      ? process.env.PUBLIC_URL
      : output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
    if (!ready && url && output.includes("Registered tunnel connection")) {
      ready = true;
      clearTimeout(timer);
      void publish(url)
        .then(() => {
          published = true;
          console.log(
            `\nONLINE: ${url}\nOpen http://localhost:${port}/?screen=tv on your computer.\nChoose TV + phones, create a table, and scan its QR code with each phone.\nFor remote play, choose With friends and share the table’s invitation.\nKeep this terminal open. Ctrl+C closes the tunnel.\n`,
          );
          if (process.platform === "darwin") {
            sleepGuard = spawn(
              "caffeinate",
              ["-di", "-w", String(process.pid)],
              { stdio: "ignore" },
            );
            sleepGuard.on("error", () =>
              console.log("Keep your Mac awake while hosting."),
            );
          }
        })
        .catch((error) => {
          console.error(error.message);
          void stop(1);
        });
    }
    if (/\b(ERR|error)\b/.test(chunk))
      console.error(chunk.replace(/\s+$/g, ""));
  };
  tunnel.stdout!.on("data", onOutput);
  tunnel.stderr!.on("data", onOutput);
  tunnel.on("error", (error) => {
    clearTimeout(timer);
    console.error(error.message);
    void stop(1);
  });
  tunnel.on("exit", () => {
    clearTimeout(timer);
    if (!stopping) {
      console.error(
        "Cloudflare disconnected. Run npm run host again; your saved game is kept.",
      );
      void stop(1);
    }
  });
  console.log("Connecting to Cloudflare…");
} catch (error) {
  console.error((error as Error).message);
  await stop(1);
}
