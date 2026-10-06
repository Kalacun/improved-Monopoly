import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { tokenModel } from "../src/client/models.js";
import { TOKENS } from "../src/game/board.js";
mkdirSync("public/models", { recursive: true });
function save(name: string, model: THREE.Object3D) {
  model.updateMatrixWorld(true);
  writeFileSync(`public/models/${name}.obj`, new OBJExporter().parse(model));
  model.rotation.x = Math.PI / 2;
  model.updateMatrixWorld(true);
  writeFileSync(`public/models/${name}.stl`, new STLExporter().parse(model));
}
for (const name of TOKENS)
  save(name.toLowerCase().replaceAll(" ", "-"), tokenModel(name, "#c9b270"));
const tower = new THREE.Group(),
  mat = new THREE.MeshStandardMaterial({ color: "#bbad6c" });
for (const [w, h, y] of [
  [0.46, 0.09, 0.045],
  [0.3, 0.47, 0.325],
  [0.4, 0.07, 0.6],
  [0.24, 0.16, 0.7],
]) {
  const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
  part.position.y = y;
  tower.add(part);
}
const roof = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.2, 4), mat);
roof.position.y = 0.87;
roof.rotation.y = Math.PI / 4;
tower.add(roof);
save("sample-tower", tower);
console.log(
  "Exported six original token meshes and a sample tower as STL and OBJ.",
);
// Node lacks FileReader; provide the two Blob reads used by Three's exporter.
class ExportFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    blob.arrayBuffer().then((data) => {
      this.result = data;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob: Blob) {
    blob.arrayBuffer().then((data) => {
      this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(data).toString("base64")}`;
      this.onloadend?.();
    });
  }
}
Object.assign(globalThis, { FileReader: ExportFileReader });
const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
tower.rotation.set(0, 0, 0);
tower.updateMatrixWorld(true);
const exporter = new GLTFExporter();
writeFileSync(
  "public/models/sample-tower.glb",
  Buffer.from(
    (await exporter.parseAsync(tower, { binary: true })) as ArrayBuffer,
  ),
);
writeFileSync(
  "public/models/sample-tower.gltf",
  JSON.stringify(await exporter.parseAsync(tower, { binary: false })),
);
console.log("Exported self-contained GLB and embedded glTF import samples.");
