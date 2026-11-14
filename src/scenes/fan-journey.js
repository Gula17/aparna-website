// Scenes 1-2: the hero controls, and the scroll that carries the fan through the BLDC story.
// Each pose below is where the camera and fan settle when that part of the page reaches the reader.
// On desktop the fan moves to the right of the story cards; on phones it stays above them.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// elevation: how far below the fan the camera sits (radians; about -1.4 looks straight up at the underside)
// azimuth: camera angle around the fan · zoom: >1 is closer · screenX/screenY: where the hub sits on screen
// roll: sideways tilt · air: airflow opacity
const POSES = {
  mobile: {
    hero: { elevation: -0.42, azimuth: 0, zoom: 1, screenX: 0.5, screenY: 0.3, roll: 0, air: 1 },
    intro: { elevation: -0.7, azimuth: 0.2, zoom: 1, screenX: 0.5, screenY: 0.32, roll: 0, air: 0.5 },
    steps: [
      { elevation: -0.42, azimuth: 0.35, zoom: 1.75, screenX: 0.45, screenY: 0.1, roll: 0, air: 0.2 }, // BLDC motor: three-quarter view from below, so the split along the shaft reads; high and smaller, so the opened parts fit above the 01 card
      { elevation: -1.0, azimuth: 0.5, zoom: 1.15, screenX: 0.5, screenY: 0.3, roll: 0.12, air: 0.5 }, // 35 W
      { elevation: -0.55, azimuth: -0.35, zoom: 1, screenX: 0.5, screenY: 0.28, roll: -0.1, air: 1 }, // 3X less power
      { elevation: -1.35, azimuth: 0, zoom: 1.35, screenX: 0.5, screenY: 0.3, roll: 0, air: 0.4 }, // remote
      { elevation: -0.12, azimuth: 0.6, zoom: 1.9, screenX: 0.5, screenY: 0.32, roll: 0, air: 0.2 }, // bearing: side-on to the motor
      { elevation: -0.9, azimuth: 0, zoom: 1, screenX: 0.5, screenY: 0.3, roll: 0, air: 0.7 }, // warranty
    ],
    exit: { elevation: -0.6, azimuth: -0.4, zoom: 0.7, screenX: 0.5, screenY: 0.2, roll: 0.2, air: 0.3 },
  },
  desktop: {
    hero: { elevation: -0.42, azimuth: 0, zoom: 1, screenX: 0.5, screenY: 0.3, roll: 0, air: 1 },
    intro: { elevation: -0.7, azimuth: 0.25, zoom: 1, screenX: 0.64, screenY: 0.42, roll: 0, air: 0.5 },
    steps: [
      { elevation: -0.42, azimuth: 0.35, zoom: 2.7, screenX: 0.6, screenY: 0.2, roll: 0, air: 0.2 }, // BLDC motor: three-quarter view, the split reads
      { elevation: -1.0, azimuth: 0.6, zoom: 1.2, screenX: 0.66, screenY: 0.46, roll: 0.14, air: 0.5 },
      { elevation: -0.55, azimuth: -0.4, zoom: 1.05, screenX: 0.66, screenY: 0.4, roll: -0.12, air: 1 },
      { elevation: -1.35, azimuth: 0.2, zoom: 1.4, screenX: 0.68, screenY: 0.5, roll: 0, air: 0.4 },
      { elevation: -0.12, azimuth: 0.7, zoom: 2.0, screenX: 0.68, screenY: 0.5, roll: 0, air: 0.2 },
      { elevation: -0.9, azimuth: 0, zoom: 1.05, screenX: 0.66, screenY: 0.46, roll: 0, air: 0.7 },
    ],
    // As the story ends the fan drifts up and away to the right, still turning, before the stage scrolls off.
    exit: { elevation: -0.6, azimuth: -0.5, zoom: 0.72, screenX: 0.84, screenY: 0.26, roll: 0.25, air: 0.3 },
  },
};

const isDesktop = () => matchMedia('(min-width: 900px)').matches;

// The hero framing for the current screen size (the loader hands over to this).
export const getHeroPose = () => ({ ...(isDesktop() ? POSES.desktop : POSES.mobile).hero, ...shortPhone() });
// Phones whose visible height is short (iPhone Safari with its toolbars shows ~660 px): the hero fan sits higher
// and smaller, so it never reaches the three-line headline at the bottom of the hero.
function shortPhone() {
  if (isDesktop() || innerHeight >= 760) return {};
  return innerHeight < 700 ? { screenY: 0.21, zoom: 0.78 } : { screenY: 0.25, zoom: 0.88 };
}

export const getCurrentLevel = () => Number(document.querySelector('input[name="speed"]:checked')?.value ?? 2);

function wireControls(fan) {
  const dial = document.querySelector('.regulator__dial');
  if (!dial) return; // the home page no longer shows the speed and finish controls
  document.querySelectorAll('input[name="speed"]').forEach((input) => {
    input.addEventListener('change', () => {
      fan.setLevel(Number(input.value));
      dial.style.setProperty('--level', input.value);
    });
  });
  // Tapping the dial itself turns it up one step, like a real regulator (and wraps from 5 to 1).
  dial.addEventListener('click', () => {
    const next = document.querySelector(`input[name="speed"][value="${(getCurrentLevel() % 5) + 1}"]`);
    next.checked = true;
    next.dispatchEvent(new Event('change'));
  });
  dial.style.cursor = 'pointer';

  document.querySelectorAll('input[name="finish"]').forEach((input) => {
    input.addEventListener('change', () => fan.setFinish(input.value));
  });
}

let labelTicker = null;

// ---------------------------------------------------------------- the motor story (steps "01" and "05")

// The steps that open the motor (by their key in en.json bldc.steps), the parts each names in order (the keys of
// en.json bldc.parts, as in src/templates/home.js) and the motor's layout: 0 opens evenly, 1 leaves wide gaps
// round the two bearings so their balls show (src/three/bldc-motor.js).
const MOTOR_STEPS = {
  motor: { parts: ['motor', 'board'], layout: 0 },
  bearing: { parts: ['bearing', 'housing'], layout: 1 },
};

// Where the camera looks while a step's motor is open: `open` frames the whole opened stack (null: the step's own
// camera pose, unchanged), then a close look for each part: one look, or two that the camera travels between while
// that part is named. lookY: the point on the shaft it aims at (fan units, at
// full spread) · frame: units across the screen's narrower side · x, y: where that point sits on screen (phones
// work out y from the card, see bandY) · el, az: added to the step's camera angles (more negative el looks further
// up from below). The angles keep a clear line of sight: the board from a shallow angle, so the bottom cover
// below it doesn't hide it; the bearings from well below, so the balls show between their races.
// layout 1, full spread (bldc-motor.js): halfway between the two bearings (the camera holds both, the rotor between
// them), and the bottom cover
const BEARINGS = (-0.105 + -0.445) / 2, COVER = -0.674;
const MOTOR_LOOKS = {
  desktop: {
    motor: {
      open: null,
      motor: [{ lookY: -0.21, frame: 0.66, x: 0.62, y: 0.46, el: 0, az: 0 }],
      board: [{ lookY: -0.42, frame: 0.6, x: 0.62, y: 0.46, el: 0.22, az: 0 }],
    },
    bearing: {
      open: { lookY: -0.36, frame: 1.0, x: 0.66, y: 0.48, el: -0.1, az: 0 },
      bearing: [{ lookY: BEARINGS, frame: 0.46, x: 0.62, y: 0.48, el: -0.5, az: 0.2 }],
      housing: [{ lookY: COVER, frame: 0.62, x: 0.62, y: 0.44, el: -0.55, az: 0 }],
    },
  },
  mobile: {
    motor: {
      open: { lookY: -0.24, frame: 0.95, x: 0.34, y: 0.3, el: 0, az: 0 },
      motor: [{ lookY: -0.2, frame: 0.7, x: 0.32, y: 0.3, el: 0, az: 0 }],
      board: [{ lookY: -0.42, frame: 0.62, x: 0.32, y: 0.3, el: 0.22, az: 0 }],
    },
    bearing: {
      open: { lookY: -0.36, frame: 0.95, x: 0.34, y: 0.3, el: -0.1, az: 0 },
      bearing: [{ lookY: BEARINGS, frame: 0.4, x: 0.34, y: 0.3, el: -0.5, az: 0.2 }],
      housing: [{ lookY: COVER, frame: 0.62, x: 0.34, y: 0.3, el: -0.55, az: 0 }],
    },
  },
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { const v = clamp01(x); return v * v * (3 - 2 * v); };
const LOOK_KEYS = ['lookY', 'frame', 'x', 'y', 'el', 'az'];
const mixLook = (a, b, k) => Object.fromEntries(LOOK_KEYS.map((key) => [key, a[key] + (b[key] - a[key]) * k]));

// One moment of a motor step, from its scroll progress p (0..1): a pure function, so scrolling either way always
// lands on the same picture and the motor can never stay half open.
//   0-0.2 opens · 0.2-0.47 the first part (label, glow, close look) · 0.47-0.74 the second · 0.74-0.8 its label
//   goes · 0.8-1 closes. One label at a time: the first fades out before the second fades in.
// Returns the split, each part's glow and label, and the camera: { look, detail } (detail 0 = the step's own pose).
function motorMoment(p, looks, parts) {
  const open = smooth(p / 0.2);
  const close = smooth((p - 0.8) / 0.2);
  const first = smooth((p - 0.2) / 0.08);
  const second = smooth((p - 0.47) / 0.08);
  const done = smooth((p - 0.74) / 0.06);
  const focus = [first * (1 - second), second * (1 - done)];
  const labels = [first * (1 - smooth((p - 0.45) / 0.04)), smooth((p - 0.51) / 0.04) * (1 - done)];
  // the camera: closed -> open stack -> part 1 (travelling between its looks) -> part 2 -> open stack -> closed
  const [a0, a1 = a0] = looks[parts[0]];
  const [b0, b1 = b0] = looks[parts[1]];
  const o = looks.open;
  const along = (x, y, from, to) => mixLook(x, y, smooth((p - from) / (to - from)));
  let look, detail = 1;
  if (p < 0.2) { look = o ?? a0; detail = o ? open : 0; }
  else if (p < 0.28) { look = o ? mixLook(o, a0, first) : a0; detail = o ? 1 : first; }
  else if (p < 0.47) look = along(a0, a1, 0.28, 0.45);
  else if (p < 0.55) look = mixLook(a1, b0, second);
  else if (p < 0.74) look = along(b0, b1, 0.55, 0.72);
  else if (p < 0.8) { look = o ? mixLook(b1, o, done) : b1; detail = o ? 1 : 1 - done; }
  else { look = o ?? b1; detail = o ? 1 - close : 0; }
  return { t: open * (1 - close), focus, labels, dim: Math.max(...focus), look, detail };
}

function setupMotorStory({ fan, steps, cardOf, scrub, desktop }) {
  const box = document.querySelector('[data-motor-labels]');
  const labelEl = Object.fromEntries([...(box?.querySelectorAll('.motor-label') ?? [])].map((el) => [el.dataset.part, el]));
  const twin = box?.querySelector('[data-twin="bearing"]');
  const intro = document.querySelector('.bldc__intro');
  const spread = desktop ? 1 : 0.85; // a slightly tighter split on phones
  const looks = MOTOR_LOOKS[desktop ? 'desktop' : 'mobile'];
  const motorSteps = steps.filter((s) => MOTOR_STEPS[s.dataset.key]).map((step) => ({ step, key: step.dataset.key, p: 0 }));
  if (!motorSteps.length) return;

  // Phones: the intro heading fades as the 01 card arrives, so a label never sits on it.
  if (!desktop && intro && motorSteps[0].key === 'motor') {
    gsap.fromTo(intro, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', immediateRender: false,
      scrollTrigger: { trigger: cardOf(motorSteps[0].step), start: 'top bottom', end: 'top 80%', scrub } });
  }

  const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const hide = (el) => { if (el) { el.style.opacity = 0; el.style.visibility = 'hidden'; } };

  // Phones: the step's card scrolls up through the whole screen while its motor is open, so the motor keeps to the
  // free band above the card, and glides into the band below once the card has passed the middle.
  function bandY(card, stage) {
    const r = card.getBoundingClientRect();
    const top = r.top - stage.top, bottom = r.bottom - stage.top, H = stage.height;
    const above = Math.max(0, top), below = Math.max(0, H - bottom);
    const w = smooth(0.5 + (above - below) / (0.35 * H)); // 1: the band above is the bigger one
    return ((above / 2) * w + ((bottom + H) / 2) * (1 - w)) / H;
  }

  function apply() {
    const m = motorSteps.find((s) => s.p > 0 && s.p < 1);
    const cfg = m && MOTOR_STEPS[m.key];
    const st = m ? motorMoment(m.p, looks[m.key], cfg.parts) : null;
    fan.setExplode(st ? st.t : 0, spread, cfg ? cfg.layout : 0);
    fan.setFocus(st ? { [cfg.parts[0]]: st.focus[0], [cfg.parts[1]]: st.focus[1] } : {}, st ? st.dim : 0);
    const stage = box?.getBoundingClientRect();

    // the camera's close look
    const pose = fan.pose;
    pose.detail = st ? st.detail : 0;
    if (st && st.detail > 0) {
      const y = desktop || !stage ? st.look.y : bandY(cardOf(m.step), stage);
      Object.assign(pose, { lookY: st.look.lookY * spread, frame: st.look.frame, detailX: st.look.x, detailY: y, elevAdd: st.look.el, azAdd: st.look.az });
    }

    // the labels: only this step's, one at a time, each on its own part, faded in as the story names it
    if (!box) return;
    for (const [part, el] of Object.entries(labelEl)) if (!cfg || !cfg.parts.includes(part)) hide(el);
    hide(twin);
    if (!st || Math.max(...st.labels) <= 0.01 || st.t < 0.6) {
      if (cfg) cfg.parts.forEach((part) => hide(labelEl[part]));
      box.style.opacity = 0;
      return;
    }
    box.style.opacity = 1;
    const at = fan.explodeLabelsOnScreen(st.t, spread, cfg.layout);
    const W = box.clientWidth, H = box.clientHeight;
    const inside = (q) => q.x > 6 && q.x < W - 6 && q.y > 6 && q.y < H - 6;
    // text to keep clear of: the step's own card on every screen, and on phones the intro heading while it shows
    const avoid = [cardOf(m.step), ...(!desktop && intro && Number(getComputedStyle(intro).opacity) > 0.05 ? intro.children : [])]
      .map((el) => el.getBoundingClientRect()).filter((r) => r.height)
      .map((r) => ({ left: r.left - stage.left, right: r.right - stage.left, top: r.top - stage.top, bottom: r.bottom - stage.top }));
    cfg.parts.forEach((part, i) => {
      const el = labelEl[part];
      const opacity = st.labels[i];
      if (!el || opacity <= 0.01) { hide(el); return; }
      // "Double ball bearing": the line goes to the lower bearing, which hangs in open space (a line to the upper one
      // would cross the stator), and a second dot marks the upper bearing
      const p = at.labels[part];
      const other = part === 'bearing' ? at.labels.bearing2 : null;
      const text = el.querySelector('.motor-label__text');
      const tw = text.offsetWidth, th = text.offsetHeight;
      let placed = null;
      for (const side of ['right', 'left']) {
        const dot = side === 'right' ? { x: p.x, y: p.y } : { x: p.lx, y: p.ly };
        if (!inside(dot)) continue;
        // the line runs out past every part at the label's height, so the text never sits on the motor
        const row = at.outline.filter((q) => Math.abs(q.y - dot.y) < th / 2 + 6);
        const edge = side === 'right' ? Math.max(dot.x, ...row.map((q) => q.x)) : Math.min(dot.x, ...row.map((q) => q.x));
        const line = Math.max(desktop ? 46 : 22, Math.abs(edge - dot.x) + 14);
        const x0 = side === 'right' ? dot.x + line : dot.x - line - tw;
        const label = { left: Math.min(dot.x, x0), right: Math.max(dot.x, x0 + tw), top: dot.y - th / 2, bottom: dot.y + th / 2 };
        const onScreen = label.left >= 6 && label.right <= W - 6 && label.top >= 6 && label.bottom <= H - 6;
        if (onScreen && !avoid.some((r) => hits(label, r))) { placed = { side, dot, line }; break; }
      }
      if (!placed) { hide(el); return; } // nowhere clear of the text this moment: no label (never one on words)
      el.classList.toggle('is-left', placed.side === 'left');
      el.style.setProperty('--line', `${Math.round(placed.line)}px`);
      el.style.transform = `translate(${Math.round(placed.dot.x)}px, ${Math.round(placed.dot.y)}px)`;
      el.style.opacity = opacity;
      el.style.visibility = 'visible';
      if (other && twin) {
        const q = placed.side === 'right' ? { x: other.x, y: other.y } : { x: other.lx, y: other.ly };
        if (inside(q) && !avoid.some((r) => hits({ left: q.x - 6, right: q.x + 6, top: q.y - 6, bottom: q.y + 6 }, r))) {
          twin.style.transform = `translate(${Math.round(q.x)}px, ${Math.round(q.y)}px)`;
          twin.style.opacity = opacity;
          twin.style.visibility = 'visible';
        }
      }
    });
  }

  // Each motor step: its progress follows the scroll (scrubbed). Desktop: over the whole step. Phones: only while
  // its CARD is on screen, from when it rises in at the bottom until it nears the top.
  for (const m of motorSteps) {
    const range = desktop
      ? { trigger: m.step, start: 'top 70%', end: 'bottom 30%' }
      : { trigger: cardOf(m.step), start: 'top 85%', end: 'top 10%' };
    gsap.fromTo(m, { p: 0 }, {
      p: 1, ease: 'none', immediateRender: false, onUpdate: apply,
      scrollTrigger: { ...range, scrub, onLeave: () => { m.p = 1; apply(); }, onLeaveBack: () => { m.p = 0; apply(); } },
    });
  }
  // keep the labels on their parts (and the motor clear of the card) while the camera drifts and the fan turns
  if (labelTicker) gsap.ticker.remove(labelTicker); // one ticker, even after a desktop/phone switch
  labelTicker = () => { if (motorSteps.some((s) => s.p > 0 && s.p < 1)) apply(); };
  gsap.ticker.add(labelTicker);
  apply();
}

export function setupFanJourney({ fan, reducedMotion }) {
  const journey = document.querySelector('.fan-journey');
  const stage = document.querySelector('.fan-stage');
  const intro = document.querySelector('.bldc__intro');
  const steps = [...document.querySelectorAll('.bldc-step')];
  if (!fan) return;

  wireControls(fan);

  // The blades pick up speed while the page is scrolled, then settle back to the regulator setting.
  ScrollTrigger.create({
    trigger: journey, start: 'top top', end: 'bottom top',
    onUpdate: (self) => fan.setScrollVelocity(self.getVelocity()),
  });

  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 900px)', mobile: '(max-width: 899px)' }, (ctx) => {
    const poses = ctx.conditions.desktop ? POSES.desktop : POSES.mobile;
    // Don't jump if the loader is still pulling the camera back into this pose.
    const hero = { ...poses.hero, ...shortPhone() };
    if (!gsap.isTweening(fan.pose)) Object.assign(fan.pose, hero);

    // Reduced motion never reaches here with 3D on, but keep scrubbing gentle if it ever does.
    const scrub = reducedMotion ? true : 0.6;

    // The room darkens into the catalogue's BLDC charcoal as the story begins.
    gsap.fromTo(stage, { '--dark': 0 }, {
      '--dark': 1, ease: 'none',
      scrollTrigger: { trigger: intro, start: 'top bottom', end: 'top 55%', scrub },
    });
    // The hero's dark headline and buttons leave as the room darkens, so they never sit dark-on-dark under the
    // fan (on short windows the darkening starts while the hero is still on screen).
    const heroCopy = document.querySelector('.hero');
    if (heroCopy) {
      gsap.fromTo(heroCopy, { autoAlpha: 1, y: 0 }, {
        autoAlpha: 0, y: -40, ease: 'none', immediateRender: false,
        scrollTrigger: { trigger: intro, start: 'top bottom', end: 'top 75%', scrub },
      });
    }

    // One tween per section, each from the previous pose to the next, over non-overlapping scroll ranges.
    const sequence = [hero, { ...poses.intro, ...(ctx.conditions.desktop ? {} : shortPhone()) }, ...poses.steps.slice(0, steps.length)];
    const triggers = [intro, ...steps];
    // Phones: each step is a tall section with its card at the bottom, so the camera follows the CARD (not the
    // section), and only moves once that card is coming on screen. Desktop is unchanged.
    const cardOf = (step) => step.querySelector('.bldc-step__card') ?? step;
    triggers.forEach((trigger, i) => {
      const phoneStep = !ctx.conditions.desktop && i > 0;
      gsap.fromTo(fan.pose, { ...sequence[i] }, {
        ...sequence[i + 1], ease: 'power1.inOut', immediateRender: false,
        scrollTrigger: phoneStep ? { trigger: cardOf(trigger), start: 'top bottom', end: 'top 55%', scrub } : { trigger, start: 'top bottom', end: 'top 35%', scrub },
      });
    });

    // Exit: once the last card has been read, the fan lifts away before the stage scrolls off.
    const lastStep = steps.at(-1);
    if (lastStep) {
      gsap.fromTo(fan.pose, { ...sequence.at(-1) }, {
        ...poses.exit, ease: 'power2.in', immediateRender: false,
        scrollTrigger: { trigger: lastStep, start: 'top 30%', end: 'bottom 30%', scrub },
      });
    }

    // The motor story: "01 BLDC" and "05 Double ball bearing · Anti-dust" open the Aeroflow's motor along its shaft
    // and name its parts one after the other, each label on its own part while that part glows and the camera
    // moves in on it (see motorMoment below). Every other step shows the closed fan.
    if (fan.explodeLabelsOnScreen) setupMotorStory({ fan, steps, cardOf, scrub, desktop: ctx.conditions.desktop });

    // The step cards rise in, and the title inside each one slides after its card.
    steps.forEach((step) => {
      const card = step.querySelector('.bldc-step__card');
      gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 78%', end: 'top 42%', scrub } })
        .from(card, { y: 50, opacity: 0, rotateX: 8, ease: 'power2.out' })
        .from(card.querySelectorAll('.bldc-step__num, .bldc-step__title, .bldc-step__body'), { y: 18, opacity: 0, stagger: 0.12, ease: 'power2.out' }, '<0.15');
    });
  });
}
