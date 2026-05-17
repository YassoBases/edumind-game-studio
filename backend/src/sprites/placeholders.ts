// Programmatic SVG placeholders for sprites missing from backend/sprites/library/.
// These render as themed silhouettes (a recognizable car for racing themes, a footballer for
// football, a hero figure for quest_path, etc.) — not flat colored rectangles.
// Real Kenney PNGs dropped into library/ take precedence; the loader checks the filesystem first.
import type { ArchetypeId, ThemeId } from '../schemas/archetypes.ts';

export type SpriteRole = string;

type ThemePalette = {
  primary: string;
  secondary: string;
  accent: string;
  outline: string;
  background: string;
};

const PALETTES: Record<ThemeId, ThemePalette> = {
  car_racing_f1: { primary: '#dc2626', secondary: '#fbbf24', accent: '#0ea5e9', outline: '#0f172a', background: '#1f2937' },
  car_racing_street: { primary: '#7c3aed', secondary: '#06b6d4', accent: '#f59e0b', outline: '#0f172a', background: '#111827' },
  motorbike: { primary: '#16a34a', secondary: '#fbbf24', accent: '#dc2626', outline: '#0f172a', background: '#1f2937' },
  kart: { primary: '#f97316', secondary: '#10b981', accent: '#3b82f6', outline: '#0f172a', background: '#fde68a' },
  football: { primary: '#16a34a', secondary: '#ffffff', accent: '#dc2626', outline: '#0a0a0a', background: '#166534' },
  basketball: { primary: '#ea580c', secondary: '#0f172a', accent: '#fbbf24', outline: '#0a0a0a', background: '#92400e' },
  hockey: { primary: '#0284c7', secondary: '#e2e8f0', accent: '#dc2626', outline: '#0a0a0a', background: '#cbd5e1' },
  archery: { primary: '#dc2626', secondary: '#ffffff', accent: '#fbbf24', outline: '#0a0a0a', background: '#84cc16' },
  castle: { primary: '#78716c', secondary: '#fbbf24', accent: '#dc2626', outline: '#1c1917', background: '#0c4a6e' },
  rocket: { primary: '#e2e8f0', secondary: '#dc2626', accent: '#0ea5e9', outline: '#0f172a', background: '#020617' },
  skyscraper: { primary: '#64748b', secondary: '#fbbf24', accent: '#06b6d4', outline: '#0f172a', background: '#1e293b' },
  treehouse: { primary: '#854d0e', secondary: '#16a34a', accent: '#fbbf24', outline: '#1c1917', background: '#365314' },
  fantasy: { primary: '#7c3aed', secondary: '#fbbf24', accent: '#16a34a', outline: '#1e1b4b', background: '#312e81' },
  sci_fi: { primary: '#06b6d4', secondary: '#a855f7', accent: '#fbbf24', outline: '#0f172a', background: '#020617' },
  detective: { primary: '#1c1917', secondary: '#fbbf24', accent: '#dc2626', outline: '#0a0a0a', background: '#292524' },
  anime: { primary: '#ec4899', secondary: '#fef3c7', accent: '#a855f7', outline: '#3b0764', background: '#fce7f3' },
};

function svg(width: number, height: number, body: string, palette?: ThemePalette): string {
  const bg = palette ? `<rect width="${width}" height="${height}" fill="${palette.background}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${bg}${body}</svg>`;
}

function toBase64DataUri(s: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(s, 'utf8').toString('base64')}`;
}

function carSilhouette(p: ThemePalette, w = 96, h = 144): string {
  // top-down racing car
  const body = `
    <rect x="${w * 0.18}" y="${h * 0.15}" width="${w * 0.64}" height="${h * 0.70}" rx="${w * 0.12}" fill="${p.primary}" stroke="${p.outline}" stroke-width="3"/>
    <rect x="${w * 0.28}" y="${h * 0.30}" width="${w * 0.44}" height="${h * 0.22}" fill="${p.secondary}" stroke="${p.outline}" stroke-width="2"/>
    <rect x="${w * 0.28}" y="${h * 0.62}" width="${w * 0.44}" height="${h * 0.18}" fill="${p.outline}" opacity="0.6"/>
    <rect x="${w * 0.05}" y="${h * 0.22}" width="${w * 0.13}" height="${h * 0.18}" rx="3" fill="${p.outline}"/>
    <rect x="${w * 0.82}" y="${h * 0.22}" width="${w * 0.13}" height="${h * 0.18}" rx="3" fill="${p.outline}"/>
    <rect x="${w * 0.05}" y="${h * 0.60}" width="${w * 0.13}" height="${h * 0.18}" rx="3" fill="${p.outline}"/>
    <rect x="${w * 0.82}" y="${h * 0.60}" width="${w * 0.13}" height="${h * 0.18}" rx="3" fill="${p.outline}"/>
    <circle cx="${w * 0.5}" cy="${h * 0.85}" r="${w * 0.08}" fill="${p.accent}"/>
  `;
  return svg(w, h, body, p);
}

function bikeSilhouette(p: ThemePalette, w = 90, h = 150): string {
  const body = `
    <circle cx="${w * 0.5}" cy="${h * 0.20}" r="${w * 0.20}" fill="${p.outline}"/>
    <rect x="${w * 0.36}" y="${h * 0.30}" width="${w * 0.28}" height="${h * 0.40}" fill="${p.primary}" stroke="${p.outline}" stroke-width="2"/>
    <circle cx="${w * 0.5}" cy="${h * 0.85}" r="${w * 0.22}" fill="${p.outline}"/>
    <circle cx="${w * 0.5}" cy="${h * 0.85}" r="${w * 0.10}" fill="${p.secondary}"/>
  `;
  return svg(w, h, body, p);
}

function kartSilhouette(p: ThemePalette, w = 110, h = 130): string {
  const body = `
    <rect x="${w * 0.10}" y="${h * 0.30}" width="${w * 0.80}" height="${h * 0.50}" rx="${w * 0.08}" fill="${p.primary}" stroke="${p.outline}" stroke-width="3"/>
    <circle cx="${w * 0.20}" cy="${h * 0.30}" r="${w * 0.10}" fill="${p.outline}"/>
    <circle cx="${w * 0.80}" cy="${h * 0.30}" r="${w * 0.10}" fill="${p.outline}"/>
    <circle cx="${w * 0.20}" cy="${h * 0.80}" r="${w * 0.13}" fill="${p.outline}"/>
    <circle cx="${w * 0.80}" cy="${h * 0.80}" r="${w * 0.13}" fill="${p.outline}"/>
    <rect x="${w * 0.35}" y="${h * 0.15}" width="${w * 0.30}" height="${h * 0.25}" fill="${p.secondary}" stroke="${p.outline}" stroke-width="2"/>
  `;
  return svg(w, h, body, p);
}

function roadTile(p: ThemePalette, w = 240, h = 120): string {
  const body = `
    <rect x="0" y="0" width="${w}" height="${h}" fill="${p.outline}"/>
    <rect x="${w * 0.49}" y="${h * 0.10}" width="${w * 0.02}" height="${h * 0.18}" fill="${p.secondary}"/>
    <rect x="${w * 0.49}" y="${h * 0.40}" width="${w * 0.02}" height="${h * 0.18}" fill="${p.secondary}"/>
    <rect x="${w * 0.49}" y="${h * 0.70}" width="${w * 0.02}" height="${h * 0.18}" fill="${p.secondary}"/>
    <rect x="0" y="0" width="${w * 0.03}" height="${h}" fill="${p.primary}"/>
    <rect x="${w * 0.97}" y="0" width="${w * 0.03}" height="${h}" fill="${p.primary}"/>
  `;
  return svg(w, h, body);
}

function horizon(p: ThemePalette, w = 480, h = 160): string {
  const body = `
    <defs>
      <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${p.accent}"/>
        <stop offset="100%" stop-color="${p.primary}" stop-opacity="0.3"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#sky)"/>
    <polygon points="0,${h * 0.7} ${w * 0.2},${h * 0.4} ${w * 0.35},${h * 0.6} ${w * 0.55},${h * 0.3} ${w * 0.75},${h * 0.55} ${w * 0.9},${h * 0.45} ${w},${h * 0.6} ${w},${h} 0,${h}" fill="${p.outline}" opacity="0.6"/>
  `;
  return svg(w, h, body);
}

function answerPanel(p: ThemePalette, w = 220, h = 100): string {
  const body = `
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="12" fill="${p.background}" stroke="${p.accent}" stroke-width="3" opacity="0.95"/>
    <rect x="6" y="6" width="${w - 12}" height="${h * 0.20}" rx="8" fill="${p.accent}" opacity="0.3"/>
  `;
  return svg(w, h, body);
}

function playerHumanoid(p: ThemePalette, w = 80, h = 120): string {
  const body = `
    <circle cx="${w * 0.5}" cy="${h * 0.20}" r="${w * 0.18}" fill="${p.secondary}" stroke="${p.outline}" stroke-width="2"/>
    <rect x="${w * 0.30}" y="${h * 0.38}" width="${w * 0.40}" height="${h * 0.40}" rx="8" fill="${p.primary}" stroke="${p.outline}" stroke-width="2"/>
    <rect x="${w * 0.30}" y="${h * 0.78}" width="${w * 0.16}" height="${h * 0.20}" fill="${p.outline}"/>
    <rect x="${w * 0.54}" y="${h * 0.78}" width="${w * 0.16}" height="${h * 0.20}" fill="${p.outline}"/>
  `;
  return svg(w, h, body, p);
}

function ballShape(p: ThemePalette, type: 'football' | 'basketball' | 'hockey' | 'arrow' | 'generic', w = 60, h = 60): string {
  let body = '';
  if (type === 'football') {
    body = `<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.4}" fill="${p.secondary}" stroke="${p.outline}" stroke-width="2"/>
            <polygon points="${w * 0.5},${h * 0.20} ${w * 0.62},${h * 0.40} ${w * 0.55},${h * 0.55} ${w * 0.45},${h * 0.55} ${w * 0.38},${h * 0.40}" fill="${p.outline}"/>`;
  } else if (type === 'basketball') {
    body = `<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.4}" fill="${p.primary}" stroke="${p.outline}" stroke-width="2"/>
            <line x1="${w * 0.10}" y1="${h * 0.50}" x2="${w * 0.90}" y2="${h * 0.50}" stroke="${p.outline}" stroke-width="2"/>
            <line x1="${w * 0.50}" y1="${h * 0.10}" x2="${w * 0.50}" y2="${h * 0.90}" stroke="${p.outline}" stroke-width="2"/>`;
  } else if (type === 'hockey') {
    body = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.4}" ry="${h * 0.18}" fill="${p.outline}"/>`;
  } else if (type === 'arrow') {
    body = `<line x1="${w * 0.10}" y1="${h / 2}" x2="${w * 0.80}" y2="${h / 2}" stroke="${p.outline}" stroke-width="4"/>
            <polygon points="${w * 0.80},${h * 0.30} ${w * 0.95},${h / 2} ${w * 0.80},${h * 0.70}" fill="${p.accent}"/>`;
  } else {
    body = `<circle cx="${w / 2}" cy="${h / 2}" r="${w * 0.4}" fill="${p.primary}" stroke="${p.outline}" stroke-width="2"/>`;
  }
  return svg(w, h, body);
}

function goalFrame(p: ThemePalette, type: 'football' | 'basketball' | 'hockey' | 'archery', w = 180, h = 200): string {
  let body = '';
  if (type === 'football' || type === 'hockey') {
    body = `<rect x="${w * 0.10}" y="${h * 0.18}" width="${w * 0.80}" height="${h * 0.65}" fill="none" stroke="${p.secondary}" stroke-width="6"/>
            <line x1="${w * 0.10}" y1="${h * 0.18}" x2="${w * 0.20}" y2="${h * 0.05}" stroke="${p.secondary}" stroke-width="4"/>
            <line x1="${w * 0.90}" y1="${h * 0.18}" x2="${w * 0.80}" y2="${h * 0.05}" stroke="${p.secondary}" stroke-width="4"/>`;
  } else if (type === 'basketball') {
    body = `<rect x="${w * 0.20}" y="${h * 0.20}" width="${w * 0.60}" height="${h * 0.30}" fill="${p.secondary}" stroke="${p.outline}" stroke-width="3"/>
            <circle cx="${w * 0.50}" cy="${h * 0.55}" r="${w * 0.15}" fill="none" stroke="${p.accent}" stroke-width="4"/>`;
  } else {
    body = `<circle cx="${w * 0.50}" cy="${h * 0.50}" r="${w * 0.40}" fill="${p.secondary}" stroke="${p.outline}" stroke-width="3"/>
            <circle cx="${w * 0.50}" cy="${h * 0.50}" r="${w * 0.28}" fill="${p.primary}" stroke="${p.outline}" stroke-width="2"/>
            <circle cx="${w * 0.50}" cy="${h * 0.50}" r="${w * 0.18}" fill="${p.secondary}" stroke="${p.outline}" stroke-width="2"/>
            <circle cx="${w * 0.50}" cy="${h * 0.50}" r="${w * 0.08}" fill="${p.accent}"/>`;
  }
  return svg(w, h, body);
}

function towerBlock(p: ThemePalette, kind: 'block' | 'wrong_block' | 'base', w = 160, h = 80): string {
  const fill = kind === 'wrong_block' ? '#7f1d1d' : p.primary;
  const accent = kind === 'wrong_block' ? '#fca5a5' : p.secondary;
  const body = `
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="6" fill="${fill}" stroke="${p.outline}" stroke-width="3"/>
    <rect x="${w * 0.05}" y="${h * 0.15}" width="${w * 0.90}" height="${h * 0.20}" fill="${accent}" opacity="0.4"/>
    ${kind === 'base' ? `<rect x="0" y="${h * 0.8}" width="${w}" height="${h * 0.2}" fill="${p.outline}"/>` : ''}
    ${kind === 'wrong_block' ? `<line x1="${w * 0.15}" y1="${h * 0.20}" x2="${w * 0.85}" y2="${h * 0.80}" stroke="#fca5a5" stroke-width="3" opacity="0.6"/>` : ''}
  `;
  return svg(w, h, body);
}

function pathTile(p: ThemePalette, w = 240, h = 120): string {
  const body = `
    <rect width="${w}" height="${h}" fill="${p.background}"/>
    <rect x="${w * 0.20}" y="${h * 0.40}" width="${w * 0.60}" height="${h * 0.30}" rx="8" fill="${p.primary}" stroke="${p.outline}" stroke-width="2"/>
    <circle cx="${w * 0.30}" cy="${h * 0.55}" r="${w * 0.02}" fill="${p.secondary}"/>
    <circle cx="${w * 0.50}" cy="${h * 0.55}" r="${w * 0.02}" fill="${p.secondary}"/>
    <circle cx="${w * 0.70}" cy="${h * 0.55}" r="${w * 0.02}" fill="${p.secondary}"/>
  `;
  return svg(w, h, body);
}

function fork(p: ThemePalette, w = 100, h = 140): string {
  const body = `
    <rect x="${w * 0.40}" y="${h * 0.40}" width="${w * 0.20}" height="${h * 0.55}" fill="${p.outline}"/>
    <rect x="${w * 0.15}" y="${h * 0.25}" width="${w * 0.70}" height="${h * 0.20}" rx="4" fill="${p.secondary}" stroke="${p.outline}" stroke-width="2"/>
    <polygon points="${w * 0.85},${h * 0.35} ${w * 0.95},${h * 0.30} ${w * 0.95},${h * 0.40}" fill="${p.outline}"/>
    <polygon points="${w * 0.15},${h * 0.35} ${w * 0.05},${h * 0.30} ${w * 0.05},${h * 0.40}" fill="${p.outline}"/>
  `;
  return svg(w, h, body, p);
}

function backdrop(p: ThemePalette, w = 720, h = 1280): string {
  const body = `
    <defs>
      <linearGradient id="bg" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${p.background}"/>
      </linearGradient>
    </defs>
    <rect width="${w}" height="${h}" fill="url(#bg)"/>
  `;
  return svg(w, h, body);
}

const builders: Record<ThemeId, Record<SpriteRole, () => string>> = {
  car_racing_f1: {
    player: () => carSilhouette(PALETTES.car_racing_f1),
    rival: () => carSilhouette({ ...PALETTES.car_racing_f1, primary: '#0ea5e9' }),
    road: () => roadTile(PALETTES.car_racing_f1),
    horizon: () => horizon(PALETTES.car_racing_f1),
    barrier_left: () => svg(40, 200, `<rect width="40" height="200" fill="#fbbf24"/><rect width="40" height="40" y="40" fill="#dc2626"/><rect width="40" height="40" y="120" fill="#dc2626"/>`),
    barrier_right: () => svg(40, 200, `<rect width="40" height="200" fill="#fbbf24"/><rect width="40" height="40" y="40" fill="#dc2626"/><rect width="40" height="40" y="120" fill="#dc2626"/>`),
    answer_panel: () => answerPanel(PALETTES.car_racing_f1),
    crash_particles: () => svg(120, 120, `<circle cx="60" cy="60" r="40" fill="#fbbf24" opacity="0.8"/><circle cx="60" cy="60" r="22" fill="#dc2626"/>`),
  },
  car_racing_street: {
    player: () => carSilhouette(PALETTES.car_racing_street),
    rival: () => carSilhouette({ ...PALETTES.car_racing_street, primary: '#06b6d4' }),
    road: () => roadTile(PALETTES.car_racing_street),
    horizon: () => horizon(PALETTES.car_racing_street),
    barrier_left: () => svg(40, 200, `<rect width="40" height="200" fill="#06b6d4"/>`),
    barrier_right: () => svg(40, 200, `<rect width="40" height="200" fill="#06b6d4"/>`),
    answer_panel: () => answerPanel(PALETTES.car_racing_street),
    crash_particles: () => svg(120, 120, `<circle cx="60" cy="60" r="40" fill="#f59e0b" opacity="0.8"/>`),
  },
  motorbike: {
    player: () => bikeSilhouette(PALETTES.motorbike),
    rival: () => bikeSilhouette({ ...PALETTES.motorbike, primary: '#dc2626' }),
    road: () => roadTile(PALETTES.motorbike),
    horizon: () => horizon(PALETTES.motorbike),
    answer_panel: () => answerPanel(PALETTES.motorbike),
    crash_particles: () => svg(120, 120, `<circle cx="60" cy="60" r="40" fill="#fbbf24" opacity="0.8"/>`),
  },
  kart: {
    player: () => kartSilhouette(PALETTES.kart),
    rival: () => kartSilhouette({ ...PALETTES.kart, primary: '#3b82f6' }),
    road: () => roadTile(PALETTES.kart),
    horizon: () => horizon(PALETTES.kart),
    answer_panel: () => answerPanel(PALETTES.kart),
    crash_particles: () => svg(120, 120, `<circle cx="60" cy="60" r="40" fill="#f97316" opacity="0.8"/>`),
  },
  football: {
    player: () => playerHumanoid(PALETTES.football),
    goalkeeper: () => playerHumanoid({ ...PALETTES.football, primary: '#fbbf24' }),
    ball: () => ballShape(PALETTES.football, 'football'),
    goal_frame: () => goalFrame(PALETTES.football, 'football'),
    field: () => svg(720, 200, `<rect width="720" height="200" fill="#166534"/><line x1="0" y1="100" x2="720" y2="100" stroke="#ffffff" stroke-width="2"/>`),
    crowd: () => svg(720, 80, `<rect width="720" height="80" fill="#1c1917"/><circle cx="50" cy="40" r="10" fill="#dc2626"/><circle cx="150" cy="40" r="10" fill="#fbbf24"/><circle cx="250" cy="40" r="10" fill="#16a34a"/>`),
    answer_panel: () => answerPanel(PALETTES.football),
  },
  basketball: {
    player: () => playerHumanoid(PALETTES.basketball),
    goalkeeper: () => playerHumanoid({ ...PALETTES.basketball, primary: '#fbbf24' }),
    ball: () => ballShape(PALETTES.basketball, 'basketball'),
    goal_frame: () => goalFrame(PALETTES.basketball, 'basketball'),
    field: () => svg(720, 200, `<rect width="720" height="200" fill="#92400e"/>`),
    crowd: () => svg(720, 80, `<rect width="720" height="80" fill="#1c1917"/>`),
    answer_panel: () => answerPanel(PALETTES.basketball),
  },
  hockey: {
    player: () => playerHumanoid(PALETTES.hockey),
    goalkeeper: () => playerHumanoid({ ...PALETTES.hockey, primary: '#0284c7' }),
    ball: () => ballShape(PALETTES.hockey, 'hockey'),
    goal_frame: () => goalFrame(PALETTES.hockey, 'hockey'),
    field: () => svg(720, 200, `<rect width="720" height="200" fill="#cbd5e1"/>`),
    crowd: () => svg(720, 80, `<rect width="720" height="80" fill="#1c1917"/>`),
    answer_panel: () => answerPanel(PALETTES.hockey),
  },
  archery: {
    player: () => playerHumanoid(PALETTES.archery),
    goalkeeper: () => svg(60, 200, `<line x1="30" y1="0" x2="30" y2="200" stroke="#84cc16" stroke-width="3"/><polygon points="30,40 40,30 30,20" fill="#dc2626"/>`),
    ball: () => ballShape(PALETTES.archery, 'arrow'),
    goal_frame: () => goalFrame(PALETTES.archery, 'archery'),
    field: () => svg(720, 200, `<rect width="720" height="200" fill="#84cc16"/>`),
    crowd: () => svg(720, 80, `<rect width="720" height="80" fill="#1c1917"/>`),
    answer_panel: () => answerPanel(PALETTES.archery),
  },
  castle: {
    base: () => towerBlock(PALETTES.castle, 'base'),
    block: () => towerBlock(PALETTES.castle, 'block'),
    wrong_block: () => towerBlock(PALETTES.castle, 'wrong_block'),
    flag: () => svg(60, 80, `<line x1="10" y1="0" x2="10" y2="80" stroke="#78716c" stroke-width="3"/><polygon points="10,0 50,10 10,25" fill="#dc2626"/>`),
    backdrop: () => backdrop(PALETTES.castle),
    answer_panel: () => answerPanel(PALETTES.castle),
  },
  rocket: {
    base: () => towerBlock(PALETTES.rocket, 'base'),
    block: () => towerBlock(PALETTES.rocket, 'block'),
    wrong_block: () => towerBlock(PALETTES.rocket, 'wrong_block'),
    flag: () => svg(80, 120, `<polygon points="40,0 70,90 10,90" fill="#e2e8f0" stroke="#0f172a" stroke-width="2"/><circle cx="40" cy="60" r="10" fill="#0ea5e9"/>`),
    backdrop: () => backdrop(PALETTES.rocket),
    answer_panel: () => answerPanel(PALETTES.rocket),
  },
  skyscraper: {
    base: () => towerBlock(PALETTES.skyscraper, 'base'),
    block: () => towerBlock(PALETTES.skyscraper, 'block'),
    wrong_block: () => towerBlock(PALETTES.skyscraper, 'wrong_block'),
    flag: () => svg(40, 100, `<line x1="20" y1="0" x2="20" y2="100" stroke="#64748b" stroke-width="3"/><circle cx="20" cy="10" r="6" fill="#06b6d4"/>`),
    backdrop: () => backdrop(PALETTES.skyscraper),
    answer_panel: () => answerPanel(PALETTES.skyscraper),
  },
  treehouse: {
    base: () => towerBlock(PALETTES.treehouse, 'base'),
    block: () => towerBlock(PALETTES.treehouse, 'block'),
    wrong_block: () => towerBlock(PALETTES.treehouse, 'wrong_block'),
    flag: () => svg(60, 60, `<circle cx="30" cy="30" r="25" fill="#16a34a"/><circle cx="20" cy="22" r="8" fill="#0f172a" opacity="0.3"/>`),
    backdrop: () => backdrop(PALETTES.treehouse),
    answer_panel: () => answerPanel(PALETTES.treehouse),
  },
  fantasy: {
    hero: () => playerHumanoid(PALETTES.fantasy),
    path: () => pathTile(PALETTES.fantasy),
    fork: () => fork(PALETTES.fantasy),
    backdrop: () => backdrop(PALETTES.fantasy),
    enemy: () => playerHumanoid({ ...PALETTES.fantasy, primary: '#16a34a', secondary: '#dc2626' }),
    treasure: () => svg(80, 70, `<rect x="6" y="20" width="68" height="44" rx="6" fill="#fbbf24" stroke="#1e1b4b" stroke-width="2"/><rect x="6" y="34" width="68" height="6" fill="#1e1b4b"/>`),
    answer_panel: () => answerPanel(PALETTES.fantasy),
  },
  sci_fi: {
    hero: () => playerHumanoid(PALETTES.sci_fi),
    path: () => pathTile(PALETTES.sci_fi),
    fork: () => fork(PALETTES.sci_fi),
    backdrop: () => svg(720, 1280, `<rect width="720" height="1280" fill="#020617"/><circle cx="120" cy="200" r="2" fill="#ffffff"/><circle cx="320" cy="100" r="2" fill="#ffffff"/><circle cx="520" cy="300" r="2" fill="#ffffff"/><circle cx="650" cy="500" r="2" fill="#ffffff"/>`),
    enemy: () => playerHumanoid({ ...PALETTES.sci_fi, primary: '#dc2626' }),
    treasure: () => svg(80, 70, `<rect x="6" y="14" width="68" height="48" rx="6" fill="#06b6d4" stroke="#0f172a" stroke-width="2"/><rect x="14" y="22" width="52" height="20" fill="#a855f7" opacity="0.7"/>`),
    answer_panel: () => answerPanel(PALETTES.sci_fi),
  },
  detective: {
    hero: () => playerHumanoid(PALETTES.detective),
    path: () => pathTile(PALETTES.detective),
    fork: () => fork(PALETTES.detective),
    backdrop: () => backdrop(PALETTES.detective),
    enemy: () => playerHumanoid({ ...PALETTES.detective, primary: '#7f1d1d' }),
    treasure: () => svg(80, 70, `<rect x="6" y="14" width="68" height="48" rx="4" fill="#fef3c7" stroke="#0a0a0a" stroke-width="2"/><line x1="14" y1="30" x2="66" y2="30" stroke="#0a0a0a"/><line x1="14" y1="40" x2="66" y2="40" stroke="#0a0a0a"/>`),
    answer_panel: () => answerPanel(PALETTES.detective),
  },
  anime: {
    hero: () => playerHumanoid(PALETTES.anime),
    path: () => pathTile(PALETTES.anime),
    fork: () => fork(PALETTES.anime),
    backdrop: () => backdrop(PALETTES.anime),
    enemy: () => playerHumanoid({ ...PALETTES.anime, primary: '#a855f7' }),
    treasure: () => svg(80, 70, `<rect x="6" y="14" width="68" height="48" rx="6" fill="#fef3c7" stroke="#3b0764" stroke-width="2"/>`),
    answer_panel: () => answerPanel(PALETTES.anime),
  },
};

export function generatePlaceholder(theme: ThemeId, role: SpriteRole): string | null {
  const themeBuilders = builders[theme];
  if (!themeBuilders) return null;
  const b = themeBuilders[role];
  if (!b) return null;
  return toBase64DataUri(b());
}

export function paletteFor(theme: ThemeId): ThemePalette {
  return PALETTES[theme];
}

export function defaultRolesFor(archetype: ArchetypeId): SpriteRole[] {
  switch (archetype) {
    case 'lane_racer':
      return ['player', 'rival', 'road', 'horizon', 'answer_panel', 'crash_particles'];
    case 'goal_shootout':
      return ['player', 'goalkeeper', 'ball', 'goal_frame', 'field', 'crowd', 'answer_panel'];
    case 'tower_builder':
      return ['base', 'block', 'wrong_block', 'flag', 'backdrop', 'answer_panel'];
    case 'quest_path':
      return ['hero', 'path', 'fork', 'backdrop', 'enemy', 'treasure', 'answer_panel'];
  }
}
