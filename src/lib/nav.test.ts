import { describe, expect, it } from "vitest";

import { PAGES, navDirection, pad2, pad3, pageIndex, stepPage } from "./nav";

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

  it("counts sub-pages as their section", () => {
    expect(pageIndex("/food/melbourne")).toBe(4);
    expect(pageIndex("/food/melbourne/")).toBe(4);
    expect(pageIndex("/foodie")).toBe(-1);
  });

  it("steps and wraps in both directions", () => {
    expect(stepPage("/", 1).href).toBe("/travel");
    expect(stepPage("/food", 1).href).toBe("/about");
    expect(stepPage("/about", -1).href).toBe("/food");
    expect(stepPage("/nope", -1).href).toBe("/projects");
  });

  it("calls rightward jumps forward and leftward ones back", () => {
    expect(navDirection("/", "/food")).toBe("nav-forward");
    expect(navDirection("/food", "/about")).toBe("nav-back");
    expect(navDirection("/travel/", "/projects")).toBe("nav-back");
    expect(navDirection("/nope", "/about")).toBe("nav-back");
    expect(navDirection("/nope", "/")).toBe("nav-forward");
    expect(navDirection("/food", "/food/melbourne")).toBe("nav-forward");
    expect(navDirection("/food/melbourne/", "/food")).toBe("nav-back");
    expect(navDirection("/food/melbourne", "/travel")).toBe("nav-back");
  });

  it("pads numbers", () => {
    expect(pad2(6)).toBe("06");
    expect(pad3(1)).toBe("001");
  });
});
