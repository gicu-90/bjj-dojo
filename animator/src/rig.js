// Phase 0 — the rig data model.
// The canonical 17-joint skeleton: hierarchy, rest offsets (from parent, in the parent's
// local frame), segment lengths, and per-joint rotation limits. Pure data + helpers; no
// rendering. Proportions match the skill's fighter-factory (1.75 m athletic adult).

export const JOINTS = [
  'root', 'spine', 'chest', 'neck', 'head',
  'shoulderL', 'elbowL', 'wristL',
  'shoulderR', 'elbowR', 'wristR',
  'hipL', 'kneeL', 'ankleL',
  'hipR', 'kneeR', 'ankleR',
];

// parent[name] = parent joint name (root has none).
// offset = position relative to the parent joint, in the parent's local frame, at rest.
// limit = [lo, hi] radians per local axis; hinge joints (elbow/knee) work on x only.
const PI = Math.PI;
export const RIG = {
  root:      { parent: null,       offset: [0, 0.93, 0] },
  spine:     { parent: 'root',     offset: [0, 0.10, 0],   limit: { x: [-0.5, 0.9], y: [-0.6, 0.6], z: [-0.45, 0.45] } },
  chest:     { parent: 'spine',    offset: [0, 0.16, 0],   limit: { x: [-0.5, 0.9], y: [-0.6, 0.6], z: [-0.45, 0.45] } },
  neck:      { parent: 'chest',    offset: [0, 0.21, 0],   limit: { x: [-0.6, 0.7], y: [-1.0, 1.0], z: [-0.5, 0.5] } },
  head:      { parent: 'neck',     offset: [0, 0.07, 0],   limit: { x: [-0.6, 0.7], y: [-1.0, 1.0], z: [-0.5, 0.5] } },

  shoulderL: { parent: 'chest',    offset: [ 0.21, 0.15, 0], limit: { x: [-3.1, 0.6], y: [-1.5, 1.5], z: [-0.3, 2.9] } },
  elbowL:    { parent: 'shoulderL', offset: [0, -0.30, 0],  limit: { x: [-2.7, 0], y: [0, 0], z: [0, 0] } },
  wristL:    { parent: 'elbowL',   offset: [0, -0.27, 0],   limit: { x: [-0.7, 0.7], y: [-0.4, 0.4], z: [-0.5, 0.5] } },

  shoulderR: { parent: 'chest',    offset: [-0.21, 0.15, 0], limit: { x: [-3.1, 0.6], y: [-1.5, 1.5], z: [-2.9, 0.3] } },
  elbowR:    { parent: 'shoulderR', offset: [0, -0.30, 0],  limit: { x: [-2.7, 0], y: [0, 0], z: [0, 0] } },
  wristR:    { parent: 'elbowR',   offset: [0, -0.27, 0],   limit: { x: [-0.7, 0.7], y: [-0.4, 0.4], z: [-0.5, 0.5] } },

  hipL:      { parent: 'root',     offset: [ 0.095, -0.02, 0], limit: { x: [-2.4, 0.4], y: [-0.7, 0.7], z: [-0.4, 1.3] } },
  kneeL:     { parent: 'hipL',     offset: [0, -0.44, 0],   limit: { x: [0, 2.4], y: [0, 0], z: [0, 0] } },
  ankleL:    { parent: 'kneeL',    offset: [0, -0.42, 0],   limit: { x: [-0.9, 0.6], y: [-0.3, 0.3], z: [-0.3, 0.3] } },

  hipR:      { parent: 'root',     offset: [-0.095, -0.02, 0], limit: { x: [-2.4, 0.4], y: [-0.7, 0.7], z: [-1.3, 0.4] } },
  kneeR:     { parent: 'hipR',     offset: [0, -0.44, 0],   limit: { x: [0, 2.4], y: [0, 0], z: [0, 0] } },
  ankleR:    { parent: 'kneeR',    offset: [0, -0.42, 0],   limit: { x: [-0.9, 0.6], y: [-0.3, 0.3], z: [-0.3, 0.3] } },
};

// Segment length = distance from a joint to its parent (|offset|). Cached for IK.
export const BONE_LENGTH = Object.fromEntries(
  JOINTS.filter((j) => RIG[j].parent).map((j) => {
    const [x, y, z] = RIG[j].offset;
    return [j, Math.hypot(x, y, z)];
  })
);

// Children lookup (parent → [children]), for forward-kinematics traversal order.
export const CHILDREN = Object.fromEntries(JOINTS.map((j) => [j, []]));
for (const j of JOINTS) {
  const p = RIG[j].parent;
  if (p) CHILDREN[p].push(j);
}

// Clamp an Euler [x,y,z] to a joint's limits (returns a new array). Used before applying poses.
export function clampToLimits(joint, euler) {
  const lim = RIG[joint].limit;
  if (!lim) return euler.slice();
  const c = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
  return [c(euler[0], lim.x), c(euler[1], lim.y), c(euler[2], lim.z)];
}
