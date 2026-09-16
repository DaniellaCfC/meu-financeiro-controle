// Network-only: no financial responses, authenticated pages or credentials are cached.
const offlinePage=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Meu Financeiro · Sem conexão</title><style>body{font:18px/1.6 system-ui,sans-serif;margin:0;padding:48px 24px;background:#f3f6fa;color:#102d40}main{max-width:480px;margin:10vh auto}h1{font-size:30px}a{display:inline-block;background:#087b64;color:white;text-decoration:none;border-radius:8px;padding:12px 20px}p{color:#435a6c}</style><main><h1>Você está sem conexão</h1><p>Conecte-se à internet para consultar suas contas e registrar lançamentos.</p><p>Se a conexão caiu durante um envio, confira seus lançamentos quando voltar antes de cadastrar a conta novamente.</p><a href="/">Tentar novamente</a></main></html>`;
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||event.request.mode!=='navigate'||url.origin!==self.location.origin||url.pathname!=='/')return;
  event.respondWith(fetch(event.request).catch(()=>new Response(offlinePage,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
