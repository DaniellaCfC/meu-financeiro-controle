import {billingRoute,memberFor,hasAccess} from './billing.mjs';
import {validateInvestment,calculateInvestment} from '../public/investments.mjs';
import {validDate,installmentPlan} from '../public/finance.mjs';
import {profileCategories} from '../public/profiles.mjs';

const categories=[...new Set(Object.values(profileCategories).flat())];
export class ApiError extends Error {constructor(status,message){super(message);this.status=status}}
const fail=(status,message)=>{throw new ApiError(status,message)};
const clean=(v,max,label)=>{if(typeof v!=='string'||!v.trim()||v.trim().length>max)fail(400,`Preencha ${label} com até ${max} caracteres.`);return v.trim()};
const id=v=>{if(typeof v!=='string'||!/^[a-f0-9-]{36}$/i.test(v))fail(400,'Identificador inválido.');return v};
const amount=(v,opening=false)=>{if(!Number.isSafeInteger(v)||Math.abs(v)>99999999999||!opening&&v<=0)fail(400,'Valor monetário inválido.');return v};
export const brazilToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function database(env){if(!env.DB?.prepare)fail(503,'O armazenamento está indisponível. Tente novamente.');return env.DB;}
async function body(request){if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))fail(415,'Envie os dados em JSON.');if(Number(request.headers.get('content-length')||0)>16000)fail(413,'Dados muito extensos.');const value=await request.text();if(value.length>16000)fail(413,'Dados muito extensos.');try{const b=JSON.parse(value);if(!b||Array.isArray(b)||typeof b!=='object')throw Error();return b;}catch{fail(400,'Dados inválidos.');}}
const companyFor=(db,owner)=>db.prepare('SELECT id, name, profile_type AS profileType, opening, opening_date AS openingDate FROM companies WHERE owner = ?').bind(owner).first();
const entryFields='id, type, description, party, category, amount, due, paid, installment, installment_count AS installmentCount, revision';
const entrySelect='SELECT '+entryFields+' FROM entries';
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const entryFor=(db,company,entryId)=>db.prepare(`${entrySelect} WHERE company_id = ? AND id = ?`).bind(company,entryId).first();

export async function handleApi(request,env){try{
  // These headers are stripped/replaced by Sites dispatch. Never accept identity in the request body or query.
  const owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)fail(401,'Entre na sua conta para acessar o financeiro.');
  const url=new URL(request.url),method=request.method;
  if(!['GET','POST'].includes(method))fail(405,'Método não permitido.');
  if(method==='POST'){
    if(request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Origem da solicitação não permitida.');
  }
  const db=database(env),today=brazilToday();
  const billing=await billingRoute({request,db,user:owner,today,body,fail,json});if(billing)return billing;
  if(method==='POST'&&!hasAccess(owner,await memberFor(db,owner),today))fail(402,'Seu acesso para alterações está pendente ou vencido. Consulte Minha assinatura. Seus dados continuam disponíveis para consulta.');
  if(url.pathname==='/api/state'&&method==='GET'){
    const company=await companyFor(db,owner);
    const records=company?await db.prepare(`${entrySelect} WHERE company_id = ? ORDER BY due, created_at, id`).bind(company.id).all():{results:[]};
    return json({user:{email:request.headers.get('oai-authenticated-user-email')||''},company,rows:records.results,today});
  }
  if(url.pathname==='/api/company'&&method==='POST'){
    const b=await body(request),name=clean(b.name,100,'o nome'),opening=amount(b.opening,true),profileType=b.profileType??'pj';
    if(!['pf','pj'].includes(profileType))fail(400,'Escolha pessoa física ou empresa.');
    if(!validDate(b.openingDate)||b.openingDate>today)fail(400,'Informe uma data inicial válida, até hoje.');
    await db.prepare('INSERT INTO companies (id, owner, name, profile_type, opening, opening_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner) DO NOTHING')
      .bind(crypto.randomUUID(),owner,name,profileType,opening,b.openingDate,new Date().toISOString()).run();
    const company=await companyFor(db,owner);
    if(company.name!==name||company.profileType!==profileType||company.opening!==opening||company.openingDate!==b.openingDate)fail(409,'Seu perfil já está cadastrado. Atualize a página.');
    return json({company},201);
  }
  const company=await companyFor(db,owner);if(!company)fail(409,'Cadastre seu perfil primeiro.');
  if(url.pathname==='/api/investment-rate'&&method==='GET'){
    const model=url.searchParams.get('model'),series=({cdi:4389,selic:1178})[model];if(!series)fail(400,'Escolha CDI ou Selic.');
    try{const response=await fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.'+series+'/dados/ultimos/1?formato=json',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error();const values=await response.json(),value=Number(values[0]?.valor),date=values[0]?.data;if(!Number.isFinite(value)||value<0||value>100||typeof date!=='string')throw Error();return json({rate:value,date,source:'Banco Central · SGS '+series});}catch{fail(503,'Não foi possível consultar o Banco Central. Informe a taxa manualmente ou tente novamente.');}
  }
  if(url.pathname==='/api/investments'&&method==='GET'){
    const result=await db.prepare('SELECT id,data,revision FROM investments WHERE company_id = ? ORDER BY updated_at DESC,id').bind(company.id).all();return json({investments:result.results.map(r=>({id:r.id,revision:r.revision,...JSON.parse(r.data)}))});
  }
  if(url.pathname==='/api/investments'&&method==='POST'){
    const b=await body(request),investmentId=id(b.id);let data;try{data=validateInvestment(b);calculateInvestment(data,'end');calculateInvestment(data,'exit');}catch(e){fail(400,e.message);}
    if(company.profileType!=='pf'&&data.tax==='regressive')fail(400,'Para empresa, informe os descontos conforme orientação contábil. O cálculo regressivo automático é para pessoa física.');
    if(!Number.isInteger(b.revision)||b.revision<0)fail(400,'Revisão inválida.');
    const serialized=JSON.stringify(data),existing=await db.prepare('SELECT data,revision FROM investments WHERE company_id = ? AND id = ?').bind(company.id,investmentId).first();
    if(existing){
      if(existing.data===serialized&&existing.revision===b.revision+1)return json({investment:{id:investmentId,revision:existing.revision,...data}});
      if(existing.revision!==b.revision)fail(409,'O investimento mudou em outra janela. Feche o formulário e atualize a lista.');
      const result=await db.prepare('UPDATE investments SET data = ?,revision = revision + 1,updated_at = ? WHERE id = ? AND company_id = ? AND revision = ? RETURNING revision').bind(serialized,new Date().toISOString(),investmentId,company.id,b.revision).first();if(!result)fail(409,'O investimento foi alterado. Atualize a lista.');return json({investment:{id:investmentId,revision:result.revision,...data}});
    }
    if(b.revision!==0)fail(404,'Investimento não encontrado.');
    await db.prepare('INSERT INTO investments (id,company_id,data,revision,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(id) DO NOTHING').bind(investmentId,company.id,serialized,new Date().toISOString()).run();
    const saved=await db.prepare('SELECT data,revision FROM investments WHERE id = ? AND company_id = ?').bind(investmentId,company.id).first();if(!saved||saved.data!==serialized)fail(409,'Não foi possível salvar este identificador. Atualize os dados.');return json({investment:{id:investmentId,revision:saved.revision,...data}},201);
  }
  if(url.pathname==='/api/profile'&&method==='POST'){
    const b=await body(request),name=clean(b.name,100,'o nome');
    if(!['pf','pj'].includes(b.profileType))fail(400,'Escolha pessoa física ou empresa.');
    await db.prepare('UPDATE companies SET name = ?, profile_type = ? WHERE owner = ?').bind(name,b.profileType,owner).run();
    return json({company:await companyFor(db,owner)});
  }
  if(url.pathname==='/api/entries'&&method==='POST'){
    const b=await body(request),entryId=id(b.id),description=clean(b.description,100,'a descrição'),party=clean(b.party,100,'o cliente ou fornecedor');
    amount(b.amount);if(!['in','out'].includes(b.type)||!categories.includes(b.category))fail(400,'Tipo ou categoria inválidos.');
    if(!validDate(b.due))fail(400,'Vencimento inválido.');
    let plan;try{plan=installmentPlan(b.amount,b.installments??1,b.due);}catch(e){fail(400,e.message);}
    const requestKey=await digest(JSON.stringify([company.id,b.type,description,party,b.category,b.amount,b.due,plan.length]));
    const identifiers=await Promise.all(plan.map(async(_,i)=>{if(i===0)return entryId;const hash=await digest(entryId+':'+i);return `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;}));
    const createdAt=new Date().toISOString();
    // The first record anchors the request. Remaining rows are inserted only if its fingerprint matches.
    // D1 batch is transactional, so a storage failure cannot leave only some installments saved.
    const statements=plan.map((p,i)=>db.prepare(`INSERT INTO entries (id, company_id, type, description, party, category, amount, due, created_at, installment_group, installment, installment_count, request_key)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ? = 0 OR EXISTS (SELECT 1 FROM entries WHERE id = ? AND company_id = ? AND request_key = ?) ON CONFLICT(id) DO NOTHING`)
      .bind(identifiers[i],company.id,b.type,description,party,b.category,p.amount,p.due,createdAt,entryId,p.installment,p.installmentCount,requestKey,i,entryId,company.id,requestKey));
    await db.batch(statements);
    const saved=await db.prepare(`${entrySelect} WHERE company_id = ? AND (installment_group = ? OR id = ?) ORDER BY installment`).bind(company.id,entryId,entryId).all();
    if(saved.results.length!==plan.length||saved.results.some((r,i)=>r.type!==b.type||r.description!==description||r.party!==party||r.category!==b.category||r.amount!==plan[i].amount||r.due!==plan[i].due||r.installmentCount!==plan.length))fail(409,'Este lançamento já foi enviado com outros dados. Atualize a página.');
    return json({entry:saved.results[0],entries:saved.results},201);
  }
  const historyMatch=url.pathname.match(/^\/api\/entries\/([a-f0-9-]{36})\/history$/i);
  if(historyMatch&&method==='GET'){
    const entry=await entryFor(db,company.id,historyMatch[1]);if(!entry)fail(404,'Lançamento não encontrado.');
    const records=await db.prepare('SELECT id, action, actor, reason, before_json AS beforeJson, after_json AS afterJson, occurred_at AS occurredAt FROM entry_history WHERE company_id = ? AND entry_id = ? ORDER BY id DESC LIMIT 101').bind(company.id,entry.id).all();
    return json({entry,hasMore:records.results.length>100,history:records.results.slice(0,100).map(r=>({...r,before:r.beforeJson?JSON.parse(r.beforeJson):null,after:JSON.parse(r.afterJson),beforeJson:undefined,afterJson:undefined,actor:r.actor===owner?'Você':'Usuário do perfil'}))});
  }
  const match=url.pathname.match(/^\/api\/entries\/([a-f0-9-]{36})\/(settle|edit|reopen)$/i);
  if(match&&method==='POST'){
    const b=await body(request),entryId=id(match[1]),action=match[2];
    const entry=await entryFor(db,company.id,entryId);
    if(!entry)fail(404,'Lançamento não encontrado.');
    const revision=b.revision??(action==='settle'?entry.revision:null);
    if(!Number.isSafeInteger(revision)||revision<0)fail(400,'Atualize a página antes de alterar o lançamento.');
    const operationId=b.operationId?id(b.operationId):action==='settle'?crypto.randomUUID():fail(400,'Identificador da alteração não informado.');
    const reason=action==='settle'?'Quitação registrada':clean(b.reason,200,'o motivo da alteração');
    const next={type:entry.type,description:entry.description,party:entry.party,category:entry.category,amount:entry.amount,due:entry.due,paid:entry.paid};
    if(action==='edit'){
      next.description=clean(b.description,100,'a descrição');next.party=clean(b.party,100,'a pessoa ou empresa');next.amount=amount(b.amount);
      if(!['in','out'].includes(b.type)||!categories.includes(b.category))fail(400,'Tipo ou categoria inválidos.');
      if(!validDate(b.due))fail(400,'Vencimento inválido.');
      next.type=b.type;next.category=b.category;next.due=b.due;
    }else if(action==='settle'){
      if(!validDate(b.date)||b.date>today||b.date<company.openingDate)fail(400,'A quitação deve ocorrer entre a data do saldo inicial e hoje.');
      next.paid=b.date;
    }else next.paid=null;
    const key=await digest(JSON.stringify([entryId,action,revision,reason,action==='edit'?[next.type,next.description,next.party,next.category,next.amount,next.due]:next.paid]));
    const previous=await db.prepare('SELECT last_mutation_id AS id, last_mutation_key AS key FROM entries WHERE id = ? AND company_id = ?').bind(entryId,company.id).first();
    if(previous.id===operationId){if(previous.key!==key)fail(409,'Essa solicitação já foi usada com outros dados. Atualize a página.');return json({entry});}
    if(action==='settle'&&entry.paid===b.date&&b.revision===undefined)return json({entry});
    if(entry.revision!==revision)fail(409,'Este lançamento foi alterado em outra janela. Atualize os dados e tente novamente.');
    if(action==='edit'&&entry.paid)fail(409,'Desfaça a quitação antes de editar esta conta.');
    if(action==='settle'&&entry.paid)fail(409,'Esta conta já foi quitada. Atualize os dados.');
    if(action==='reopen'&&!entry.paid)fail(409,'Esta conta já está em aberto. Atualize os dados.');
    const result=await db.prepare('UPDATE entries SET type = ?, description = ?, party = ?, category = ?, amount = ?, due = ?, paid = ?, paid_at = ?, revision = revision + 1, updated_by = ?, change_reason = ?, last_mutation_id = ?, last_mutation_key = ? WHERE id = ? AND company_id = ? AND revision = ? RETURNING '+entryFields)
      .bind(next.type,next.description,next.party,next.category,next.amount,next.due,next.paid,next.paid?new Date().toISOString():null,owner,reason,operationId,key,entryId,company.id,revision).first();
    if(result)return json({entry:result});
    const latest=await db.prepare('SELECT last_mutation_id AS id, last_mutation_key AS key FROM entries WHERE id = ? AND company_id = ?').bind(entryId,company.id).first();
    if(latest?.id===operationId&&latest.key===key)return json({entry:await entryFor(db,company.id,entryId)});
    if(action==='settle'&&b.revision===undefined){const current=await entryFor(db,company.id,entryId);if(current.paid===b.date&&current.revision===revision+1)return json({entry:current});}
    fail(409,'Este lançamento foi alterado em outra janela. Atualize os dados e tente novamente.');
  }
  fail(404,'Recurso não encontrado.');
}catch(error){if(error instanceof ApiError)return json({error:error.message},error.status);console.error('Financial API storage failure',error?.name);return json({error:'Não foi possível concluir a operação. Confira sua conexão e tente novamente; os dados do formulário foram mantidos.'},503);}}
