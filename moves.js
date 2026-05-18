// Move library v3 — canonical pose helpers + many intermediate frames.
// Pose joint rotations are Euler [x,y,z] in figure-local frame.
// Figure default faces +Z. Head=+Y. Arms/legs hang -Y.

const PI = Math.PI;
const GY = 1.05;
const GY_KNEEL = 0.55;
const GY_LIE = 0.22;
const GY_LOW_KNEEL = 0.4;

// Root rotation presets
const FACE_POS_X        = [0, PI/2, 0];
const FACE_NEG_X        = [0, -PI/2, 0];
const FACE_POS_Z        = [0, 0, 0];           // default — facing camera
const FACE_NEG_Z        = [0, PI, 0];
const ON_BACK_HEAD_NEG_X = [-PI/2, 0, PI/2];
const ON_BACK_HEAD_POS_X = [-PI/2, 0, -PI/2];
const ON_BACK_HEAD_POS_Z = [-PI/2, 0, PI];
const ON_BACK_HEAD_NEG_Z = [-PI/2, 0, 0];
const FACE_DOWN_HEAD_POS_X = [PI/2, 0, -PI/2];
const FACE_DOWN_HEAD_NEG_X = [PI/2, 0, PI/2];
const FACE_DOWN_HEAD_POS_Z = [PI/2, 0, 0];

const REST = {
  spine: [0, 0, 0],
  chest: [0, 0, 0],
  neck: [0, 0, 0],
  head: [0, 0, 0],
  shoulderL: [0, 0, 0.14],
  shoulderR: [0, 0, -0.14],
  elbowL: [-0.1, 0, 0],
  elbowR: [-0.1, 0, 0],
  wristL: [0, 0, 0],
  wristR: [0, 0, 0],
  hipL: [0, 0, 0.04],
  hipR: [0, 0, -0.04],
  kneeL: [0.05, 0, 0],
  kneeR: [0.05, 0, 0],
  ankleL: [0, 0, 0],
  ankleR: [0, 0, 0],
};

function P(overrides = {}, rootPos = [0, GY, 0], rootRot = [0, 0, 0], bones = null) {
  const pose = { joints: { ...REST, ...overrides }, rootPos, rootRot };
  if (bones) pose.bones = bones;
  return pose;
}

// ============================== CANONICAL POSES ==============================

// Shared fight stance bone deltas — both figures use the same pose.
// Standing upright with arms forward in a guard; only slight knee bend.
const FIGHT_STANCE_BONES = {
  // Modest hip flex (~12°) so torso leans slightly forward
  hipL: [0.105, 0, 0, 0.994],
  hipR: [0.105, 0, 0, 0.994],
  // Slight knee bend (~20°)
  kneeL: [-0.174, 0, 0, 0.985],
  kneeR: [-0.174, 0, 0, 0.985],
  spine: [0.0894, 0, 0, 0.996],
  chest: [0.0998, 0, 0, 0.995],
  head: [0.0998, 0, 0, 0.995],
  shoulderL: [0.4931, -0.4568, -0.352, 0.6514],
  shoulderR: [0.4888, 0.461, 0.3568, 0.649],
  elbowL: [-0.0379, 0.0315, 0.721, 0.6912],
  elbowR: [-0.0379, -0.0314, -0.7222, 0.6899],
};

// Standing fighting stance (hands forward, knees bent, leaning forward)
function fightStanceA() {
  return P({
    spine: [0.08, 0, 0],
    chest: [0.05, 0.2, 0],
    neck: [-0.05, 0, 0],
    head: [-0.1, 0, 0],
    shoulderL: [-1.7, 0, 0.2],
    elbowL: [-1.7, 0, 0.15],
    wristL: [0, 0, 0],
    shoulderR: [-1.7, 0, -0.2],
    elbowR: [-1.7, 0, -0.15],
    wristR: [0, 0, 0],
    hipL: [-0.35, 0, 0.08],
    kneeL: [0.65, 0, 0],
    hipR: [-0.15, 0, -0.08],
    kneeR: [0.55, 0, 0],
  }, [-0.85, GY - 0.18, 0], FACE_POS_X,
  FIGHT_STANCE_BONES);
}
function fightStanceB() {
  return P({
    spine: [0.08, 0, 0],
    chest: [0.05, 0.2, 0],
    neck: [-0.05, 0, 0],
    head: [-0.1, 0, 0],
    shoulderL: [-1.7, 0, 0.2],
    elbowL: [-1.7, 0, 0.15],
    shoulderR: [-1.7, 0, -0.2],
    elbowR: [-1.7, 0, -0.15],
    hipL: [-0.35, 0, 0.08],
    kneeL: [0.65, 0, 0],
    hipR: [-0.15, 0, -0.08],
    kneeR: [0.55, 0, 0],
  }, [0.85, GY - 0.18, 0], FACE_NEG_X,
  FIGHT_STANCE_BONES);
}

// Crouched / level change — deep knee bend, back straight, hands still UP at face
function crouchA(deep = 0.4) {
  return P({
    spine: [0.15, 0, 0],
    chest: [0.1, 0.15, 0],
    neck: [-0.1, 0, 0],
    head: [-0.05, 0, 0],
    // Hands stay at face — same as fight stance
    shoulderL: [-1.7, 0, 0.2],
    elbowL: [-1.7, 0, 0.15],
    shoulderR: [-1.7, 0, -0.2],
    elbowR: [-1.7, 0, -0.15],
    // Deep knee bend, hips drop
    hipL: [-0.95, 0, 0.08],
    kneeL: [1.4, 0, 0],
    hipR: [-1.05, 0, -0.08],
    kneeR: [1.5, 0, 0],
  }, [-0.85, GY - deep, 0], FACE_POS_X);
}

// Closed guard, attacker on back, knees up around opp.
function guardClosedAtt() {
  return P({
    spine: [0.18, 0, 0],
    chest: [0.15, 0, 0],
    neck: [0.05, 0, 0],
    head: [0.1, 0, 0],
    shoulderL: [-2.0, 0, 0.5],
    elbowL: [-1.2, 0, 0.4],
    shoulderR: [-2.0, 0, -0.5],
    elbowR: [-1.2, 0, -0.4],
    hipL: [-PI/2 + 0.3, 0, 0.5],
    kneeL: [PI - 0.8, 0, 0],
    hipR: [-PI/2 + 0.3, 0, -0.5],
    kneeR: [PI - 0.8, 0, 0],
  }, [0.05, GY_LIE + 0.05, 0], ON_BACK_HEAD_NEG_X);
}

// Closed guard, opp kneeling between att's legs, facing -X.
function guardClosedOpp() {
  return P({
    spine: [-0.15, 0, 0],
    chest: [-0.05, 0, 0],
    neck: [0.05, 0, 0],
    shoulderL: [-1.0, 0, 0.5],
    elbowL: [-1.4, 0, 0.3],
    shoulderR: [-1.0, 0, -0.5],
    elbowR: [-1.4, 0, -0.3],
    hipL: [0.1, 0, 0.05],
    kneeL: [PI/2 + 0.3, 0, 0],
    ankleL: [-PI/2 + 0.15, 0, 0],
    hipR: [0.1, 0, -0.05],
    kneeR: [PI/2 + 0.3, 0, 0],
    ankleR: [-PI/2 + 0.15, 0, 0],
  }, [0.7, GY_KNEEL, 0], FACE_NEG_X);
}

// Back control: both seated. Attacker behind opponent, both facing +X.
function backControlAtt() {
  return P({
    spine: [0.1, 0, 0],
    chest: [0.05, 0, 0],
    shoulderL: [-0.5, 0, 1.3],
    elbowL: [-1.4, 0, 0.5],
    shoulderR: [-0.5, 0, -1.3],
    elbowR: [-1.4, 0, -0.5],
    hipL: [-1.1, 0, 0.7],
    kneeL: [1.2, 0, 0],
    hipR: [-1.1, 0, -0.7],
    kneeR: [1.2, 0, 0],
  }, [-0.35, GY_LOW_KNEEL, 0], FACE_POS_X);
}
function backControlOpp() {
  return P({
    spine: [0.3, 0, 0],
    chest: [0.2, 0, 0],
    shoulderL: [-0.4, 0, 0.4],
    elbowL: [-0.6, 0, 0],
    shoulderR: [-0.4, 0, -0.4],
    elbowR: [-0.6, 0, 0],
    hipL: [-1.4, 0, 0.06],
    kneeL: [1.6, 0, 0],
    hipR: [-1.4, 0, -0.06],
    kneeR: [1.6, 0, 0],
  }, [0.1, GY_LOW_KNEEL + 0.02, 0], FACE_POS_X);
}

// Side control top (attacker on top of opp who is on back)
function sideControlAtt() {
  return P({
    spine: [0.25, 0, 0],
    chest: [0.2, 0, 0],
    neck: [-0.2, 0, 0],
    shoulderL: [-1.8, 0, 0.7],
    elbowL: [-0.6, 0, 0.2],
    shoulderR: [-1.8, 0, -0.7],
    elbowR: [-0.6, 0, -0.2],
    hipL: [-PI/2 + 0.4, 0, 0.4],
    kneeL: [PI/2 + 0.2, 0, 0],
    hipR: [-PI/2 + 0.4, 0, -0.4],
    kneeR: [PI/2 + 0.2, 0, 0],
  }, [0.5, GY_KNEEL - 0.1, 0], FACE_POS_X);
}
function onBackOpp(x = 0.9, z = 0) {
  return P({
    spine: [0, 0, 0],
    shoulderL: [-0.6, 0, 0.8],
    elbowL: [-1.0, 0, 0.2],
    shoulderR: [-0.6, 0, -0.8],
    elbowR: [-1.0, 0, -0.2],
    hipL: [-0.4, 0, 0.1],
    kneeL: [0.6, 0, 0],
    hipR: [-0.4, 0, -0.1],
    kneeR: [0.6, 0, 0],
  }, [x, GY_LIE, z], ON_BACK_HEAD_POS_X);
}

// === Move-specific finish poses ===

function armbarFinishAtt() {
  // Att lying perpendicular to opp. Body along world X (head -X, feet +X).
  // Both legs go straight UP, pinching tight (squeezing opp's shoulder).
  return P({
    spine: [0.1, 0, 0.1],
    chest: [0.15, 0, 0.1],
    neck: [0.15, 0, 0],
    head: [0.1, 0, 0],
    shoulderL: [-2.6, 0, 0.5],
    elbowL: [-2.2, 0, 0.4],
    wristL: [0, 0, 0],
    shoulderR: [-2.6, 0, -0.5],
    elbowR: [-2.2, 0, -0.4],
    wristR: [0, 0, 0],
    // legs vertical, knees pinched
    hipL: [-PI/2 + 0.15, 0, 0.15],
    kneeL: [0.35, 0, 0],
    hipR: [-PI/2 + 0.15, 0, -0.15],
    kneeR: [0.35, 0, 0],
  }, [0.15, GY_LIE + 0.08, 0], ON_BACK_HEAD_NEG_X);
}
function armbarFinishOpp() {
  // Opp face-down on the ground, body extending in +Z direction.
  // Right shoulder at att's pelvis area. Right arm reaches toward att (world -X).
  return P({
    spine: [0.1, 0, 0],
    chest: [0.05, 0, 0],
    neck: [-0.15, 0, 0],
    head: [0.1, 0, 0],
    shoulderL: [-0.5, 0, 0.7],     // posting left arm
    elbowL: [-0.5, 0, 0.2],
    shoulderR: [-1.3, 0, -0.9],    // right arm trapped, reaching toward att
    elbowR: [-0.5, 0, 0],
    wristR: [0, 0, 0],
    hipL: [-0.6, 0, 0.15],
    kneeL: [1.0, 0, 0],
    hipR: [-0.6, 0, -0.15],
    kneeR: [1.0, 0, 0],
  }, [0.15, GY_LIE + 0.04, 0.6], FACE_DOWN_HEAD_POS_Z);
}

function triangleFinishAtt() {
  // Att lies back. Left leg HIGH across opp's neck. Right leg CROSSES UNDER.
  return P({
    spine: [0.2, 0, 0.05],
    chest: [0.15, 0, 0.05],
    neck: [0.1, 0, 0],
    head: [0.1, 0, 0],
    shoulderL: [-2.6, 0, 0.4],
    elbowL: [-2.0, 0, 0.4],
    wristL: [0, 0, 0.3],          // grab opp's head
    shoulderR: [-2.6, 0, -0.4],
    elbowR: [-2.0, 0, -0.4],
    // Left leg high (toward opp's far shoulder)
    hipL: [-PI/2 - 0.1, 0, 0.15],   // thigh up and slightly past vertical
    kneeL: [PI/2 - 0.2, 0, 0],      // shin folds down across opp
    // Right leg crosses underneath
    hipR: [-PI/2 + 0.3, 0, -0.6],
    kneeR: [PI - 0.6, 0, 0],
  }, [0.05, GY_LIE + 0.05, 0.1], ON_BACK_HEAD_NEG_X);
}
function triangleFinishOpp() {
  // Opp's head pulled forward into att's chest, one arm trapped between att's legs
  return P({
    spine: [-0.6, 0, 0],
    chest: [-0.4, 0, 0],
    neck: [0.7, 0, 0],
    head: [0.3, 0, 0],
    shoulderL: [-2.4, 0, 0.5],      // left arm trapped, pulled across
    elbowL: [-1.6, 0, 0.2],
    shoulderR: [-2.4, 0, -0.4],
    elbowR: [-1.6, 0, 0],
    hipL: [0.05, 0, 0.05],
    kneeL: [PI/2 + 0.4, 0, 0],
    hipR: [0.05, 0, -0.05],
    kneeR: [PI/2 + 0.4, 0, 0],
  }, [0.45, GY_LOW_KNEEL, 0], FACE_NEG_X);
}

function kimuraFinishAtt() {
  // Att sitting up on side, both arms gripping opp's wrist (figure-4 grip).
  return P({
    spine: [-0.6, 0, 0.1],
    chest: [-0.2, 0, 0.05],
    neck: [0.2, 0, 0],
    shoulderL: [-2.4, 0, 0.4],
    elbowL: [-2.0, 0, 0.2],
    wristL: [0, 0, 0],
    shoulderR: [-2.6, 0, -0.4],
    elbowR: [-2.4, 0, 0.3],
    wristR: [0, 0, 0],
    hipL: [-PI/2 + 0.3, 0, 0.4],
    kneeL: [PI - 0.5, 0, 0],
    hipR: [-PI/2 + 0.4, 0, -0.4],
    kneeR: [PI - 0.5, 0, 0],
  }, [0.1, GY_LIE + 0.25, 0.1], ON_BACK_HEAD_NEG_X);
}
function kimuraFinishOpp() {
  // Opp arm bent up behind back, wrist trapped above
  return P({
    spine: [-0.2, 0, 0.1],
    chest: [-0.15, 0, 0.05],
    neck: [0.2, 0, 0],
    shoulderL: [-3.0, 0, 0.5],     // left arm rotated way up
    elbowL: [-2.6, 0, 0.6],         // elbow bent acutely
    wristL: [0, 0, 0],
    shoulderR: [-0.5, 0, -0.4],
    elbowR: [-1.0, 0, -0.2],
    hipL: [0.1, 0, 0.05],
    kneeL: [PI/2 + 0.4, 0, 0],
    hipR: [0.1, 0, -0.05],
    kneeR: [PI/2 + 0.4, 0, 0],
  }, [0.5, GY_LOW_KNEEL, 0], FACE_NEG_X);
}

// ============================== MOVES ==============================

const MOVES = [
  // =================================================
  {
    id: 'doubleLeg',
    name: 'Double Leg Takedown',
    category: 'Takedown',
    difficulty: 'Beginner',
    target: ['thighL', 'thighR', 'shinL', 'shinR'],
    icon: '🦵',
    summary: 'Drop level, penetrate, drive through both legs.',
    animations: {
      attUrl: 'animations/doubleLeg-att.fbx',
      oppUrl: 'animations/doubleLeg-opp.fbx',
      duration: 2.3,
      // 7 step beats compressed into the 2.3s window
      stepTimes: [0.05, 0.35, 0.7, 1.05, 1.4, 1.75, 2.2],
      // World-space starting positions for the figures (animation root motion
      // will take them from here). Attacker starts a step away from opponent.
      startPos: { att: [-1.1, 0, 0], opp: [0.4, 0, 0] },
      startRot: { att: [0, Math.PI / 2, 0], opp: [0, -Math.PI / 2, 0] },
    },
    steps: [
      { caption: 'Stance. Both fighters squared off, hands up.',
        hint: 'Read their weight — heavy on the lead leg means easy shot.',
        attacker: fightStanceA(),
        opponent: fightStanceB() },
      { caption: 'Step in and close the distance.',
        hint: 'Don\'t telegraph the shot.',
        attacker: P({
          spine: [0.12, 0, 0], chest: [0.08, 0.2, 0],
          neck: [-0.08, 0, 0], head: [-0.1, 0, 0],
          // Lead arm extended forward to grab
          shoulderL: [-2.5, 0, 0.05], elbowL: [-0.4, 0, 0.1],
          wristL: [0, 0, 0],
          // Rear arm still at face
          shoulderR: [-1.7, 0, -0.2], elbowR: [-1.7, 0, -0.15],
          // Lead foot forward, more bent — getting into range
          hipL: [-0.45, 0, 0.08], kneeL: [0.7, 0, 0],
          hipR: [-0.2, 0, -0.08], kneeR: [0.6, 0, 0],
        }, [-0.7, GY - 0.2, 0], FACE_POS_X),
        opponent: fightStanceB() },
      { caption: 'Level change — drop your hips by bending the knees.',
        hint: 'Back stays straight. Drop with the legs, not the waist.',
        attacker: crouchA(0.4),
        opponent: fightStanceB() },
      { caption: 'Shoot in — lead foot deep between their feet, knee touches the mat.',
        hint: 'Head to one side of their chest, arms wrap behind their knees.',
        attacker: P({
          spine: [0.4, 0, 0.1], chest: [0.3, 0, 0.05],
          neck: [0.2, 0.3, 0], head: [0.1, 0.2, 0],
          // Arms wrap LOW around opp's legs (behind knees)
          shoulderL: [-1.8, 0, 1.3], elbowL: [-1.7, 0, 0.4],
          wristL: [0, 0, 0],
          shoulderR: [-1.8, 0, -1.3], elbowR: [-1.7, 0, -0.4],
          wristR: [0, 0, 0],
          // Back leg: knee on the ground, shin extending behind
          hipL: [0, 0, 0.1], kneeL: [PI/2 + 0.2, 0, 0],
          ankleL: [-PI/2 + 0.3, 0, 0],
          // Front leg: foot planted forward
          hipR: [-1.4, 0, -0.1], kneeR: [1.7, 0, 0],
          ankleR: [-0.2, 0, 0],
        }, [0.35, 0.55, 0.05], FACE_POS_X),
        opponent: P({
          spine: [0.25, 0, 0], chest: [0.2, 0, 0],
          neck: [0.35, 0, 0], head: [0.25, 0, 0],
          // Arms reaching down toward att's back
          shoulderL: [-0.5, 0, 0.4], elbowL: [-1.0, 0, 0.3],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.3],
          // Standing with slight knee bend
          hipL: [-0.15, 0, 0.06], kneeL: [0.4, 0, 0],
          hipR: [-0.15, 0, -0.06], kneeR: [0.4, 0, 0],
        }, [0.85, GY - 0.05, 0], FACE_NEG_X) },
      { caption: 'Lock your hands behind their knees and squeeze them together.',
        hint: 'Pull their knees toward you to kill their base.',
        attacker: P({
          spine: [0.5, 0, 0.1], chest: [0.35, 0, 0.15], neck: [0.2, 0, 0.25], head: [0.15, 0, 0],
          // Arms WIDE behind opp's knees
          shoulderL: [-1.7, 0, 1.4], elbowL: [-1.6, 0, 0.3],
          shoulderR: [-1.7, 0, -1.4], elbowR: [-1.6, 0, -0.3],
          // Both legs bent — almost kneeling on lead knee
          hipL: [-1.3, 0, 0.06], kneeL: [2.2, 0, 0],
          hipR: [-0.5, 0, -0.06], kneeR: [1.7, 0, 0],
        }, [0.3, GY - 0.72, 0.05], FACE_POS_X),
        opponent: P({
          spine: [-0.3, 0, 0], chest: [-0.2, 0, 0],
          shoulderL: [-0.3, 0, 0.6], shoulderR: [-0.3, 0, -0.6],
          elbowL: [-0.6, 0, 0], elbowR: [-0.6, 0, 0],
          hipL: [-0.15, 0, 0.06], hipR: [-0.25, 0, -0.06],
          kneeL: [0.6, 0, 0], kneeR: [0.7, 0, 0],
        }, [0.85, GY - 0.1, 0], FACE_NEG_X) },
      { caption: 'Drive forward and turn the corner — lift their hips off the mat.',
        hint: 'Pivot toward the side your head is on.',
        attacker: P({
          spine: [0.4, 0, 0.2], chest: [0.25, 0, 0.15],
          shoulderL: [-1.8, 0, 1.2], elbowL: [-1.6, 0, 0.4],
          shoulderR: [-1.8, 0, -1.2], elbowR: [-1.6, 0, -0.4],
          hipL: [-0.6, 0, 0.06], kneeL: [1.0, 0, 0],
          hipR: [-0.4, 0, -0.06], kneeR: [0.6, 0, 0],
        }, [0.5, GY - 0.3, 0], FACE_POS_X),
        opponent: P({
          spine: [-0.5, 0, 0], chest: [-0.2, 0, 0],
          shoulderL: [-1.0, 0, 0.5], shoulderR: [-1.0, 0, -0.5],
          elbowL: [-0.6, 0, 0], elbowR: [-0.6, 0, 0],
          hipL: [-PI/2, 0, 0.06], kneeL: [0.6, 0, 0],
          hipR: [-PI/2, 0, -0.06], kneeR: [0.6, 0, 0],
        }, [0.95, GY - 0.5, 0], FACE_NEG_X) },
      { caption: 'Finish on top in side control — heavy hips, pin them down.',
        hint: 'Shoulder pressure on their chest, stay tight.',
        attacker: sideControlAtt(),
        opponent: onBackOpp(1.0, 0) },
    ],
  },

  // =================================================
  {
    id: 'singleLeg',
    name: 'Single Leg Takedown',
    category: 'Takedown',
    difficulty: 'Beginner',
    target: ['thighL', 'thighR', 'shinL', 'shinR'],
    icon: '🦿',
    summary: 'Shoot one leg, run the pipe to finish.',
    steps: [
      { caption: 'Start in fighting stance.',
        hint: 'Look for the lead leg.',
        attacker: fightStanceA(),
        opponent: fightStanceB() },
      { caption: 'Level change with a small step forward.',
        hint: 'Drop your hips, not your shoulders.',
        attacker: crouchA(0.35),
        opponent: fightStanceB() },
      { caption: 'Shoot. Lead knee toward the mat, arms wrap their leg.',
        hint: 'Head ON the OUTSIDE of their thigh.',
        attacker: P({
          spine: [0.25, 0, -0.05], chest: [0.15, 0, -0.05],
          neck: [-0.2, 0, -0.1], head: [-0.1, 0, 0],
          shoulderL: [-1.8, 0, 0.7], elbowL: [-1.0, 0, 0.3],
          shoulderR: [-1.8, 0, -0.5], elbowR: [-1.0, 0, -0.2],
          hipL: [-1.5, 0, 0.06], kneeL: [2.0, 0, 0],
          hipR: [-0.4, 0, -0.06], kneeR: [1.1, 0, 0],
        }, [-0.05, GY - 0.5, 0.15], FACE_POS_X),
        opponent: fightStanceB() },
      { caption: 'Stand up with the leg. Lift it high — to your hip pocket.',
        hint: 'Step toward where your head is pointing.',
        attacker: P({
          spine: [0.25, 0, 0.1], chest: [0.15, 0, 0.1],
          shoulderL: [-2.0, 0, 1.0], elbowL: [-1.6, 0, 0.3],
          shoulderR: [-1.8, 0, -0.4], elbowR: [-1.2, 0, -0.2],
          hipL: [-0.6, 0, 0.06], kneeL: [0.9, 0, 0],
          hipR: [-0.5, 0, -0.06], kneeR: [0.8, 0, 0],
        }, [0.3, GY - 0.15, 0.1], FACE_POS_X),
        opponent: P({
          spine: [-0.15, 0, 0.1], chest: [-0.1, 0, 0],
          shoulderL: [-0.8, 0, 0.6], shoulderR: [-0.8, 0, -0.6],
          elbowL: [-1.0, 0, 0.2], elbowR: [-1.0, 0, -0.2],
          // One leg trapped (raised)
          hipL: [-1.8, 0, 0.1], kneeL: [0.8, 0, 0],
          // Other leg supporting
          hipR: [-0.1, 0, -0.06], kneeR: [0.3, 0, 0],
        }, [0.95, GY - 0.05, 0], FACE_NEG_X) },
      { caption: 'Run the pipe. Step around their hopping foot, drive their knee to the mat.',
        hint: 'Block their good leg or take the angle.',
        attacker: P({
          spine: [0.3, 0, 0.15], chest: [0.2, 0, 0.1],
          shoulderL: [-1.8, 0, 1.0], elbowL: [-1.4, 0, 0.3],
          shoulderR: [-1.8, 0, -0.6], elbowR: [-1.0, 0, -0.2],
          hipL: [-0.5, 0, 0.06], kneeL: [0.7, 0, 0],
          hipR: [-0.4, 0, -0.06], kneeR: [0.5, 0, 0],
        }, [0.45, GY - 0.2, 0.2], FACE_POS_X),
        opponent: P({
          spine: [-0.4, 0, 0.2], chest: [-0.2, 0, 0.1],
          shoulderL: [-1.4, 0, 0.6], shoulderR: [-1.4, 0, -0.6],
          elbowL: [-0.8, 0, 0], elbowR: [-0.8, 0, 0],
          hipL: [-PI/2, 0, 0.1], kneeL: [1.2, 0, 0],
          hipR: [-0.3, 0, -0.06], kneeR: [0.5, 0, 0],
        }, [0.9, GY - 0.4, 0], FACE_NEG_X) },
      { caption: 'They land. Establish top position — side control or knee on belly.',
        hint: 'Keep their leg under control as you settle.',
        attacker: sideControlAtt(),
        opponent: onBackOpp(1.0, 0) },
    ],
  },

  // =================================================
  {
    id: 'hipThrow',
    name: 'Hip Throw (O-Goshi)',
    category: 'Takedown',
    difficulty: 'Intermediate',
    target: ['torso', 'hip', 'thighL', 'thighR'],
    icon: '🌀',
    summary: 'Underhook + grip, pivot in, lift on your hip.',
    steps: [
      { caption: 'Standing tied up. You have one collar / underhook grip.',
        hint: 'Hand on their hip or under their armpit.',
        attacker: P({
          spine: [0.05, 0, 0], chest: [0.1, 0, 0],
          shoulderL: [-1.5, 0, 0.6], elbowL: [-1.4, 0, 0.3],
          shoulderR: [-1.6, 0, -0.5], elbowR: [-1.4, 0, -0.3],
          hipL: [-0.1, 0, 0.06], kneeL: [0.4, 0, 0],
          hipR: [-0.2, 0, -0.06], kneeR: [0.5, 0, 0],
        }, [-0.4, GY - 0.05, 0], FACE_POS_X),
        opponent: P({
          spine: [0.05, 0, 0], chest: [0.1, 0, 0],
          shoulderL: [-1.5, 0, 0.6], elbowL: [-1.4, 0, 0.3],
          shoulderR: [-1.6, 0, -0.5], elbowR: [-1.4, 0, -0.3],
          hipL: [-0.1, 0, 0.06], kneeL: [0.4, 0, 0],
          hipR: [-0.2, 0, -0.06], kneeR: [0.5, 0, 0],
        }, [0.4, GY - 0.05, 0], FACE_NEG_X) },
      { caption: 'Step in. Plant lead foot deep between their feet, hip aligned with theirs.',
        hint: 'Your back faces them now.',
        attacker: P({
          spine: [0.1, 0, 0.3], chest: [0.05, 0, 0.2],
          shoulderL: [-2.0, 0, 1.0], elbowL: [-1.4, 0, 0.3],
          shoulderR: [-2.0, 0, -1.0], elbowR: [-1.4, 0, -0.3],
          hipL: [-0.15, 0, 0.1], kneeL: [0.4, 0, 0],
          hipR: [-0.3, 0, -0.1], kneeR: [0.7, 0, 0],
        }, [0.0, GY - 0.1, 0], [0, PI, 0]),  // facing AWAY (back to opp)
        opponent: P({
          spine: [0.05, 0, 0],
          shoulderL: [-1.0, 0, 0.6], elbowL: [-1.4, 0, 0.3],
          shoulderR: [-1.0, 0, -0.6], elbowR: [-1.4, 0, -0.3],
          hipL: [-0.1, 0, 0.06], kneeL: [0.4, 0, 0],
          hipR: [-0.2, 0, -0.06], kneeR: [0.5, 0, 0],
        }, [0.4, GY - 0.05, 0], FACE_NEG_X) },
      { caption: 'Bend your knees, drop hips lower than theirs. Pull them onto your back.',
        hint: 'Get UNDER their center of gravity.',
        attacker: P({
          spine: [0.3, 0, 0.4], chest: [0.15, 0, 0.3],
          shoulderL: [-2.2, 0, 1.1], elbowL: [-1.6, 0, 0.4],
          shoulderR: [-2.2, 0, -1.1], elbowR: [-1.6, 0, -0.4],
          hipL: [-0.9, 0, 0.1], kneeL: [1.5, 0, 0],
          hipR: [-1.0, 0, -0.1], kneeR: [1.6, 0, 0],
        }, [0.0, GY - 0.35, 0], [0, PI, 0]),
        opponent: P({
          spine: [0.4, 0, 0], chest: [0.2, 0, 0],
          shoulderL: [-1.2, 0, 0.6], elbowL: [-1.6, 0, 0.3],
          shoulderR: [-1.2, 0, -0.6], elbowR: [-1.6, 0, -0.3],
          hipL: [-0.4, 0, 0.06], kneeL: [0.6, 0, 0],
          hipR: [-0.4, 0, -0.06], kneeR: [0.6, 0, 0],
        }, [0.45, GY - 0.2, 0], FACE_NEG_X) },
      { caption: 'Straighten your legs explosively. Pull on the grips. They lift off the ground.',
        hint: 'Bend forward at the waist; their feet rise high.',
        attacker: P({
          spine: [0.5, 0, 0.3], chest: [0.3, 0, 0.2],
          shoulderL: [-2.4, 0, 1.0], elbowL: [-2.0, 0, 0.4],
          shoulderR: [-2.4, 0, -1.0], elbowR: [-2.0, 0, -0.4],
          hipL: [-0.2, 0, 0.08], kneeL: [0.3, 0, 0],
          hipR: [-0.3, 0, -0.08], kneeR: [0.4, 0, 0],
        }, [-0.1, GY - 0.05, 0], [0, PI, 0]),
        opponent: P({
          spine: [0.7, 0, 0], chest: [0.3, 0, 0],
          shoulderL: [-1.8, 0, 0.5], shoulderR: [-1.8, 0, -0.5],
          elbowL: [-1.4, 0, 0], elbowR: [-1.4, 0, 0],
          hipL: [-0.6, 0, 0.1], kneeL: [0.4, 0, 0],
          hipR: [-0.6, 0, -0.1], kneeR: [0.4, 0, 0],
        }, [0.25, GY + 0.05, 0.25], [-0.5, -PI/2, 0]) },
      { caption: 'Slam them to the mat. Maintain a grip for the follow-up.',
        hint: 'They land in front of you, on their back.',
        attacker: P({
          spine: [0.3, 0, 0], chest: [0.2, 0, 0],
          shoulderL: [-1.8, 0, 0.6], elbowL: [-1.4, 0, 0.3],
          shoulderR: [-1.6, 0, -0.4], elbowR: [-1.4, 0, -0.3],
          hipL: [-0.4, 0, 0.06], kneeL: [0.8, 0, 0],
          hipR: [-0.3, 0, -0.06], kneeR: [0.6, 0, 0],
        }, [0.1, GY - 0.2, 0], FACE_POS_X),
        opponent: onBackOpp(0.7, 0) },
    ],
  },

  // =================================================
  {
    id: 'guillotine',
    name: 'Guillotine Choke',
    category: 'Submission',
    difficulty: 'Beginner',
    target: ['head', 'neck'],
    icon: '🪢',
    summary: 'Catch a shot, trap the neck, finish with arms + arch.',
    steps: [
      { caption: 'Standing. They start to shoot for a takedown.',
        hint: 'See the shot coming early.',
        attacker: fightStanceA(),
        opponent: fightStanceB() },
      { caption: 'Sprawl — throw your hips back, weight forward onto their head.',
        hint: 'Heavy chest on their shoulders.',
        attacker: P({
          spine: [0.45, 0, 0], chest: [0.25, 0, 0], neck: [-0.25, 0, 0],
          shoulderL: [-1.4, 0, 0.5], elbowL: [-0.6, 0, 0.2],
          shoulderR: [-1.4, 0, -0.5], elbowR: [-0.6, 0, -0.2],
          hipL: [0.4, 0, 0.06], kneeL: [0.25, 0, 0],
          hipR: [0.5, 0, -0.06], kneeR: [0.25, 0, 0],
        }, [-0.5, GY - 0.35, 0], FACE_POS_X),
        opponent: P({
          spine: [0.7, 0, 0], chest: [0.4, 0, 0], neck: [-0.3, 0, 0],
          shoulderL: [-2.2, 0, 0.7], elbowL: [-0.8, 0, 0],
          shoulderR: [-2.2, 0, -0.7], elbowR: [-0.8, 0, 0],
          hipL: [-1.3, 0, 0.06], kneeL: [1.7, 0, 0],
          hipR: [-0.4, 0, -0.06], kneeR: [1.4, 0, 0],
        }, [0.4, GY - 0.6, 0], FACE_NEG_X) },
      { caption: 'Wrap your near arm under their neck — blade across the throat.',
        hint: 'Thumb points DOWN to your hip. Get the arm DEEP.',
        attacker: P({
          spine: [0.4, 0, 0], chest: [0.2, 0, 0], neck: [-0.15, 0, 0],
          shoulderL: [-1.4, 0, 0.5], elbowL: [-0.5, 0, 0.2],
          shoulderR: [-2.4, 0, -1.1], elbowR: [-2.2, 0, -0.4],
          wristR: [0, 0, 0.4],
          hipL: [0.4, 0, 0.06], kneeL: [0.25, 0, 0],
          hipR: [0.5, 0, -0.06], kneeR: [0.25, 0, 0],
        }, [-0.45, GY - 0.35, 0], FACE_POS_X),
        opponent: P({
          spine: [0.7, 0, 0], chest: [0.4, 0, 0], neck: [0.2, 0, 0],
          shoulderL: [-2.0, 0, 0.6], elbowL: [-0.8, 0, 0],
          shoulderR: [-2.0, 0, -0.6], elbowR: [-0.8, 0, 0],
          hipL: [-1.3, 0, 0.06], kneeL: [1.7, 0, 0],
          hipR: [-0.4, 0, -0.06], kneeR: [1.4, 0, 0],
        }, [0.35, GY - 0.6, 0], FACE_NEG_X) },
      { caption: 'Walk your other hand to meet your choking hand. Lock the grip.',
        hint: 'Hands clasp under their throat. Elbows pinch.',
        attacker: P({
          spine: [0.3, 0, 0], chest: [0.2, 0, 0], neck: [-0.15, 0, 0],
          shoulderL: [-2.0, 0, 0.9], elbowL: [-2.4, 0, 0.4],
          shoulderR: [-2.4, 0, -1.0], elbowR: [-2.4, 0, -0.4],
          wristR: [0, 0, 0.4],
          hipL: [0.3, 0, 0.06], kneeL: [0.3, 0, 0],
          hipR: [0.4, 0, -0.06], kneeR: [0.3, 0, 0],
        }, [-0.4, GY - 0.3, 0], FACE_POS_X),
        opponent: P({
          spine: [0.85, 0, 0], chest: [0.4, 0, 0], neck: [0.4, 0, 0],
          shoulderL: [-1.6, 0, 0.6], elbowL: [-1.4, 0, 0],
          shoulderR: [-1.6, 0, -0.6], elbowR: [-1.4, 0, 0],
          hipL: [-1.3, 0, 0.06], kneeL: [1.7, 0, 0],
          hipR: [-0.4, 0, -0.06], kneeR: [1.4, 0, 0],
        }, [0.3, GY - 0.65, 0], FACE_NEG_X) },
      { caption: 'Stand tall, arch back. Squeeze elbows together. Their chin meets your forearm.',
        hint: 'The CHOKE is the arch — not your bicep.',
        attacker: P({
          spine: [-0.25, 0, 0], chest: [-0.1, 0, 0], neck: [-0.2, 0, 0],
          shoulderL: [-1.8, 0, 1.0], elbowL: [-2.4, 0, 0.5],
          shoulderR: [-2.4, 0, -1.0], elbowR: [-2.4, 0, -0.5],
          wristR: [0, 0, 0.4],
          hipL: [0.15, 0, 0.06], kneeL: [0.4, 0, 0],
          hipR: [0.2, 0, -0.06], kneeR: [0.4, 0, 0],
        }, [-0.45, GY - 0.15, 0], FACE_POS_X),
        opponent: P({
          spine: [0.95, 0, 0], chest: [0.5, 0, 0], neck: [0.6, 0, 0],
          shoulderL: [-1.4, 0, 0.7], shoulderR: [-1.4, 0, -0.7],
          elbowL: [-1.6, 0, 0], elbowR: [-1.6, 0, 0],
          hipL: [-1.3, 0, 0.06], kneeL: [1.7, 0, 0],
          hipR: [-0.4, 0, -0.06], kneeR: [1.4, 0, 0],
        }, [0.3, GY - 0.7, 0], FACE_NEG_X) },
    ],
  },

  // =================================================
  {
    id: 'rnc',
    name: 'Rear Naked Choke',
    category: 'Submission',
    difficulty: 'Beginner',
    target: ['neck', 'head'],
    icon: '🩸',
    summary: 'From back control: arm under chin, figure-4 grip, squeeze.',
    steps: [
      { caption: 'Back control. Hooks in, chest on their back.',
        hint: 'Heels inside their thighs.',
        attacker: backControlAtt(),
        opponent: backControlOpp() },
      { caption: 'Free hand peels their chin to one side — exposes the neck.',
        hint: 'Don\'t feed the arm yet. Clear the chin first.',
        attacker: P({
          spine: [0.1, 0, -0.1], chest: [0.05, 0, -0.05], neck: [0, 0, -0.1],
          shoulderL: [-1.6, 0, 1.0], elbowL: [-1.6, 0, 0.4],
          shoulderR: [-0.5, 0, -1.3], elbowR: [-1.4, 0, -0.5],
          hipL: [-1.1, 0, 0.7], kneeL: [1.2, 0, 0],
          hipR: [-1.1, 0, -0.7], kneeR: [1.2, 0, 0],
        }, [-0.35, GY_LOW_KNEEL, 0], FACE_POS_X),
        opponent: P({
          spine: [0.3, 0, 0], chest: [0.2, 0, 0], neck: [0, 0, 0.4],
          shoulderL: [-0.5, 0, 0.5], shoulderR: [-0.5, 0, -0.5],
          elbowL: [-0.8, 0, 0], elbowR: [-0.8, 0, 0],
          hipL: [-1.4, 0, 0.06], kneeL: [1.6, 0, 0],
          hipR: [-1.4, 0, -0.06], kneeR: [1.6, 0, 0],
        }, [0.1, GY_LOW_KNEEL + 0.02, 0], FACE_POS_X) },
      { caption: 'Slide your choke arm under their chin. Bicep one side, forearm the other.',
        hint: 'Elbow points at their belly button.',
        attacker: P({
          spine: [0.1, 0, -0.15], chest: [0.05, 0, -0.1], neck: [0, 0, -0.15],
          shoulderL: [-1.6, 0, 1.0], elbowL: [-1.6, 0, 0.4],
          shoulderR: [-2.3, 0, -1.4], elbowR: [-2.6, 0, -0.4],
          wristR: [0, 0, 0.5],
          hipL: [-1.1, 0, 0.7], kneeL: [1.2, 0, 0],
          hipR: [-1.1, 0, -0.7], kneeR: [1.2, 0, 0],
        }, [-0.35, GY_LOW_KNEEL, 0], FACE_POS_X),
        opponent: P({
          spine: [0.3, 0, 0], chest: [0.2, 0, 0], neck: [0.1, 0, 0.3],
          shoulderL: [-0.6, 0, 0.5], shoulderR: [-0.6, 0, -0.5],
          elbowL: [-1.0, 0, 0], elbowR: [-1.0, 0, 0],
          hipL: [-1.4, 0, 0.06], kneeL: [1.6, 0, 0],
          hipR: [-1.4, 0, -0.06], kneeR: [1.6, 0, 0],
        }, [0.1, GY_LOW_KNEEL + 0.02, 0], FACE_POS_X) },
      { caption: 'Choke hand grabs your other bicep. Free hand goes behind their head. Figure-four.',
        hint: 'No gaps. Their head is trapped.',
        attacker: P({
          spine: [0.05, 0, -0.2], chest: [0, 0, -0.1], neck: [-0.1, 0, -0.2],
          shoulderL: [-2.6, 0, 0.4], elbowL: [-2.6, 0, 0.5],
          wristL: [0, 0, -0.5],
          shoulderR: [-2.5, 0, -1.2], elbowR: [-2.6, 0, -0.4],
          wristR: [0, 0, 0.5],
          hipL: [-1.1, 0, 0.7], kneeL: [1.2, 0, 0],
          hipR: [-1.1, 0, -0.7], kneeR: [1.2, 0, 0],
        }, [-0.35, GY_LOW_KNEEL, 0], FACE_POS_X),
        opponent: P({
          spine: [0.4, 0, 0], chest: [0.25, 0, 0], neck: [0.4, 0, 0],
          shoulderL: [-0.8, 0, 0.5], shoulderR: [-0.8, 0, -0.5],
          elbowL: [-1.2, 0, 0], elbowR: [-1.2, 0, 0],
          hipL: [-1.4, 0, 0.06], kneeL: [1.6, 0, 0],
          hipR: [-1.4, 0, -0.06], kneeR: [1.6, 0, 0],
        }, [0.05, GY_LOW_KNEEL - 0.05, 0], FACE_POS_X) },
      { caption: 'Lean back, chest up, drive elbows together. Their chin tucks into the V.',
        hint: 'Slow. Their face will tell you when.',
        attacker: P({
          spine: [-0.25, 0, -0.25], chest: [-0.1, 0, -0.1], neck: [-0.2, 0, -0.25],
          shoulderL: [-2.6, 0, 0.5], elbowL: [-2.7, 0, 0.5],
          shoulderR: [-2.6, 0, -1.0], elbowR: [-2.7, 0, -0.5],
          wristR: [0, 0, 0.5],
          hipL: [-1.1, 0, 0.7], kneeL: [1.2, 0, 0],
          hipR: [-1.1, 0, -0.7], kneeR: [1.2, 0, 0],
        }, [-0.4, GY_LOW_KNEEL - 0.05, 0], FACE_POS_X),
        opponent: P({
          spine: [0.5, 0, 0], chest: [0.3, 0, 0], neck: [0.6, 0, 0],
          shoulderL: [-1.0, 0, 0.5], shoulderR: [-1.0, 0, -0.5],
          elbowL: [-1.2, 0, 0], elbowR: [-1.2, 0, 0],
          hipL: [-1.4, 0, 0.06], kneeL: [1.6, 0, 0],
          hipR: [-1.4, 0, -0.06], kneeR: [1.6, 0, 0],
        }, [0.05, GY_LOW_KNEEL - 0.1, 0], FACE_POS_X) },
    ],
  },

  // =================================================
  {
    id: 'armbarGuard',
    name: 'Armbar from Guard',
    category: 'Submission',
    difficulty: 'Intermediate',
    target: ['upperArmR', 'forearmR', 'upperArmL', 'forearmL'],
    icon: '💪',
    summary: 'From closed guard: trap wrist, swing leg over, extend.',
    steps: [
      { caption: 'Closed guard. Opponent posturing inside your legs.',
        hint: 'Your back is on the mat.',
        attacker: guardClosedAtt(),
        opponent: guardClosedOpp() },
      { caption: 'Grab one wrist with two hands. Pin it to your chest.',
        hint: 'Pull on the wrist — break their posture.',
        attacker: P({
          spine: [0.25, 0, 0], chest: [0.2, 0, 0], neck: [0.1, 0, 0],
          shoulderL: [-2.4, 0, 0.4], elbowL: [-1.8, 0, 0.3],
          wristL: [0, 0, 0],
          shoulderR: [-2.4, 0, -0.4], elbowR: [-1.8, 0, -0.3],
          wristR: [0, 0, 0],
          hipL: [-PI/2 + 0.3, 0, 0.5], kneeL: [PI - 0.8, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.5], kneeR: [PI - 0.8, 0, 0],
        }, [0.05, GY_LIE + 0.05, 0], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.2, 0, 0], chest: [-0.1, 0, 0],
          shoulderL: [-1.6, 0, 0.5], elbowL: [-1.0, 0, 0.2],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          ankleL: [-PI/2 + 0.15, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
          ankleR: [-PI/2 + 0.15, 0, 0],
        }, [0.65, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Foot on hip. Use it to scoot your hips out at an angle.',
        hint: 'Get your body perpendicular to theirs.',
        attacker: P({
          spine: [0.25, 0, 0.25], chest: [0.2, 0, 0.2],
          shoulderL: [-2.4, 0, 0.4], elbowL: [-1.8, 0, 0.3],
          shoulderR: [-2.4, 0, -0.4], elbowR: [-1.8, 0, -0.3],
          hipL: [-PI/2 - 0.3, 0, 0.5], kneeL: [0.5, 0, 0],
          hipR: [-PI/2, 0, -0.5], kneeR: [PI - 0.6, 0, 0],
        }, [0.05, GY_LIE + 0.05, 0.2], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.2, 0, 0.1], chest: [-0.1, 0, 0.05],
          shoulderL: [-1.8, 0, 0.5], elbowL: [-1.0, 0, 0.2],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.65, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Climb your high leg up onto their shoulder — knee near their face.',
        hint: 'Other foot stays on their hip for control.',
        attacker: P({
          spine: [0.1, 0, 0.15], chest: [0.1, 0, 0.1],
          shoulderL: [-2.5, 0, 0.4], elbowL: [-1.6, 0, 0.2],
          shoulderR: [-2.5, 0, -0.4], elbowR: [-1.6, 0, -0.2],
          hipL: [-PI - 0.1, 0, 0.15], kneeL: [0.3, 0, 0],
          hipR: [-PI/2, 0, -0.5], kneeR: [PI - 0.6, 0, 0],
        }, [0.05, GY_LIE + 0.08, 0.1], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.3, 0, 0.15], chest: [-0.2, 0, 0.1],
          shoulderL: [-2.2, 0, 0.5], elbowL: [-0.5, 0, 0.1],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.6, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Swing the top leg OVER their head. Pinch knees, fall back.',
        hint: 'Their wrist stays glued to your chest.',
        attacker: P({
          spine: [0.05, 0, 0], chest: [0.1, 0, 0.05],
          shoulderL: [-2.6, 0, 0.4], elbowL: [-2.0, 0, 0.3],
          shoulderR: [-2.6, 0, -0.4], elbowR: [-2.0, 0, -0.3],
          hipL: [-PI/2 + 0.1, 0, 0.2], kneeL: [0.4, 0, 0],
          hipR: [-PI/2 + 0.2, 0, -0.2], kneeR: [0.4, 0, 0],
        }, [0.1, GY_LIE + 0.08, 0.1], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [0, 0, 0.1], chest: [0.05, 0, 0.05],
          shoulderL: [-2.0, 0, 0.5], elbowL: [-0.6, 0, 0.1],
          shoulderR: [-0.6, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [-0.5, 0, 0.1], kneeL: [0.8, 0, 0],
          hipR: [-0.5, 0, -0.1], kneeR: [0.8, 0, 0],
        }, [0.4, GY_LIE + 0.1, 0.3], FACE_DOWN_HEAD_POS_Z) },
      { caption: 'Both legs squeeze. Bridge hips up. The shoulder is the hinge.',
        hint: 'SLOW. Their thumb stays UP.',
        attacker: armbarFinishAtt(),
        opponent: armbarFinishOpp() },
    ],
  },

  // =================================================
  {
    id: 'triangle',
    name: 'Triangle Choke',
    category: 'Submission',
    difficulty: 'Intermediate',
    target: ['neck', 'upperArmL', 'upperArmR'],
    icon: '🔺',
    summary: 'One arm in, one arm out — legs lock around the neck.',
    steps: [
      { caption: 'Closed guard.',
        hint: 'Hunt for the angle.',
        attacker: guardClosedAtt(),
        opponent: guardClosedOpp() },
      { caption: 'Trap one wrist; SHOVE the other arm outside your knee.',
        hint: 'One arm IN, one OUT.',
        attacker: P({
          spine: [0.25, 0, 0], chest: [0.2, 0, 0],
          shoulderL: [-2.4, 0, 0.3], elbowL: [-1.8, 0, 0.3],
          shoulderR: [-2.2, 0, -0.7], elbowR: [-1.6, 0, -0.3],
          hipL: [-PI/2 + 0.3, 0, 0.5], kneeL: [PI - 0.8, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.5], kneeR: [PI - 0.8, 0, 0],
        }, [0.05, GY_LIE + 0.05, 0], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.2, 0, 0], chest: [-0.1, 0, 0],
          shoulderL: [-1.4, 0, 0.5], elbowL: [-1.0, 0, 0.2],
          shoulderR: [-2.2, 0, -0.5], elbowR: [-1.4, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.65, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Angle off. High knee climbs onto their shoulder near the neck.',
        hint: 'Hip escape — get perpendicular.',
        attacker: P({
          spine: [0.15, 0, 0.3], chest: [0.15, 0, 0.2],
          shoulderL: [-1.8, 0, 0.5], elbowL: [-1.4, 0, 0.2],
          shoulderR: [-2.2, 0, -0.7], elbowR: [-1.6, 0, -0.3],
          hipL: [-PI - 0.1, 0, 0.2], kneeL: [0.4, 0, 0],
          hipR: [-PI/2, 0, -0.5], kneeR: [PI - 0.6, 0, 0],
        }, [0.05, GY_LIE + 0.05, 0.2], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.3, 0, 0.1], chest: [-0.2, 0, 0.05], neck: [0.4, 0, 0],
          shoulderL: [-1.6, 0, 0.4], elbowL: [-1.0, 0, 0.2],
          shoulderR: [-2.2, 0, -0.5], elbowR: [-1.2, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.55, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Other leg crosses behind your high knee — figure-four lock.',
        hint: 'Calf bone behind your knee.',
        attacker: P({
          spine: [0.2, 0, 0.1], chest: [0.15, 0, 0.05],
          shoulderL: [-2.0, 0, 0.5], elbowL: [-2.0, 0, 0.4],
          shoulderR: [-2.2, 0, -0.4], elbowR: [-1.4, 0, -0.3],
          hipL: [-PI/2 - 0.1, 0, 0.15], kneeL: [PI/2, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.6], kneeR: [PI - 0.5, 0, 0],
        }, [0.05, GY_LIE + 0.06, 0.1], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.4, 0, 0], chest: [-0.3, 0, 0], neck: [0.5, 0, 0],
          shoulderL: [-1.6, 0, 0.5], elbowL: [-1.2, 0, 0],
          shoulderR: [-2.4, 0, -0.5], elbowR: [-1.6, 0, 0],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.5, GY_KNEEL - 0.05, 0], FACE_NEG_X) },
      { caption: 'Pull their head down with both hands. Bridge slightly. Choke is on.',
        hint: 'Your thigh seals one side; their shoulder seals the other.',
        attacker: triangleFinishAtt(),
        opponent: triangleFinishOpp() },
    ],
  },

  // =================================================
  {
    id: 'kimura',
    name: 'Kimura',
    category: 'Submission',
    difficulty: 'Beginner',
    target: ['forearmL', 'forearmR', 'upperArmL', 'upperArmR'],
    icon: '🔧',
    summary: 'Figure-four the wrist, rotate the shoulder past its range.',
    steps: [
      { caption: 'Closed guard. They post a hand on the mat near your hip.',
        hint: 'That posted hand is an invitation.',
        attacker: guardClosedAtt(),
        opponent: P({
          spine: [-0.15, 0, 0], chest: [-0.05, 0, 0],
          shoulderL: [-1.9, 0, 0.6], elbowL: [-0.4, 0, 0.1],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.65, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Grab their wrist with your SAME-side hand.',
        hint: 'Their LEFT wrist with your LEFT hand.',
        attacker: P({
          spine: [0.25, 0, 0], chest: [0.2, 0, 0],
          shoulderL: [-2.6, 0, 0.4], elbowL: [-1.0, 0, 0],
          wristL: [0, 0, 0],
          shoulderR: [-1.8, 0, -0.6], elbowR: [-1.4, 0, -0.3],
          hipL: [-PI/2 + 0.3, 0, 0.5], kneeL: [PI - 0.8, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.5], kneeR: [PI - 0.8, 0, 0],
        }, [0.05, GY_LIE + 0.05, 0], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.15, 0, 0], chest: [-0.05, 0, 0],
          shoulderL: [-1.9, 0, 0.6], elbowL: [-0.4, 0, 0.1],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.65, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Sit up explosively. Hip escape slightly.',
        hint: 'Pull yourself up with the wrist grip.',
        attacker: P({
          spine: [-0.6, 0, 0.1], chest: [-0.2, 0, 0.05], neck: [0.2, 0, 0],
          shoulderL: [-2.6, 0, 0.4], elbowL: [-1.0, 0, 0],
          shoulderR: [-1.2, 0, -0.5], elbowR: [-1.4, 0, -0.3],
          hipL: [-PI/2 + 0.4, 0, 0.4], kneeL: [PI - 0.5, 0, 0],
          hipR: [-PI/2 + 0.4, 0, -0.4], kneeR: [PI - 0.5, 0, 0],
        }, [0.05, GY_LIE + 0.25, 0.05], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.15, 0, 0], chest: [-0.05, 0, 0],
          shoulderL: [-1.9, 0, 0.6], elbowL: [-0.4, 0, 0.1],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.65, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Reach your free arm OVER their tricep. Grab your own wrist.',
        hint: 'Figure-four grip locks the arm.',
        attacker: P({
          spine: [-0.4, 0, 0.05], chest: [-0.1, 0, 0.05],
          shoulderL: [-2.4, 0, 0.4], elbowL: [-1.6, 0, 0.2],
          wristL: [0, 0, 0],
          shoulderR: [-2.5, 0, -0.5], elbowR: [-2.2, 0, 0.4],
          wristR: [0, 0, 0],
          hipL: [-PI/2 + 0.3, 0, 0.4], kneeL: [PI - 0.5, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.4], kneeR: [PI - 0.5, 0, 0],
        }, [0.05, GY_LIE + 0.2, 0.05], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.2, 0, 0.05], chest: [-0.1, 0, 0.05],
          shoulderL: [-2.4, 0, 0.6], elbowL: [-1.0, 0, 0.1],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.55, GY_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Trap their body by throwing a leg over their back.',
        hint: 'Don\'t let them roll out.',
        attacker: P({
          spine: [-0.2, 0, 0.05], chest: [0, 0, 0.05],
          shoulderL: [-2.4, 0, 0.4], elbowL: [-1.8, 0, 0.2],
          shoulderR: [-2.5, 0, -0.5], elbowR: [-2.2, 0, 0.4],
          hipL: [-PI - 0.2, 0, 0.2], kneeL: [0.6, 0, 0],
          hipR: [-PI/2 + 0.2, 0, -0.5], kneeR: [PI - 0.5, 0, 0],
        }, [0.05, GY_LIE + 0.15, 0.05], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [-0.3, 0, 0.1], chest: [-0.1, 0, 0.05],
          shoulderL: [-2.6, 0, 0.5], elbowL: [-1.4, 0, 0.1],
          shoulderR: [-0.5, 0, -0.4], elbowR: [-1.0, 0, -0.2],
          hipL: [0.1, 0, 0.05], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [0.1, 0, -0.05], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0.5, GY_LOW_KNEEL, 0], FACE_NEG_X) },
      { caption: 'Lie back. Rotate their wrist UP toward their own head.',
        hint: 'SLOW. The shoulder is fragile.',
        attacker: kimuraFinishAtt(),
        opponent: kimuraFinishOpp() },
    ],
  },

  // =================================================
  {
    id: 'mountUpa',
    name: 'Mount Escape (Upa)',
    category: 'Escape',
    difficulty: 'Beginner',
    target: ['torso', 'hip', 'upperArmL', 'upperArmR'],
    icon: '🔄',
    summary: 'Trap arm + leg, bridge and roll to top.',
    steps: [
      { caption: 'You\'re mounted. They\'re sitting on your hips.',
        hint: 'Don\'t panic — and don\'t reach UP.',
        attacker: P({
          spine: [0.05, 0, 0], chest: [0.05, 0, 0],
          shoulderL: [-0.4, 0, 0.5], elbowL: [-1.4, 0, 0.2],
          shoulderR: [-0.4, 0, -0.5], elbowR: [-1.4, 0, -0.2],
          hipL: [-0.2, 0, 0.1], kneeL: [0.5, 0, 0],
          hipR: [-0.2, 0, -0.1], kneeR: [0.5, 0, 0],
        }, [0, GY_LIE, 0], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [0.15, 0, 0], chest: [0.1, 0, 0],
          shoulderL: [-0.6, 0, 0.5], shoulderR: [-0.6, 0, -0.5],
          elbowL: [-0.8, 0, 0], elbowR: [-0.8, 0, 0],
          hipL: [-PI/2 + 0.3, 0, 0.5], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.5], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0, GY_LOW_KNEEL - 0.05, 0], FACE_NEG_X) },
      { caption: 'Trap one of their wrists across your chest with both your hands.',
        hint: 'They can\'t post with that arm.',
        attacker: P({
          spine: [0.1, 0, 0],
          shoulderL: [-2.4, 0, 0.4], elbowL: [-1.8, 0, 0.3],
          shoulderR: [-2.4, 0, -0.4], elbowR: [-1.8, 0, -0.3],
          hipL: [-0.2, 0, 0.1], kneeL: [0.6, 0, 0],
          hipR: [-0.2, 0, -0.1], kneeR: [0.6, 0, 0],
        }, [0, GY_LIE + 0.02, 0], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [0.2, 0, 0], chest: [0.1, 0, 0],
          shoulderL: [-2.0, 0, 0.6], elbowL: [-1.0, 0, 0.2],
          shoulderR: [-0.6, 0, -0.5],
          hipL: [-PI/2 + 0.3, 0, 0.5], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.5], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0, GY_LOW_KNEEL - 0.05, 0], FACE_NEG_X) },
      { caption: 'Step the foot on the SAME side as the trapped arm — outside their leg.',
        hint: 'Heel close to your butt.',
        attacker: P({
          spine: [0.1, 0, 0],
          shoulderL: [-2.4, 0, 0.4], elbowL: [-1.8, 0, 0.3],
          shoulderR: [-2.4, 0, -0.4], elbowR: [-1.8, 0, -0.3],
          hipL: [-PI/2 + 0.2, 0, 0.2], kneeL: [PI - 0.5, 0, 0],
          hipR: [-0.2, 0, -0.1], kneeR: [0.6, 0, 0],
        }, [0, GY_LIE + 0.02, 0], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [0.2, 0, 0], chest: [0.1, 0, 0],
          shoulderL: [-2.0, 0, 0.6], elbowL: [-1.0, 0, 0.2],
          shoulderR: [-0.6, 0, -0.5],
          hipL: [-PI/2 + 0.3, 0, 0.5], kneeL: [PI/2 + 0.3, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.5], kneeR: [PI/2 + 0.3, 0, 0],
        }, [0, GY_LOW_KNEEL - 0.05, 0], FACE_NEG_X) },
      { caption: 'Bridge UP and OVER your shoulder. They roll.',
        hint: 'Drive hips skyward — they have no posts.',
        attacker: P({
          spine: [-0.2, 0, 0.3], chest: [-0.1, 0, 0.2],
          shoulderL: [-2.4, 0, 0.4], elbowL: [-1.8, 0, 0.3],
          shoulderR: [-2.4, 0, -0.4], elbowR: [-1.8, 0, -0.3],
          hipL: [-PI/2 + 0.1, 0, 0.2], kneeL: [PI - 0.3, 0, 0],
          hipR: [-0.2, 0, -0.1], kneeR: [0.5, 0, 0],
        }, [0, GY_LIE + 0.15, 0.1], ON_BACK_HEAD_NEG_X),
        opponent: P({
          spine: [0.4, 0, 0.3],
          shoulderL: [-2.4, 0, 0.6], elbowL: [-1.2, 0, 0.2],
          shoulderR: [-0.8, 0, -0.5],
          hipL: [-1.0, 0, 0.5], kneeL: [0.5, 0, 0],
          hipR: [-1.0, 0, -0.3], kneeR: [0.5, 0, 0],
        }, [0, GY_LOW_KNEEL + 0.1, 0.3], [-0.5, -PI/2, 0]) },
      { caption: 'Land in their guard, on top. From here you can pass.',
        hint: 'You went from worst to better in 4 moves.',
        attacker: P({
          spine: [-0.05, 0, 0],
          shoulderL: [-0.6, 0, 0.4], elbowL: [-0.8, 0, 0.2],
          shoulderR: [-0.6, 0, -0.4], elbowR: [-0.8, 0, -0.2],
          hipL: [-0.6, 0, 0.1], kneeL: [PI/2 + 0.4, 0, 0],
          hipR: [-0.6, 0, -0.1], kneeR: [PI/2 + 0.4, 0, 0],
        }, [0, GY_KNEEL - 0.05, 0.6], FACE_POS_Z),
        opponent: P({
          spine: [0.2, 0, 0],
          shoulderL: [-1.2, 0, 0.5], elbowL: [-0.8, 0, 0.1],
          shoulderR: [-1.2, 0, -0.5], elbowR: [-0.8, 0, -0.1],
          hipL: [-PI/2 + 0.3, 0, 0.5], kneeL: [PI - 0.5, 0, 0],
          hipR: [-PI/2 + 0.3, 0, -0.5], kneeR: [PI - 0.5, 0, 0],
        }, [0, GY_LIE + 0.05, 0.05], ON_BACK_HEAD_POS_Z) },
    ],
  },

  // =================================================
  {
    id: 'americana',
    name: 'Americana (Keylock)',
    category: 'Submission',
    difficulty: 'Beginner',
    target: ['upperArmL', 'forearmL', 'upperArmR', 'forearmR'],
    icon: '🔑',
    summary: 'From side control, bend arm into "L", drive wrist to mat.',
    steps: [
      { caption: 'Side control. You\'re pinning them flat.',
        hint: 'Heavy hips, shoulder pressure.',
        attacker: sideControlAtt(),
        opponent: onBackOpp(0.9, 0) },
      { caption: 'Grab their wrist as it appears near your chest.',
        hint: 'Pin it against the mat above their head.',
        attacker: P({
          spine: [0.2, 0, 0], chest: [0.15, 0, 0], neck: [-0.2, 0, 0],
          shoulderL: [-2.6, 0, 0.4], elbowL: [-1.8, 0, 0.3],
          wristL: [0, 0, 0],
          shoulderR: [-1.8, 0, -0.7], elbowR: [-0.6, 0, -0.2],
          hipL: [-PI/2 + 0.4, 0, 0.4], kneeL: [PI/2 + 0.2, 0, 0],
          hipR: [-PI/2 + 0.4, 0, -0.4], kneeR: [PI/2 + 0.2, 0, 0],
        }, [0.5, GY_KNEEL - 0.1, 0], FACE_POS_X),
        opponent: P({
          spine: [0, 0, 0],
          shoulderL: [-2.6, 0, 0.7], elbowL: [-1.8, 0, 0.3],
          wristL: [0, 0, 0],
          shoulderR: [-0.6, 0, -0.8], elbowR: [-1.0, 0, -0.2],
          hipL: [-0.4, 0, 0.1], kneeL: [0.6, 0, 0],
          hipR: [-0.4, 0, -0.1], kneeR: [0.6, 0, 0],
        }, [0.9, GY_LIE, 0], ON_BACK_HEAD_POS_X) },
      { caption: 'Reach under their elbow with your other arm. Grab your own wrist.',
        hint: 'Figure-four under the arm.',
        attacker: P({
          spine: [0.2, 0, 0],
          shoulderL: [-2.6, 0, 0.4], elbowL: [-1.8, 0, 0.3],
          shoulderR: [-2.4, 0, -0.3], elbowR: [-2.2, 0, 0.3],
          wristR: [0, 0, 0],
          hipL: [-PI/2 + 0.4, 0, 0.4], kneeL: [PI/2 + 0.2, 0, 0],
          hipR: [-PI/2 + 0.4, 0, -0.4], kneeR: [PI/2 + 0.2, 0, 0],
        }, [0.5, GY_KNEEL - 0.1, 0], FACE_POS_X),
        opponent: P({
          spine: [0, 0, 0],
          shoulderL: [-2.6, 0, 0.7], elbowL: [-2.0, 0, 0.5],
          shoulderR: [-0.6, 0, -0.8], elbowR: [-1.0, 0, -0.2],
          hipL: [-0.4, 0, 0.1], kneeL: [0.6, 0, 0],
          hipR: [-0.4, 0, -0.1], kneeR: [0.6, 0, 0],
        }, [0.9, GY_LIE, 0], ON_BACK_HEAD_POS_X) },
      { caption: 'Drag their wrist toward THEIR hip. The elbow stays put — that\'s the lock.',
        hint: 'Paint a half-circle on the mat with their wrist.',
        attacker: P({
          spine: [0.25, 0, 0],
          shoulderL: [-2.0, 0, 0.4], elbowL: [-2.2, 0, 0.3],
          shoulderR: [-2.4, 0, -0.3], elbowR: [-2.4, 0, 0.4],
          hipL: [-PI/2 + 0.4, 0, 0.4], kneeL: [PI/2 + 0.2, 0, 0],
          hipR: [-PI/2 + 0.4, 0, -0.4], kneeR: [PI/2 + 0.2, 0, 0],
        }, [0.5, GY_KNEEL - 0.1, 0], FACE_POS_X),
        opponent: P({
          spine: [0, 0, 0],
          shoulderL: [-2.0, 0, 0.6], elbowL: [-2.4, 0, 0.5],
          shoulderR: [-0.6, 0, -0.8], elbowR: [-1.0, 0, -0.2],
          hipL: [-0.4, 0, 0.1], kneeL: [0.6, 0, 0],
          hipR: [-0.4, 0, -0.1], kneeR: [0.6, 0, 0],
        }, [0.9, GY_LIE, 0], ON_BACK_HEAD_POS_X) },
      { caption: 'Lift their elbow as you press their wrist down. Slow.',
        hint: 'Their shoulder rotates. Tap.',
        attacker: P({
          spine: [0.3, 0, 0],
          shoulderL: [-1.6, 0, 0.4], elbowL: [-2.4, 0, 0.3],
          shoulderR: [-2.4, 0, -0.3], elbowR: [-2.6, 0, 0.5],
          hipL: [-PI/2 + 0.4, 0, 0.4], kneeL: [PI/2 + 0.2, 0, 0],
          hipR: [-PI/2 + 0.4, 0, -0.4], kneeR: [PI/2 + 0.2, 0, 0],
        }, [0.5, GY_KNEEL - 0.1, 0], FACE_POS_X),
        opponent: P({
          spine: [-0.05, 0, 0],
          shoulderL: [-1.6, 0, 0.7], elbowL: [-2.6, 0, 0.6],
          shoulderR: [-0.6, 0, -0.8], elbowR: [-1.0, 0, -0.2],
          hipL: [-0.4, 0, 0.1], kneeL: [0.6, 0, 0],
          hipR: [-0.4, 0, -0.1], kneeR: [0.6, 0, 0],
        }, [0.9, GY_LIE, 0], ON_BACK_HEAD_POS_X) },
    ],
  },

];

const BODY_PART_LABEL = {
  head: 'Head',
  neck: 'Neck',
  chest: 'Chest',
  abdomen: 'Abdomen',
  hip: 'Hips',
  torso: 'Torso',
  upperArmL: 'Left upper arm',
  upperArmR: 'Right upper arm',
  forearmL: 'Left forearm',
  forearmR: 'Right forearm',
  handL: 'Left hand',
  handR: 'Right hand',
  thighL: 'Left thigh',
  thighR: 'Right thigh',
  shinL: 'Left shin',
  shinR: 'Right shin',
  footL: 'Left foot',
  footR: 'Right foot',
};

function movesTargeting(bodyPart) {
  return MOVES.filter((m) => {
    if (m.target.includes(bodyPart)) return true;
    if (bodyPart === 'head' && m.target.includes('neck')) return true;
    if (bodyPart === 'chest' && m.target.includes('torso')) return true;
    if (bodyPart === 'abdomen' && m.target.includes('torso')) return true;
    return false;
  });
}

window.MOVES = MOVES;
window.BODY_PART_LABEL = BODY_PART_LABEL;
window.movesTargeting = movesTargeting;
window.GY = GY;
window.REST = REST;
window.P = P;
window.fightStanceA = fightStanceA;
window.fightStanceB = fightStanceB;
window.guardClosedAttacker = guardClosedAtt;
window.guardClosedOpp = guardClosedOpp;
window.backControlAtt = backControlAtt;
window.backControlOpp = backControlOpp;
window.armbarFinishAtt = armbarFinishAtt;
window.armbarFinishOpp = armbarFinishOpp;
window.triangleFinishAtt = triangleFinishAtt;
window.triangleFinishOpp = triangleFinishOpp;
window.kimuraFinishAtt = kimuraFinishAtt;
window.kimuraFinishOpp = kimuraFinishOpp;
