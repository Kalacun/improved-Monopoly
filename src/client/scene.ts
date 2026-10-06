import { translate, boardLabel } from "./i18n";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { BOARD, COLORS, TOKENS } from "../game/board";
import type { Game, Seat } from "../game/types";
import { tokenModel, importModel, disposeObject } from "./models";
import {
  boardView,
  followPose,
  interpolateView,
  type BoardView,
  type CameraPose,
} from "./camera";
const SIZE = 12,
  EDGE = 1.55,
  STEP = (SIZE - EDGE * 2) / 9;
const tileAngle = (id: number) => Math.floor(id / 10) * (Math.PI / 2);
export function tilePosition(id: number): THREE.Vector3 {
  const side = Math.floor(id / 10),
    n = id % 10,
    c = SIZE / 2 - EDGE / 2;
  if (n === 0) {
    const corners = [
      [c, c],
      [-c, c],
      [-c, -c],
      [c, -c],
    ];
    return new THREE.Vector3(corners[side][0], 0, corners[side][1]);
  }
  const along = SIZE / 2 - EDGE - STEP * (n - 0.5);
  const edges = [
    [along, c],
    [-c, along],
    [-along, -c],
    [c, -along],
  ];
  return new THREE.Vector3(edges[side][0], 0, edges[side][1]);
}
function roundedShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}
function boardTexture(game: Game | null = null) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2400;
  const ctx = canvas.getContext("2d")!;
  const ratio = 200;
  ctx.fillStyle = "#dfdcc8";
  ctx.fillRect(0, 0, 2400, 2400);
  ctx.fillStyle = "#294e3b";
  ctx.fillRect(310, 310, 1780, 1780);
  ctx.strokeStyle = "#9caf8c";
  ctx.lineWidth = 5;
  ctx.strokeRect(310, 310, 1780, 1780);
  ctx.textAlign = "center";
  ctx.fillStyle = "#e8dbd0";
  ctx.font = "24px sans-serif";
  ctx.fillText(translate("A CITY BUILT ON AGREEMENTS"), 1200, 880);
  ctx.font = "bold 110px Georgia";
  ctx.fillText("ESTATE", 1200, 1060);
  ctx.fillText("EXCHANGE", 1200, 1190);
  ctx.font = "30px sans-serif";
  ctx.fillText(translate("Own a little. Negotiate a lot."), 1200, 1270);
  for (const [x, label, symbol] of [
    [850, translate("COMMUNITY CHEST"), "✦"],
    [1550, translate("CHANCE"), "↗"],
  ] as const) {
    ctx.save();
    ctx.translate(x, 1510);
    ctx.fillStyle = "#dfd1c4";
    ctx.beginPath();
    ctx.roundRect(-115, -72, 230, 144, 18);
    ctx.fill();
    ctx.fillStyle = "#3c314f";
    ctx.font = "bold 34px sans-serif";
    ctx.fillText(symbol, 0, -5);
    ctx.font = "15px sans-serif";
    ctx.fillText(label, 0, 42, 210);
    ctx.restore();
  }
  for (const tile of BOARD) {
    const p = tilePosition(tile.id);
    ctx.save();
    ctx.translate((p.x + 6) * ratio, (p.z + 6) * ratio);
    ctx.rotate(-tileAngle(tile.id));
    const corner = tile.id % 10 === 0,
      w = (corner ? EDGE : STEP) * ratio,
      h = (corner ? EDGE : EDGE) * ratio;
    const side = Math.floor(tile.id / 10);
    const verticalEdge = !corner && (side === 1 || side === 3);
    const owner = game?.players.find(
      (player) => player.id === game.deeds[tile.id]?.owner,
    );
    ctx.fillStyle = owner
      ? new THREE.Color("#f1e8df")
          .lerp(new THREE.Color(owner.color), 0.4)
          .getStyle()
      : "#f3efdf";
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = "#6d7968";
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    if (tile.color) {
      ctx.fillStyle = tile.color;
      ctx.fillRect(
        -w / 2,
        verticalEdge ? h / 2 - 24 : -h / 2,
        w,
        24,
      );
    }
    if (verticalEdge) {
      // Rotate the complete printed face toward the player on each vertical
      // edge. Keep the tile and its outside color band in their board frame.
      ctx.save();
      ctx.rotate(Math.PI);
    }
    ctx.fillStyle = "#352a45";
    ctx.font = corner ? "bold 28px sans-serif" : "bold 22px sans-serif";
    const cornerLabels: Record<number, string[]> = {
      0: [translate("START"), translate("COLLECT $200")],
      10: [translate("JAIL"), translate("JUST VISITING")],
      20: [translate("FREE PARKING")],
      30: [translate("GO TO JAIL")],
    };
    const words = (
      corner ? cornerLabels[tile.id].join(" ") : boardLabel(tile.name)
    )
      .toUpperCase()
      .split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > 12 && line) {
        lines.push(line);
        line = word;
      } else line = (line + " " + word).trim();
    }
    if (line) lines.push(line);
    lines.forEach((label, i) =>
      ctx.fillText(label, 0, corner ? -38 + i * 31 : -47 + i * 25, w - 14),
    );
    ctx.font = corner ? "bold 45px sans-serif" : "bold 38px sans-serif";
    const symbols: Record<string, string> = {
      go: "↗",
      chance: "↗",
      chest: "✦",
      jail: "◎",
      goToJail: "↘",
      parking: "◇",
      railroad: "⇄",
      utility: "≈",
      tax: "$",
    };
    if (symbols[tile.kind] && !corner)
      ctx.fillText(symbols[tile.kind], 0, 15, w - 14);
    ctx.font = "17px sans-serif";
    if (tile.price || tile.tax)
      ctx.fillText(`$${tile.price || tile.tax}`, 0, 49);
    if (tile.id === 0) ctx.fillText("+$200", 0, 49);
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#746284";
    if (!corner) ctx.fillText(String(tile.id + 1).padStart(2, "0"), 0, 72);
    if (verticalEdge) ctx.restore();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
function diceTexture(value: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#f7f0db";
  c.fillRect(0, 0, 128, 128);
  c.fillStyle = "#203d32";
  const dot = (x: number, y: number) => {
    c.beginPath();
    c.arc(x, y, 9, 0, Math.PI * 2);
    c.fill();
  };
  if (value % 2) dot(64, 64);
  if (value >= 2) {
    dot(30, 30);
    dot(98, 98);
  }
  if (value >= 4) {
    dot(30, 98);
    dot(98, 30);
  }
  if (value === 6) {
    dot(30, 64);
    dot(98, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export class BoardScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  controls: OrbitControls;
  tokenGroups = new Map<string, THREE.Group>();
  modelKeys = new Map<string, string>();
  markers = new THREE.Group();
  buildings = new THREE.Group();
  pickables: THREE.Mesh[] = [];
  ring: THREE.Mesh;
  dice: THREE.Mesh[] = [];
  targetPositions = new Map<string, THREE.Vector3>();
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  selected = -1;
  frame = 0;
  updateSerial = 0;
  private boardMaterial = new THREE.MeshStandardMaterial({
    map: boardTexture(),
    roughness: 0.83,
  });
  private ownershipSignature = "";
  lastRevision = -1;
  lastPositions = new Map<string, number>();
  routes = new Map<string, THREE.Vector3[]>();
  dieTargets: THREE.Quaternion[] = [];
  lastDiceLog = 0;
  spinUntil = 0;
  lastFrame = performance.now();
  private followEnabled = true;
  private activePlayer = "";
  private animatedSquares = new Map<string, number>();
  private preset: BoardView | null = "home";
  private cameraMove?: { from: CameraPose; to: CameraPose; started: number };
  onSelect: (id: number) => void;
  resizeObserver: ResizeObserver;
  error: (message: string) => void;
  constructor(
    container: HTMLElement,
    onSelect: (id: number) => void,
    onError: (message: string) => void,
    private onStep: (player: string, square: number) => void = () => {},
  ) {
    this.onSelect = onSelect;
    this.error = onError;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D property board. Left-drag to orbit, right-drag to pan, scroll to zoom. On touch screens, use two fingers to pan or zoom.",
    );
    this.camera.position.set(10, 14, 12);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0.55, 0, 0.66);
    this.controls.enableDamping = true;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 29;
    this.controls.maxPolarAngle = Math.PI * 0.43;
    this.controls.minPolarAngle = 0.08;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.addEventListener("start", () => {
      this.cameraMove = undefined;
      this.preset = null;
      this.followEnabled = false;
      this.notifyFollow();
    });
    const pmrem = new THREE.PMREMGenerator(this.renderer),
      env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    env.dispose();
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight("#fff8e0", "#626d51", 0.9));
    const light = new THREE.DirectionalLight("#fff4d9", 2);
    light.position.set(-5, 14, 8);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.normalBias = 0.03;
    light.shadow.bias = -0.0001;
    this.scene.add(light);
    const geo = new THREE.ExtrudeGeometry(roundedShape(12.3, 12.3, 0.12), {
      depth: 0.28,
      bevelEnabled: false,
    });
    const base = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: "#294e3b", roughness: 0.55 }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = -0.3;
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      this.boardMaterial,
    );
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.02;
    top.receiveShadow = true;
    this.scene.add(top);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ color: "#4b5641", opacity: 0.18 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.43;
    ground.receiveShadow = true;
    this.scene.add(ground);
    for (const t of BOARD) {
      const p = tilePosition(t.id);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(t.id % 10 === 0 ? EDGE : STEP, EDGE),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      mesh.rotation.set(-Math.PI / 2, 0, -tileAngle(t.id));
      mesh.position.copy(p).setY(0.05);
      mesh.userData.id = t.id;
      this.scene.add(mesh);
      this.pickables.push(mesh);
    }
    this.scene.add(this.markers, this.buildings);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.44, 48),
      new THREE.MeshBasicMaterial({
        color: "#f4c66b",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.055;
    this.scene.add(this.ring);
    for (let i = 0; i < 2; i++) {
      const mats = [3, 4, 1, 6, 2, 5].map(
        (n) =>
          new THREE.MeshStandardMaterial({
            map: diceTexture(n),
            roughness: 0.36,
          }),
      );
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), mats);
      die.position.set(-0.43 + i * 0.87, 0.37, 1.36);
      die.castShadow = true;
      this.scene.add(die);
      this.dice.push(die);
      this.dieTargets.push(new THREE.Quaternion());
    }
    let down:
      { x: number; y: number; id: number; dragged: boolean } | undefined;
    this.renderer.domElement.addEventListener("pointerdown", (e) => {
      down =
        e.button === 0 && e.isPrimary
          ? { x: e.clientX, y: e.clientY, id: e.pointerId, dragged: false }
          : undefined;
    });
    this.renderer.domElement.addEventListener("pointermove", (e) => {
      if (
        down &&
        down.id === e.pointerId &&
        Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5
      )
        down.dragged = true;
    });
    this.renderer.domElement.addEventListener("pointercancel", () => {
      down = undefined;
    });
    this.renderer.domElement.addEventListener("pointerup", (e) => {
      const click = down;
      down = undefined;
      if (
        !click ||
        click.id !== e.pointerId ||
        e.button !== 0 ||
        click.dragged ||
        Math.hypot(e.clientX - click.x, e.clientY - click.y) > 5
      )
        return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.pickables)[0];
      if (hit) this.onSelect(hit.object.userData.id);
    });
    this.resizeObserver = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      if (!width || !height) return;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      // Preserve the full board on narrow browser panels without changing user zoom.
      this.camera.fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(38) / 2) *
              Math.max(1, 1.35 / this.camera.aspect),
          ),
      );
      this.camera.updateProjectionMatrix();
      if (this.preset && !this.followEnabled) this.view(this.preset, false);
    });
    this.resizeObserver.observe(container);
    this.animate();
  }
  private notifyFollow() {
    document.dispatchEvent(
      new CustomEvent("camera-follow", { detail: this.followEnabled }),
    );
  }
  follow() {
    this.followEnabled = true;
    this.preset = null;
    this.cameraMove = undefined;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
    this.notifyFollow();
  }
  home(top = false) {
    this.view(top ? "top" : "home");
  }
  view(preset: BoardView, animate = true) {
    this.followEnabled = false;
    this.notifyFollow();
    const from = {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
    };
    // Drain remaining drag inertia, then restore the exact visible starting pose.
    this.controls.enableDamping = false;
    this.controls.update();
    this.camera.position.copy(from.position);
    this.controls.target.copy(from.target);
    this.controls.enableDamping = true;
    const to = boardView(this.camera, preset);
    this.controls.maxDistance = Math.max(29, to.position.distanceTo(to.target));
    this.preset = preset;
    if (
      animate &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      this.cameraMove = { from, to, started: performance.now() };
    } else {
      this.cameraMove = undefined;
      this.camera.position.copy(to.position);
      this.controls.target.copy(to.target);
    }
    this.controls.update();
  }
  select(id: number) {
    this.selected = id;
    this.ring.position.copy(tilePosition(id)).setY(0.06);
  }
  async update(game: Game | null, seats: Seat[]) {
    const signature = JSON.stringify([
      game?.deeds &&
        Object.entries(game.deeds).map(([id, deed]) => [id, deed.owner]),
      game?.players.map((p) => [p.id, p.color]),
    ]);
    if (signature !== this.ownershipSignature) {
      this.ownershipSignature = signature;
      const previous = this.boardMaterial.map;
      this.boardMaterial.map = boardTexture(game);
      this.boardMaterial.needsUpdate = true;
      previous?.dispose();
    }
    const serial = ++this.updateSerial;
    this.activePlayer =
      game && game.phase !== "over" ? game.players[game.turn].id : "";
    const players =
      game?.players ||
      seats.map((s, i) => ({
        ...s,
        position: i === 0 ? 0 : i === 1 ? 6 : 16,
        bankrupt: false,
      }));
    for (const [id, obj] of this.tokenGroups)
      if (!players.some((p) => p.id === id && !p.bankrupt)) {
        this.scene.remove(obj);
        disposeObject(obj);
        this.tokenGroups.delete(id);
        this.modelKeys.delete(id);
        this.lastPositions.delete(id);
        this.routes.delete(id);
      }
    for (const [i, p] of players.entries()) {
      if (p.bankrupt) continue;
      const seat = seats.find((s) => s.id === p.id),
        key = seat?.model || p.token;
      let tg = this.tokenGroups.get(p.id);
      if (!tg) {
        tg = new THREE.Group();
        this.scene.add(tg);
        this.tokenGroups.set(p.id, tg);
        tg.position.copy(tilePosition(p.position)).setY(0.055);
      }
      if (this.modelKeys.get(p.id) !== key) {
        this.modelKeys.set(p.id, key);
        for (const c of [...tg.children]) {
          tg.remove(c);
          disposeObject(c);
        }
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.27, 0.29, 0.045, 40),
          new THREE.MeshStandardMaterial({
            color: p.color,
            metalness: 0.3,
            roughness: 0.5,
          }),
        );
        base.position.y = 0.025;
        base.castShadow = true;
        tg.add(base);
        const fallback = tokenModel(p.token, p.color);
        fallback.position.y = 0.047;
        tg.add(fallback);
        if (seat?.model) {
          const target = tg;
          try {
            const response = await fetch(seat.model);
            if (!response.ok)
              throw Error("The host could not serve the uploaded model.");
            const data = await response.arrayBuffer();
            const model = await importModel(
              data,
              seat.model.split(".").pop()!,
              p.color,
            );
            if (this.modelKeys.get(p.id) === key) {
              target.remove(fallback);
              disposeObject(fallback);
              model.position.y = 0.05;
              target.add(model);
            } else disposeObject(model);
          } catch (e) {
            this.error(
              `Could not load ${p.name}'s custom figure: ${(e as Error).message}`,
            );
          }
          if (serial !== this.updateSerial) return;
        }
      }
      const others = players.filter(
          (q) => q.position === p.position && !q.bankrupt,
        ),
        idx = others.findIndex((q) => q.id === p.id);
      const target = tilePosition(p.position);
      if (others.length > 1) {
        target.x += ((idx % 2) - 0.5) * 0.48;
        target.z +=
          (Math.floor(idx / 2) - (Math.ceil(others.length / 2) - 1) / 2) * 0.42;
      }
      const old = this.lastPositions.get(p.id);
      this.lastPositions.set(p.id, p.position);
      if (!this.animatedSquares.has(p.id))
        this.animatedSquares.set(p.id, p.position);
      target.y = 0.05;
      this.targetPositions.set(p.id, target);
      if (old !== undefined && old !== p.position) {
        const route: THREE.Vector3[] = [];
        const distance = (p.position - old + 40) % 40;
        if ("jailed" in p && p.jailed && p.position === 10) {
          route.push(target.clone());
        } else {
          const backwards = distance === 37,
            steps = backwards ? 3 : distance;
          for (let step = 1; step <= steps; step++)
            route.push(
              tilePosition((old + (backwards ? -step : step) + 40) % 40).setY(
                0.05,
              ),
            );
          route[route.length - 1] = target.clone();
        }
        this.routes.set(p.id, [...(this.routes.get(p.id) || []), ...route]);
      }
    }
    for (const c of [...this.markers.children]) {
      this.markers.remove(c);
      disposeObject(c);
    }
    for (const c of [...this.buildings.children]) {
      this.buildings.remove(c);
      disposeObject(c);
    }
    if (game) {
      for (const [idstr, d] of Object.entries(game.deeds)) {
        const id = Number(idstr),
          p = tilePosition(id),
          side = Math.floor(id / 10);
        if (d.owner) {
          const marker = new THREE.Mesh(
            new THREE.BoxGeometry(0.68, 0.035, 0.1),
            new THREE.MeshStandardMaterial({
              color: game.players.find((p) => p.id === d.owner)!.color,
              roughness: 0.5,
            }),
          );
          const inward = new THREE.Vector3(
            side === 0 ? 0 : side === 1 ? 1 : side === 2 ? 0 : -1,
            0,
            side === 0 ? -1 : side === 1 ? 0 : side === 2 ? 1 : 0,
          ).multiplyScalar(0.55);
          marker.position.copy(p).add(inward).setY(0.065);
          marker.rotation.y = tileAngle(id);
          if (d.mortgage)
            (marker.material as THREE.MeshStandardMaterial).color.set(
              "#65645c",
            );
          this.markers.add(marker);
        }
        for (let h = 0; h < (d.houses === 5 ? 1 : d.houses); h++) {
          const hotel = d.houses === 5,
            house = new THREE.Group(),
            mat = new THREE.MeshStandardMaterial({
              color: hotel ? "#ac493d" : "#397b58",
              roughness: 0.57,
            });
          const body = new THREE.Mesh(
            new THREE.BoxGeometry(
              hotel ? 0.44 : 0.18,
              hotel ? 0.27 : 0.17,
              0.22,
            ),
            mat,
          );
          body.position.y = hotel ? 0.135 : 0.085;
          body.castShadow = true;
          house.add(body);
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(hotel ? 0.34 : 0.17, hotel ? 0.17 : 0.12, 4),
            mat,
          );
          roof.rotation.y = Math.PI / 4;
          roof.scale.z = 0.75;
          roof.position.y = hotel ? 0.34 : 0.22;
          roof.castShadow = true;
          house.add(roof);
          const along = hotel ? 0 : (h - 1.5) * 0.205;
          const angle = tileAngle(id),
            inward = [
              [0, 0, -0.46],
              [0.46, 0, 0],
              [0, 0, 0.46],
              [-0.46, 0, 0],
            ][side];
          house.position
            .copy(p)
            .add(
              new THREE.Vector3(
                inward[0] + Math.cos(angle) * along,
                0,
                inward[2] - Math.sin(angle) * along,
              ),
            )
            .setY(0.065);
          house.rotation.y = angle;
          this.buildings.add(house);
        }
      }
      if (this.lastRevision !== game.revision) {
        const rotations: [
          [number, number, number],
          [number, number, number],
          [number, number, number],
          [number, number, number],
          [number, number, number],
          [number, number, number],
        ] = [
          [0, 0, 0],
          [-Math.PI / 2, 0, 0],
          [0, 0, Math.PI / 2],
          [0, 0, -Math.PI / 2],
          [Math.PI / 2, 0, 0],
          [Math.PI, 0, 0],
        ];
        const diceLog =
          game.logs.filter((l) => l.kind === "dice").at(-1)?.id || 0;
        if (diceLog !== this.lastDiceLog) {
          this.lastDiceLog = diceLog;
          this.spinUntil = performance.now() + 650;
        }
        game.dice.forEach((n, i) =>
          this.dieTargets[i].setFromEuler(new THREE.Euler(...rotations[n - 1])),
        );
        this.lastRevision = game.revision;
      }
    }
  }
  animate = () => {
    this.frame = requestAnimationFrame(this.animate);
    const now = performance.now(),
      dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    if (this.cameraMove) {
      const progress = Math.min(1, (now - this.cameraMove.started) / 750);
      const pose = interpolateView(
        this.cameraMove.from,
        this.cameraMove.to,
        progress,
      );
      this.camera.position.copy(pose.position);
      this.controls.target.copy(pose.target);
      if (progress === 1) this.cameraMove = undefined;
    }
    this.controls.update();
    this.lastFrame = now;
    for (const [id, obj] of this.tokenGroups) {
      const route = this.routes.get(id),
        target = route?.[0] || this.targetPositions.get(id);
      if (target) {
        const distance = obj.position.distanceTo(target),
          travel = dt * (route?.length ? 6 : 4);
        if (distance <= travel) {
          obj.position.copy(target);
          if (route?.length) {
            let nearest = 0,
              distance = Infinity;
            for (let square = 0; square < 40; square++) {
              const d = tilePosition(square).distanceToSquared(target);
              if (d < distance) {
                distance = d;
                nearest = square;
              }
            }
            this.animatedSquares.set(id, nearest);
            this.onStep(id, nearest);
          }
          route?.shift();
        } else obj.position.lerp(target, travel / distance);
      }
    }
    const figure = this.tokenGroups.get(this.activePlayer);
    if (this.followEnabled && figure) {
      const destination = followPose(
        this.camera,
        this.animatedSquares.get(this.activePlayer) || 0,
        figure.position,
      );
      const pose = interpolateView(
        { position: this.camera.position, target: this.controls.target },
        destination,
        matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 1
          : 1 - Math.exp(-dt * 5),
      );
      this.camera.position.copy(pose.position);
      this.controls.target.copy(pose.target);
      this.controls.maxDistance = Math.max(
        29,
        destination.position.distanceTo(destination.target),
      );
      this.controls.update();
    }
    this.dice.forEach((die, i) => {
      if (now < this.spinUntil) {
        die.rotation.x += dt * (10 + i);
        die.rotation.z += dt * 13;
        die.position.y =
          0.37 + Math.sin(((this.spinUntil - now) / 650) * Math.PI) * 0.35;
      } else {
        die.quaternion.slerp(this.dieTargets[i], Math.min(1, dt * 14));
        die.position.y = 0.37;
      }
    });
    this.renderer.render(this.scene, this.camera);
  };
}
