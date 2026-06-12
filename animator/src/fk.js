// Phase 0/1 — forward kinematics.
// Given local rotations per joint + a root world transform, compute each joint's WORLD
// position and rotation by walking the hierarchy. Pure; no rendering. The output world
// positions are what IK and the verification gates measure (e.g. "is the ankle where it
// should be", "did the planted foot move").

import { Quaternion, Vector3 } from '../vendor/three.module.js';
import { JOINTS, RIG } from './rig.js';

const _v = new Vector3();

// localRots: { jointName: Quaternion } (missing joints default to identity).
// rootPos/rootQuat: the world transform of the root.
// Returns { pos: {joint: Vector3}, quat: {joint: Quaternion} } in WORLD space.
export function solveFK(localRots, rootPos, rootQuat) {
  const pos = {};
  const quat = {};

  for (const joint of JOINTS) {
    const def = RIG[joint];
    const local = localRots[joint] || new Quaternion();

    if (def.parent === null) {
      pos[joint] = new Vector3().copy(rootPos);
      quat[joint] = new Quaternion().copy(rootQuat).multiply(local);
      continue;
    }

    const pQuat = quat[def.parent];
    const pPos = pos[def.parent];
    // world pos = parentPos + parentQuat * offset
    _v.set(def.offset[0], def.offset[1], def.offset[2]).applyQuaternion(pQuat);
    pos[joint] = new Vector3().copy(pPos).add(_v);
    // world rot = parentQuat * localRot
    quat[joint] = new Quaternion().copy(pQuat).multiply(local);
  }

  return { pos, quat };
}
