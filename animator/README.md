# Grappling Animator — Phases 0–2 (foundation)

The constraint-solver core of the professional grappling animator (see
[../docs/PRO-GRAPPLING-ANIMATOR-PLAN.md](../docs/PRO-GRAPPLING-ANIMATOR-PLAN.md)). The principle:
**author a few targets, let a solver produce correct dense motion** — not hand-keyed frames.

## What's built (executed-level verified)

- **Phase 0 — data model + FK** ([src/rig.js](src/rig.js), [src/fk.js](src/fk.js)): the canonical
  17-joint skeleton (hierarchy, bone lengths, per-joint limits) and a forward-kinematics evaluator
  that turns local rotations + a root transform into world joint positions.
- **Phase 1 — per-joint keyframe tracks** ([src/track.js](src/track.js)): each joint has its own
  keyframes with its own easing (`ease`/`linear`/`sharp`/`soft`) and a `timeOffset` so joints can
  lead or lag (the offset/overlap that removes robotic lockstep motion). `Clip` evaluates all tracks.
- **Phase 2 — two-bone IK + foot-lock** ([src/ik.js](src/ik.js), [src/solver.js](src/solver.js)):
  analytic two-bone IK; a `footLock` constraint pins an ankle to a world point so it **cannot slide**
  while the root moves over it. The per-frame pipeline is FK → IK (fixed order, one owner per joint).

## Verify it yourself

```
node test/animator.test.mjs        # 13/13: FK, track easing/offset, IK reach+clamp, foot-lock no-slide
node serve.mjs                     # then open http://localhost:8078/demo.html
```

The demo sways the hips like a walk; the amber foot stays glued to its marker (HUD shows the live
ankle→point distance — 0.0 mm with the lock on). Uncheck "Foot-lock ON" to watch it slide, which is
exactly the failure this kills.

## The headline test (regression guard)

`foot-lock: planted foot stays glued as the root moves` — moves the root through a walk's bob/sway
and asserts the ankle drifts < 2 mm, with a control proving it moves > 50 mm without the lock. This
is the "no foot sliding" guarantee, locked in so it can't silently regress.

## Next phases (not yet built)

3 grip-lock (cross-skeleton contact) · 4 collision push-out · 5 balance/COM · 6 authoring UI ·
7 gates+tests · 8 position-graph + GLB integration.
