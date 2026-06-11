# BJJ Dojo v1 — deep-dive findings (2026-06-11)

Where v1 lives: `gicu-90/bjj-dojo` (public GitHub repo, last push 2026-05-19), built on the Mac.
Cloned locally to `C:\Users\gicub\bjj-dojo`.

## What v1 is
A single-page vanilla-JS + Three.js web app, no build system:

- **Two low-poly blocky mannequins** (You = blue, Opponent = red) on a dojo mat,
  orbit/zoom camera ([mannequin.js](../mannequin.js), [scene.js](../scene.js)).
- **10 moves** defined data-first in [moves.js](../moves.js) (55KB):
  doubleLeg, singleLeg, hipThrow, guillotine, rnc, armbarGuard, triangle, kimura,
  mountUpa, americana. Each move = `{id, name, category, difficulty, target[],
  icon, summary, steps[]}`; each step = `{caption, hint, attacker: pose, opponent: pose}`.
- **Pose format**: per-joint Euler `[x,y,z]` in figure-local frame over a 16-joint rig
  (spine, chest, neck, head, shoulder/elbow/wrist L+R, hip/knee/ankle L+R) +
  `rootPos`/`rootRot` presets (FACE_POS_X, ON_BACK_HEAD_NEG_X, …). Steps tween between poses.
- **Proto "Dr Strange" feature already existed**: every move declares `target` body parts;
  clicking a body part on the red figure opens a menu of moves that attack that part
  (ui.js `pulseTarget`, `#moveMenu`).
- **Progress + settings** in localStorage (learned set, speed, colors, autoplay).
- **A whole authoring toolchain**: pose-editor.html with per-joint sliders, IK drag handles
  on every joint ([ik-handles.js](../ik-handles.js)), screen-plane drag + floor/grip snapping,
  edit mode inside the app, auto-save to disk via a local node [save-server.js](../save-server.js).
- **FBX path explored**: character.fbx (3.7MB rigged char) + Mixamo-style
  "Double Leg Takedown - Attacker/Victim" FBX pairs with step-beat timestamps
  (`animations` block on doubleLeg) — only one move ever got real animations.
- **Hundreds of iteration screenshots** (iter/, pt/, v3/, verify/) — poses were
  authored by screenshot-iterating joint angles.

## What worked (keep in v2)
1. **Data-driven move library** with captions + per-step coaching hints — right architecture.
2. **Click-a-body-part → what attacks it** — the seed of the Dr Strange feature, validated.
3. **The pose editor with IK handles + save server** — the most valuable tool in the repo;
   authoring content is the real bottleneck, the editor is how Claude can author moves.
4. Step beats mapped onto continuous FBX animation clips (`stepTimes`) — good hybrid:
   discrete teaching steps over smooth motion.
5. Documented pose conventions ([notes/lessons.md](../notes/lessons.md)) — coordinate
   conventions, verified fight-stance recipe, screenshot-verification workflow.

## What failed / was missing (fix in v2)
1. **Hand-authoring Euler poses is brutally slow** — double-leg refinement got 1 of 7 steps
   done (lessons.md checklist). v2 must lead with retargetable animation clips +
   editor-assisted keyframes, not raw numbers.
2. **No knowledge model** — moves were a flat list with categories; no positions,
   no transitions, no "where am I, where can I go". v2's core must be a
   **position graph: positions = nodes, techniques = edges**.
3. **Zero pedagogy layer** — no philosophy, no 3-step macro-game (takedown → control →
   submit), no positional hierarchy, no principles. This was the original point of the app.
4. **No sparring**, no adaptive opponent.
5. **No camera coach** (was noted in Keep: "posibil sa transform in AI coach live pe camera").
6. Blocky mannequins read as toys; fine for silhouettes but joints/grips are illegible —
   v2 wants smooth stylized humanoids with visible hands.

## Research links (user-provided + verified)
- ACM MMSports'22: *Video-Based Detection of Combat Positions and Automatic Scoring in
  Jiu-jitsu* — https://dl.acm.org/doi/10.1145/3552437.3555707 (pose keypoints → grappling
  position classification → scoring). Template for the coach's position-awareness.
- r/bjj pose-estimation thread (user link) + open repo:
  https://github.com/talhaahussain/grappling-pose-identification (2-athlete pose → position ML).
- Known hard problem: two-body entanglement occlusion; single-person on-device models
  (MediaPipe BlazePose 33-landmark) work for solo drilling; two-person live rolling needs
  server-side multi-person models (RTMPose/MMPose/YOLO-pose) and stays "best effort".

## v2 architecture decision (for the record)
- Phase A (Claude Design): the 3D academy/game as a self-contained web app — procedural
  stylized humanoids + shared rig + data-driven position graph (no binary assets in artifact).
- Phase B (local): asset pipeline (Mixamo/Quaternius GLB + Claude-authored poses via the
  editor) + backend (accounts, progress, LLM analysis) on the Windows box.
- Coach: **on-device MediaPipe landmarks → WebSocket → server analysis → TTS voice back**
  (keypoints are KB/s — survives the slow uplink; raw-video-to-server kept as fallback mode).
