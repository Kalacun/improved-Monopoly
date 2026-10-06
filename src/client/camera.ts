import * as THREE from "three";

export type BoardView = "home" | "top" | "north" | "east" | "south" | "west";
export type CameraPose = { position: THREE.Vector3; target: THREE.Vector3 };

// Fit a separate camera so calculating a destination never moves the live view.
export function boardView(
  camera: THREE.PerspectiveCamera,
  view: BoardView,
): CameraPose {
  const target = new THREE.Vector3();
  const position = new THREE.Vector3();
  switch (view) {
    case "home":
      position.set(9, 12.6, 10.8);
      target.set(0.55, 0, 0.66);
      break;
    case "top":
      position.set(0, 22 * Math.cos(0.08), 22 * Math.sin(0.08));
      break;
    case "north":
      position.set(0, 16, -18);
      break;
    case "east":
      position.set(18, 16, 0);
      break;
    case "south":
      position.set(0, 16, 18);
      break;
    case "west":
      position.set(-18, 16, 0);
      break;
  }
  const probe = camera.clone();
  for (let attempt = 0; attempt < 12; attempt++) {
    probe.position.copy(position);
    probe.lookAt(target);
    probe.updateMatrixWorld();
    let extent = 0;
    // Fit the square board corners, including figure/building height.
    for (const x of [-6.25, 6.25])
      for (const z of [-6.25, 6.25])
        for (const y of [-0.4, 0.8]) {
          const point = new THREE.Vector3(x, y, z).project(probe);
          extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
        }
    if (extent <= (view === "home" ? 0.97 : 0.93)) break;
    position
      .sub(target)
      .multiplyScalar(extent / (view === "home" ? 0.95 : 0.9))
      .add(target);
  }
  return { position, target };
}

export function interpolateView(
  from: CameraPose,
  to: CameraPose,
  progress: number,
): CameraPose {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const ease = t * t * (3 - 2 * t);
  const start = new THREE.Spherical().setFromVector3(
    from.position.clone().sub(from.target),
  );
  const end = new THREE.Spherical().setFromVector3(
    to.position.clone().sub(to.target),
  );
  // Orbit along the shortest arc; a straight line would cut through the board.
  const angle = Math.atan2(
    Math.sin(end.theta - start.theta),
    Math.cos(end.theta - start.theta),
  );
  const offset = new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(
      THREE.MathUtils.lerp(start.radius, end.radius, ease),
      THREE.MathUtils.lerp(start.phi, end.phi, ease),
      start.theta + angle * ease,
    ),
  );
  const target = from.target.clone().lerp(to.target, ease);
  return { position: target.clone().add(offset), target };
}

export type BoardSide = "south" | "west" | "north" | "east";
export function sideForSquare(square: number): BoardSide {
  return (["south", "west", "north", "east"] as const)[
    Math.floor((((square % 40) + 40) % 40) / 10)
  ];
}
// A modest offset keeps the moving figure prominent without losing the board.
export function followPose(
  camera: THREE.PerspectiveCamera,
  square: number,
  figure: THREE.Vector3,
): CameraPose {
  const pose = boardView(camera, sideForSquare(square));
  const offset = pose.position.clone().sub(pose.target).multiplyScalar(0.92);
  const target = new THREE.Vector3(figure.x * 0.22, 0, figure.z * 0.22);
  return { position: target.clone().add(offset), target };
}
