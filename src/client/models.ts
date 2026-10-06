import * as THREE from "three";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
export function metal(color: string) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.78,
    roughness: 0.26,
  });
}
export function tokenModel(name: string, color: string): THREE.Group {
  const g = new THREE.Group();
  const mat = metal(color);
  const accent = metal("#e8d6f3");
  const legacy = [
    "Top hat",
    "Roadster",
    "Terrier",
    "Sailing ship",
    "Thimble",
    "Boot",
  ];
  const figures = ["Drone", "Lighthouse", "Fox", "Comet", "Crystal", "Robot"];
  name = figures[legacy.indexOf(name)] || name;
  const add = (
    geo: THREE.BufferGeometry,
    x = 0,
    y = 0,
    z = 0,
    material = mat,
  ) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };
  if (name === "Drone") {
    add(new THREE.SphereGeometry(0.16, 24, 16), 0, 0.23);
    for (const x of [-0.21, 0.21])
      for (const z of [-0.21, 0.21]) {
        const arm = add(
          new THREE.BoxGeometry(0.32, 0.035, 0.045),
          x / 2,
          0.23,
          z / 2,
        );
        arm.rotation.y = x * z > 0 ? -Math.PI / 4 : Math.PI / 4;
        const rotor = add(
          new THREE.TorusGeometry(0.095, 0.018, 8, 24),
          x,
          0.25,
          z,
          accent,
        );
        rotor.rotation.x = Math.PI / 2;
        add(
          new THREE.CylinderGeometry(0.018, 0.025, 0.18, 10),
          x / 2,
          0.1,
          z / 2,
        );
      }
  } else if (name === "Lighthouse") {
    add(new THREE.CylinderGeometry(0.13, 0.22, 0.39, 32), 0, 0.2);
    add(new THREE.CylinderGeometry(0.19, 0.19, 0.035, 32), 0, 0.41);
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16), 0, 0.48, 0, accent);
    add(new THREE.ConeGeometry(0.18, 0.12, 32), 0, 0.59);
  } else if (name === "Fox") {
    const body = add(new THREE.SphereGeometry(0.2, 20, 14), 0, 0.2);
    body.scale.set(0.85, 1, 0.6);
    add(new THREE.IcosahedronGeometry(0.14, 0), 0.07, 0.39);
    for (const z of [-0.075, 0.075])
      add(new THREE.ConeGeometry(0.055, 0.15, 4), 0.06, 0.52, z);
    const tail = add(
      new THREE.ConeGeometry(0.12, 0.38, 16),
      -0.16,
      0.21,
      0,
      accent,
    );
    tail.rotation.z = -0.9;
    const snout = add(new THREE.ConeGeometry(0.07, 0.13, 4), 0.2, 0.35);
    snout.rotation.z = -Math.PI / 2;
  } else if (name === "Comet") {
    add(new THREE.SphereGeometry(0.17, 24, 16), 0.13, 0.27);
    for (let i = 0; i < 3; i++) {
      const trail = add(
        new THREE.ConeGeometry(0.055, 0.37 - i * 0.05, 12),
        -0.11,
        0.16 + i * 0.08,
        (i - 1) * 0.07,
        accent,
      );
      trail.rotation.z = -1.05;
    }
  } else if (name === "Crystal") {
    for (const [x, z, height] of [
      [0, 0, 0.55],
      [-0.14, 0.06, 0.32],
      [0.14, -0.05, 0.38],
    ]) {
      add(
        new THREE.CylinderGeometry(0.07, 0.095, height * 0.65, 6),
        x,
        height * 0.325,
        z,
      );
      add(
        new THREE.ConeGeometry(0.07, height * 0.35, 6),
        x,
        height * 0.825,
        z,
        accent,
      );
    }
  } else {
    add(new THREE.BoxGeometry(0.23, 0.2, 0.17), 0, 0.24);
    add(new THREE.BoxGeometry(0.25, 0.17, 0.2), 0, 0.44);
    for (const x of [-0.07, 0.07]) {
      add(new THREE.BoxGeometry(0.075, 0.11, 0.12), x, 0.08);
      add(new THREE.SphereGeometry(0.025, 12, 8), x, 0.46, 0.108, accent);
    }
    for (const x of [-0.17, 0.17])
      add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 12), x, 0.26);
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 10), 0, 0.56);
    add(new THREE.SphereGeometry(0.028, 12, 8), 0, 0.61, 0, accent);
  }
  return g;
}
export async function importModel(
  data: ArrayBuffer,
  ext: string,
  color: string,
): Promise<THREE.Group> {
  let object: THREE.Object3D;
  if (ext === "stl") {
    const faces =
        data.byteLength >= 84 ? new DataView(data).getUint32(80, true) : 0,
      binary = data.byteLength === 84 + faces * 50;
    const text = binary ? "" : new TextDecoder().decode(data);
    if (binary && faces * 3 > 500000)
      throw Error("STL exceeds 500,000 vertices.");
    if (
      !binary &&
      (!/^\s*solid\b/i.test(text) ||
        !text.includes("facet") ||
        [...text.matchAll(/facet\s+normal/g)].length * 3 > 500000)
    )
      throw Error("Invalid or oversized STL geometry.");
    const geo = new STLLoader().parse(data);
    geo.computeVertexNormals();
    object = new THREE.Mesh(geo, metal(color));
    object.rotation.x = -Math.PI / 2;
  } else if (ext === "obj") {
    object = new OBJLoader().parse(new TextDecoder().decode(data));
    object.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = metal(color);
    });
  } else if (ext === "glb" || ext === "gltf") {
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((url) => {
      if (!url.startsWith("data:") && !url.startsWith("blob:"))
        throw new Error(
          "Use a GLB or embedded glTF. External files are not supported.",
        );
      return url;
    });
    const loader = new GLTFLoader(manager);
    const asset = await loader.parseAsync(
      ext === "gltf" ? new TextDecoder().decode(data) : data,
      "",
    );
    object = asset.scene;
  } else throw Error("Choose an STL, OBJ, GLB, or embedded glTF file.");
  object.updateMatrixWorld(true);
  let vertices = 0;
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      vertices += o.geometry.getAttribute("position")?.count || 0;
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  if (vertices === 0 || vertices > 500000)
    throw Error(
      "The model needs 1–500,000 vertices. Simplify the mesh before importing.",
    );
  const box = new THREE.Box3().setFromObject(object),
    size = box.getSize(new THREE.Vector3()),
    center = box.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.length()) || size.length() === 0)
    throw Error("The model has invalid bounds.");
  const scale = 0.65 / Math.max(size.x, size.y, size.z);
  const wrapper = new THREE.Group();
  object.position.sub(new THREE.Vector3(center.x, box.min.y, center.z));
  wrapper.add(object);
  wrapper.scale.setScalar(scale);
  return wrapper;
}
export function disposeObject(object: THREE.Object3D) {
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const v of Object.values(m))
          if (v instanceof THREE.Texture) v.dispose();
        m.dispose();
      }
    }
  });
}
