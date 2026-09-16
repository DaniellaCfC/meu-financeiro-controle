import http from 'node:http';import {mkdirSync} from 'node:fs';
import {localDatabase} from './local-db.mjs';import worker from './dist/server/index.js';
mkdirSync('.local',{recursive:true});const DB=localDatabase('.local/preview.sqlite');
http.createServer(async(req,res)=>{try{
  if(req.headers.host!=='127.0.0.1:4173'){res.writeHead(403);res.end();return;}
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>16000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(!key.startsWith('oai-authenticated-user-')&&value)headers.set(key,String(value));
  headers.set('oai-authenticated-user-id','local-preview-only');headers.set('oai-authenticated-user-email','teste-local@example.test');
  const request=new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined});
  const result=await worker.fetch(request,{DB});res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
}catch{res.writeHead(500);res.end('Falha na visualização local');}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173 — dados de teste separados da publicação'));
