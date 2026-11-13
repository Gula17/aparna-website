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

    // "01 BLDC": the motor opens along its shaft as the step scrolls in, stays open while it is read, and closes
    // again before the next step (or on the way back up). Scrubbed, so it can never stay half open.
    const motorLabels = document.querySelector('[data-motor-labels]');
    if (steps[0] && fan.explodeLabelsOnScreen) {
      const split = { t: 0 };
      const spread = ctx.conditions.desktop ? 1 : 0.85; // a slightly tighter split on phones
      const labelEls = motorLabels ? [...motorLabels.querySelectorAll('[data-part]')] : [];
      const introBox = document.querySelector('.bldc__intro');
      // phones: a label is hidden while it would touch any text (the 01 card, the intro heading and lines), so a
      // label can never sit on words; on small screens that can mean fewer labels
      const avoid = ctx.conditions.desktop ? [] : [cardOf(steps[0]), ...document.querySelectorAll('.bldc__intro > *')];
      const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const show = () => {
        fan.setExplode(split.t, spread);
        if (!motorLabels) return;
        const on = Math.min(1, Math.max(0, (split.t - 0.55) / 0.35));
        motorLabels.style.opacity = on;
        if (on <= 0) return;
        const at = fan.explodeLabelsOnScreen(split.t, spread);
        const w = motorLabels.clientWidth;
        for (const el of labelEls) {
          const p = at[el.dataset.part];
          if (!p) continue;
          // on phones the labels alternate sides, and any that would run off the screen flips to the other side
          let left = !ctx.conditions.desktop && (el.dataset.part === 'motor' || el.dataset.part === 'board');
          const textW = el.querySelector('.motor-label__text')?.offsetWidth ?? 120;
          if (!left && p.x + textW + 40 > w) left = true;
          if (left && p.x - textW - 40 < 0) left = false;
          el.classList.toggle('is-left', left);
          el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px)`;
          if (avoid.length) {
            const box = el.querySelector('.motor-label__text').getBoundingClientRect();
            el.style.visibility = avoid.some((o) => { if (introBox && introBox.contains(o) && Number(getComputedStyle(introBox).opacity) < 0.05) return false; const r = o.getBoundingClientRect(); return r.height && hits(box, r); }) ? 'hidden' : '';
          }
        }
      };
      // Desktop: over the whole step. Phones: only while the 01 CARD is on screen (the intro heading has gone by
      // then), closed again by the time the 02 card reaches the screen.
      if (!ctx.conditions.desktop && introBox) {
        gsap.fromTo(introBox, { autoAlpha: 1 }, { autoAlpha: 0, ease: 'none', immediateRender: false,
          scrollTrigger: { trigger: cardOf(steps[0]), start: 'top bottom', end: 'top 80%', scrub } });
      }
      const range = ctx.conditions.desktop
        ? { trigger: steps[0], start: 'top 70%', end: 'bottom 30%' }
        : { trigger: cardOf(steps[0]), start: 'top 78%', endTrigger: steps[1] ? cardOf(steps[1]) : steps[0], end: steps[1] ? 'top bottom' : 'bottom top' };
      gsap.timeline({ scrollTrigger: { ...range, scrub, onLeave: () => { split.t = 0; show(); }, onLeaveBack: () => { split.t = 0; show(); } } })
        .to(split, { t: 1, duration: 0.35, ease: 'power2.inOut', onUpdate: show })
        .to(split, { t: 1, duration: 0.3, onUpdate: show })
        .to(split, { t: 0, duration: 0.35, ease: 'power2.inOut', onUpdate: show });
      // keep the labels on their parts while the fan keeps turning
      if (labelTicker) gsap.ticker.remove(labelTicker); // one ticker, even after a desktop/phone switch
      labelTicker = () => { if (split.t > 0.55) show(); };
      gsap.ticker.add(labelTicker);
    }

    // The step cards rise in, and the title inside each one slides after its card.
    steps.forEach((step) => {
      const card = step.querySelector('.bldc-step__card');
      gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 78%', end: 'top 42%', scrub } })
        .from(card, { y: 50, opacity: 0, rotateX: 8, ease: 'power2.out' })
        .from(card.querySelectorAll('.bldc-step__num, .bldc-step__title, .bldc-step__body'), { y: 18, opacity: 0, stagger: 0.12, ease: 'power2.out' }, '<0.15');
    });
  });
}
