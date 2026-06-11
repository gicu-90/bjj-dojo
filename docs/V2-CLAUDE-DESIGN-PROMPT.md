# BJJ Dojo v2 — master prompt for Claude Design

Paste everything below the line into Claude Design.

---

Build **BJJ Dojo** — an interactive 3D web app that teaches Brazilian Jiu-Jitsu the way nobody teaches it: philosophy and big picture first, then positions, then techniques, with the whole art visible as an explorable map. There is no app like this; existing fight games are arcade MMA, not learning tools. This app's job is to open a beginner's horizons: make them *understand* BJJ before they memorize moves.

## 1. The product in one paragraph

A single-page 3D experience with two stylized fighters on a dojo mat. The user can (a) follow a guided curriculum that starts with BJJ's core philosophy, (b) play any technique step-by-step in 3D with coaching nuances at every step, (c) click any position or any body part and *see* — Doctor Strange style — ghosted previews of every possible future branching out from there and pick a path, (d) spar against an adaptive AI opponent in a turn-based decision duel on the same map, and (e) open a separate, clearly-labeled **Live Coach** mode that uses the phone camera + on-device pose detection to watch the user drill solo movements and coach them with a voice.

## 2. Audience and tone

- Absolute beginners and early white belts. No prior knowledge assumed. Define every term on first use (a tap-able glossary chip, never a wall of text).
- Friendly professor tone — calm, precise, encouraging. Short sentences. Every screen should answer "what am I looking at, why does it matter".
- Mobile-first (phone portrait is the primary layout), but fully usable on desktop. Dark dojo aesthetic: near-black background, mat circle, You = cool blue fighter, Opponent = warm red fighter, one amber accent color. Typography: a geometric sans for UI + a mono for data labels. Premium, minimal, zero clutter.

## 3. The pedagogy — this is the heart, build it first

### 3.1 The Three-Step Game (the app's opening lesson and permanent spine)
BJJ at the highest level is just three steps. Show this as an animated 3-node diagram the very first time the user enters, and keep it as a persistent mini-map / progress spine everywhere:

1. **TAKEDOWN** — get the fight to the ground (or pull guard deliberately).
2. **CONTROL** — pass their defenses and climb the ladder of dominant positions.
3. **SUBMIT** — finish with a choke or a joint lock.

Every technique in the app is color-tagged by which of the three steps it serves. The user must always be able to answer "where in the 3-step game am I?"

### 3.2 The Positional Hierarchy (the ladder)
Teach that positions are ranked by control, and the whole "control" phase is climbing this ladder while the opponent tries to descend it. Render it as a vertical ladder with the sport-points annotation:

worst → best for YOU when opponent has it / you have it:
- Back taken on you ←→ **Back control** (4 pts)
- Mounted ←→ **Mount** (4 pts)
- Knee on belly under ←→ **Knee on belly** (2 pts)
- Side control under ←→ **Side control** (3 pts for the pass)
- Half guard bottom ←→ **Half guard top**
- **Guard** (closed/open) — the neutral, uniquely-BJJ position where the bottom player can attack
- Standing — neutral

### 3.3 The Principles (the ideology) — a dedicated, beautiful section
Each principle is one card: name, one-line essence, a 3D micro-demo (the two fighters acting it out in a 3–5 s loop), and one "you'll feel this when…" line. Minimum set:

1. **Position before submission** — control first; a submission attempted without control loses both.
2. **Leverage beats strength** — your whole body against their one limb; technique multiplies force.
3. **Base** — a stable triangle of support; lose your base, lose the exchange.
4. **Frames and levers** — bones, not muscles, hold people away.
5. **Grips win exchanges** — whoever controls the grips controls the pace.
6. **Pressure and weight** — make your 80 kg feel like 200 by where you put it.
7. **Angles** — attacks succeed off-line, not head-on.
8. **Hip movement (shrimping/bridging)** — escapes are made with the hips, not the arms.
9. **Posture and distance** — inside someone's guard, posture is survival.
10. **Breathe and stay calm** — panic burns the gas tank; survival is a skill.
11. **The tap is sacred** — tapping is learning, not losing. Include the safety/limits lesson here: what joint locks and chokes actually do, why you tap early, training etiquette, injury honesty. This is the "limits" content and it is non-skippable in the curriculum.

### 3.4 Curriculum (Journey mode)
A linear belt-themed journey stitched from the above: White Belt Chapter 1 "The Three Steps" → 2 "The Ladder" → 3 "The Principles" → 4 "Your First Takedown" (double leg) → 5 "Your First Control" (side control + mount basics) → 6 "Your First Submission" (RNC) → 7 "The Guard" → 8 "Escapes" → graduation spar. Each chapter = short concept screen(s) + one interactive 3D lesson + a 3-question check ("which position is higher value?") + a sparring micro-challenge. Track progress (% per chapter, streak) in localStorage.

## 4. The knowledge model — POSITION GRAPH (build the data layer exactly like this)

Everything in the app is driven by one typed dataset: **positions are nodes, techniques are edges**.

```ts
type PositionId = 'standing' | 'clinch' | 'guard-closed' | 'guard-open' | 'half-guard-top' | 'half-guard-bottom' | 'side-control-top' | 'side-control-bottom' | 'knee-on-belly-top' | 'mount-top' | 'mount-bottom' | 'back-control' | 'back-taken' | 'turtle-top' | 'turtle-bottom' | 'submitted';

interface Position {
  id: PositionId;
  name: string;            // "Closed Guard (bottom)"
  phase: 1 | 2 | 3;        // which of the Three Steps it belongs to
  controlScore: number;    // -5..+5 from YOUR perspective, drives ladder rendering
  points: number | null;   // sport points awarded when you arrive here
  essence: string;         // one sentence: what this position IS
  yourGoals: string[];     // max 3
  dangers: string[];       // max 3, each names the opponent's best attack
  pose: ScenePose;         // full 3D pose of BOTH fighters for this position
}

interface Technique {
  id: string;
  name: string;            // "Double Leg Takedown"
  from: PositionId;
  to: PositionId;          // success outcome
  failTo?: PositionId;     // common failure outcome (teach risk!)
  type: 'takedown' | 'pass' | 'sweep' | 'escape' | 'transition' | 'submission';
  attacksJoint?: ('neck'|'shoulderL'|'shoulderR'|'elbowL'|'elbowR'|'wristL'|'wristR'|'hipL'|'hipR'|'kneeL'|'kneeR'|'ankleL'|'ankleR')[];
  usesGrips: string[];     // e.g. ["collar", "behind both knees"]
  difficulty: 1|2|3;
  principleIds: string[];  // which Principles this move embodies — cross-link them
  steps: Step[];
}

interface Step {
  caption: string;         // imperative, ≤ 12 words: "Drop your hips by bending the knees."
  nuance: string;          // the detail nobody tells you: "Back straight — drop with legs, not waist."
  commonMistake: string;   // "Bending at the waist = guillotine bait."
  pose: ScenePose;         // keyframe for both fighters
  focusJoints: string[];   // joints to highlight/glow during this step
  cameraHint?: 'front'|'side'|'top'|'closeup-grip'|'closeup-hips';
}
```

`ScenePose` = per-fighter root position/rotation + per-joint quaternion (or Euler) over the shared rig (section 5). All poses are authored data in the artifact — no external binary files.

### Starter content (ship all of these, fully step-authored, 4–7 steps each):
- Takedowns: **Double Leg**, **Single Leg**, **O-Goshi hip throw**, **Guard Pull** (teach it as a legitimate phase-1 choice).
- Control/passes: **Knee Slice pass** (closed→side), **Side Control maintenance**, **Mount climb** (side→mount), **Back take from turtle**.
- Sweeps/escapes: **Hip Bump sweep**, **Upa mount escape**, **Elbow-knee mount escape**, **Shrimp to guard recovery** (side-bottom→guard).
- Submissions: **Rear Naked Choke**, **Cross Collar Choke**, **Guillotine**, **Armbar from guard**, **Armbar from mount**, **Triangle**, **Kimura**, **Americana**.

That's ~20 edges over ~16 nodes — enough for the map to feel alive.

## 5. The 3D layer

- **Three.js** (or react-three-fiber). 60 fps target on a mid phone; keep total scene < 50k triangles; no postprocessing except soft shadows and a subtle rim light.
- **Two procedurally-built stylized humanoids** (NOT blocky cubes — smooth capsule/rounded-box limbs with proper proportions, simple mitten hands with a visible thumb so grips read, a neck, a head with a face-direction cue). Build one `createFighter(color)` factory; rig = root + spine, chest, neck, head, shoulderL/R, elbowL/R, wristL/R, hipL/R, kneeL/R, ankleL/R (17 nodes). Joint transforms drive limb meshes — this IS the animation system.
- **Pose tweening**: slerp between step keyframes with ease-in-out, 0.6–1.2 s per step; scrub bar under the step panel; 0.5×/1×/1.5× speed; loop-this-step toggle.
- Mat: dark circular tatami with a faint ring; soft spotlight; ground-contact shadows (cheap blob shadows are fine).
- **Camera presets** per step (front/side/top/close-up) with smooth dolly; user can always orbit/zoom freely; one-tap "reset camera".
- **Joint highlighting system**: any joint can glow (pulsing emissive ring) — used by steps' `focusJoints`, by the body-part explorer, and by the coach.
- Author all starter poses with care: fighters must visibly CONNECT (hands on collar = hand touching collar). Build an internal dev-only pose editor route (per-joint sliders + copy-JSON button) so poses can be refined fast — this tool is how content gets authored, treat it as a first-class feature, but hide it behind a long-press on the logo.

## 6. The five screens

Bottom tab bar (mobile) / left rail (desktop): **Journey · Map · Techniques · Spar · Coach**. Coach is visually separated (divider + camera icon + different accent) so the "game" and the "camera trainer" read as two clearly distinct halves of one app, per the product vision.

### 6.1 Journey — the curriculum of section 3.4. Default landing screen for new users.

### 6.2 Map — the Doctor Strange screen (the signature feature)
- Full-screen force-directed (or hand-laid radial) graph of the position graph, ladder-ordered vertically by `controlScore`. Nodes = position thumbnails (tiny live 3D or pre-posed snapshots). Edges = colored by technique type; submissions converge into a skull-ringed `submitted` node.
- Tap a node → the 3D stage (top half) poses both fighters in that position; bottom sheet shows essence/goals/dangers; **all outgoing edges fan out as glowing arcs**.
- **Future-ghosting**: tapping an edge (or "preview all") plays translucent ghost fighters performing the first second of that technique from the current pose, then snapping back — multiple futures shimmer from the present, the user picks a path. Chain navigation: standing → double leg → side → mount → RNC as a continuous guided flow, breadcrumbs showing the path taken through the 3-step game.
- **Body-part mode** (toggle inside Map): the camera moves close, the opponent's joints become tappable. Tap their neck → every edge from the current position that `attacksJoint: neck` lights up with ghost previews ("from here, their neck gives you: guillotine, cross collar"). Tap their elbow → armbar/kimura/americana paths. Tap YOUR OWN joints → defensive view: what they can attack, what to protect. This must be visual-first: ghosts and glowing paths, never just a text list.

### 6.3 Techniques — the library
Searchable, filterable (phase, type, difficulty, position, joint). Each technique opens the **Step Player**: 3D stage + step card (caption, nuance, common-mistake collapsible) + prev/next + scrub + the from→to chip ("Closed Guard → Mount") + "see it on the Map" link + linked Principles chips. Completing all steps marks it learned (✓, persists).

### 6.4 Spar — the adaptive duel
Turn-based decision sparring ON the position graph (not physics):
- The 3D fighters hold the current position. Each turn you pick from 2–4 action cards (legit techniques/edges from the current node, including "hold position / recover grips"). The AI opponent picks simultaneously; resolution = weighted dice biased by technique difficulty, your demonstrated knowledge (learned techniques succeed more), and a counter table (some actions beat others — e.g. their guillotine punishes your sloppy double leg if you didn't learn the level-change lesson).
- The result plays out as a 3D transition to the new node. Win by reaching `submitted` on them; survive/escape goals for asymmetric drills ("start mounted, escape in 5 turns").
- **Adaptive difficulty**: track a hidden Elo-ish skill score; the AI's pick quality and counter sharpness scale with it; if the user loses 3 in a row the AI starts choosing teachable mistakes and the speed slows; if they win easily it tightens. After every spar: a 3-line debrief ("You jumped to submission from half guard — position before submission; pass first.") linking the violated principle.
- Score sport-points live (2 takedown, 3 pass, 4 mount/back) so the point system is learned by playing.

### 6.5 Coach — the camera half (clearly separated)
A real, working v1 inside this artifact:
- Webcam/phone camera + **MediaPipe Pose Landmarker (tasks-vision, via CDN, GPU delegate)** running on-device in the browser, 33 landmarks, drawn as a skeleton overlay.
- **Center-of-gravity computation**: weighted average of landmarks using body-segment mass fractions (trunk ≈ 50%, thighs 2×10%, shanks+feet 2×6%, upper arms 2×3%, forearms+hands 2×2.5%, head 8%); render CoG as an amber dot + vertical plumb line + the support polygon between the feet; green when CoG is inside the polygon, red when outside.
- **Solo drill programs** (start with three): (1) *Stance & level change* — checks knee bend depth, back angle (shoulder-hip-knee), hands at chin height; (2) *Shrimp* (lying hip escape) — checks side-lying, hip elevation rhythm; (3) *Bridge (upa)* — checks hip height vs shoulder line, feet placement. Each drill = a target-pose state machine over landmark geometry with tolerance bands and rep counting.
- **Voice coaching** via Web Speech API (speechSynthesis): short imperative cues max every ~4 s ("Lower your hips", "Hands up", "Good — 5 more"), with a mute toggle and on-screen captions mirroring every cue.
- Architecture note to honor in the code structure: keep `PoseSource` (camera+model) and `CoachBrain` (analysis+cues) as cleanly separated modules communicating only via a landmark-frame interface, because the production roadmap sends those landmark frames over WebSocket to a remote server brain (LLM-assisted analysis, partner-mode multi-person models server-side); the in-artifact version runs the brain locally but the seam must already exist. Show a small "Analysis: on-device (server mode coming)" status chip.
- Privacy line on the Coach landing: video never leaves the device; only stick-figure joint data would be sent in server mode.

## 7. Quality bar / build order

1. Data layer (position graph + all starter content with real, carefully-authored poses) → 2. 3D stage + step player → 3. Map with ghost-futures + body-part mode → 4. Journey → 5. Spar → 6. Coach.
- Pose quality is THE quality metric: fighters must actually touch where grips are described; no floating limbs, no interpenetrating torsos. Verify every technique's steps from front AND side camera before calling it done.
- Everything data-driven; adding technique #21 must mean adding one object literal, zero new UI code.
- Smooth on phones: cap pixel ratio, pause rendering on hidden tabs, lazy-init the Coach (camera/model only load when entering it).
- Persist all progress (journey, learned techniques, spar Elo, drill reps) in localStorage under one versioned key.
- Empty/error states everywhere (camera denied, model loading, WebGL unavailable).
- No lorem ipsum anywhere — all BJJ content real and correct; when unsure of a detail, prefer the universally-taught fundamental version of a technique.

Start by building the complete data layer and the 3D fighters, show me the standing position with both fighters in a correct fight stance, then proceed screen by screen in the build order above.
