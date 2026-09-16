import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import vm from 'node:vm';
import worker from './dist/server/index.js';
test('Manifesto e ícones servidos corretamente pelo Worker',async()=>{
 const response=await worker.fetch(new Request('https://financeiro.example/manifest.webmanifest'),{});assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/manifest/);
 const manifest=await response.json();assert.equal(manifest.display,'standalone');assert.equal(manifest.start_url,'/');
 for(const icon of manifest.icons){const res=await worker.fetch(new Request('https://financeiro.example'+icon.src),{});const buffer=Buffer.from(await res.arrayBuffer());assert.equal(res.headers.get('content-type'),'image/png');assert.equal(buffer.toString('hex',0,8),'89504e470d0a1a0a');const size=Number(icon.sizes.split('x')[0]);assert.equal(buffer.readUInt32BE(16),size);assert.equal(buffer.readUInt32BE(20),size);}
 const html=await(await worker.fetch(new Request('https://financeiro.example/'),{})).text();assert.match(html,/rel="manifest"[^>]+crossorigin="use-credentials"/);
});
test('Service worker não intercepta pagamentos, API ou autenticação; offline não mostra dados',async()=>{
 const callbacks={};const self={location:{origin:'https://financeiro.example'},addEventListener:(name,callback)=>callbacks[name]=callback,skipWaiting:()=>{},clients:{claim:async()=>{}}};
 vm.runInNewContext(readFileSync('public/sw.js','utf8'),{self,URL,Response,fetch:async()=>{throw Error('Offline')}});
 for(const [method,path,mode] of [['POST','/api/entries','cors'],['GET','/api/state','cors'],['GET','/signin-with-chatgpt','navigate'],['GET','/signout-with-chatgpt','navigate']]){
 let intercepted=false;callbacks.fetch({request:{method,mode,url:'https://financeiro.example'+path},respondWith(){intercepted=true}});assert.equal(intercepted,false);
 }
 let result;callbacks.fetch({request:{method:'GET',mode:'navigate',url:'https://financeiro.example/'},respondWith(p){result=p}});const response=await result;assert.match(await response.text(),/sem conexão/);assert.equal(response.headers.get('cache-control'),'no-store');
});
