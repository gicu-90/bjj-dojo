// Phase 0–2 tests. Run: node animator/test/animator.test.mjs
// Pure node, no DOM. Each `check` is one feature/invariant; a failure throws and prints.

import { Quaternion, Vector3, Euler } from '../vendor/three.module.js';
import { RIG, BONE_LENGTH, clampToLimits, JOINTS } from '../src/rig.js';
import { Track, Clip, eulerToQuat, EASES } from '../src/track.js';
import { solveFK } from '../src/fk.js';
import { solveTwoBoneIK } from '../src/ik.js';
import { solveFrame } from '../src/solver.js';

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}  ${detail}`); }
}
const close = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;

// ---------- Phase 0: rig + FK ----------
check('rig has 17 joints', JOINTS.length === 17);
check('bone lengths computed', close(BONE_LENGTH.kneeL, 0.44) && close(BONE_LENGTH.ankleL, 0.42));
check('limits clamp elbow (hinge, x only, no positive bend)',
  clampToLimits('elbowL', [1.0, 0.5, 0.5])[0] === 0 && clampToLimits('elbowL', [-1.0, 0.5, 0.5])[0] === -1.0);

{
  // FK of a rest pose (all identity): ankle should hang straight below the hip.
  const root = new Vector3(0, 0.93, 0);
  const w = solveFK({}, root, new Quaternion());
  const hip = w.pos.hipL, ankle = w.pos.ankleL;
  check('FK: ankle hangs straight under hip at rest',
    close(ankle.x, hip.x) && close(ankle.z, hip.z) && close(hip.y - ankle.y, 0.44 + 0.42),
    `hip=${hip.toArray().map(n=>n.toFixed(2))} ankle=${ankle.toArray().map(n=>n.toFixed(2))}`);
}

// ---------- Phase 1: tracks ----------
{
  const tr = new Track('chest', [
    { t: 0, q: [0, 0, 0], ease: 'ease' },
    { t: 1, q: [0, Math.PI / 2, 0], ease: 'ease' },
  ]);
  const at0 = tr.evaluate(0), at1 = tr.evaluate(1), mid = tr.evaluate(0.5);
  const want1 = eulerToQuat([0, Math.PI / 2, 0]);
  check('track: endpoints exact', at0.angleTo(new Quaternion()) < 1e-4 && at1.angleTo(want1) < 1e-4);
  // eased midpoint is symmetric here (ease passes through 0.5 at t=0.5) but must lie between
  check('track: midpoint lies between the keys', mid.angleTo(at0) > 0.1 && mid.angleTo(at1) > 0.1);

  // Easing is non-linear: at t=0.25 'ease' has moved LESS than 'linear' would.
  const easeQ = new Track('a', [{ t: 0, q: [0,0,0], ease: 'ease' }, { t: 1, q: [0,0,Math.PI], ease: 'ease' }]).evaluate(0.25);
  const linQ  = new Track('a', [{ t: 0, q: [0,0,0], ease: 'linear' }, { t: 1, q: [0,0,Math.PI], ease: 'linear' }]).evaluate(0.25);
  check('track: ease slows the start (less rotation than linear at t=0.25)',
    easeQ.angleTo(new Quaternion()) < linQ.angleTo(new Quaternion()),
    `ease=${easeQ.angleTo(new Quaternion()).toFixed(3)} lin=${linQ.angleTo(new Quaternion()).toFixed(3)}`);

  // timeOffset makes a joint lag: sampling at t with offset 0.3 == sampling at t-0.3 with none.
  const lag = new Track('a', [{ t: 0, q: [0,0,0] }, { t: 1, q: [0,0,1] }], 0.3);
  const none = new Track('a', [{ t: 0, q: [0,0,0] }, { t: 1, q: [0,0,1] }]);
  check('track: timeOffset lags the joint', lag.evaluate(0.5).angleTo(none.evaluate(0.2)) < 1e-4);
}

// ---------- Phase 2: two-bone IK ----------
{
  const hip = new Vector3(0.095, 0.91, 0);
  const l1 = BONE_LENGTH.kneeL, l2 = BONE_LENGTH.ankleL;
  // Reachable target straight down, partially bent.
  const target = new Vector3(0.095, 0.91 - 0.7, 0.1);
  const { proximal, distal } = solveTwoBoneIK(hip, new Quaternion(), target, l1, l2);
  const w = solveFK({ hipL: proximal, kneeL: distal }, new Vector3(0, 0.93, 0), new Quaternion());
  check('IK: ankle reaches the target', w.pos.ankleL.distanceTo(target) < 2e-3,
    `ankle=${w.pos.ankleL.toArray().map(n=>n.toFixed(3))} target=${target.toArray().map(n=>n.toFixed(3))}`);

  // Knee actually bends for a target closer than full leg length.
  check('IK: knee bends when target is close', distal.angleTo(new Quaternion()) > 0.2);

  // Unreachable target gets clamped to max reach (no NaN, stays on the line, near full extent).
  const far = new Vector3(0.095, 0.91 - 5, 0);
  const r2 = solveTwoBoneIK(hip, new Quaternion(), far, l1, l2);
  const w2 = solveFK({ hipL: r2.proximal, kneeL: r2.distal }, new Vector3(0, 0.93, 0), new Quaternion());
  const reach = w2.pos.ankleL.distanceTo(hip);
  check('IK: unreachable target clamps to max reach (no NaN)',
    Number.isFinite(reach) && reach > (l1 + l2) - 0.02 && reach <= l1 + l2 + 1e-3,
    `reach=${reach.toFixed(3)} max=${(l1+l2).toFixed(3)}`);
}

// ---------- Phase 2: foot-lock no-slide invariant (the headline) ----------
{
  // A foot locked to a world point. Move the root sideways + up/down (a walk's bob/sway).
  // The ankle MUST stay glued to the locked point; without the lock it would move with the root.
  // Planted ankle ~0.08 above the floor (the foot mesh + ankle height puts the sole on the mat).
  // Kept within the 0.86 m leg reach across the whole bob/sway so the lock is physically solvable.
  const lockPoint = new Vector3(0.095, 0.08, 0.0);
  const clip = new Clip([], 1);                     // empty base pose (identity) — IK does the work
  const constraints = [{ kind: 'footLock', foot: 'ankleL', worldPoint: lockPoint }];

  const positions = [
    new Vector3(0.00, 0.905, 0.00),   // a walk's hip bob (±~1.5cm) + sway (±~5cm) + forward travel
    new Vector3(0.04, 0.895, 0.03),
    new Vector3(-0.03, 0.915, -0.02),
    new Vector3(0.05, 0.890, 0.05),
  ];
  let maxSlide = 0;
  for (const rp of positions) {
    const r = solveFrame(clip, 0, rp, new Quaternion(), constraints);
    maxSlide = Math.max(maxSlide, r.pos.ankleL.distanceTo(lockPoint));
  }
  check('foot-lock: planted foot stays glued as the root moves (no slide)', maxSlide < 2e-3,
    `max ankle drift = ${(maxSlide * 1000).toFixed(2)} mm`);

  // Control: WITHOUT the lock, the same root motion drags the ankle far from the point.
  let maxDriftNoLock = 0;
  for (const rp of positions) {
    const r = solveFrame(clip, 0, rp, new Quaternion(), []);
    maxDriftNoLock = Math.max(maxDriftNoLock, r.pos.ankleL.distanceTo(lockPoint));
  }
  check('control: without the lock the foot DOES move (proves the lock is doing the work)',
    maxDriftNoLock > 0.05, `drift without lock = ${(maxDriftNoLock * 1000).toFixed(0)} mm`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
