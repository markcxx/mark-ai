// Standalone read-only reference harness; does not run Next or touch .next.
import { build } from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';

const root = process.cwd();
const out = resolve(root, 'mobile/qa/web-reference');
await mkdir(out, { recursive: true });
const shims = {
  'next/image': `import React from 'react'; export default function Image({fill,priority,unoptimized,sizes,quality,...props}) {return <img {...props} style={{...props.style,...(fill?{position:'absolute',inset:0,width:'100%',height:'100%'}:{})}}/>}`,
  'next/link': `import React from 'react'; export default function Link(props){return <a {...props}/>}`,
  'next/navigation': `export const useRouter=()=>({push:p=>history.pushState({},'',p),replace:p=>history.replaceState({},'',p),refresh:()=>{}}); export const usePathname=()=>location.pathname; export const useSearchParams=()=>new URLSearchParams(location.search);`,
  'next/dynamic': `import React from 'react'; export default function dynamic(load){const Component=React.lazy(load);return props=><React.Suspense fallback={null}><Component {...props}/></React.Suspense>}`,
  '@/lib/auth-client': `const data={user:{id:'qa-user',name:'测试用户',email:'qa@example.invalid'}}; export const useSession=()=>({data,isPending:false}); export const signOut=async()=>{}; export const getSession=async()=>({data}); export const signIn={}; export const signUp={};`,
};
await build({entryPoints: ['mobile/tool/web-reference.tsx'], bundle: true, outdir: out, format: 'esm', splitting: true, jsx: 'automatic',
  external: ['@js-preview/docx', 'echarts-gl'],
  define: {'process.env.NODE_ENV':'"development"'}, loader: {'.css':'empty', '.woff2':'file', '.ttf':'file'},
  plugins: [{name:'qa-shims',setup(b){
    b.onResolve({filter:/^(next\/|@\/lib\/auth-client$)/},args=>shims[args.path] ? {path:args.path,namespace:'shim'} : undefined);
    b.onLoad({filter:/.*/,namespace:'shim'},args=>({contents:shims[args.path],loader:'tsx',resolveDir:root}));
  }}]});
const css = await postcss([tailwind()]).process(await readFile('app/globals.css','utf8'), {from:resolve('app/globals.css')});
await writeFile(resolve(out,'style.css'), css.css + `\n@font-face{font-family:'Noto Sans SC';src:url('/qa-fonts/NotoSansSC.ttf');font-weight:100 900}@font-face{font-family:'Plus Jakarta Sans';src:url('/qa-fonts/PlusJakartaSans.ttf');font-weight:100 900}body{font-family:'Noto Sans SC';margin:0}#root{height:100dvh}`);
await writeFile(resolve(out,'index.html'), '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/web-reference.js"></script></body></html>');
createServer(async (req,res)=>{
  try {
    const path = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const base = path.startsWith('/images/') ? resolve(root,'public') : path.startsWith('/qa-fonts/') ? resolve(root,'mobile/assets/fonts') : out;
    const relative = path.startsWith('/qa-fonts/') ? path.slice('/qa-fonts/'.length) : path.slice(1) || 'index.html';
    const file = resolve(base, base === out && !extname(relative) ? 'index.html' : relative);
    if (!file.startsWith(base+'/')) {res.writeHead(403).end();return;}
    const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.ttf':'font/ttf'};
    res.setHeader('Content-Type',types[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch {res.writeHead(404).end();}
}).listen(4317,'127.0.0.1',()=>console.log('Web component reference: http://127.0.0.1:4317'));
