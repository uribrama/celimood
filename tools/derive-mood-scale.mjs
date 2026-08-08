/**
 * Deriva y valida la escala de humor divergente de 5 pasos (ver SPEC.md §6.2).
 *
 *   node tools/derive-mood-scale.mjs
 *
 * Imprime, para modo claro y oscuro:
 *   - los 5 hex de la escala elegida (rojo ↔ azul, neutro gris medio)
 *   - OKLCH L/C, contraste WCAG vs. superficie, ΔL entre pasos
 *   - ΔE OKLab (visión normal y bajo simulación CVD protan/deutan)
 *   - la comparación contra rojo↔verde, que es la alternativa que FALLA
 *
 * Si se cambia algún hue de la paleta, re-correr esto ANTES de tocar los tokens
 * CSS. Los gates no se evalúan a ojo.
 */

// ── sRGB ↔ OKLab / OKLCH ──────────────────────────────────────────────────────
const srgbToLin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linToSrgb = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const hex2rgb = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
const rgb2hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');

function rgb2oklab([r, g, b]) {
  const R = srgbToLin(r), G = srgbToLin(g), B = srgbToLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklab2rgb([L, a, bb]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * bb) ** 3;
  return [ 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(linToSrgb);
}
const lab2lch = ([L, a, b]) => [L, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
const lch2lab = ([L, C, h]) => [L, C * Math.cos(h * Math.PI / 180), C * Math.sin(h * Math.PI / 180)];
const hex2lch = h => lab2lch(rgb2oklab(hex2rgb(h)));
const lch2hex = c => rgb2hex(oklab2rgb(lch2lab(c)));

const lum = hex => { const [r, g, b] = hex2rgb(hex).map(srgbToLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const L1 = lum(a), L2 = lum(b); const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1]; return (hi + 0.05) / (lo + 0.05); };

// Machado, Oliveira & Fernandes (2009), severidad 1.0, en RGB lineal.
const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
};
const sim = (hex, kind) => {
  const lin = hex2rgb(hex).map(srgbToLin), M = MACHADO[kind];
  return rgb2hex(M.map(r => r[0] * lin[0] + r[1] * lin[1] + r[2] * lin[2]).map(linToSrgb));
};
const dE = (h1, h2) => {
  const a = rgb2oklab(hex2rgb(h1)), b = rgb2oklab(hex2rgb(h2));
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
};
const cvdDE = (h1, h2) => Math.min(dE(sim(h1, 'protan'), sim(h2, 'protan')), dE(sim(h1, 'deutan'), sim(h2, 'deutan')));

// ── parámetros ────────────────────────────────────────────────────────────────
const SURFACE = { light: '#fcfcfb', dark: '#1a1a19' };
// Gris MEDIO, no casi-blanco: el nivel 3 tiene que separarse del hairline de una
// celda vacía. Con #dedcd4 la separación era ΔE 1.2 — indistinguible.
const NEUTRAL = { light: '#d3d0c5', dark: '#4a4a46' };
const HAIRLINE = { light: '#e1e0d9', dark: '#2c2c2a' }; // borde de la celda "sin registrar"
const PULL = 0.50;   // cuánto se acerca el paso interno al neutro (lightness)
const CHROMA = 0.60; // chroma que conserva el paso interno respecto del polo
const PERIOD = { light: '#e87ba4', dark: '#d55181' };

const SCALES = {
  'rojo↔azul  (ELEGIDA)': { light: { warm: '#e34948', cool: '#2a78d6' }, dark: { warm: '#e66767', cool: '#3987e5' } },
  'rojo↔verde (FALLA)':   { light: { warm: '#e34948', cool: '#1baf7a' }, dark: { warm: '#e66767', cool: '#199e70' } },
};

const LABELS = ['1 Horrible', '2 Mal', '3 Normal', '4 Bien', '5 Genial'];
const CVD_GATE = 8, NORMAL_GATE = 15, DL_GATE = 0.06, CONTRAST_GATE = 3;
const ok = b => (b ? '✓' : '✗ FALLA');

function buildScale(warm, cool, neutral) {
  const [Ln] = hex2lch(neutral);
  const inner = pole => { const [L, C, h] = hex2lch(pole); return lch2hex([L + (Ln - L) * PULL, C * CHROMA, h]); };
  return [warm, inner(warm), neutral, inner(cool), cool];
}

for (const [name, modes] of Object.entries(SCALES)) {
  console.log(`\n${'='.repeat(74)}\n  ${name}\n${'='.repeat(74)}`);
  for (const mode of ['light', 'dark']) {
    const surf = SURFACE[mode], { warm, cool } = modes[mode];
    const scale = buildScale(warm, cool, NEUTRAL[mode]);
    console.log(`\n  ── modo ${mode} (superficie ${surf}) ──`);
    scale.forEach((hx, i) => {
      const [L, C] = hex2lch(hx);
      console.log(`    ${LABELS[i].padEnd(11)} ${hx}   L=${L.toFixed(3)}  C=${C.toFixed(3)}  contraste=${contrast(hx, surf).toFixed(2)}:1`);
    });
    const Ls = scale.map(h => hex2lch(h)[0]);
    const dL = [0, 1, 2, 3].map(i => Math.abs(Ls[i + 1] - Ls[i]));
    const worstAdj = Math.min(...[0, 1, 2, 3].map(i => dE(scale[i], scale[i + 1])));
    const poleC = Math.min(contrast(scale[0], surf), contrast(scale[4], surf));
    console.log(`    ΔL adyacente mín      ${Math.min(...dL).toFixed(3)}   (≥ ${DL_GATE}) ${ok(Math.min(...dL) >= DL_GATE)}`);
    console.log(`    polos 1↔5 normal      ${dE(scale[0], scale[4]).toFixed(1)}    (≥ ${NORMAL_GATE}) ${ok(dE(scale[0], scale[4]) >= NORMAL_GATE)}`);
    console.log(`    polos 1↔5 bajo CVD    ${cvdDE(scale[0], scale[4]).toFixed(1)}    (≥ ${CVD_GATE}) ${ok(cvdDE(scale[0], scale[4]) >= CVD_GATE)}`);
    console.log(`    internos 2↔4 bajo CVD ${cvdDE(scale[1], scale[3]).toFixed(1)}    (≥ ${CVD_GATE}) ${ok(cvdDE(scale[1], scale[3]) >= CVD_GATE)}`);
    console.log(`    peor par adyacente    ${worstAdj.toFixed(1)}`);
    console.log(`    contraste polos       ${poleC.toFixed(2)}:1 (≥ ${CONTRAST_GATE}) ${ok(poleC >= CONTRAST_GATE)}`);
    // 6º estado visual del calendario: la celda SIN REGISTRAR. Si no se separa del
    // nivel 3, el heatmap miente en la vista cuyo único trabajo es leerse de un
    // vistazo. Por eso la celda vacía NO lleva relleno ni anillo: la ausencia se
    // codifica como ausencia del chip, un canal de forma que ningún ΔE puede romper.
    // El gate medible es el chip del nivel 3 contra la superficie desnuda.
    const eSurf = dE(scale[2], surf), eHair = dE(scale[2], HAIRLINE[mode]);
    console.log(`    mood-3 vs superficie       ΔE ${eSurf.toFixed(1)}  (≥ 8) ${ok(eSurf >= 8)}`);
    console.log(`    mood-3 vs hairline         ΔE ${eHair.toFixed(1)}  ← por esto la celda vacía no lleva borde de relleno`);
    console.log(`    magenta período vs mood-1  ΔE ${dE(PERIOD[mode], scale[0]).toFixed(1)}  → exige anillo de 2px de superficie`);
    console.log(`    CSS: ${scale.join('  ')}`);
  }
}
console.log('');
