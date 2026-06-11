// Two-bone IK in CANONICAL pose space for the back-control wrap arms.
// Replicates the page's forward kinematics (shoulder Euler XYZ + elbow hinge x),
// solves shoulder (x,y,z) + elbow.x so the wrist hits a world-space anchor on the
// opponent, then prints Eulers to bake into demo.html's pose data (skill workflow:
// IK is an authoring tool, final poses stay plain data).
const L1 = 0.25, L2 = 0.24; // this rig's upper arm / forearm lengths (probed via ?dump)

// quaternion helpers (x,y,z,w)
const qmul = (a, b) => [
  a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1],
  a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
  a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3],
  a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
const qaxis = (x, y, z, t) => [x*Math.sin(t/2), y*Math.sin(t/2), z*Math.sin(t/2), Math.cos(t/2)];
const qrot = (q, v) => {
  const u = [q[0], q[1], q[2]], s = q[3];
  const cr = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const c1 = cr(u, v), t = c1.map(x => 2*x), c2 = cr(u, t);
  return [v[0]+s*t[0]+c2[0], v[1]+s*t[1]+c2[1], v[2]+s*t[2]+c2[2]];
};
const eulerXYZ = (x, y, z) => qmul(qaxis(1,0,0,x), qmul(qaxis(0,1,0,y), qaxis(0,0,1,z)));
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const scl = (a, k) => a.map(v => v * k);
const len = a => Math.hypot(...a);

function fk(shoulderPos, eu) { // eu = [sx, sy, sz, ex]
  const Q = eulerXYZ(eu[0], eu[1], eu[2]);
  const armDir = qrot(Q, [0, -1, 0]);
  const elbow = add(shoulderPos, scl(armDir, L1));
  const W = qmul(Q, qaxis(1, 0, 0, eu[3]));
  const wrist = add(elbow, scl(qrot(W, [0, -1, 0]), L2));
  return { elbow, wrist };
}

function solve(name, shoulderPos, wristTarget, elbowPref, side) {
  // joint limits (posing-and-grappling.md), z mirrored for the right side
  const lim = side === 'L'
    ? [[-3.1, 0.6], [-1.5, 1.5], [-0.3, 2.9], [-2.7, 0]]
    : [[-3.1, 0.6], [-1.5, 1.5], [-2.9, 0.3], [-2.7, 0]];
  const cost = eu => {
    const { elbow, wrist } = fk(shoulderPos, eu);
    return len(sub(wrist, wristTarget)) ** 2 + 0.25 * len(sub(elbow, elbowPref)) ** 2;
  };
  let best = null;
  for (let r = 0; r < 60; r++) { // random restarts + coordinate descent
    let eu = lim.map(([lo, hi]) => lo + Math.random() * (hi - lo));
    let step = 0.5;
    while (step > 1e-4) {
      let improved = false;
      for (let i = 0; i < 4; i++) for (const d of [step, -step]) {
        const trial = eu.slice();
        trial[i] = Math.min(lim[i][1], Math.max(lim[i][0], trial[i] + d));
        if (cost(trial) < cost(eu)) { eu = trial; improved = true; }
      }
      if (!improved) step /= 2;
    }
    if (!best || cost(eu) < cost(best)) best = eu;
  }
  const { elbow, wrist } = fk(shoulderPos, best);
  console.log(`${name}: shoulder[${best.slice(0,3).map(v => v.toFixed(2))}] elbow[${best[3].toFixed(2)}]`);
  console.log(`  wrist -> ${wrist.map(v => v.toFixed(2))} (target ${wristTarget}) miss=${len(sub(wrist, wristTarget)).toFixed(3)}`);
  console.log(`  elbow -> ${elbow.map(v => v.toFixed(2))} (pref ${elbowPref})`);
}

// Canonical-frame positions for BLUE (attacker), derived from the ?dump world data:
// canonical = Ry(-pi/2) * (world - rootPos), rootPos = (-0.30, 0.16, 0)
// blue shoulderR (0.21 world z) -> (-0.21, 0.51, 0.13); shoulderL -> (0.21, 0.51, 0.13)
// red neck world (0.14, 0.84, 0) -> canonical (0, 0.68, 0.44); throat surface ~ +0.06 fwd
solve('R (choke arm, forearm across the throat)',
  [-0.21, 0.51, 0.13], [0.00, 0.68, 0.47], [-0.28, 0.62, 0.40], 'R');
solve('L (over the left shoulder toward the neck)',
  [0.21, 0.51, 0.13], [0.06, 0.72, 0.46], [0.30, 0.66, 0.30], 'L');
