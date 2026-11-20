// The real-time 3D Aeroflow fan in a bright, warm room.
// Used in three places, all lazy-loaded after first paint:
//   - the hero / BLDC story (src/scenes/fan-journey.js), which also drives the loader (src/scenes/loader.js)
//   - the 360° product viewer in the Aeroflow quick view (src/scenes/products.js), with { viewer: true }
//   - the still-image render (tools/fan-still.html), with { still: true }
// Everything the page needs is on the object returned by createFanScene().

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createAeroflow } from './aeroflow-model.js';
import { collectPowerParts, applyPower } from './power.js';

// Regulator steps 1-5, in turns per second. Kept well below the speed where blades start to strobe,
// so three blades can always be counted (brief §8).
const LEVEL_SPEEDS = [0.12, 0.22, 0.36, 0.52, 0.7];
const BOOST_SPEED = 0.65;
const SCROLL_SPEED = 0.45; // extra turns per second at a fast scroll
const MAX_SPEED = 1.4;
const AIR_LINES = 70;

const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {Element} [options.observe]  rendering pauses while this element is off-screen
 * @param {boolean} [options.still]    render once, keep the drawing buffer (for screenshots)
 * @param {'high'|'low'} [options.quality]  'high' adds soft shadows; 'low' is for phones and small GPUs
 * @param {boolean} [options.viewer]   360° product viewer: drag to turn, slow auto-turn, no airflow
 * @param {Function} [options.create] the model's builder (default the Aeroflow; others from src/three/model-builders.js)
 */
export function createFanScene(canvas, { observe = canvas, still = false, quality = 'low', viewer = false, create = createAeroflow } = {}) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: still });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.setClearColor(0x000000, 0);
  if (high) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; // soft studio reflections
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  // Warm daylight from the window side, a cooler rim from behind, and a bounce from the room.
  scene.add(new THREE.HemisphereLight('#fff4e4', '#c9ae8c', 0.7));
  const key = new THREE.DirectionalLight('#fff1dc', 1.5);
  key.position.set(2.5, -1.5, 3);
  const rim = new THREE.DirectionalLight('#ffe6c8', 0.8);
  rim.position.set(-3, 2, -2);
  scene.add(key, rim);
  if (high) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 4;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.01;
    Object.assign(key.shadow.camera, { left: -1.6, right: 1.6, top: 1.6, bottom: -1.6, near: 0.5, far: 9 });
  }

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  const model = create({ shadows: high });
  scene.add(model.fan);

  // ---- Start / Stop (360° view only): blades turn and elements glow while it is on. Everything else (the hero)
  // is always on.
  const switchable = viewer;
  const powerParts = collectPowerParts(model.fan);
  let rotorMoves = false;
  model.rotor.traverse((o) => { if (o.isMesh) rotorMoves = true; });

  // Shadows stay on the fan itself (blades shading the motor and each other). A shadow on the ceiling
  // was tried and dropped: from below it reads as a second, ghost fan (brief §8: no ghost blades).

  // ---- airflow: thin lines drifting down from the blades, faster as the fan speeds up
  const air = createAirflow();
  if (!viewer) model.fan.add(air.lines);

  // ---- state the page can drive (GSAP tweens these numbers directly)
  const pose = {
    elevation: -0.42, // camera angle below the fan, radians (more negative = looking up at the underside)
    azimuth: 0, // camera angle around the fan, radians
    zoom: 1, // >1 moves closer
    screenX: 0.5, // where the hub sits on screen, 0..1
    screenY: 0.3,
    roll: 0, // tilts the whole fan sideways
    air: viewer ? 0 : 1, // airflow line opacity
    // a close look at one part of the opened motor (home page BLDC story), blended in by detail (0 = off): the
    // camera aims at the point lookY on the shaft, frames `frame` units across the screen's narrower side, puts
    // that point at detailX/detailY on screen, and adds elevAdd/azAdd to the angles
    detail: 0, lookY: 0, frame: 1, detailX: 0.5, detailY: 0.5, elevAdd: 0, azAdd: 0,
  };
  const state = {
    power: switchable ? 0 : 1, powerAmt: switchable ? 0 : 1, level: 2, omega: 0, boost: 0, boostUntil: 0, holding: false, intro: 1, visible: true, running: false,
    scroll: 0, // 0..1, how fast the page is being scrolled
    parallax: { x: 0, y: 0, tx: 0, ty: 0 }, // mouse-responsive camera drift
    drag: null, spin: { az: 0, el: 0 }, idleSince: performance.now(), // viewer only: starts face-on, turns after a pause
  };

  // ---- sizing and framing
  const size = { w: 1, h: 1 };
  function resize() {
    const rect = canvas.getBoundingClientRect();
    size.w = Math.max(1, rect.width);
    size.h = Math.max(1, rect.height);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
  }

  const focusPoint = new THREE.Vector3();
  function frameCamera() {
    const aspect = size.w / size.h;
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * aspect);
    // The fan (2.1 units across) fills most of a phone's width and about half of a wide screen.
    // Keep these in step with .fan-stage__still in hero.css.
    const fill = pose.fill ?? (aspect < 0.8 ? 0.86 : aspect < 1.3 ? 0.62 : 0.5);
    const byWidth = 1.05 / (Math.tan(hHalf) * fill);
    const byHeight = 1.05 / (Math.tan(vHalf) * 0.62);
    const k = pose.detail;
    const lerp = (a, b) => a + (b - a) * k;
    const close = pose.frame / (2 * Math.tan(Math.min(vHalf, hHalf)));
    const distance = lerp(Math.max(byWidth, byHeight * 0.55) / pose.zoom, close);
    const el = pose.elevation + pose.elevAdd * k + state.parallax.y * 0.07;
    const az = pose.azimuth + pose.azAdd * k + state.parallax.x * 0.16;
    // the point the camera turns around: the hub, or a point down the shaft for a close look at a part
    const target = k > 0 ? model.fan.localToWorld(focusPoint.set(0, pose.lookY * k, 0)) : focusPoint.set(0, 0, 0);
    camera.position.set(target.x + Math.sin(az) * Math.cos(el) * distance, target.y + Math.sin(el) * distance, target.z + Math.cos(az) * Math.cos(el) * distance);
    camera.lookAt(target);
    camera.setViewOffset(size.w, size.h, (0.5 - lerp(pose.screenX, pose.detailX)) * size.w, (0.5 - lerp(pose.screenY, pose.detailY)) * size.h, size.w, size.h);
    camera.updateProjectionMatrix();
  }

  // ---- interaction
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const finePointer = matchMedia('(pointer: fine)').matches;
  function overFan(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(model.hitArea).length > 0;
  }

  const listeners = [];
  const listen = (target, type, fn) => {
    target.addEventListener(type, fn, { passive: true });
    listeners.push(() => target.removeEventListener(type, fn));
  };

  if (!still && !viewer) {
    // Hover, drag or press-and-hold makes it spin faster, then it eases back.
    listen(window, 'pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        if (overFan(e)) state.boostUntil = performance.now() + 650;
        // Subtle mouse-responsive drift: the camera leans a little towards the pointer.
        state.parallax.tx = (e.clientX / innerWidth) * 2 - 1;
        state.parallax.ty = (e.clientY / innerHeight) * 2 - 1;
      }
      if (state.holding) state.boostUntil = performance.now() + 650;
    });
    listen(window, 'pointerdown', (e) => { if (overFan(e)) state.holding = true; });
    listen(window, 'pointerup', () => { state.holding = false; });
    listen(window, 'pointercancel', () => { state.holding = false; });
    listen(document, 'pointerleave', () => { state.parallax.tx = 0; state.parallax.ty = 0; });
  }

  if (viewer) {
    // 360° viewer: drag to turn the fan all the way round and tilt it; it keeps turning slowly when left alone.
    listen(canvas, 'pointerdown', (e) => {
      state.drag = { x: e.clientX, y: e.clientY, t: performance.now() };
      canvas.setPointerCapture?.(e.pointerId);
    });
    listen(canvas, 'pointermove', (e) => {
      if (!state.drag) return;
      const dx = e.clientX - state.drag.x;
      const dy = e.clientY - state.drag.y;
      const dt = Math.max(1, performance.now() - state.drag.t) / 1000;
      state.drag = { x: e.clientX, y: e.clientY, t: performance.now() };
      orbit(-dx * 0.01, dy * 0.006);
      state.spin = { az: (-dx * 0.01) / dt, el: (dy * 0.006) / dt };
    });
    const end = () => { state.drag = null; state.idleSince = performance.now(); };
    listen(canvas, 'pointerup', end);
    listen(canvas, 'pointercancel', end);
  }

  function orbit(dAz, dEl) {
    pose.azimuth += dAz;
    pose.elevation = clamp(pose.elevation + dEl, -1.45, 0.35);
    state.idleSince = performance.now();
    if (!state.running) render();
  }

  // ---- intro: blades unfold from the hub, canopy and downrod drop into place, the fan starts turning
  function applyIntro(t) {
    const unfold = easeOut(clamp01((t - 0.15) / 0.6));
    const grow = easeOut(clamp01(t / 0.45));
    model.blades.forEach((pivot) => {
      pivot.rotation.y = pivot.userData.restAngle * unfold;
      pivot.scale.setScalar(0.001 + 0.999 * grow);
    });
    const drop = easeOut(clamp01((t - 0.35) / 0.55));
    model.stator.position.y = (1 - drop) * 1.4;
    model.stator.visible = drop > 0.01;
  }
  function playIntro(duration = 1.3) {
    return new Promise((resolve) => {
      const start = performance.now();
      state.intro = 0;
      const step = () => {
        state.intro = clamp01((performance.now() - start) / (duration * 1000));
        if (state.intro < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  // ---- the loop
  let last = performance.now();
  function render(now = performance.now()) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    const boosting = state.holding || now < state.boostUntil;
    state.boost += ((boosting ? 1 : 0) - state.boost) * Math.min(1, dt * (boosting ? 3 : 1.2));
    state.scroll *= Math.exp(-dt * 2.5); // scroll energy fades once scrolling stops
    // switching on spins up and warms over a second or two; switching off winds down a little faster
    state.powerAmt += (state.power - state.powerAmt) * Math.min(1, dt * (state.power ? 0.9 : 1.4));
    if (Math.abs(state.power - state.powerAmt) < 0.002) state.powerAmt = state.power;
    if (powerParts.length) applyPower(powerParts, state.powerAmt, now);
    const base = LEVEL_SPEEDS[state.level - 1] * (0.25 + 0.75 * clamp01(state.intro * 1.4 - 0.2)) * state.powerAmt;
    const target = Math.min(MAX_SPEED, base + state.boost * BOOST_SPEED + state.scroll * SCROLL_SPEED);
    state.omega += (target - state.omega) * Math.min(1, dt * 2);

    // Viewed from below, the fan turns anticlockwise (downdraft), which is clockwise from above.
    model.rotor.rotation.y -= state.omega * Math.PI * 2 * dt;
    model.blurDisc.material.opacity = 0.22 * clamp01((state.omega - 0.6) / 0.8);
    model.fan.rotation.z = pose.roll;

    // Smooth the mouse drift so the fan floats rather than snaps.
    const p = state.parallax;
    p.x += (p.tx - p.x) * Math.min(1, dt * 3);
    p.y += (p.ty - p.y) * Math.min(1, dt * 3);

    if (viewer && !state.drag) {
      // Coast after a drag, then fall back to a slow turn.
      state.spin.az *= Math.exp(-dt * 3);
      state.spin.el *= Math.exp(-dt * 3);
      pose.azimuth += state.spin.az * dt;
      pose.elevation = clamp(pose.elevation + state.spin.el * dt, -1.45, 0.35);
      if (now - state.idleSince > 2000) pose.azimuth += 0.35 * dt;
    }

    applyIntro(state.intro);
    if (!viewer) air.update(dt, state.omega, pose.air * clamp01(state.intro * 2 - 0.6));
    frameCamera();
    renderer.render(scene, camera);
  }

  function loop(now) {
    if (!state.running) return;
    render(now);
    requestAnimationFrame(loop);
  }
  function setRunning(on) {
    if (still || on === state.running) return;
    state.running = on;
    if (on) {
      last = performance.now();
      requestAnimationFrame(loop);
    }
  }
  const updateRunning = () => setRunning(state.visible && !document.hidden && !state.lost);

  // iOS Safari can take the WebGL context away (memory pressure, too many contexts in one tab). Stop drawing and
  // say so (the page then shows its still picture, not a blank canvas); draw again if the context comes back.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    state.lost = true;
    setRunning(false);
    canvas.dispatchEvent(new CustomEvent('fan:contextlost', { bubbles: true }));
  });
  canvas.addEventListener('webglcontextrestored', () => {
    state.lost = false;
    canvas.dispatchEvent(new CustomEvent('fan:contextrestored', { bubbles: true }));
    updateRunning();
  });
  // leaving the page for good: free the context at once (Safari caps how many a tab may hold); a page kept in
  // the back/forward cache keeps its context so it still works when you come back
  addEventListener('pagehide', (e) => { if (!e.persisted) { renderer.dispose(); renderer.forceContextLoss(); } });

  // Pause when off-screen or in a background tab (brief §8).
  const io = new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting;
    updateRunning();
  });
  io.observe(observe);
  document.addEventListener('visibilitychange', updateRunning);
  const ro = new ResizeObserver(() => {
    resize();
    if (!state.running) render();
  });
  ro.observe(canvas);

  resize();
  // Compile every shader now so the first spin doesn't stutter (counted as real loading progress).
  renderer.compile(scene, camera);
  render();
  updateRunning();

  return {
    pose,
    viewerPose: model.viewerPose ?? null, // a model's own starting view (a pedestal fan is seen at eye level)
    ready: model.ready ?? Promise.resolve(), // its pictures (the Aeroflow's wood) have loaded
    playIntro,
    render,
    orbit,
    // what Start does on this model: 'spin' (blades, a shaft), 'heat' (glow, lamps), both, or nothing
    powerKind: !switchable ? null : rotorMoves && powerParts.length ? 'both' : rotorMoves ? 'spin' : powerParts.length ? 'heat' : null,
    setPower(on) {
      state.power = on ? 1 : 0;
      if (on) state.level = Math.max(state.level, 4); // a brisk speed once started
      if (!state.running) render();
    },
    get powered() { return state.power === 1; },
    setLevel(level) {
      state.level = Math.min(5, Math.max(1, Math.round(level)));
    },
    // Called by the scroll story with ScrollTrigger's velocity (px/s); fast scrolling spins the blades up.
    setScrollVelocity(velocity) {
      state.scroll = Math.max(state.scroll, clamp01(Math.abs(velocity) / 2500));
    },
    setFinish(name) {
      model.setFinish(name);
      if (!state.running) render();
    },
    setIntroStart() {
      state.intro = 0;
      applyIntro(0);
      render();
    },
    // Where the hub sits on screen (CSS pixels within the canvas) and its radius, for the loader hand-off.
    // The motor split for the BLDC story's "01" and "05" steps (Aeroflow only), the part being named, and where
    // its labels point on screen.
    setExplode(t, spread = 1, layout = 0) {
      if (!model.setExplode) return;
      model.setExplode(t, spread, layout);
      if (!state.running) render();
    },
    setFocus(focus, dim) {
      if (!model.setFocus) return;
      model.setFocus(focus, dim);
      if (!state.running) render();
    },
    // For each label: the point on its part's edge that faces right on screen (x, y) and the one that faces left
    // (lx, ly), so a label's dot sits on the part's visible rim whichever side its text goes. outline: points round
    // the top and bottom rims of every part of the opened stack, on screen, so a label's line can run out past every
    // part at its own height (a part's box would be too wide: a big ring seen from below is an oval, narrow near its
    // top and bottom).
    explodeLabelsOnScreen(t, spread = 1, layout = 0) {
      if (!model.explodeAnchors) return null;
      frameCamera();
      model.fan.updateMatrixWorld(true);
      // the screen's "right", as a direction across the shaft in the fan's own coordinates
      const fanQ = model.fan.getWorldQuaternion(new THREE.Quaternion()).invert();
      const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).applyQuaternion(fanQ).setY(0);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      const toScreen = (x, y, z) => {
        const p = model.fan.localToWorld(new THREE.Vector3(x, y, z)).project(camera);
        return { x: (p.x * 0.5 + 0.5) * size.w, y: (-p.y * 0.5 + 0.5) * size.h };
      };
      const { labels, stack } = model.explodeAnchors(t, spread, layout);
      const out = { labels: {}, outline: [] };
      for (const [key, { y, r }] of Object.entries(labels)) {
        const a = toScreen(dir.x * r * 0.92, y, dir.z * r * 0.92);
        const b = toScreen(-dir.x * r * 0.92, y, -dir.z * r * 0.92);
        out.labels[key] = { x: a.x, y: a.y, lx: b.x, ly: b.y };
      }
      for (const { y, r, h } of stack) {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          for (const dy of [-h / 2, h / 2]) out.outline.push(toScreen(Math.cos(a) * r, y + dy, Math.sin(a) * r));
        }
      }
      return out;
    },
    hubOnScreen() {
      frameCamera();
      const centre = new THREE.Vector3(0, -0.06, 0).project(camera);
      const edge = new THREE.Vector3(0.2, -0.06, 0).project(camera);
      const x = (centre.x * 0.5 + 0.5) * size.w;
      const y = (-centre.y * 0.5 + 0.5) * size.h;
      const ex = (edge.x * 0.5 + 0.5) * size.w;
      const ey = (-edge.y * 0.5 + 0.5) * size.h;
      return { x, y, radius: Math.hypot(ex - x, ey - y) };
    },
    dispose() {
      setRunning(false);
      io.disconnect();
      ro.disconnect();
      listeners.forEach((off) => off());
      renderer.dispose();
    },
  };
}

// Thin, short lines that fall from under the blades. Their tops fade out so they read as moving air.
function createAirflow() {
  const positions = new Float32Array(AIR_LINES * 2 * 3);
  const colors = new Float32Array(AIR_LINES * 2 * 4);
  const seeds = [];
  for (let i = 0; i < AIR_LINES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 0.25 + Math.sqrt(Math.random()) * 0.75;
    seeds.push({ x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, y: -Math.random() * 2.4, len: 0.15 + Math.random() * 0.25, speed: 0.6 + Math.random() * 0.8 });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;

  function update(dt, omega, opacity) {
    const fall = (0.35 + omega * 2.6) * dt;
    seeds.forEach((s, i) => {
      s.y -= fall * s.speed;
      if (s.y < -2.6) s.y = -0.1;
      const fade = clamp01((-s.y - 0.08) / 0.4) * clamp01((2.6 + s.y) / 0.8);
      const a = fade * opacity * (0.4 + clamp01(omega) * 0.45);
      positions.set([s.x, s.y + s.len, s.z, s.x, s.y, s.z], i * 6);
      colors.set([0.55, 0.42, 0.33, 0, 0.55, 0.42, 0.33, a], i * 8);
    });
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }
  return { lines, update };
}
