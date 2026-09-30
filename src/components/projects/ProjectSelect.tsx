"use client";

import { startTransition, useState, ViewTransition } from "react";

import { MediaFrame } from "@/components/ui/MediaFrame";
import type { Project } from "@/content/types";
import { useArrowCycle } from "@/lib/keys";
import { pad2 } from "@/lib/nav";
import { blip } from "@/lib/sound/sound";

const TABS = [
  { label: "INFO", title: "OVERVIEW", body: (p: Project) => p.overview },
  { label: "STACK", title: "STACK", body: (p: Project) => p.stack },
] as const;

const chip = "px-3 py-[7px]";
const link = "outline-1 -outline-offset-1 outline-border-strong transition-colors duration-150 hover:text-accent hover:outline-accent";

/** The active tab's fill and the roster bar glide to a new pick (see `.marker` in globals.css). */
function Highlight({ name, className }: { name: string; className: string }) {
  return (
    <ViewTransition name={name} share="marker" default="none">
      <span aria-hidden className={`absolute ${className}`} />
    </ViewTransition>
  );
}

/**
 * Invisible copies of every variant, stacked in one grid cell with the live text,
 * so the cell always takes the tallest variant's height and switching never
 * moves anything below it, whatever the window width.
 */
function Ghosts({ texts }: { texts: string[] }) {
  return texts.map((text, i) => (
    <span key={i} aria-hidden className="invisible [grid-area:1/1]">
      {text}
    </span>
  ));
}

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
    startTransition(() => {
      setSelected(i);
      setTab(0);
    });
  };
  const cycle = (step: number) => pick((selected + step + projects.length) % projects.length);
  useArrowCycle(cycle);

  return (
    <main className="flex flex-1 flex-col">
      <h1 className="sr-only">Projects</h1>
      <div className="mx-auto grid w-full max-w-[1280px] flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-center gap-grid px-gutter pt-[clamp(12px,min(3vw,3dvh),44px)]">
        {/* Capped by window height so the page fits without scrolling on laptop screens. */}
        <div className="flex w-full max-w-[max(240px,calc((100dvh-380px)*16/10))] min-w-0 flex-col gap-2.5 justify-self-center">
          <p className="font-mono text-[11px] tracking-[0.16em] text-ink-muted">
            PROJECT {no} / {total}
          </p>
          {/* Keyed on the project so each pick replays the reveal, like a character select. */}
          <div key={selected} className="animate-wipe">
            <MediaFrame
              photo={project.screenshot}
              sizes="(min-width: 1280px) 600px, (min-width: 700px) 50vw, 100vw"
              className="chamfer-x aspect-[16/10]"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3.5">
          <div className="grid font-display text-project-name font-normal">
            <Ghosts texts={projects.map((p) => p.name)} />
            <h2 key={`name-${selected}`} className="animate-enter [grid-area:1/1] font-normal text-title">
              {project.name}
            </h2>
          </div>

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
                  startTransition(() => setTab(i));
                }}
                className={`relative flex-1 bg-panel-raised px-2 py-2.5 text-center transition-colors duration-150 ${
                  i === tab ? "text-bg" : "text-ink"
                }`}
              >
                {i === tab && <Highlight name="project-tab" className="inset-0 bg-accent" />}
                <span className="relative">{t.label}</span>
              </button>
            ))}
          </div>

          <div
            id="project-detail"
            aria-live="polite"
            className="flex flex-col gap-2 border-l-2 border-accent bg-panel-glass px-5 py-4"
          >
            {/* Every tab shares one title height, so only the body needs reserving. */}
            <div className="grid font-display text-[22px] leading-none tracking-[0.08em]">
              <Ghosts texts={TABS.map((t) => t.title)} />
              {/* The live region itself must persist for announcements; only its content remounts. */}
              <h3 key={`title-${selected}-${tab}`} className="animate-swap [grid-area:1/1] font-normal">
                {activeTab.title}
              </h3>
            </div>
            <div className="grid text-[16px] leading-[1.5] text-pretty">
              <Ghosts texts={projects.flatMap((p) => TABS.map((t) => t.body(p)))} />
              <p key={`body-${selected}-${tab}`} className="animate-swap [grid-area:1/1] text-ink-dim">
                {activeTab.body(project)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 font-mono text-[11px] font-medium tracking-[0.12em]">
            {project.url && (
              <a href={project.url} target="_blank" rel="noreferrer" className={`${chip} ${link}`}>
                VISIT ↗
              </a>
            )}
            {project.repo && (
              <a href={project.repo} target="_blank" rel="noreferrer" className={`${chip} ${link}`}>
                SOURCE ↗
              </a>
            )}
          </div>
        </div>
      </div>

      <nav
        aria-label="Project roster"
        className="mx-auto flex w-full max-w-[1280px] flex-col gap-2.5 px-gutter pt-[clamp(8px,min(2vw,2dvh),24px)] pb-[clamp(12px,min(3vw,3dvh),32px)]"
      >
        <div className="h-px bg-[linear-gradient(90deg,transparent,#2e2b38_20%,#2e2b38_80%,transparent)]" />
        {/* safe-center keeps the first thumbnail reachable when the row overflows. */}
        <ul className="flex justify-center-safe gap-2 overflow-x-auto pb-1.5">
          {projects.map((p, i) => {
            const active = i === selected;
            return (
              <li key={p.name} className="flex-[0_0_60px]">
                <button
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={active}
                  aria-label={`${pad2(i + 1)} ${p.name}`}
                  className="group flex w-full flex-col gap-[5px]"
                >
                  <MediaFrame
                    photo={p.screenshot}
                    sizes="60px"
                    fallback={pad2(i + 1)}
                    zoom
                    className={`aspect-square w-full outline-2 -outline-offset-2 ${
                      active ? "outline-accent" : "outline-border"
                    }`}
                  />
                  <span className="relative h-[3px] w-full bg-border-strong">
                    {active && <Highlight name="roster-bar" className="inset-0 bg-accent" />}
                  </span>
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
