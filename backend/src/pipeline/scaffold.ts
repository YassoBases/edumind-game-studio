import { loadArabicFontBase64, loadEduCore, loadGameFeel, loadMascot, loadPhaserBundle, PHASER_CDN } from './templates.ts';

export type ScaffoldInput = {
  language: 'en' | 'ar';
  innerScript: string;
  sprites?: { library: Record<string, string>; generated: Record<string, string> };
};

const SCAFFOLD_HEAD_STYLE = `*{margin:0;padding:0;box-sizing:border-box;touch-action:none;}
html,body{width:100%;height:100%;overflow:hidden;background:#000;}
#game-container{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;}
canvas{display:block;}`;

const FONT_FACE_TEMPLATE = (b64: string) =>
  b64
    ? `@font-face{font-family:'NotoArabic';src:url(data:font/woff2;base64,${b64}) format('woff2');font-display:swap;}`
    : '';

const BRIDGE_SCRIPT = (lang: 'en' | 'ar') => `
window.EduMindAPI = {
  reportScore:    v => post({event:'score', data:{value:v}}),
  reportLevel:    (lvl,score,accuracy,durationMs) => post({event:'level', data:{level:lvl,score,accuracy,durationMs}}),
  reportSummary:  s => post({event:'summary', data:s}),
  reportComplete: (score,won,time) => post({event:'complete', data:{score,won,time}}),
  reportEvent:    (n,d) => post({event:'custom', name:n, data:d}),
};
function post(p){
  // Native WebView channel (Android/iOS) — webview_flutter receives this.
  try { window.EduMind && window.EduMind.postMessage(JSON.stringify(p)); } catch(e) {}
  // Web iframe channel — forward to the parent window so the Dart-side iframe-listener
  // can route into the same _onBridge handler the native channel uses.
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ source: 'EduMind', payload: p }, '*');
    }
  } catch(e) {}
}
document.addEventListener('touchstart', function unlock(){
  try{(new (window.AudioContext||window.webkitAudioContext)()).resume();}catch(e){}
  document.removeEventListener('touchstart',unlock);
}, {once:true});
window.EduCore && window.EduCore.setLanguage('${lang}');
`;

export async function wrapInScaffold(input: ScaffoldInput): Promise<string> {
  const lang = input.language;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [eduCore, gameFeel, mascot, phaserBundle, arabicFont] = await Promise.all([
    loadEduCore(),
    loadGameFeel(),
    loadMascot(),
    loadPhaserBundle(),
    loadArabicFontBase64(),
  ]);

  // Inline the bundle whenever it's staged on disk — saves ~1.3 MB of network per game
  // load and one CDN round-trip. boot-time inline_phaser.ts copies it from node_modules.
  // Falls back to the CDN script tag if the file isn't staged (e.g. CI without npm install).
  const phaserTag = phaserBundle
    ? `<script>${phaserBundle}</script>`
    : PHASER_CDN;

  const fontFace = FONT_FACE_TEMPLATE(arabicFont);
  const spriteScript = `window.EduSprites = ${JSON.stringify(
    input.sprites ?? { library: {}, generated: {} },
  )};`;

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
${SCAFFOLD_HEAD_STYLE}
${fontFace}
</style>
</head>
<body>
<div id="game-container"></div>
${phaserTag}
<script>${eduCore}</script>
<script>${gameFeel}</script>
<script>${mascot}</script>
<script>${spriteScript}</script>
<script>${BRIDGE_SCRIPT(lang)}</script>
<script>
${input.innerScript}
</script>
</body>
</html>`;
}
