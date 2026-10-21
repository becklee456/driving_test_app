/**
 * Generates a full 50..950 Tailwind-style palette from a single base hex color
 * and applies it as CSS variables on the document root. No dependencies.
 */

const HEX_RE = /^#?([0-9a-fA-F]{6})$/;

export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const match = HEX_RE.exec(value.trim());
  return match ? `#${match[1].toLowerCase()}` : null;
}

function hexToRgb(hex) {
  const normalized = normalizeHex(hex) || '#000000';
  const int = parseInt(normalized.slice(1), 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex({ r, g, b }) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`;
}

function mix(color, target, amount) {
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
}

const WHITE = { r: 255, g: 255, b: 255 };
const BLACK = { r: 0, g: 0, b: 0 };

/** Shade weights -> how far each step moves toward white (tint) or black (shade). */
const SHADE_STEPS = [
  [50, 'tint', 0.95],
  [100, 'tint', 0.9],
  [200, 'tint', 0.75],
  [300, 'tint', 0.55],
  [400, 'tint', 0.3],
  [500, 'base', 0],
  [600, 'shade', 0.16],
  [700, 'shade', 0.32],
  [800, 'shade', 0.46],
  [900, 'shade', 0.58],
  [950, 'shade', 0.75],
];

export function paletteFromHex(hex) {
  const base = hexToRgb(hex);
  const palette = {};
  for (const [shade, mode, amount] of SHADE_STEPS) {
    if (mode === 'base') palette[shade] = rgbToHex(base);
    else if (mode === 'tint') palette[shade] = rgbToHex(mix(base, WHITE, amount));
    else palette[shade] = rgbToHex(mix(base, BLACK, amount));
  }
  return palette;
}

/** Space-separated RGB channels, e.g. "27 111 245", matching the CSS variables. */
function toChannels(hex) {
  const { r, g, b } = hexToRgb(hex);
  return `${r} ${g} ${b}`;
}

export function applyBrandPalette(primaryColor) {
  const hex = normalizeHex(primaryColor);
  if (!hex || typeof document === 'undefined') return;
  const palette = paletteFromHex(hex);
  const root = document.documentElement;
  for (const [shade, value] of Object.entries(palette)) {
    root.style.setProperty(`--brand-${shade}`, toChannels(value));
  }
}

export function clearBrandPalette() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [shade] of SHADE_STEPS) root.style.removeProperty(`--brand-${shade}`);
}
