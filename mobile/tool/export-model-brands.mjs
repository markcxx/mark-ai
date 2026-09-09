import ts from 'typescript';
import { build } from 'esbuild';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
const source = ts.createSourceFile('ModelBrandIcon.tsx',await readFile('components/chat/ModelBrandIcon.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names = ['BRAND_ASSETS','PROVIDER_ASSET_KEYS','MODEL_ASSET_RULES'];
const code = source.statements.filter(n=>ts.isVariableStatement(n) && n.declarationList.declarations.some(d=>names.includes(d.name.getText(source)))).map(n=>n.getText(source)).join('\n');
const result = await build({stdin:{contents:code+`\nexport {${names.join(',')}};`,loader:'ts'},write:false,format:'esm'});
const data = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
for (const asset of Object.values(data.BRAND_ASSETS)) {
  for (const slug of [asset.slug,asset.avatarSlug].filter(Boolean)) await copyFile(`public/images/model-icons/${slug}.svg`,`mobile/assets/model_icons/${slug}.svg`);
}
const dart = value => JSON.stringify(value,null,2).replace(/\$/g,'\\$');
await writeFile('mobile/lib/shared/widgets/model_brand_data.dart',`// Generated from components/chat/ModelBrandIcon.tsx.\nconst brandAssets = ${dart(data.BRAND_ASSETS)};\nconst providerAssetKeys = ${dart(data.PROVIDER_ASSET_KEYS)};\nconst modelAssetRules = ${dart(data.MODEL_ASSET_RULES.map(r=>({key:r.key,pattern:r.pattern.source})))};\n`);
