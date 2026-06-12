// Phase 0–2 — the per-frame solve pipeline.
// Order (fixed, one owner resolves last per joint): FK base pose → IK constraints (foot-lock).
// Later phases insert grip-lock (3), collision (4), balance (5) between these stages.

import { Quaternion, Vector3 } from '../vendor/three.module.js';
import { RIG, BONE_LENGTH } from './rig.js';
import { solveFK } from './fk.js';

// Map an ankle/wrist joint to its two-bone chain (proximal=hip/shoulder, distal=knee/elbow).
const LEG_CHAINS = {
  ankleL: { end: 'ankleL', distal: 'kneeL', proximal: 'hipL' },
  ankleR: { end: 'ankleR', distal: 'kneeR', proximal: 'hipR' },
  wristL: { end: 'wristL', distal: 'elbowL', proximal: 'shoulderL' },
  wristR: { end: 'wristR', distal: 'elbowR', proximal: 'shoulderR' },
};

// Solve one frame.
//   clip       : Clip (per-joint tracks) — the authored base motion
//   time       : seconds
//   rootPos/rootQuat : world transform of the root at this time (Vector3 / Quaternion)
//   constraints: [{ kind:'footLock', foot:'ankleL'|'ankleR', worldPoint:Vector3, pole? }]
// Returns the world transforms { pos, quat } after FK + constraints, plus the final localRots.
import { solveTwoBoneIK } from './ik.js';

export function solveFrame(clip, time, rootPos, rootQuat, constraints = []) {
  const localRots = {};
  clip.evaluate(time, localRots);

  // Pass 1: base FK so we know where each chain's anchor (hip/shoulder) sits in the world.
  let world = solveFK(localRots, rootPos, rootQuat);

  // Pass 2: apply IK constraints, overriding the chain's proximal/distal local rotations.
  let dirty = false;
  for (const c of constraints) {
    if (c.kind !== 'footLock') continue;
    const chain = LEG_CHAINS[c.foot];
    if (!chain) continue;

    const anchorPos = world.pos[chain.proximal];
    const anchorParentQ = world.quat[RIG[chain.proximal].parent];
    const l1 = BONE_LENGTH[chain.distal];   // proximal→distal (thigh)
    const l2 = BONE_LENGTH[chain.end];      // distal→end (shin)
    const pole = c.pole ? new Vector3().fromArray(c.pole) : new Vector3(0, 0, 1);

    const { proximal, distal } = solveTwoBoneIK(anchorPos, anchorParentQ, c.worldPoint, l1, l2, pole);
    localRots[chain.proximal] = proximal;
    localRots[chain.distal] = distal;
    dirty = true;
  }

  // Pass 3: re-run FK with the IK overrides folded in, so the returned world transforms
  // (and the planted-foot check) reflect the final solved pose.
  if (dirty) world = solveFK(localRots, rootPos, rootQuat);

  return { ...world, localRots };
}
