import {validDate} from '../public/finance.mjs';
export const ADMIN_OWNER='CONFIGURE_ADMIN_OWNER';
export const memberFor=(db,user)=>db.prepare('SELECT user_id AS userId,email,name,valid_until AS validUntil,revision FROM members WHERE user_id = ?').bind(user).first();
export const hasAccess=(user,member,today)=>user===ADMIN_OWNER||!!member?.validUntil&&member.validUntil>=today;
export function checkoutLink(value){if(!value)return '';let u;try{u=new URL(value);}catch{throw Error('Informe o link de assinatura do Mercado Pago.');}if(u.protocol!=='https:'||u.hostname!=='www.mercadopago.com.br'||u.port||u.username||u.password||u.pathname!=='/subscriptions/checkout'||!/^\w{20,100}$/.test(u.searchParams.get('preapproval_plan_id')||''))throw Error('Use o link de plano de assinatura do Mercado Pago, com preapproval_plan_id.');return u.href;}
export async function billingRoute({request,db,user,today,body,fail,json}){
 const path=new URL(request.url).pathname,method=request.method,admin=user===ADMIN_OWNER;
 if(path==='/api/billing'&&method==='GET'){
  const settings=await db.prepare('SELECT checkout_url AS checkoutUrl,support_email AS supportEmail FROM billing_settings WHERE id = 1').bind().first();const member=await memberFor(db,user);
  return json({price:990,currency:'BRL',interval:'month',admin,active:hasAccess(user,member,today),member,checkoutUrl:settings?.checkoutUrl||'',supportEmail:settings?.supportEmail||'',email:request.headers.get('oai-authenticated-user-email')||''});
 }
 if(path==='/api/billing/join'&&method==='POST'){
  const b=await body(request);if(typeof b.name!=='string'||!b.name.trim()||b.name.length>100)fail(400,'Informe seu nome com até 100 caracteres.');
  const email=request.headers.get('oai-authenticated-user-email')||'';const now=new Date().toISOString();
  await db.prepare('INSERT INTO members (user_id,email,name,requested_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,name=excluded.name').bind(user,email,b.name.trim(),now,now).run();
  return json({member:await memberFor(db,user)});
 }
 if(path.startsWith('/api/admin/')){
  if(!admin)fail(403,'Acesso exclusivo da administradora.');
  if(path==='/api/admin/members'&&method==='GET'){
   const result=await db.prepare('SELECT user_id AS userId,email,name,valid_until AS validUntil,revision FROM members ORDER BY requested_at DESC LIMIT 101').bind().all();return json({members:result.results.slice(0,100),hasMore:result.results.length>100});
  }
  if(path==='/api/admin/settings'&&method==='POST'){
   const b=await body(request);let link;try{link=checkoutLink(b.checkoutUrl);}catch(e){fail(400,e.message);}if(typeof b.supportEmail!=='string'||!/^\S+@\S+\.\S+$/.test(b.supportEmail)||b.supportEmail.length>200)fail(400,'Informe um e-mail de suporte válido.');
   await db.prepare('INSERT INTO billing_settings (id,checkout_url,support_email,updated_at) VALUES (1,?,?,?) ON CONFLICT(id) DO UPDATE SET checkout_url=excluded.checkout_url,support_email=excluded.support_email,updated_at=excluded.updated_at').bind(link,b.supportEmail,new Date().toISOString()).run();return json({saved:true});
  }
  if(path==='/api/admin/access'&&method==='POST'){
   const b=await body(request);if(typeof b.userId!=='string'||!Number.isInteger(b.revision)||b.revision<0)fail(400,'Cliente inválido.');
   if(b.validUntil!==null&&(!validDate(b.validUntil)||b.validUntil<today))fail(400,'Informe a data final do período pago, a partir de hoje.');
   if(typeof b.reason!=='string'||!b.reason.trim()||b.reason.length>200)fail(400,'Informe o motivo.');
   if(typeof b.paymentRef!=='string'||b.paymentRef.length>120||b.validUntil!==null&&!b.paymentRef.trim())fail(400,'Informe a referência do pagamento conferido no Mercado Pago.');
   const existing=await memberFor(db,b.userId);if(!existing)fail(404,'Cliente não encontrado.');if(existing.revision!==b.revision)fail(409,'Este acesso mudou. Atualize a lista.');
   const results=await db.batch([
    db.prepare('UPDATE members SET valid_until = ?,revision = revision + 1,updated_at = ? WHERE user_id = ? AND revision = ?').bind(b.validUntil,new Date().toISOString(),b.userId,b.revision),
    db.prepare('INSERT INTO membership_events (user_id,actor,valid_until,reason,payment_ref,created_at) SELECT ?,?,?,?,?,? WHERE changes() = 1').bind(b.userId,user,b.validUntil,b.reason.trim(),b.paymentRef.trim(),new Date().toISOString())
   ]);if(!results[0].meta.changes)fail(409,'Este acesso mudou. Atualize a lista.');return json({member:await memberFor(db,b.userId)});
  }
  fail(404,'Recurso não encontrado.');
 }
 return null;
}
