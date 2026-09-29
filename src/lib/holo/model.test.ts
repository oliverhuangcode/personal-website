import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { buildSpikeModel, createShockwaves } from "./model";

const frame = (over: Partial<Parameters<ReturnType<typeof buildSpikeModel>["update"]>[0]> = {}) => ({
  t: 1,
  dt: 1 / 60,
  charge: 0.5,
  flare: 0,
  beatPhase: 1,
  glowK: 1,
  ...over,
});

const bounds = (obj: THREE.Object3D) => {
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj);
};

describe("buildSpikeModel", () => {
  it("stands on the floor and keeps the old envelope, so the page layout doesn't move", () => {
    const { group } = buildSpikeModel();
    const box = bounds(group.getObjectByName("plinth")!.parent!);
    expect(box.min.y).toBeGreaterThan(-1.1);
    expect(box.max.y).toBeLessThan(1.4);
    // The floor HUD is the widest thing; the device itself stays within its old footprint.
    const device = new THREE.Box3();
    group.traverse((o) => {
      if (o instanceof THREE.Mesh && o.name !== "floor hud") device.expandByObject(o);
    });
    expect(device.max.x).toBeLessThan(1.15);
    expect(device.min.x).toBeGreaterThan(-1.15);
  });

  it("is three-way symmetric: three of every corner part", () => {
    const { group } = buildSpikeModel();
    for (const name of ["claw", "strut", "horn", "cable", "casing segment", "face plate"]) {
      const exact = new RegExp(`^${name} \\d+$`);
      const all: THREE.Object3D[] = [];
      group.traverse((o) => all.push(o));
      const n = all.filter((o) => exact.test(o.name)).length;
      expect(n, name).toBe(3);
    }
    expect(group.children.filter((o) => o.name.startsWith("light cell"))).toHaveLength(9);
  });

  it("has real detail, not a handful of prisms", () => {
    const { group } = buildSpikeModel();
    let tris = 0;
    let meshes = 0;
    group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      meshes++;
      const g = o.geometry as THREE.BufferGeometry;
      tris += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    });
    expect(meshes).toBeGreaterThan(80);
    expect(tris).toBeGreaterThan(20000);
    // …but stays cheap enough for a phone.
    expect(tris).toBeLessThan(250000);
  });

  it("raises the casing ring as it charges", () => {
    const model = buildSpikeModel();
    const casing = model.group.getObjectByName("casing ring")!;
    model.update(frame({ charge: 0.08 }));
    const low = casing.position.y;
    model.update(frame({ charge: 1 }));
    expect(casing.position.y).toBeGreaterThan(low + 0.5);
  });

  it("chases the light cells: not every cell is lit at once", () => {
    const model = buildSpikeModel();
    model.update(frame({ beatPhase: Math.PI / 2 }));
    const levels = model.group.children
      .filter((o): o is THREE.Mesh => o.name.startsWith("light cell"))
      .map((c) => (c.material as THREE.MeshBasicMaterial).color.r);
    expect(Math.max(...levels) - Math.min(...levels)).toBeGreaterThan(0.2);
  });

  it("moves the energy rings up the core over time", () => {
    const model = buildSpikeModel();
    const ring = model.group.getObjectByName("energy ring 1")!;
    model.update(frame({ dt: 0 }));
    const y0 = ring.position.y;
    model.update(frame({ dt: 0.2, charge: 0.8 }));
    expect(ring.position.y).not.toBe(y0);
  });

  it("disposes every geometry and material it created", () => {
    const model = buildSpikeModel();
    const spies: ReturnType<typeof vi.spyOn>[] = [];
    model.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      spies.push(vi.spyOn(o.geometry, "dispose"));
      for (const m of [o.material].flat()) spies.push(vi.spyOn(m, "dispose"));
    });
    model.dispose();
    for (const s of spies) expect(s).toHaveBeenCalled();
  });
});

describe("createShockwaves", () => {
  it("fires, expands, and retires a wave", () => {
    const waves = createShockwaves(2);
    const visible = () => waves.group.children.filter((o) => o.visible).length;
    expect(visible()).toBe(0);
    waves.fire(1);
    waves.update(0.1);
    expect(visible()).toBe(2); // ring + shell
    const shell = waves.group.children.find((o) => o.visible && o instanceof THREE.Mesh && o.geometry.type === "SphereGeometry")!;
    const s0 = shell.scale.x;
    waves.update(0.3);
    expect(shell.scale.x).toBeGreaterThan(s0);
    waves.update(2);
    expect(visible()).toBe(0);
  });

  it("reuses the oldest wave when the pool is full", () => {
    const waves = createShockwaves(1);
    waves.fire(1);
    waves.update(0.5);
    waves.fire(1);
    waves.update(0.01);
    const shell = waves.group.children.find((o) => o instanceof THREE.Mesh && o.geometry.type === "SphereGeometry")!;
    expect(shell.scale.x).toBeLessThan(0.7);
  });
});
