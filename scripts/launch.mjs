import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir =
  process.env.DATA_DIR ||
  (process.platform === "win32"
    ? path.join(process.env.LOCALAPPDATA || homedir(), "Estate Exchange")
    : process.platform === "darwin"
      ? path.join(
          homedir(),
          "Library",
          "Application Support",
          "Estate Exchange",
        )
      : path.join(
          process.env.XDG_DATA_HOME || path.join(homedir(), ".local", "share"),
          "estate-exchange",
        ));
mkdirSync(dataDir, { recursive: true });
const options = ["local", "online", "tv-local", "tv-online"];
let mode = process.argv[2];
if (!options.includes(mode)) {
  console.log(
    "\nESTATE EXCHANGE\n1. Play on this computer / same Wi-Fi\n2. Host friends online (Cloudflare)\n3. TV + phones on the same Wi-Fi\n4. TV + phones online (Cloudflare)\n",
  );
  const input = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  mode =
    options[Number(await input.question("Choose 1–4 and press Enter: ")) - 1];
  input.close();
  if (!mode) {
    console.error("Choose a number from 1 to 4.");
    process.exit(1);
  }
}
const online = mode.includes("online");
const port = Number(process.env.PORT || 3000);
const url = `http://localhost:${port}/${mode.startsWith("tv") ? "?screen=tv" : ""}`;
const env = {
  ...process.env,
  NODE_ENV: "production",
  ESTATE_PACKAGED: "1",
  DATA_DIR: dataDir,
  CLOUDFLARED_BIN: path.join(
    root,
    "runtime",
    process.platform === "win32" ? "cloudflared.exe" : "cloudflared",
  ),
};
console.log(
  `\nSaves: ${dataDir}\nKeep this window open while playing. Ctrl+C stops hosting.\n`,
);
const child = spawn(
  process.execPath,
  [path.join(root, "bin", online ? "host.mjs" : "server.mjs")],
  { cwd: root, env, stdio: ["inherit", "pipe", "inherit"] },
);
let opened = false;
function openBrowser() {
  if (opened || process.env.ESTATE_NO_BROWSER === "1") return;
  opened = true;
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const browser = spawn(command, args, { stdio: "ignore" });
  browser.on("error", () => console.log(`Open ${url} in your browser.`));
}
let output = "";
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  output = (output + chunk).slice(-12000);
  if (
    online
      ? output.includes("ONLINE:")
      : /Estate Exchange is (ready|already running)/.test(output)
  )
    openBrowser();
});
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
