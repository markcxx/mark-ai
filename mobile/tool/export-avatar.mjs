// Export geometry from the canonical Web engine for native Flutter Canvas.
// Run with: node mobile/tool/export-avatar.mjs
import { build } from "esbuild";
import { mkdir, writeFile, readFile } from "node:fs/promises";

const result = await build({
  stdin: {
    contents: `export { BotEngine } from './lib/agent-avatar/core/engine';
      export { EXPRESSION_BY_ID } from './lib/agent-avatar/core/expressions';
      export { STATE_BY_ID } from './lib/agent-avatar/core/states';`,
    resolveDir: process.cwd(), loader: "ts",
  },
  bundle: true, write: false, format: "esm", platform: "node",
});
const { BotEngine, EXPRESSION_BY_ID, STATE_BY_ID } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
);
const paths = [], ids = new Map();
const path = (value) => {
  if (!ids.has(value)) { ids.set(value, paths.length); paths.push(value); }
  return ids.get(value);
};
const clips = {};
for (const state of ['idle', 'swirl', 'wink', 'wide', 'notify', 'egg', 'hexagon', 'play']) {
  const engine = new BotEngine(100, state, null, EXPRESSION_BY_ID.get('mefiant'));
  const duration = state === 'idle' ? 8 : STATE_BY_ID.get(state).duration;
  clips[state] = Array.from({ length: Math.ceil(duration * 60) }, (_, i) => {
    const frame = engine.sample(i / 60);
    frame.bodyPath = path(frame.bodyPath);
    frame.eyes.forEach(e => { e.d = path(e.d); });
    frame.arcs.forEach(a => { a.back = path(a.back); a.front = path(a.front); });
    frame.dots.forEach(d => { if (d.d) d.d = path(d.d); });
    return frame;
  });
}
await mkdir('mobile/assets/avatar', { recursive: true });
await writeFile('mobile/assets/avatar/frames.json', JSON.stringify({ fps: 60, paths, clips }));
await writeFile('mobile/assets/avatar/LICENSE', await readFile('lib/agent-avatar/core/LICENSE'));

// Use the exact selected Lucide paths used by the Web, not a different font
// package's version or its internal glyph padding.
for (const name of ['moon', 'sun', 'eye', 'eye-off', 'clock-3', 'log-in', 'paperclip', 'globe', 'sliders-horizontal', 'send-horizontal']) {
  const icon = await build({entryPoints: [`node_modules/lucide-react/dist/esm/icons/${name}.js`], bundle: true, write: false, format: 'esm', platform: 'node'});
  const { __iconNode } = await import(`data:text/javascript;base64,${Buffer.from(icon.outputFiles[0].text).toString('base64')}`);
  const body = __iconNode.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([key]) => key !== 'key').map(([key, value]) => `${key}="${value}"`).join(' ')}/>`).join('');
  await writeFile(`mobile/assets/images/ui-${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`);
}
await writeFile('mobile/assets/images/LUCIDE-LICENSE', await readFile('node_modules/lucide-react/LICENSE'));
