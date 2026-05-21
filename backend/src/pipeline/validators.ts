import type { GameSpec } from '../schemas/gameSpec.ts';

export type ValidatorResult = {
  name: string;
  ok: boolean;
  signature: string;
  detail: string;
};

export type ValidatorContext = {
  html: string;
  innerScript: string;
  spec: GameSpec;
  spriteManifest?: { library: Record<string, string>; generated: Record<string, string> };
};

type Validator = (ctx: ValidatorContext) => ValidatorResult;

const browserStorageRe = /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/;
function v_no_browser_storage(ctx: ValidatorContext): ValidatorResult {
  const m = ctx.html.match(browserStorageRe);
  return {
    name: 'no_browser_storage',
    ok: !m,
    signature: m ? `browser_storage:${m[0]}` : 'browser_storage:ok',
    detail: m ? `Found forbidden API: ${m[0]}` : 'no forbidden storage APIs',
  };
}

function v_no_external_resources(ctx: ValidatorContext): ValidatorResult {
  // Allow exactly one Phaser CDN script and the EduCore script. Otherwise external URLs are banned.
  const urls = Array.from(ctx.html.matchAll(/\b(?:https?:)?\/\/[^"'\s)>]+/g)).map((m) => m[0]);
  const bad = urls.filter(
    (u) => !u.includes('cdn.jsdelivr.net/npm/phaser@') && !u.endsWith('/client/EduCore.js'),
  );
  // In production we inline Phaser & EduCore; this validator runs before scaffold-wrap so
  // jsdelivr/EduCore references are acceptable here.
  return {
    name: 'no_external_resources',
    ok: bad.length === 0,
    signature: bad.length ? `external_resource:${bad[0]}` : 'external_resource:ok',
    detail: bad.length ? `External resources: ${bad.slice(0, 3).join(', ')}` : 'none',
  };
}

function v_bridge_calls_present(ctx: ValidatorContext): ValidatorResult {
  // Direct path (legacy) OR factory path (cost lever C).
  // Factory path: `EduCore.buildBridgeWiring(...)` followed by calls like `bridge.reportLevel(...)`
  // and `bridge.reportFinish()` (which internally fires reportSummary + reportComplete).
  const usesFactory = /EduCore\.buildBridgeWiring\s*\(/.test(ctx.innerScript);
  const factoryFinishes = /\.reportFinish\s*\(/.test(ctx.innerScript);
  const factoryLevels = /\.reportLevel\s*\(/.test(ctx.innerScript);
  if (usesFactory && factoryFinishes && factoryLevels) {
    return { name: 'bridge_calls_present', ok: true, signature: 'bridge:factory', detail: 'using buildBridgeWiring' };
  }
  const required = ['reportLevel', 'reportSummary', 'reportComplete'];
  const missing = required.filter((k) => !ctx.innerScript.includes(`EduMindAPI.${k}`));
  return {
    name: 'bridge_calls_present',
    ok: missing.length === 0,
    signature: missing.length ? `bridge_missing:${missing.join(',')}` : 'bridge:ok',
    detail: missing.length ? `Missing EduMindAPI.* calls: ${missing.join(', ')}` : 'all present',
  };
}

function v_three_scenes_only(ctx: ValidatorContext): ValidatorResult {
  const sceneClassMatches = Array.from(
    ctx.innerScript.matchAll(/class\s+(\w+)\s+extends\s+(?:Phaser\.Scene|\(\s*window\.EduCore\.build)/g),
  ).map((m) => m[1] ?? '');
  // EduCore-built MenuScene/EndScene are returned as expressions and assigned to const; count those too.
  const buildMatches = Array.from(
    ctx.innerScript.matchAll(/=\s*window\.EduCore\.build(?:Menu|End)Scene\(/g),
  );
  const total = sceneClassMatches.length + buildMatches.length;
  const ok = total > 0 && total <= 3;
  return {
    name: 'three_scenes_only',
    ok,
    signature: ok ? 'scenes:ok' : `scenes:${total}`,
    detail: ok ? `${total} scenes` : `Expected 1–3 scenes, found ${total}`,
  };
}

function v_uses_educore(ctx: ValidatorContext): ValidatorResult {
  // AdaptiveEngine is always required. HUD can be the legacy makeScoreHud OR the factory
  // makeHud (cost lever C) — either one demonstrates EduCore usage.
  const hasAdaptiveEngine = ctx.innerScript.includes('window.EduCore.AdaptiveEngine.create') ||
                            ctx.innerScript.includes('EduCore.AdaptiveEngine.create');
  const hasHud = /(?:window\.)?EduCore\.makeScoreHud\b/.test(ctx.innerScript) ||
                 /(?:window\.)?EduCore\.makeHud\b/.test(ctx.innerScript) ||
                 /(?:window\.)?EduCore\.buildGameSceneSkeleton\b/.test(ctx.innerScript);
  if (hasAdaptiveEngine && hasHud) {
    return { name: 'uses_educore', ok: true, signature: 'educore:ok', detail: 'AdaptiveEngine + HUD primitive present' };
  }
  const missing: string[] = [];
  if (!hasAdaptiveEngine) missing.push('window.EduCore.AdaptiveEngine.create');
  if (!hasHud) missing.push('window.EduCore.makeScoreHud or makeHud or buildGameSceneSkeleton');
  return {
    name: 'uses_educore',
    ok: false,
    signature: `no_educore:${missing[0]}`,
    detail: `Missing: ${missing.join(', ')}`,
  };
}

function v_five_levels_in_spec(ctx: ValidatorContext): ValidatorResult {
  const ok = ctx.spec.levels.length === 5;
  return {
    name: 'five_levels_in_spec',
    ok,
    signature: ok ? 'levels:ok' : `levels:${ctx.spec.levels.length}`,
    detail: `Spec has ${ctx.spec.levels.length} levels`,
  };
}

function v_content_length_total(ctx: ValidatorContext): ValidatorResult {
  const counts = ctx.spec.levels.map((l) => l.contentItems.length);
  const total = counts.reduce((a, b) => a + b, 0);
  const tooFew = counts.some((c) => c < 3) || total < 25;
  return {
    name: 'content_length_total',
    ok: !tooFew,
    signature: tooFew ? `content_short:${total}` : 'content:ok',
    detail: tooFew ? `Counts: ${counts.join(',')} (total ${total})` : `total ${total}`,
  };
}

function v_concepts_tagged(ctx: ValidatorContext): ValidatorResult {
  const ids = new Set(ctx.spec.concepts.map((c) => c.id));
  for (const l of ctx.spec.levels) {
    for (const it of l.contentItems) {
      if (it.concepts.length === 0)
        return { name: 'concepts_tagged', ok: false, signature: 'concept_missing_on_item', detail: `Item ${it.id} has no concepts` };
      for (const c of it.concepts) {
        if (!ids.has(c))
          return { name: 'concepts_tagged', ok: false, signature: 'concept_unknown', detail: `Item ${it.id} references unknown concept ${c}` };
      }
    }
  }
  return { name: 'concepts_tagged', ok: true, signature: 'concepts:ok', detail: 'all items concept-tagged' };
}

function v_touch_target_size(ctx: ValidatorContext): ValidatorResult {
  // Only flag shapes that are INTERACTIVE. Decorative shapes (progress bar fill, particles,
  // background dots, etc.) can be any size. We detect interactivity by finding the
  // `.setInteractive(` call on the same statement as the `add.rectangle|circle` call.
  const re = /add\.(?:rectangle|circle)\(\s*[^,)]+,\s*[^,)]+,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?[^)]*\)[^;\n]*\.setInteractive\(/g;
  const matches = ctx.innerScript.matchAll(re);
  for (const m of matches) {
    const w = Number(m[1]);
    const h = m[2] ? Number(m[2]) : w;
    const effW = m[2] ? w : w * 2; // circle: arg is radius → diameter is 2r
    const effH = m[2] ? h : w * 2;
    if (effW < 44 || effH < 44) {
      return {
        name: 'touch_target_size',
        ok: false,
        signature: 'touch_small',
        detail: `Interactive shape ${effW}x${effH} below 44px`,
      };
    }
  }
  return { name: 'touch_target_size', ok: true, signature: 'touch:ok', detail: 'all interactive shapes ≥44px' };
}

function v_no_keyboard_input(ctx: ValidatorContext): ValidatorResult {
  const m = ctx.innerScript.match(/\binput\.keyboard\b|addEventListener\(\s*['"]key/);
  return {
    name: 'no_keyboard_input',
    ok: !m,
    signature: m ? 'keyboard_input' : 'keyboard:ok',
    detail: m ? `Found keyboard input: ${m[0]}` : 'none',
  };
}

function v_phaser4_api_check(ctx: ValidatorContext): ValidatorResult {
  const badPatterns: Array<[RegExp, string]> = [
    [/\bsetTintFill\b/, 'setTintFill (use setTint + setTintMode in Phaser 4)'],
    [/\bsetPipeline\b/, 'setPipeline (Phaser 4 uses setFilter)'],
    [/\baddPipeline\b/, 'addPipeline (Phaser 4 uses Filter system)'],
    [/\brenderer\.pipelines\b/, 'renderer.pipelines (gone in Phaser 4)'],
  ];
  for (const [re, label] of badPatterns) {
    if (re.test(ctx.innerScript))
      return { name: 'phaser4_api_check', ok: false, signature: `phaser3_api:${label}`, detail: `Phaser 3 API: ${label}` };
  }
  return { name: 'phaser4_api_check', ok: true, signature: 'phaser4:ok', detail: 'no Phaser 3 APIs' };
}

function v_phaser_scale_config(ctx: ValidatorContext): ValidatorResult {
  // Legacy path: literal Phaser.Scale.FIT + CENTER_BOTH constants.
  // Factory path: buildPhaserConfig() — the factory already includes the right scale mode.
  const hasFit = /Phaser\.Scale\.FIT/.test(ctx.innerScript);
  const hasCenter = /Phaser\.Scale\.CENTER_BOTH/.test(ctx.innerScript);
  const hasFactory = /EduCore\.buildPhaserConfig\s*\(/.test(ctx.innerScript);
  const ok = (hasFit && hasCenter) || hasFactory;
  return {
    name: 'phaser_scale_config',
    ok,
    signature: ok ? 'scale:ok' : 'scale_missing',
    detail: ok ? 'scale config present' : 'Missing Phaser.Scale.FIT/CENTER_BOTH and no buildPhaserConfig',
  };
}

function v_font_size_minimum(ctx: ValidatorContext): ValidatorResult {
  const minSize = ctx.spec.language === 'ar' ? 28 : 24;
  const matches = Array.from(ctx.innerScript.matchAll(/fontSize:\s*['"](\d+)px['"]/g));
  for (const m of matches) {
    const sz = Number(m[1]);
    if (sz < minSize)
      return {
        name: 'font_size_minimum',
        ok: false,
        signature: `font_small:${sz}`,
        detail: `fontSize ${sz}px below ${minSize}px (language ${ctx.spec.language})`,
      };
  }
  return { name: 'font_size_minimum', ok: true, signature: 'font:ok', detail: `min ${minSize}px enforced` };
}

function v_language_consistency(ctx: ValidatorContext): ValidatorResult {
  const setLang = ctx.innerScript.match(/EduCore\.setLanguage\(['"](\w+)['"]\)/);
  const lang = setLang?.[1];
  if (lang && lang !== ctx.spec.language)
    return {
      name: 'language_consistency',
      ok: false,
      signature: `lang_mismatch:${lang}`,
      detail: `Inner script sets language=${lang}, spec=${ctx.spec.language}`,
    };
  return { name: 'language_consistency', ok: true, signature: 'lang:ok', detail: 'consistent' };
}

function v_rtl_support_if_arabic(ctx: ValidatorContext): ValidatorResult {
  if (ctx.spec.language !== 'ar') {
    return { name: 'rtl_support_if_arabic', ok: true, signature: 'rtl:na', detail: 'not Arabic' };
  }
  const rawTextCalls = Array.from(
    ctx.innerScript.matchAll(/\.add\.text\([^)]*\)/g),
  );
  for (const m of rawTextCalls) {
    if (!/rtl\s*:\s*true/.test(m[0]) && !/EduCore\.addText/.test(m[0]))
      return {
        name: 'rtl_support_if_arabic',
        ok: false,
        signature: 'rtl_missing',
        detail: `Raw add.text without rtl:true: ${m[0].slice(0, 80)}`,
      };
  }
  return { name: 'rtl_support_if_arabic', ok: true, signature: 'rtl:ok', detail: 'all text RTL-aware' };
}

function v_uses_mascot(ctx: ValidatorContext): ValidatorResult {
  // Mascot must be instantiated at least once. Allow either the create call OR a stored
  // reference like `this.mascot = window.Mascot.create(...)`.
  const has = /window\.Mascot\.create\s*\(/.test(ctx.innerScript) ||
              /Mascot\.create\s*\(/.test(ctx.innerScript);
  if (!has) {
    return {
      name: 'uses_mascot',
      ok: false,
      signature: 'mascot_missing',
      detail: 'Generated game does not instantiate Pip via window.Mascot.create(...)',
    };
  }
  return { name: 'uses_mascot', ok: true, signature: 'mascot:ok', detail: 'mascot present' };
}

function v_uses_candy_button(ctx: ValidatorContext): ValidatorResult {
  // UI buttons must use GameFeel.candyButton. Skip games that genuinely have no UI buttons
  // (rare — most templates show menu / continue / level-end buttons). Heuristic: if the
  // code contains `setInteractive({ useHandCursor` (the standard button-making pattern)
  // and ALSO does not call GameFeel.candyButton, that's a missing-candy violation.
  const hasInteractive = /setInteractive\s*\(\s*\{[^}]*useHandCursor/.test(ctx.innerScript);
  const hasCandy = /GameFeel\.candyButton\s*\(/.test(ctx.innerScript);
  if (hasInteractive && !hasCandy) {
    return {
      name: 'uses_candy_button',
      ok: false,
      signature: 'raw_buttons:no_candy',
      detail: 'Game uses setInteractive buttons but never calls GameFeel.candyButton',
    };
  }
  return {
    name: 'uses_candy_button',
    ok: true,
    signature: hasCandy ? 'candy:used' : 'candy:no_buttons',
    detail: hasCandy ? 'GameFeel.candyButton called' : 'no buttons in this game',
  };
}

function v_uses_educore_factories(ctx: ValidatorContext): ValidatorResult {
  // Cost lever C: generated games should lean on the EduCore factories. Count distinct
  // factory references — at least 3 must appear. Templates that pre-existed v3 may not
  // hit this yet; the prompt update + repair seed nudge new generations toward it.
  const factories = [
    'EduCore.buildPhaserConfig',
    'EduCore.buildBridgeWiring',
    'EduCore.makeHud',
    'EduCore.buildLevelLoop',
    'EduCore.buildGameSceneSkeleton',
  ];
  let found = 0;
  for (const f of factories) if (ctx.innerScript.includes(f)) found += 1;
  if (found < 3) {
    return {
      name: 'uses_educore_factories',
      ok: false,
      signature: `educore_factories_low:${found}`,
      detail: `Only ${found} distinct EduCore factory references found (need ≥3 of buildPhaserConfig / buildBridgeWiring / makeHud / buildLevelLoop / buildGameSceneSkeleton)`,
    };
  }
  return {
    name: 'uses_educore_factories',
    ok: true,
    signature: 'educore_factories:ok',
    detail: `${found} factory references`,
  };
}

function v_uses_gamefeel(ctx: ValidatorContext): ValidatorResult {
  // Require generated games to actually use the juice library. We look for at least
  // 5 distinct GameFeel.* method invocations across the script (composite or atomic).
  // This catches LLMs that ignore the runtime and roll their own primitives.
  const matches = Array.from(ctx.innerScript.matchAll(/GameFeel\.(?:audio\.)?([a-zA-Z_]+)\s*\(/g));
  const distinct = new Set<string>();
  for (const m of matches) distinct.add(m[1] ?? '');
  if (matches.length < 5 || distinct.size < 3) {
    return {
      name: 'uses_gamefeel',
      ok: false,
      signature: matches.length === 0 ? 'no_gamefeel_calls' : `gamefeel_low:${matches.length}:${distinct.size}`,
      detail: `Found ${matches.length} GameFeel calls across ${distinct.size} distinct methods (need ≥5 calls, ≥3 distinct)`,
    };
  }
  return {
    name: 'uses_gamefeel',
    ok: true,
    signature: 'gamefeel:ok',
    detail: `${matches.length} calls across ${distinct.size} distinct methods`,
  };
}

function v_sprite_assets_referenced_exist(ctx: ValidatorContext): ValidatorResult {
  // Inspect inner-script for references to EduSprites.library.X or EduSprites.generated.X
  // and confirm every referenced key exists in the assembled manifest. If no manifest is
  // attached (legacy specs without archetype), this validator passes silently.
  if (!ctx.spriteManifest) {
    return {
      name: 'sprite_assets_referenced_exist',
      ok: true,
      signature: 'sprite_manifest:na',
      detail: 'no manifest attached (legacy spec)',
    };
  }
  const { library, generated } = ctx.spriteManifest;
  const libRefs = Array.from(ctx.innerScript.matchAll(/EduSprites\.library\.(\w+)/g)).map((m) => m[1] ?? '');
  const genRefs = Array.from(ctx.innerScript.matchAll(/EduSprites\.generated\[['"]([\w-]+)['"]\]/g)).map((m) => m[1] ?? '');
  const missingLib = libRefs.filter((k) => !(k in library));
  const missingGen = genRefs.filter((k) => !(k in generated));
  if (missingLib.length > 0) {
    return {
      name: 'sprite_assets_referenced_exist',
      ok: false,
      signature: `sprite_missing:role_${missingLib[0]}`,
      detail: `Library sprite roles referenced but absent: ${missingLib.join(', ')}`,
    };
  }
  if (missingGen.length > 0) {
    return {
      name: 'sprite_assets_referenced_exist',
      ok: false,
      signature: `sprite_missing:concept_${missingGen[0]}`,
      detail: `Generated sprite concepts referenced but absent: ${missingGen.join(', ')}`,
    };
  }
  return {
    name: 'sprite_assets_referenced_exist',
    ok: true,
    signature: 'sprite_manifest:ok',
    detail: `${libRefs.length} library + ${genRefs.length} generated refs all resolved`,
  };
}

export const VALIDATORS: Validator[] = [
  v_no_browser_storage,
  v_no_external_resources,
  v_bridge_calls_present,
  v_three_scenes_only,
  v_uses_educore,
  v_five_levels_in_spec,
  v_content_length_total,
  v_concepts_tagged,
  v_touch_target_size,
  v_no_keyboard_input,
  v_phaser4_api_check,
  v_phaser_scale_config,
  v_font_size_minimum,
  v_language_consistency,
  v_rtl_support_if_arabic,
  v_sprite_assets_referenced_exist,
  v_uses_gamefeel,
  v_uses_mascot,
  v_uses_candy_button,
  v_uses_educore_factories,
];

export function runValidators(ctx: ValidatorContext): ValidatorResult[] {
  return VALIDATORS.map((v) => {
    try {
      return v(ctx);
    } catch (err) {
      return {
        name: v.name || 'unknown',
        ok: false,
        signature: 'validator_error',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
