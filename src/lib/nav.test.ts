import { describe, expect, it } from "vitest";

import { PAGES, pad2, pad3, pageIndex, stepPage } from "./nav";

describe("nav", () => {
  it("orders pages as in the header: about, projects, home, travel, food", () => {
    expect(PAGES.map((p) => p.label)).toEqual(["ABOUT", "PROJECTS", "HOME", "TRAVEL", "FOOD"]);
  });

  it("resolves paths with or without a trailing slash", () => {
    expect(pageIndex("/")).toBe(2);
    expect(pageIndex("/travel")).toBe(3);
    expect(pageIndex("/travel/")).toBe(3);
    expect(pageIndex("/nope")).toBe(-1);
  });

  it("steps and wraps in both directions", () => {
    expect(stepPage("/", 1).href).toBe("/travel");
    expect(stepPage("/food", 1).href).toBe("/about");
    expect(stepPage("/about", -1).href).toBe("/food");
    expect(stepPage("/nope", -1).href).toBe("/projects");
  });

  it("pads numbers", () => {
    expect(pad2(6)).toBe("06");
    expect(pad3(1)).toBe("001");
  });
});
