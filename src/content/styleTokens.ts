/**
 * Shared visual design tokens for every on-page UI surface the extension
 * injects into Chess.com. The goal is a "Chess.com native" look: the brand
 * green, board cream/green, and the dark wood-tone panels the site uses for
 * its own menus — so the overlays read as part of the page, not bolted on.
 *
 * Every content overlay (eval bar, alerts, debug panel, board badges, arrows)
 * pulls its colors/radii/shadows from here instead of hard-coding hex values,
 * so the palette can be tuned in one place.
 */

export const palette = {
  // Brand green (Chess.com primary action color) and its states.
  green: '#81b64c',
  greenHover: '#9bca5e',
  greenDark: '#6a9b3e',

  // Board tones, reused for cream surfaces and the light side of the eval bar.
  cream: '#eeeed2',
  boardGreen: '#769656',

  // Dark "wood" panel surfaces matching Chess.com's own popovers/menus.
  surface: '#262421',
  surfaceRaised: '#312e2b',
  surfaceControl: '#3c3936',
  surfaceHover: '#45413c',
  borderSubtle: 'rgba(255, 255, 255, 0.09)',
  borderStrong: '#4a4744',

  // Text on dark surfaces.
  textPrimary: '#ececec',
  textSecondary: '#b3b0ab',
  textMuted: '#8b8884',
  textOnGreen: '#ffffff',

  // Text on light/cream surfaces.
  inkPrimary: '#312e2b',
  inkSecondary: '#6f6c69',

  // Status colors.
  danger: '#d04c43',
  warning: '#e8a23d',
  info: '#5891c4',

  // Eval bar fills.
  evalWhite: '#f5f4ef',
  evalBlack: '#3b3835',

  // Score readouts (advantage / disadvantage).
  scorePositive: '#81b64c',
  scoreNegative: '#d04c43',

  // Board move arrows: best line green, alternatives amber.
  arrowBest: '#81b64c',
  arrowAlt: '#e8a23d'
} as const;

export const radius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  pill: '999px'
} as const;

export const shadow = {
  panel: '0 8px 28px rgba(0, 0, 0, 0.45)',
  raised: '0 2px 8px rgba(0, 0, 0, 0.3)',
  badge: '0 2px 5px rgba(0, 0, 0, 0.4)'
} as const;

export const fontStack =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
