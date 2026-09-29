# Project skills

Third-party design skills, vendored so they are reviewed, pinned and visible in git
rather than installed globally. Each folder keeps its upstream licence.

| Skill | Source | Pinned at | Licence |
| --- | --- | --- | --- |
| emil-design-eng, animate, review-animations, improve-animations, find-animation-opportunities, animation-vocabulary, apple-design | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `d16ebe6` | MIT |
| impeccable | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `114ea1d` (v4.4.0) | Apache 2.0 |
| threejs-webgl, web3d-integration-patterns | [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills) | `1da73fe` | MIT |

## Deliberate omissions

- **Impeccable's `scripts/` folder is included.** Everything in it was reviewed: the browser
  scripts only talk to Impeccable's own local server on `localhost`, authenticated with a
  token. The launcher (`scripts/impeccable`) runs a prebuilt engine binary that is **not in
  this repo**: on first use it downloads the binary for your platform from
  github.com/pbakaus/impeccable/releases into `~/.impeccable/`, and refuses to run it unless it
  matches the published `.sha256` checksum. That checksum proves the download wasn't corrupted,
  not what the binary does, so the engine itself is trusted, not reviewed.
- **No hooks are installed.** Upstream wires the engine into hooks that run after every edit and
  at session end; that is opt-in here via `/impeccable hooks on`.
- **threejs-webgl dates from Nov 2025** and its examples target Three.js r160; this project
  uses r186. Check API details against the installed version.
- Emil Kowalski's Swift, Expo, mobile-native, Sonner, prototype and pick-ui-library skills
  are not relevant to this site and were not copied.

To update: re-clone the source, diff against the folder here, review, then copy.
