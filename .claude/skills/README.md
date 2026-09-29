# Project skills

Third-party design skills, vendored so they are reviewed, pinned and visible in git
rather than installed globally. Each folder keeps its upstream licence.

| Skill | Source | Pinned at | Licence |
| --- | --- | --- | --- |
| emil-design-eng, animate, review-animations, improve-animations, find-animation-opportunities, animation-vocabulary, apple-design | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `d16ebe6` | MIT |
| impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `114ea1d` (v4.4.0) | Apache 2.0 |
| threejs-webgl, web3d-integration-patterns | [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills) | `1da73fe` | MIT |

## Deliberate omissions

- **Impeccable's `scripts/` folder is left out.** Its launcher downloads and runs a prebuilt
  binary from the project's GitHub releases, and the upstream repo's settings wire that binary
  into hooks on every edit and at session end. Without `scripts/`, the skill uses its own
  documented fallback: it reads the project's context directly, so critique, audit and polish
  still work, but the automatic detector rules and live-browser mode do not. To opt in, copy
  `scripts/` from the pinned commit after reviewing it. No hooks are installed either way.
- **threejs-webgl dates from Nov 2025** and its examples target Three.js r160; this project
  uses r186. Check API details against the installed version.
- Emil Kowalski's Swift, Expo, mobile-native, Sonner, prototype and pick-ui-library skills
  are not relevant to this site and were not copied.

To update: re-clone the source, diff against the folder here, review, then copy.
