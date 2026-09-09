import { build } from 'esbuild';
import { readdir, readFile, writeFile, access } from 'node:fs/promises';
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, {withFileTypes:true})) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.name.endsWith('.dart')) result.push(path);
  }
  return result;
}
const names = new Set();
for (const path of await files('mobile/lib')) {
  for (const match of (await readFile(path,'utf8')).matchAll(/LucideIcons\.([a-zA-Z0-9]+)/g)) names.add(match[1]);
}
const entries = [];
for (const name of [...names].sort()) {
  const slug = name.replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/([a-zA-Z])([0-9])/g,'$1-$2').toLowerCase();
  let path = `node_modules/lucide-react/dist/esm/icons/${name === 'globeOff' ? 'globe' : name === 'wrapText' ? 'text-wrap' : name === 'fileCode2' ? 'file-code-corner' : slug}.js`;
  try { await access(path); } catch { throw new Error(`Missing canonical icon ${name}: select an explicit alias`); }
  for (let depth = 0; depth < 5; depth++) {
    const alias = (await readFile(path, 'utf8')).match(/export\s*\{\s*default\s*\}\s*from\s*['"]\.\/([^'"]+)['"]/);
    if (!alias) break;
    path = `node_modules/lucide-react/dist/esm/icons/${alias[1]}`;
  }
  const result = await build({entryPoints:[path],bundle:true,write:false,format:'esm',platform:'node'});
  const {__iconNode} = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
  const nodes = name === 'globeOff' ? [...(await readFile('components/icons/GlobeOffIcon.tsx','utf8')).matchAll(/d: "([^"]+)"/g)].map(m=>['path',{d:m[1]}]) : __iconNode;
  const body = nodes.map(([tag,attrs])=>`<${tag} ${Object.entries(attrs).filter(([key])=>key!=='key').map(([key,value])=>`${key}="${value}"`).join(' ')}/>`).join('');
  await writeFile(`mobile/assets/images/ui-${slug}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`);
  entries.push(`  LucideIcons.${name}: '${slug}',`);
}
await writeFile('mobile/lib/shared/widgets/ui_icon_paths.dart',`// Generated from the repository's lucide-react assets.\nimport 'package:flutter/widgets.dart';\nimport 'package:lucide_icons_flutter/lucide_icons.dart';\nfinal uiIconPaths = <IconData, String>{\n${entries.join('\n')}\n};\n`);
