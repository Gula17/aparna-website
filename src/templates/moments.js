// The small animated "moment" that plays over each station's photo in the range parade (brief §5, Scene 3).
// Markup only; the motion lives in src/styles/range.css and src/scenes/range.js. All are decorative.

// A G-coil: an Archimedean spiral, drawn once at build time.
function coilPath() {
  const pts = [];
  for (let a = 0; a <= Math.PI * 9; a += 0.08) {
    const r = 5 + a * 3.1;
    pts.push(`${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

// One Aeroflow-style swept blade, pointing right, around a hub at 0,0.
const BLADE = 'M10 -10 C 40 -16, 76 -12, 97 0 C 100 6, 95 9, 88 8 C 64 6, 36 12, 10 16 Z';

const moments = {
  blades: () => `
    <svg class="moment-blades" viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">
      ${[0, 120, 240].map((r) => `<path d="${BLADE}" transform="rotate(${r})"/>`).join('')}
      <circle r="16"/><circle class="moment-blades__ring" r="11"/>
    </svg>`,
  oscillate: () => '', // the photo itself sways (see .station--table in range.css)
  gust: () => `
    <svg class="moment-gust" viewBox="0 0 400 240" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      ${[40, 80, 120, 160, 200].map((y, i) => `<path style="--i:${i}" d="M-20 ${y} C 90 ${y - 26}, 210 ${y + 26}, 420 ${y - 8}"/>`).join('')}
    </svg>`,
  louvres: () => `<span class="moment-louvres" aria-hidden="true">${'<span></span>'.repeat(8)}</span>`,
  mist: () => `<span class="moment-mist" aria-hidden="true"><span></span><span></span><span></span></span>`,
  drum: () => `
    <svg class="moment-drum" viewBox="-50 -50 100 100" aria-hidden="true" focusable="false">
      <circle r="44" class="moment-drum__rim"/>
      <g class="moment-drum__spin">
        ${[0, 60, 120, 180, 240, 300].map((r) => `<circle cx="0" cy="-28" r="4" transform="rotate(${r})"/>`).join('')}
        <path d="M-30 6 C -16 -18, 16 18, 30 -6" />
      </g>
    </svg>`,
  coil: () => `
    <svg class="moment-coil" viewBox="-40 -40 80 80" aria-hidden="true" focusable="false">
      <path class="moment-coil__glow" d="${coilPath()}"/>
      <path class="moment-coil__wire" d="${coilPath()}"/>
    </svg>`,
  glow: () => `<span class="moment-glow" aria-hidden="true"></span>`,
  steam: () => `
    <svg class="moment-steam" viewBox="0 0 120 160" aria-hidden="true" focusable="false">
      ${[30, 60, 90].map((x, i) => `<path style="--i:${i}" d="M${x} 150 C ${x - 18} 120, ${x + 18} 90, ${x} 60 S ${x - 12} 20, ${x + 4} 4"/>`).join('')}
    </svg>`,
};

export const renderMoment = (name) => (moments[name] ? moments[name]() : '');
