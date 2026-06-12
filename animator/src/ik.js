// Phase 2 — two-bone analytic inverse kinematics + foot-lock.
// Given a chain root (e.g. the hip) and a desired world target for the end (the ankle), solve
// the two intermediate rotations so the end lands exactly on the target. This is what lets a
// FEW authored targets produce correct motion: the planted-foot target never moves, so the
// solver keeps the ankle nailed there while the body's root translates over it — no sliding.

import { Quaternion, Vector3 } from '../vendor/three.module.js';

const REST_DOWN = new Vector3(0, -1, 0); // bones rest pointing down -Y in their local frame
const _ab = new Vector3();
const _dir = new Vector3();
const _perp = new Vector3();
const _knee = new Vector3();
const _tmp = new Vector3();

// Solve a two-bone chain.
//   anchorPos      : world position of the chain root (hip/shoulder)
//   anchorParentQ  : world quaternion of the chain root's PARENT (to convert to local)
//   target         : desired world position of the chain end (ankle/wrist)
//   l1, l2         : bone lengths (thigh, shin)
//   pole           : world-space hint for which way the mid-joint (knee) points
// Returns { proximal, distal } local quaternions to assign to (hip, knee).
export function solveTwoBoneIK(anchorPos, anchorParentQ, target, l1, l2, pole = new Vector3(0, 0, 1)) {
  _ab.copy(target).sub(anchorPos);
  let d = _ab.length();
  const min = Math.abs(l1 - l2) + 1e-4;
  const max = l1 + l2 - 1e-4;
  d = Math.min(max, Math.max(min, d));
  _dir.copy(_ab).normalize();

  // Knee placement: distance along the anchor→target axis, and height off it (law of cosines).
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));

  // Pole projected perpendicular to the axis; fall back to a stable perpendicular if degenerate.
  _perp.copy(pole).addScaledVector(_dir, -pole.dot(_dir));
  if (_perp.lengthSq() < 1e-8) {
    _perp.set(1, 0, 0).addScaledVector(_dir, -_dir.x);
    if (_perp.lengthSq() < 1e-8) _perp.set(0, 0, 1).addScaledVector(_dir, -_dir.z);
  }
  _perp.normalize();

  _knee.copy(anchorPos).addScaledVector(_dir, along).addScaledVector(_perp, h);

  // Aim each bone (-Y rest) at its child; ankle lands on target by construction.
  const thighDir = _tmp.copy(_knee).sub(anchorPos).normalize();
  const proximalWorld = new Quaternion().setFromUnitVectors(REST_DOWN, thighDir);

  const shinDir = new Vector3().copy(target).sub(_knee).normalize();
  const distalWorld = new Quaternion().setFromUnitVectors(REST_DOWN, shinDir);

  const proximal = anchorParentQ.clone().invert().multiply(proximalWorld);
  const distal = proximalWorld.clone().invert().multiply(distalWorld);
  return { proximal, distal, kneeWorld: _knee.clone() };
}
