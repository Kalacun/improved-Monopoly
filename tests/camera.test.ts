import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  boardView,
  followPose,
  sideForSquare,
  interpolateView,
  type BoardView,
} from "../src/client/camera";

describe("board camera", () => {
  it.each([0.6, 1, 1.35, 2.5])(
    "frames every preset at aspect ratio %s",
    (aspect) => {
      const fov = THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(38) / 2) *
              Math.max(1, 1.35 / aspect),
          ),
      );
      const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);
      camera.position.set(35, 8, -10);
      for (const view of [
        "home",
        "top",
        "north",
        "east",
        "south",
        "west",
      ] as BoardView[]) {
        const pose = boardView(camera, view);
        const probe = camera.clone();
        probe.position.copy(pose.position);
        probe.lookAt(pose.target);
        probe.updateMatrixWorld();
        for (let sector = 0; sector < 32; sector++)
          for (const y of [-0.4, 0.8]) {
            const angle = (sector * Math.PI) / 16;
            const point = new THREE.Vector3(
              6.25 * Math.cos(angle),
              y,
              6.25 * Math.sin(angle),
            ).project(probe);
            expect(Math.abs(point.x)).toBeLessThanOrEqual(
              view === "home" ? 0.971 : 0.931,
            );
            expect(Math.abs(point.y)).toBeLessThanOrEqual(
              view === "home" ? 0.971 : 0.931,
            );
            expect(Math.abs(point.z)).toBeLessThan(1);
          }
      }
      expect(camera.position.toArray()).toEqual([35, 8, -10]);
    },
  );

  it("recenters a panned view and orbits safely between opposite sides", () => {
    const camera = new THREE.PerspectiveCamera(38, 1.35, 0.1, 100);
    const from = boardView(camera, "south");
    from.position.add(new THREE.Vector3(8, 3, 0));
    from.target.add(new THREE.Vector3(8, 3, 0));
    const to = boardView(camera, "north");
    const middle = interpolateView(from, to, 0.5);
    expect(middle.position.distanceTo(middle.target)).toBeCloseTo(
      from.position.distanceTo(from.target),
    );
    expect(middle.position.y).toBeGreaterThan(10);
    expect(
      interpolateView(from, to, 0).position.distanceTo(from.position),
    ).toBeLessThan(1e-10);
    const end = interpolateView(from, to, 1);
    expect(end.target.toArray()).toEqual([0, 0, 0]);
    expect(end.position.distanceTo(to.position)).toBeLessThan(1e-10);
  });

  it("takes the short arc across the azimuth wrap", () => {
    const target = new THREE.Vector3();
    const pose = (theta: number) => ({
      target,
      position: new THREE.Vector3().setFromSpherical(
        new THREE.Spherical(24, 0.8, theta),
      ),
    });
    const halfway = interpolateView(
      pose(Math.PI - 0.1),
      pose(-Math.PI + 0.1),
      0.5,
    );
    expect(halfway.position.z).toBeLessThan(-10);
    expect(Math.abs(halfway.position.x)).toBeLessThan(1e-10);
  });
});

it("follows each edge and changes direction at corners including GO", () => {
  expect([0, 9, 10, 19, 20, 29, 30, 39, 40, -1].map(sideForSquare)).toEqual([
    "south",
    "south",
    "west",
    "west",
    "north",
    "north",
    "east",
    "east",
    "south",
    "east",
  ]);
  const camera = new THREE.PerspectiveCamera(38, 1.35, 0.1, 100);
  for (const [square, x, z] of [
    [5, 0, 5.225],
    [15, -5.225, 0],
    [25, 0, -5.225],
    [35, 5.225, 0],
  ]) {
    const figure = new THREE.Vector3(x, 0.05, z);
    const pose = followPose(camera, square, figure);
    const probe = camera.clone();
    probe.position.copy(pose.position);
    probe.lookAt(pose.target);
    probe.updateMatrixWorld();
    const projected = figure.clone().project(probe);
    expect(Math.abs(projected.x)).toBeLessThan(0.8);
    expect(Math.abs(projected.y)).toBeLessThan(0.8);
    expect(pose.position.distanceTo(pose.target)).toBeGreaterThan(15);
  }
});
