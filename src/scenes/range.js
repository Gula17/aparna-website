// Scene 3: "Ek naam, poori range".
// Desktop: the section stays pinned (CSS sticky) while vertical scroll moves the stations sideways.
// Mobile: stations are stacked cards. Either way each station gets --p (0..1, how far it has come in)
// for its "moment", and .is-active while it is on screen.

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

function trackProgress(station, scrollTrigger) {
  ScrollTrigger.create({
    ...scrollTrigger,
    onUpdate: (self) => station.style.setProperty('--p', self.progress.toFixed(3)),
    onLeave: () => station.style.setProperty('--p', '1'),
    onLeaveBack: () => station.style.setProperty('--p', '0'),
  });
}

export function setupRange({ reducedMotion }) {
  const parade = document.querySelector('.parade');
  const viewport = document.querySelector('.parade__viewport');
  const track = document.querySelector('.parade__track');
  const stations = [...document.querySelectorAll('.station[data-moment]')];
  if (!parade) return;

  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px)', () => {
    const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
    // The section is as tall as the sideways distance, plus one screen to sit pinned in.
    const setHeight = () => { parade.style.height = `${distance() + viewport.clientHeight}px`; };
    setHeight();
    ScrollTrigger.addEventListener('refreshInit', setHeight);

    const slide = gsap.to(track, {
      x: () => -distance(), ease: 'none',
      scrollTrigger: { trigger: parade, start: 'top top', end: () => `+=${distance()}`, scrub: reducedMotion ? true : 0.5, invalidateOnRefresh: true },
    });

    stations.forEach((station, i) => {
      if (reducedMotion) return;
      // The first station is already on screen when the pin starts, so it plays on the way in.
      if (i === 0) {
        station.style.setProperty('--p', '0');
        trackProgress(station, { trigger: parade, start: 'top 85%', end: 'top top' });
      } else {
        station.style.setProperty('--p', '0');
        trackProgress(station, { trigger: station, containerAnimation: slide, start: 'left right', end: 'left 35%' });
      }
      ScrollTrigger.create({
        trigger: station, containerAnimation: i === 0 ? undefined : slide,
        start: i === 0 ? 'top bottom' : 'left 85%', end: i === 0 ? '+=200%' : 'right 15%',
        toggleClass: 'is-active',
      });
    });

    return () => {
      ScrollTrigger.removeEventListener('refreshInit', setHeight);
      parade.style.height = '';
    };
  });

  mm.add('(max-width: 899px)', () => {
    if (reducedMotion) return;
    stations.forEach((station) => {
      station.style.setProperty('--p', '0');
      trackProgress(station, { trigger: station, start: 'top bottom', end: 'top 25%' });
      ScrollTrigger.create({ trigger: station, start: 'top 80%', end: 'bottom top', toggleClass: 'is-active' });
    });
  });
}
