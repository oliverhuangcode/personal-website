import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { buildSpikeModel } from "./model";

const frame = (over: Partial<Parameters<ReturnType<typeof buildSpikeModel>["update"]>[0]> = {}) => ({
  t: 1,
  dt: 1 / 60,
  glow: 0.5,
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
    // The device stays within its old footprint.
    const device = new THREE.Box3();
    group.traverse((o) => {
      if (o instanceof THREE.Mesh) device.expandByObject(o);
    });
    expect(device.max.x).toBeLessThan(1.15);
    expect(device.min.x).toBeGreaterThan(-1.15);
  });

  it("has no floor ring", () => {
    expect(buildSpikeModel().group.getObjectByName("floor hud")).toBeUndefined();
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

  it("rides the casing ring up and down the chamber over time", () => {
    const model = buildSpikeModel();
    const casing = model.group.getObjectByName("casing ring")!;
    model.update(frame({ t: 0 }));
    const low = casing.position.y;
    model.update(frame({ t: Math.PI / 0.35 }));
    expect(casing.position.y).toBeGreaterThan(low + 0.5);
  });

  it("holds its lights steady: no pulse from one moment to the next", () => {
    const model = buildSpikeModel();
    const lights = () =>
      model.group.children
        .filter((o): o is THREE.Mesh => /^(light cell|glowing seam)/.test(o.name))
        .map((c) => (c.material as THREE.MeshBasicMaterial).color.getHex());
    model.update(frame({ t: 0.3 }));
    const a = lights();
    model.update(frame({ t: 7.9 }));
    expect(lights()).toEqual(a);
    // …and every light cell is lit alike, rather than chasing.
    const cells = model.group.children
      .filter((o): o is THREE.Mesh => o.name.startsWith("light cell"))
      .map((c) => (c.material as THREE.MeshBasicMaterial).color.getHex());
    expect(cells).toHaveLength(9);
    expect(new Set(cells).size).toBe(1);
  });

  it("moves the energy rings up the core over time", () => {
    const model = buildSpikeModel();
    const ring = model.group.getObjectByName("energy ring 1")!;
    model.update(frame({ dt: 0 }));
    const y0 = ring.position.y;
    model.update(frame({ dt: 0.2 }));
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
