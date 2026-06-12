# Professional Grappling Animator — design & build plan

The heavy, per-joint authoring system for BJJ contact techniques. This is the one thing no
download gives you (mocap can't capture two entangled bodies — occlusion), so it must be
hand-authored — but to studio quality. This document scopes exactly how.

## 0. The core reframe — why this works when keyframing didn't

The gemma walk failed because it was **8 sparse poses + blind interpolation**. The computer
guessed every in-between frame with a straight blend → slide, pop, stiffness. No model typing
keyframes fixes that.

The professional answer is not "type more keyframes." It is: **give the system a constraint
solver, then author a few targets.** The solver produces correct dense motion:

- You don't keyframe the planted foot — a **foot-lock** constraint pins it; it physically cannot slide.
- You don't keyframe the choking hand chasing the neck — a **grip-lock** constraint binds it to the opponent's neck bone; it follows automatically when the opponent moves.
- You don't keyframe every in-between — **IK + per-joint curves** generate them correctly.

Quality comes from the solver in-betweening, not from hand-keys. This is how Cascadeur and
Blender work. It fixes slide, pop, penetration, and stiffness at the root. **The animator's job
becomes: place a few key targets + declare the constraints. The solver does the hard math.**

## 1. The gap list (each maps to a failure we saw or will hit)

| Missing capability | Failure it causes | Fixed by |
|---|---|---|
| Foot/base locking | feet slide / skate | IK foot-lock (§3) |
| Cross-skeleton contact binding | grips float; choke arm doesn't track the neck | grip-lock (§3) |
| Per-joint timing & curves | robotic lockstep motion | track model + offset/overlap (§5) |
| Breakdown poses | straight-line morph between keys | dense timeline (§5) |
| Collision / penetration | limbs pass through torsos | capsule push-out (§3) |
| Center-of-mass / base | weightless, impossible balance | COM + support polygon (§3) |
| Visual authoring (IK drag, onion-skin) | hand-typed numbers are unauthorable | the tool (§6) |
| Automated verification | "looks done" but slides/penetrates | gates + tests (§7) |

## 2. Data model (the foundation — build first)

```ts
// The rig: the canonical 17-joint skeleton, now carrying lengths + limits per bone.
interface Bone { name: JointId; length: number; limit: {x:[lo,hi]; y:[lo,hi]; z:[lo,hi]}; }

// FK base layer: a value PER JOINT PER TIME, as keyframe tracks (not one pose per step).
interface Track { joint: JointId; keys: { t:number; q:Quat; inTan:Tangent; outTan:Tangent }[]; }

// Constraints — the professional core. Each is active over a time range and overrides FK.
type Constraint =
  | { kind:'footLock'; foot:'L'|'R'; worldPoint:Vec3; from:number; to:number }
  | { kind:'gripLock'; actor:ActorId; hand:'L'|'R';
      targetActor:ActorId; targetBone:JointId; offset:Vec3; from:number; to:number }
  | { kind:'lookAt'; actor:ActorId; targetActor:ActorId; targetBone:JointId }
  | { kind:'poleVector'; chain:'armL'|'armR'|'legL'|'legR'; dir:Vec3 };

// A scene has TWO actors posed together; constraints can bind across them (gripLock).
interface Transition {            // one edge of the position graph (e.g. "turtle → back-control")
  from:PositionId; to:PositionId; duration:number;
  actors:{ A:{tracks:Track[]}; B:{tracks:Track[]} };
  constraints:Constraint[];       // foot-locks, grip-locks active over sub-ranges
}
```

The `Transition` is the unit of authored content. A `Technique` is a path of transitions on
the position graph. This unifies with the bjj-dojo position-graph design — the animator
produces the edges.

## 3. The solver stack (the heart) — runs every frame, in this fixed order

1. **FK** — evaluate each joint's track at time `t` (spline tangents → smooth value), apply.
2. **IK** — override specific chains after FK:
   - Two-bone analytic IK for each arm (shoulder→elbow→wrist) and leg (hip→knee→ankle) — fast, stable, exact.
   - **Foot-lock**: while a foot's `planted` range is active, solve its leg so the ankle stays at the locked world point. Root can move over it; foot cannot slide.
   - **Grip-lock**: solve the hand's arm so the wrist reaches `targetActor.targetBone.worldPos + offset`. When B's neck moves, A's choking hand follows. *The grappling-specific feature.*
   - Pole vectors keep elbows/knees pointing the anatomically correct way.
3. **Collision** — capsule-vs-capsule tests between limbs/torsos of both actors; soft push-out along the contact normal so bodies touch but don't interpenetrate. Iterate 2–3× for stability.
4. **Balance** — compute each actor's COM (segment-mass weighted); check it lies over the support polygon (planted feet/knees/hands); flag violations, optionally nudge the root.

**Override order per joint is fixed: FK → IK chain → collision push.** One owner resolves last
per joint per frame — no two systems fight over the same bone in the same frame (the jitter cause).

## 4. Per-body-part authoring spec (attention to each joint, as required)

| Region | Driven by | Constraints that apply | Verify | Common failure |
|---|---|---|---|---|
| Hips / pelvis (root) | FK track + balance | COM-over-base | root height = leg length; COM inside support | floating / sinking |
| Spine + chest | FK track (counter-rotates pelvis) | — | curve, not a hinge; counter-twist present | rigid plank torso |
| Neck + head | FK + lookAt | lookAt opponent | eyes track the action; level-ish | staring at the floor |
| Shoulder→elbow→wrist (each arm) | FK, overridden by IK when gripping | gripLock + poleVector | wrist ≤ tolerance from anchor; elbow points out | floating choke arm |
| Hands / fingers | FK micro-poses (curl on grip) | — | fist/grip closes on contact | open splayed hands |
| Hip→knee→ankle (each leg) | FK, overridden by IK when planted/hooking | footLock or gripLock(hook), poleVector | planted foot world-velocity ≈ 0; hook wraps | skating / straight-through legs |
| Feet | FK ankle + footLock | footLock | sole on mat when weight-bearing; heel-toe roll | tip-toe / sunken / sliding |

Each row is a checklist item the verifier (§7) enforces.

## 5. Timing & flow (the "professional flow" layer)

- **Per-joint curves**: every track key has editable in/out tangents → each joint eases on its own. Not one global ease for the whole body.
- **Offset / overlap (successive breaking of joints)**: hips lead, chest +2–4 frames, head/arms last — encoded as per-joint time offsets on the tracks. This single thing removes most robotic feel.
- **Breakdown poses**: between every two keys, author the breakdown that defines the *path* (the half-fallen frame of a takedown, the scramble mid-pass). Sparse keys are blocking only.
- **Moving holds**: held positions keep a 1–3% breathing/drift layer — never a frozen frame.
- **Contact = sharp, settle = soft**: impacts hit with no ease-out; pins settle slow. Per-key, not global.

## 6. The authoring tool (in-browser — because hand-typing per-joint is unauthorable)

A mini Cascadeur/Blender for grappling. **We already built half of this in v1** — reuse
`ik-handles.js` (IK drag handle on every joint) + `pose-editor.html` + `save-server.js`.

- Timeline with scrubber + per-joint curve lanes; add/move/delete keys.
- **IK drag handles** on every joint of both fighters (v1 asset) — drag a hand, the arm solves.
- **Grip-pin tool**: click a hand, then click a bone on the other fighter → creates a `gripLock`. Drag-free contact authoring.
- **Foot-plant toggle**: mark a foot planted over a time range → `footLock` auto-captures the world point.
- **Onion-skinning**: translucent ghosts of the prev/next frames so you author the path, not just the pose.
- **Multi-view** (front/side/top simultaneously) + **contact-distance HUD** (green when grips touch) + **penetration warning** (red glow when capsules overlap).
- **Export**: bake the solved motion to pose-data / an `AnimationClip` / GLB; write back via the save-server.

Authoring loop: rough-block 3–5 key poses → pin grips + plant feet (solver fills the rest correctly) →
add breakdowns where the path is wrong → tune per-joint curves → run the gates.

## 7. Verification gates (automated — a technique isn't done until green)

Each is a function over the baked motion; each also gets a regression test (global rule 5/6):

- **Contact**: every declared grip ≤ tolerance from its anchor, every frame it's active.
- **Penetration**: no capsule-capsule overlap beyond ε between actors or self.
- **Foot-slide**: planted foot world-velocity ≈ 0 across its planted range.
- **Balance**: COM inside the support polygon (or a deliberate off-balance moment is flagged, not silent).
- **Arcs**: extremity world-paths are curved, not zig-zag.
- **Silhouette**: each key readable from front + side (the Pose Lab grid).

## 8. Integration with the rest of the system

- **Locomotion, idles, falls, get-ups** = Mixamo mocap clips (`AnimationMixer`) — never hand-authored.
- **Grappling contact techniques** = authored with this tool.
- Both compose on the **position graph**: a transition edge is either `{type:'clip', url}` or `{type:'authored', transition}`. The player blends between them.
- Renders on the **Quaternius pro character** via the bone-map (`professional-assets.md`); the procedural capsule rig stays as the fast authoring proxy. The 17-joint pose data is the bridge — author on capsules, retarget to GLB.

## 9. Build phases (each ships a runnable demo + tests before the next)

| Phase | Deliverable | Kills |
|---|---|---|
| 0 | Data model: Bone/Track/Constraint/Transition schemas + FK track evaluator | foundation |
| 1 | Per-joint keyframe tracks + spline tangents + offset/overlap (replaces sparse poses) | lockstep robotic motion |
| 2 | Two-bone IK + **foot-lock** | foot sliding |
| 3 | **Grip-lock** (cross-skeleton contact) | floating grips / non-tracking choke |
| 4 | Capsule collision push-out | interpenetration |
| 5 | COM + support-polygon balance | weightless / impossible poses |
| 6 | Authoring UI (timeline, IK handles, grip-pin, onion-skin, multi-view, HUD, export) | unauthorable by hand |
| 7 | Verification gates + regression tests per solver feature | silent "looks done" |
| 8 | Position-graph integration + Mixamo locomotion + GLB render | isolated demo → real app |

First concrete chunk = **Phases 0–2** (data model + curve tracks + IK foot-lock). That alone
turns the stickman-that-slides into a figure whose planted foot stays put and whose joints
ease individually — a visible, verifiable jump in quality, and the foundation for grip-lock.

## 10. Honest scope & risks

- **Multi-week**, the most complex part of the whole project. Not a one-session build.
- **Risks**: grip-lock stability when both skeletons move (solve order/iteration); collision push-out oscillation (needs damping); the authoring UI is a real app, not a script.
- **Mitigations**: reuse v1's IK handles + save-server; build the solver one layer at a time with a test per layer; keep the capsule rig as the authoring proxy so iteration is fast; render final on GLB.
- **What we deliberately do NOT build**: a general 3D animation suite. Only the minimum solver that makes *grappling contact* correct. Everything generic is a Mixamo clip.
- **Where this lives**: it becomes the core of the `humanoid-fight-3d` skill's "authoring" half (the skill teaches the methodology + how to build/drive the tool); the tool itself ships in the bjj-dojo app.
