// Animation loader for Mixamo-rigged FBX animations.
// Loads an FBX, extracts the AnimationClip, and returns it for use with AnimationMixer.

(function () {
  const cache = new Map();

  function loadAnim(url) {
    if (cache.has(url)) return cache.get(url);
    const promise = new Promise((resolve, reject) => {
      new THREE.FBXLoader().load(url,
        (fbx) => {
          if (!fbx.animations || fbx.animations.length === 0) {
            reject(new Error('No animation in ' + url));
            return;
          }
          const clip = fbx.animations[0];
          // Strip bone-name prefix variation: Mixamo prefixes vary across exports
          // (mixamorig vs mixamorig1 etc). We rewrite track names if needed.
          clip.tracks.forEach((t) => {
            // Track names are like "boneName.property"
            t.name = t.name.replace(/^[^\.]+\./, (match) => {
              const bn = match.slice(0, -1);
              // strip prefix and replace with our character's prefix
              // For now we keep as-is; mixer matches loosely
              return match;
            });
          });
          resolve(clip);
        },
        undefined,
        reject
      );
    });
    cache.set(url, promise);
    return promise;
  }

  // Per-figure AnimationMixer manager.
  // Each figure gets its own mixer attached to its skeleton root.
  function createPlayer(figure) {
    const mixer = new THREE.AnimationMixer(figure.fbxScene);
    let currentAction = null;
    let currentClip = null;

    function setClip(clip) {
      if (currentAction) currentAction.stop();
      // The clip's tracks reference bone names. If our character's bones use
      // a different prefix (e.g. "mixamorig1Hips" vs "mixamorigHips"), we
      // need to rewrite track names to match. Detect & fix.
      const ourBoneName = figure.joints.spine ? figure.joints.spine.name : null;
      let ourPrefix = '';
      if (ourBoneName) {
        const m = ourBoneName.match(/^(mixamorig\d*)/);
        if (m) ourPrefix = m[1];
      }
      // Adjust clip tracks
      const adjustedClip = clip.clone();
      adjustedClip.tracks.forEach((t) => {
        const dot = t.name.indexOf('.');
        if (dot < 0) return;
        const bn = t.name.slice(0, dot);
        // Strip whatever prefix the clip's track has and replace with ours
        const stripped = bn.replace(/^mixamorig\d*/, '');
        t.name = ourPrefix + stripped + t.name.slice(dot);
      });
      currentClip = adjustedClip;
      currentAction = mixer.clipAction(adjustedClip);
      currentAction.play();
      currentAction.paused = true;
    }

    function setTime(t) {
      if (!currentAction || !currentClip) return;
      const clamped = Math.max(0, Math.min(currentClip.duration, t));
      currentAction.time = clamped;
      mixer.update(0);   // force the bone transforms to update
    }

    function getDuration() {
      return currentClip ? currentClip.duration : 0;
    }

    function dispose() {
      if (currentAction) currentAction.stop();
      mixer.stopAllAction();
    }

    return { mixer, setClip, setTime, getDuration, dispose };
  }

  window.AnimLoader = { loadAnim, createPlayer };
})();
