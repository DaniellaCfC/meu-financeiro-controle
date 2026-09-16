import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve('.');
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
const files={};for(const [file,mime] of [['index.html','text/html; charset=utf-8'],['app.js','text/javascript; charset=utf-8'],['style.css','text/css; charset=utf-8'],['finance.mjs','text/javascript; charset=utf-8'],['profiles.mjs','text/javascript; charset=utf-8'],['reports.mjs','text/javascript; charset=utf-8'],['investments.mjs','text/javascript; charset=utf-8'],['investments-ui.mjs','text/javascript; charset=utf-8'],['billing-ui.mjs','text/javascript; charset=utf-8'],['install.js','text/javascript; charset=utf-8'],['sw.js','text/javascript; charset=utf-8'],['manifest.webmanifest','application/manifest+json'],['icon.svg','image/svg+xml'],['icon-192.png','image/png'],['icon-512.png','image/png']]){const binary=mime==='image/png';files['/'+file]={body:await readFile('public/'+file,binary?'base64':'utf8'),mime,binary};}
await writeFile('dist/server/assets.mjs','export default '+JSON.stringify(files)+';\n');
await writeFile('dist/server/api.mjs',(await readFile('server/api.mjs','utf8')).replace("'../public/finance.mjs'","'./finance.mjs'").replace("'../public/profiles.mjs'","'./profiles.mjs'").replace("'../public/investments.mjs'","'./investments.mjs'"));
await writeFile('dist/server/billing.mjs',(await readFile('server/billing.mjs','utf8')).replace("'../public/finance.mjs'","'./finance.mjs'"));
await cp('public/finance.mjs','dist/server/finance.mjs');
await cp('public/investments.mjs','dist/server/investments.mjs');
await cp('public/profiles.mjs','dist/server/profiles.mjs');
await cp('public','dist/public',{recursive:true});
await writeFile('dist/server/index.js',`import assets from './assets.mjs';
import {handleApi} from './api.mjs';
export default {async fetch(request,env){
const url=new URL(request.url);
if(url.pathname.startsWith('/api/'))return handleApi(request,env);
const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
if(!asset)return new Response('Não encontrado',{status:404});
if(!['GET','HEAD'].includes(request.method))return new Response('Método não permitido',{status:405});
return new Response(request.method==='HEAD'?null:asset.binary?Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0)):asset.body,{headers:{'Content-Type':asset.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'"}});
}};\n`);
await cp('.openai/hosting.json','dist/.openai/hosting.json');await cp('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Worker e migrações preparados em '+root+'/dist');
