import ts from 'typescript';
import { build } from 'esbuild';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
const source=ts.createSourceFile('CodeBlock.tsx',await readFile('components/CodeBlock.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let pairs;
function walk(node) {if(ts.isVariableDeclaration(node) && node.name.getText(source)==='themePairs') pairs=node.initializer.getText(source);ts.forEachChild(node,walk);}
walk(source);
const imports=source.statements.filter(n=>ts.isImportDeclaration(n)&&n.moduleSpecifier.text==='react-syntax-highlighter/dist/esm/styles/prism').map(n=>n.getText(source)).join('\n');
const themeBundle=await build({stdin:{contents:imports+`\nexport const themes=${pairs};`,loader:'ts',resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'node'});
const {themes}=await import(`data:text/javascript;base64,${Buffer.from(themeBundle.outputFiles[0].text).toString('base64')}`);
await writeFile('mobile/lib/shared/models/code_themes.dart',`// Generated from components/CodeBlock.tsx and its exact Prism themes.\nconst codeThemes = ${JSON.stringify(themes,null,2).replace(/\$/g,'\\$')};\n`);
await build({stdin:{contents:`import {refractor} from 'refractor/all';
globalThis.markaiTokens = (code,language) => {
  if(!refractor.registered(language)) return [{text:code,classes:[]}];
  const result=[];
  const walk=(node,classes=[])=>{if(node.type==='text') {result.push({text:node.value,classes});return;}
    const next=[...classes,...(node.properties?.className || []).filter(c=>c!=='token')];
    for(const child of node.children || []) walk(child,next);
  };
  walk(refractor.highlight(code,language));return result;
};`,loader:'js',resolveDir:process.cwd()},bundle:true,outfile:'mobile/assets/web/code-highlighter.js',format:'iife',platform:'neutral',target:'es2019',minify:true,
  // Refractor uses ES2022 Object.hasOwn; Android's embedded QuickJS predates it.
  banner:{js:'if (!Object.hasOwn) Object.hasOwn = function(object, key) { return Object.prototype.hasOwnProperty.call(object, key); };'}});
await copyFile('node_modules/refractor/license','mobile/assets/web/REFRACTOR-LICENSE');
