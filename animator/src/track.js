// Phase 1 — per-joint keyframe tracks.
// A Track holds keyframes for ONE joint: { t, q } where q is a quaternion. Evaluating a track
// at time `t` slerps between the surrounding keys using a per-key easing (so each joint can
// ease on its own — the offset/overlap that kills robotic lockstep motion). A track may carry
// a `timeOffset` so a joint leads or lags the body (hips lead, chest follows, head last).

import { Quaternion, Euler } from '../vendor/three.module.js';

const _qa = new Quaternion();
const _qb = new Quaternion();
const _e = new Euler();

// Easing modes per key transition. 'linear' for constant motion (a planted foot drifting at
// constant speed), 'ease' for slow-in/slow-out (the default natural feel), 'sharp' for impacts
// (no ease-out — hits hard), 'soft' for settles (long ease-out).
export const EASES = {
  linear: (t) => t,
  ease: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sharp: (t) => t * t,                      // accelerates into the key — for contact/impact
  soft: (t) => 1 - Math.pow(1 - t, 3),      // decelerates into the key — for settling
};

export function eulerToQuat(e, out = new Quaternion()) {
  return out.setFromEuler(_e.set(e[0], e[1], e[2], 'XYZ'));
}

export class Track {
  // keys: [{ t:number, q:Quaternion|[x,y,z]euler, ease?:keyof EASES }], assumed sorted by t.
  // timeOffset: shift sampling for this joint (positive = lags behind the body).
  constructor(joint, keys = [], timeOffset = 0) {
    this.joint = joint;
    this.timeOffset = timeOffset;
    this.keys = keys.map((k) => ({
      t: k.t,
      q: k.q instanceof Quaternion ? k.q.clone() : eulerToQuat(k.q),
      ease: k.ease || 'ease',
    }));
  }

  // Evaluate the joint's local rotation at world time `time`. Clamps outside the key range.
  evaluate(time, out = new Quaternion()) {
    const keys = this.keys;
    if (keys.length === 0) return out.identity();
    const t = time - this.timeOffset;
    if (keys.length === 1 || t <= keys[0].t) return out.copy(keys[0].q);
    if (t >= keys[keys.length - 1].t) return out.copy(keys[keys.length - 1].q);

    let i = 0;
    while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const span = b.t - a.t;
    const raw = span > 0 ? (t - a.t) / span : 0;
    const k = EASES[b.ease] ? EASES[b.ease](raw) : raw;

    _qa.copy(a.q);
    _qb.copy(b.q);
    return out.copy(_qa).slerp(_qb, k);
  }
}

// A clip = a set of tracks (one per animated joint) + a duration. Evaluating it yields a map
// jointName -> local quaternion at the given time. This is the FK input for the solver.
export class Clip {
  constructor(tracks = [], duration = 1) {
    this.duration = duration;
    this.tracks = new Map(tracks.map((tr) => [tr.joint, tr]));
  }

  evaluate(time, out = {}) {
    for (const [joint, track] of this.tracks) {
      out[joint] = track.evaluate(time, out[joint]);
    }
    return out;
  }
}
