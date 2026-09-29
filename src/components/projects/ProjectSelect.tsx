"use client";

import { useState } from "react";

import { MediaFrame } from "@/components/ui/MediaFrame";
import type { Project } from "@/content/types";
import { pad2 } from "@/lib/nav";
import { blip } from "@/lib/sound/sound";

const TABS = [
  { label: "INFO", title: "OVERVIEW", body: (p: Project) => p.overview },
  { label: "ROLE", title: "MY ROLE", body: (p: Project) => p.myRole },
  { label: "STACK", title: "STACK", body: (p: Project) => p.stack },
  { label: "RESULT", title: "RESULT", body: (p: Project) => p.result },
] as const;

const chip = "px-3 py-[7px]";
const stagger = (s: number) => ({ animationDelay: `${s}s` });

/** Character-select style browser: media and detail above a roster strip. */
export function ProjectSelect({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState(0);

  const project = projects[selected];
  const total = pad2(projects.length);
  const no = pad2(selected + 1);
  const activeTab = TABS[tab];

  const pick = (i: number) => {
    blip("project");
    setSelected(i);
    setTab(0);
  };
  const cycle = (step: number) => pick((selected + step + projects.length) % projects.length);

  return (
    <main className="flex flex-1 flex-col">
      <h1 className="sr-only">Projects</h1>
      <div className="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-center gap-grid px-gutter pt-[clamp(12px,min(3vw,3dvh),44px)]">
        {/* Capped by window height so the page fits without scrolling on laptop screens. */}
        <div className="flex w-full max-w-[max(240px,calc((100dvh-350px)*4/3))] min-w-0 flex-col gap-2.5 justify-self-center">
          <p className="font-mono text-[11px] tracking-[0.16em] text-ink-muted">
            PROJECT {no} / {total}
          </p>
          {/* Keyed on the project so each pick replays the reveal, like a character select. */}
          <div key={selected} className="animate-wipe">
            <MediaFrame
              photo={project.screenshot}
              sizes="(min-width: 1280px) 600px, (min-width: 700px) 50vw, 100vw"
              className="chamfer-x aspect-[4/3]"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-[18px]">
          <p key={`role-${selected}`} className="animate-enter font-mono text-[12px] tracking-[0.3em] text-ink">
            {project.role}
          </p>
          <h2
            key={`name-${selected}`}
            className="animate-enter font-display text-project-name font-normal text-title"
            style={stagger(0.04)}
          >
            {project.name}
          </h2>

          <div
            role="group"
            aria-label="Project details"
            className="flex gap-px bg-hairline font-mono text-[11px] font-medium tracking-[0.12em]"
          >
            {TABS.map((t, i) => (
              <button
                key={t.label}
                type="button"
                aria-pressed={i === tab}
                aria-controls="project-detail"
                onClick={() => {
                  blip("tab");
                  setTab(i);
                }}
                className={`flex-1 px-2 py-3 text-center transition-colors duration-150 ${
                  i === tab ? "bg-accent text-bg" : "bg-panel-raised text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            id="project-detail"
            aria-live="polite"
            className="flex flex-col gap-3 border-l-2 border-accent bg-panel-glass p-5"
          >
            {/* The live region itself must persist for announcements; only its content remounts. */}
            <div key={`${selected}-${tab}`} className="flex animate-swap flex-col gap-3">
              <h3 className="font-display text-[24px] leading-none font-normal tracking-[0.08em]">
                {activeTab.title}
              </h3>
              <p className="text-[17px] leading-[1.55] text-pretty text-ink-dim">{activeTab.body(project)}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 font-mono text-[11px] font-medium tracking-[0.12em]">
            <span className={`${chip} bg-panel-raised`}>{project.year}</span>
            <span className={`${chip} bg-panel-raised`}>{project.kind}</span>
            <span className={`${chip} bg-accent text-bg`}>{project.status}</span>
          </div>
        </div>
      </div>

      <nav
        aria-label="Project roster"
        className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-gutter py-[clamp(8px,min(2.5vw,2dvh),28px)]"
      >
        <div className="h-px bg-[linear-gradient(90deg,transparent,#2e2b38_20%,#2e2b38_80%,transparent)]" />
        {/* safe-center keeps the first thumbnail reachable when the row overflows. */}
        <ul className="flex justify-center-safe gap-2 overflow-x-auto pb-1.5">
          {projects.map((p, i) => {
            const active = i === selected;
            return (
              <li key={p.name} className="flex-[0_0_72px]">
                <button
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={active}
                  aria-label={`${pad2(i + 1)} ${p.name}`}
                  className="flex w-full flex-col gap-[5px]"
                >
                  <MediaFrame
                    photo={p.screenshot}
                    sizes="72px"
                    fallback={pad2(i + 1)}
                    className={`aspect-square w-full outline-2 -outline-offset-2 ${
                      active ? "outline-accent" : "outline-border"
                    }`}
                  />
                  <span className={`h-[3px] w-full ${active ? "bg-accent" : "bg-border-strong"}`} />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-center gap-4 font-mono text-[12px] tracking-[0.14em] text-ink-muted">
          <button
            type="button"
            aria-label="Previous project"
            onClick={() => cycle(-1)}
            className="px-2.5 py-1 hover:text-ink"
          >
            ◂
          </button>
          <span className="text-ink">
            {no} / {total}
          </span>
          <button
            type="button"
            aria-label="Next project"
            onClick={() => cycle(1)}
            className="px-2.5 py-1 hover:text-ink"
          >
            ▸
          </button>
        </div>
      </nav>
    </main>
  );
}
