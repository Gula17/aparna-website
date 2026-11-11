// Events pages: arrow buttons for the photo strips, a full-size photo viewer, and the event's muted glimpse
// loop. The loop starts by itself only on wider screens, when it is on screen, and never on Data Saver or with
// reduced motion (it is 21 MB): phones and those visitors get the still and a "Play" button.

export function setupEvents({ reducedMotion }) {
  const root = document.querySelector('main.events');
  if (!root) return;

  for (const strip of root.querySelectorAll('[data-strip]')) {
    const list = strip.querySelector('.photo-strip__list');
    const step = (dir) => list.scrollBy({ left: dir * list.clientWidth * 0.8, behavior: reducedMotion ? 'auto' : 'smooth' });
    strip.querySelector('[data-strip-prev]')?.addEventListener('click', () => step(-1));
    strip.querySelector('[data-strip-next]')?.addEventListener('click', () => step(1));
  }

  // Photo viewer: every photo on the page in one sequence.
  const dialog = document.querySelector('[data-photo-viewer]');
  const photos = [...root.querySelectorAll('[data-photo]')];
  if (dialog && photos.length) {
    const img = dialog.querySelector('[data-viewer-img]');
    const cap = dialog.querySelector('[data-viewer-caption]');
    let current = 0;
    const show = (i) => {
      current = (i + photos.length) % photos.length;
      const b = photos[current];
      img.src = b.dataset.photo;
      img.alt = b.querySelector('img')?.alt ?? '';
      cap.textContent = b.dataset.caption ?? '';
    };
    photos.forEach((b, i) => b.addEventListener('click', () => { show(i); dialog.showModal(); }));
    dialog.querySelector('[data-viewer-close]').addEventListener('click', () => dialog.close());
    dialog.querySelector('[data-viewer-prev]').addEventListener('click', () => show(current - 1));
    dialog.querySelector('[data-viewer-next]').addEventListener('click', () => show(current + 1));
    dialog.addEventListener('click', (e) => { if (e.target === dialog || e.target.classList.contains('photo-viewer__figure')) dialog.close(); });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') show(current + 1);
      if (e.key === 'ArrowLeft') show(current - 1);
    });
    dialog.addEventListener('close', () => photos[current]?.focus());
  }

  // The glimpse loop.
  const video = root.querySelector('[data-event-video]');
  const toggle = root.querySelector('[data-video-toggle]');
  if (!video) return;
  const setPlaying = (on) => {
    video.classList.toggle('is-playing', on);
    if (toggle) { toggle.textContent = on ? toggle.dataset.pause : toggle.dataset.play; toggle.setAttribute('aria-pressed', String(on)); }
  };
  const play = () => video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  video.addEventListener('pause', () => setPlaying(false));
  toggle?.addEventListener('click', () => { if (video.paused) { video.dataset.user = '1'; play(); } else { video.dataset.user = '0'; video.pause(); } });
  const saveData = navigator.connection?.saveData;
  if (reducedMotion || saveData || matchMedia('(max-width: 700px)').matches) return;
  new IntersectionObserver(([e]) => {
    if (video.dataset.user === '0') return; // the visitor paused it
    if (e.isIntersecting) play(); else if (!video.paused) { video.pause(); }
  }, { threshold: 0.35 }).observe(video);
}
