import { build } from "esbuild";
import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  readFile,
  writeFile,
  cp,
  chmod,
  rm,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const target = process.argv[2] || `${process.platform}-${process.arch}`;
const supported = [
  "darwin-arm64",
  "darwin-x64",
  "linux-x64",
  "linux-arm64",
  "win32-x64",
];
if (!supported.includes(target))
  throw Error(`Supported targets: ${supported.join(", ")}`);
const [platform, arch] = target.split("-");
const windows = platform === "win32";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const name = `estate-exchange-${pkg.version}-${target}`;
const folder = path.join(root, "release", name);
const cache = path.join(root, ".release-cache");
await mkdir(cache, { recursive: true });
await rm(folder, { recursive: true, force: true });
await mkdir(path.join(folder, "runtime"), { recursive: true });
await mkdir(path.join(folder, "bin"), { recursive: true });
async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "estate-exchange-release" },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw Error(`Download failed (${response.status}): ${url}`);
  return response.text();
}
const provenance = [];
async function download(url, filename, sha256) {
  if (!/^[a-f0-9]{64}$/.test(sha256 || ""))
    throw Error(`Missing trusted checksum for ${filename}`);
  const dest = path.join(cache, filename);
  let bytes;
  try {
    bytes = await readFile(dest);
  } catch {}
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== sha256) {
    const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
    if (!response.ok)
      throw Error(`Download failed (${response.status}): ${url}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== sha256)
      throw Error(`Checksum mismatch: ${filename}`);
    await writeFile(dest, bytes);
  }
  provenance.push({ url, filename, sha256 });
  return dest;
}
function untar(file, destination) {
  const result = spawnSync("tar", ["-xzf", file, "-C", destination], {
    stdio: "inherit",
  });
  if (result.status !== 0) throw Error("tar extraction failed");
}
console.log(`Packaging ${name}…`);
const sums = await fetchText(
  "https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt",
);
const version = sums.match(/node-(v24\.[\d.]+)-/)?.[1];
if (!version) throw Error("Node 24 release not found");
const nodeFile = windows
  ? `node-${version}-win-x64.zip`
  : `node-${version}-${platform}-${arch}.tar.gz`;
const checksum = sums
  .split("\n")
  .find((line) => line.trim().endsWith(" " + nodeFile))
  ?.split(/\s+/)[0];
const archive = await download(
  `https://nodejs.org/dist/${version}/${nodeFile}`,
  nodeFile,
  checksum,
);
const staging = path.join(cache, `unpack-${target}`);
await mkdir(staging, { recursive: true });
if (windows) new AdmZip(archive).extractAllTo(staging, true);
else untar(archive, staging);
const nodeFolder = path.join(staging, nodeFile.replace(/\.(zip|tar\.gz)$/, ""));
await cp(
  path.join(nodeFolder, windows ? "node.exe" : "bin/node"),
  path.join(folder, "runtime", windows ? "node.exe" : "node"),
);
await cp(
  path.join(nodeFolder, "LICENSE"),
  path.join(folder, "runtime", "NODE-LICENSE.txt"),
);
const release = JSON.parse(
  await fetchText(
    "https://api.github.com/repos/cloudflare/cloudflared/releases/latest",
  ),
);
const cloudName =
  platform === "darwin"
    ? `cloudflared-darwin-${arch === "x64" ? "amd64" : "arm64"}.tgz`
    : windows
      ? "cloudflared-windows-amd64.exe"
      : `cloudflared-linux-${arch === "x64" ? "amd64" : "arm64"}`;
const asset = release.assets.find((a) => a.name === cloudName);
if (!asset) throw Error(`Cloudflare does not publish ${cloudName}`);
const fallback = release.body.match(
  new RegExp(`${cloudName.replaceAll(".", "\\.")}:\\s*([a-f0-9]{64})`),
)?.[1];
const cloudArchive = await download(
  asset.browser_download_url,
  `${release.tag_name}-${cloudName}`,
  asset.digest?.replace("sha256:", "") || fallback,
);
const cloudPath = path.join(
  folder,
  "runtime",
  windows ? "cloudflared.exe" : "cloudflared",
);
if (platform === "darwin") {
  const dir = path.join(staging, "cloudflare");
  await mkdir(dir, { recursive: true });
  untar(cloudArchive, dir);
  await cp(path.join(dir, "cloudflared"), cloudPath);
} else await cp(cloudArchive, cloudPath);
await writeFile(
  path.join(folder, "runtime", "CLOUDFLARED-LICENSE.txt"),
  await fetchText(
    `https://raw.githubusercontent.com/cloudflare/cloudflared/${release.tag_name}/LICENSE`,
  ),
);
await writeFile(
  path.join(folder, "runtime", "CLOUDFLARED-NOTICE.txt"),
  `Cloudflared ${release.tag_name} — Copyright Cloudflare, Inc.\nSource: https://github.com/cloudflare/cloudflared/tree/${release.tag_name}\nThe upstream distribution has no separate NOTICE file. Its Apache-2.0 LICENSE is included alongside this distributor attribution.\n`,
);
for (const entry of ["server/index.ts", "scripts/host.ts"]) {
  const result = await build({
    entryPoints: [entry],
    outfile: path.join(
      folder,
      "bin",
      entry.startsWith("server") ? "server.mjs" : "host.mjs",
    ),
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    metafile: true,
    external: ["vite", "bufferutil", "utf-8-validate"],
    define: { "process.env.NODE_ENV": '"production"' },
    banner: {
      js: "import { createRequire as estateCreateRequire } from 'node:module'; const require = estateCreateRequire(import.meta.url);",
    },
  });
  await writeFile(
    path.join(
      folder,
      "bin",
      entry.startsWith("server") ? "server.meta.json" : "host.meta.json",
    ),
    JSON.stringify(result.metafile),
  );
}
await cp("scripts/launch.mjs", path.join(folder, "bin", "launch.mjs"));
await cp("dist", path.join(folder, "dist"), { recursive: true });
for (const file of ["README.md", "LICENSE", "THIRD_PARTY_NOTICES.md"])
  await cp(file, path.join(folder, file));
await cp("docs", path.join(folder, "docs"), { recursive: true });
// Preserve license texts for dependencies in the actual server and browser bundles.
const licenseDir = path.join(folder, "licenses");
await mkdir(licenseDir, { recursive: true });
async function collect(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const current = path.join(dir, entry.name);
    if (entry.name.startsWith("@")) {
      await collect(current, entry.name + "-");
      continue;
    }
    const safeName = prefix + entry.name;
    for (const file of await readdir(current))
      if (/^(licen[sc]e|copying|notice|ofl)(\.|$)/i.test(file)) {
        try {
          await cp(
            path.join(current, file),
            path.join(licenseDir, safeName + "-" + file),
          );
        } catch {}
      }
    try {
      await collect(path.join(current, "node_modules"), safeName + "-");
    } catch {}
  }
}
await collect("node_modules");
await writeFile(
  path.join(folder, "runtime", "PROVENANCE.json"),
  JSON.stringify(
    { node: version, cloudflared: release.tag_name, downloads: provenance },
    null,
    2,
  ),
);
await writeFile(
  path.join(folder, "START-HERE.txt"),
  "Estate Exchange\nExtract this entire folder before launching.\nMac: double-click Play.command\nWindows: double-click Play.cmd\nLinux: run ./Play.sh\nChoose a mode, then play in the browser that opens.\nKeep the launcher open. Ctrl+C stops hosting.\nSee README.md for the complete beginner guide.\n",
);
if (windows)
  await writeFile(
    path.join(folder, "Play.cmd"),
    '@echo off\r\ncd /d "%~dp0"\r\n"runtime\\node.exe" "bin\\launch.mjs"\r\nif errorlevel 1 pause\r\n',
  );
else {
  const launcher = platform === "darwin" ? "Play.command" : "Play.sh";
  await writeFile(
    path.join(folder, launcher),
    '#!/bin/sh\ncd "$(dirname "$0")" || exit 1\nexec ./runtime/node ./bin/launch.mjs\n',
  );
  for (const executable of [launcher, "runtime/node", "runtime/cloudflared"])
    await chmod(path.join(folder, executable), 0o755);
}
const zip = new AdmZip();
zip.addLocalFolder(folder, name);
zip.writeZip(path.join(root, "release", name + ".zip"));
const bytes = await readFile(path.join(root, "release", name + ".zip"));
await writeFile(
  path.join(root, "release", name + ".zip.sha256"),
  createHash("sha256").update(bytes).digest("hex") + "  " + name + ".zip\n",
);
await rm(staging, { recursive: true, force: true });
console.log(
  `Ready: release/${name}.zip (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`,
);
