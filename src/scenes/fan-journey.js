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
      { elevation: -1.3, azimuth: 0, zoom: 1.9, screenX: 0.5, screenY: 0.3, roll: 0, air: 0.3 }, // BLDC motor: right under the hub
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
      { elevation: -1.3, azimuth: 0, zoom: 1.45, screenX: 0.68, screenY: 0.5, roll: 0, air: 0.3 },
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
export const getHeroPose = () => ({ ...(isDesktop() ? POSES.desktop : POSES.mobile).hero });

export const getCurrentLevel = () => Number(document.querySelector('input[name="speed"]:checked')?.value ?? 2);

function wireControls(fan) {
  const dial = document.querySelector('.regulator__dial');
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
    if (!gsap.isTweening(fan.pose)) Object.assign(fan.pose, poses.hero);

    // Reduced motion never reaches here with 3D on, but keep scrubbing gentle if it ever does.
    const scrub = reducedMotion ? true : 0.6;

    // The room darkens into the catalogue's BLDC charcoal as the story begins.
    gsap.fromTo(stage, { '--dark': 0 }, {
      '--dark': 1, ease: 'none',
      scrollTrigger: { trigger: intro, start: 'top bottom', end: 'top 55%', scrub },
    });

    // One tween per section, each from the previous pose to the next, over non-overlapping scroll ranges.
    const sequence = [poses.hero, poses.intro, ...poses.steps.slice(0, steps.length)];
    const triggers = [intro, ...steps];
    triggers.forEach((trigger, i) => {
      gsap.fromTo(fan.pose, { ...sequence[i] }, {
        ...sequence[i + 1], ease: 'power1.inOut', immediateRender: false,
        scrollTrigger: { trigger, start: 'top bottom', end: 'top 35%', scrub },
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

    // The step cards rise in, and the title inside each one slides after its card.
    steps.forEach((step) => {
      const card = step.querySelector('.bldc-step__card');
      gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 78%', end: 'top 42%', scrub } })
        .from(card, { y: 50, opacity: 0, rotateX: 8, ease: 'power2.out' })
        .from(card.querySelectorAll('.bldc-step__num, .bldc-step__title, .bldc-step__body'), { y: 18, opacity: 0, stagger: 0.12, ease: 'power2.out' }, '<0.15');
    });
  });
}
