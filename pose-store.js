// pose-store.js — single source of truth for pose authoring.
// A "step pose" is a complete capture of a figure: world pos + rot + every bone quaternion.
//
// Public API on window.PoseStore:
//   captureFigure(fig) -> Pose                 -- snapshot of current visual state
//   applyFigure(fig, pose)                     -- write a pose to a figure
//   slerpFigure(fig, a, b, t)                  -- interpolate between two poses
//   bakeAnimFrame(fig, player, t)              -- capture a frame from a Mixamo animation
//   serialize(move) / deserialize(blob)        -- export/import move
//   autosave() / loadAutosave()                -- localStorage persistence
//   markDirty(moveId, stepIdx) / clean(...)    -- track unsaved edits
//   stepHistory(moveId, stepIdx)               -- per-step undo stack

(function () {
  const STORAGE_KEY = 'bjj.moves.v2';
  const DIRTY = new Set();      // 'moveId.stepIdx' strings

  function captureFigure(fig) {
    const bones = {};
    for (const k in fig.joints) {
      if (k === 'root') continue;
      const q = fig.joints[k].quaternion;
      bones[k] = [q.x, q.y, q.z, q.w];
    }
    return {
      pos: fig.root.position.toArray(),
      rot: [fig.root.rotation.x, fig.root.rotation.y, fig.root.rotation.z],
      bones,
    };
  }

  function applyFigure(fig, pose) {
    if (!pose) return;
    if (pose.pos) fig.root.position.fromArray(pose.pos);
    if (pose.rot) fig.root.rotation.set(...pose.rot);
    if (pose.bones) {
      for (const k in pose.bones) {
        if (fig.joints[k]) {
          const q = pose.bones[k];
          fig.joints[k].quaternion.set(q[0], q[1], q[2], q[3]);
        }
      }
    }
  }

  const _qa = new THREE.Quaternion();
  const _qb = new THREE.Quaternion();
  function slerpFigure(fig, a, b, t) {
    if (!a || !b) return;
    // Root pos lerp
    fig.root.position.set(
      a.pos[0] + (b.pos[0] - a.pos[0]) * t,
      a.pos[1] + (b.pos[1] - a.pos[1]) * t,
      a.pos[2] + (b.pos[2] - a.pos[2]) * t
    );
    // Root rot lerp (simple, OK for small deltas)
    fig.root.rotation.set(
      a.rot[0] + (b.rot[0] - a.rot[0]) * t,
      a.rot[1] + (b.rot[1] - a.rot[1]) * t,
      a.rot[2] + (b.rot[2] - a.rot[2]) * t
    );
    // Bone slerp
    for (const k in b.bones) {
      if (!fig.joints[k]) continue;
      const aq = a.bones[k] || (fig.restPose[k] && fig.restPose[k].quaternion) || [0, 0, 0, 1];
      const bq = b.bones[k];
      _qa.set(aq[0], aq[1], aq[2], aq[3]);
      _qb.set(bq[0], bq[1], bq[2], bq[3]);
      _qa.slerp(_qb, t);
      fig.joints[k].quaternion.copy(_qa);
    }
  }

  // Bake the current frame of a Mixamo animation player into a Pose.
  function bakeAnimFrame(fig, player, t) {
    player.setTime(t);
    // After setTime, the bones are at that frame's transforms.
    return captureFigure(fig);
  }

  // === Persistence ===
  function autosave() {
    if (!window.MOVES) return;
    try {
      const data = JSON.stringify(window.MOVES);
      localStorage.setItem(STORAGE_KEY, data);
    } catch (e) {
      console.warn('autosave failed', e);
    }
  }
  function loadAutosave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed)) return parsed;
    } catch (e) {}
    return null;
  }
  function clearAutosave() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // === Move serialize ===
  function serialize(move) {
    return JSON.stringify(move, null, 2);
  }
  function deserialize(text) {
    return JSON.parse(text);
  }

  // === Dirty tracking ===
  function key(mId, sIdx) { return mId + '.' + sIdx; }
  function markDirty(moveId, stepIdx) { DIRTY.add(key(moveId, stepIdx)); fireDirty(); }
  function markClean(moveId, stepIdx) { DIRTY.delete(key(moveId, stepIdx)); fireDirty(); }
  function isDirty(moveId, stepIdx) { return DIRTY.has(key(moveId, stepIdx)); }
  const dirtyListeners = [];
  function onDirtyChange(fn) { dirtyListeners.push(fn); }
  function fireDirty() { dirtyListeners.forEach(fn => fn()); }

  // === Per-step history ===
  const HISTORY = new Map();   // key -> { stack: [Pose pairs], idx }
  function pushStepHistory(moveId, stepIdx, attPose, oppPose) {
    const k = key(moveId, stepIdx);
    if (!HISTORY.has(k)) HISTORY.set(k, { stack: [], idx: -1 });
    const h = HISTORY.get(k);
    if (h.idx < h.stack.length - 1) h.stack.length = h.idx + 1;
    h.stack.push({ att: attPose, opp: oppPose });
    if (h.stack.length > 60) h.stack.shift();
    h.idx = h.stack.length - 1;
  }
  function canUndo(moveId, stepIdx) {
    const h = HISTORY.get(key(moveId, stepIdx));
    return h && h.idx > 0;
  }
  function canRedo(moveId, stepIdx) {
    const h = HISTORY.get(key(moveId, stepIdx));
    return h && h.idx < h.stack.length - 1;
  }
  function undoStep(moveId, stepIdx) {
    const h = HISTORY.get(key(moveId, stepIdx));
    if (!h || h.idx <= 0) return null;
    h.idx--;
    return h.stack[h.idx];
  }
  function redoStep(moveId, stepIdx) {
    const h = HISTORY.get(key(moveId, stepIdx));
    if (!h || h.idx >= h.stack.length - 1) return null;
    h.idx++;
    return h.stack[h.idx];
  }

  window.PoseStore = {
    captureFigure, applyFigure, slerpFigure, bakeAnimFrame,
    autosave, loadAutosave, clearAutosave,
    serialize, deserialize,
    markDirty, markClean, isDirty, onDirtyChange,
    pushStepHistory, canUndo, canRedo, undoStep, redoStep,
  };
})();
