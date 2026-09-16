import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,rmdirSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {DatabaseSync} from 'node:sqlite';
import {handleApi,brazilToday} from './server/api.mjs';import {localDatabase} from './local-db.mjs';import {totals} from './public/finance.mjs';
const origin='https://financeiro.example';
async function call(db,user,path,body,extra={}){
// Existing financial tests use explicitly provisioned local memberships. Billing authorization has separate tests.
 if(path==='/api/company'&&db?.sqlite)db.sqlite.prepare("INSERT OR IGNORE INTO members (user_id,email,name,valid_until,requested_at,updated_at) VALUES (?,?,?,'2100-12-31','2026-01-01','2026-01-01')").run(user,'test@example.test',user);
 const headers={'oai-authenticated-user-id':user||'','oai-authenticated-user-email':'teste@example.test',...extra};
 if(body){headers['content-type']='application/json';headers.origin=extra.origin??origin;}
 const response=await handleApi(new Request(origin+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined}),{DB:db});
 return {status:response.status,data:await response.json()};
}
const createCompany=(db,user)=>call(db,user,'/api/company',{name:'Empresa '+user,opening:500000,openingDate:'2026-01-01'});
const entry=()=>({id:crypto.randomUUID(),type:'out',description:'Aluguel',party:'Fornecedor',category:'Aluguel',amount:12345,due:brazilToday()});
test('Parcelamento atômico e idempotente, rejeita reenvio diferente e quita somente uma parcela',async()=>{
 const db=localDatabase();try{
 await createCompany(db,'a');const e={...entry(),amount:10000,installments:3,due:'2026-01-31'};
 let response=await call(db,'a','/api/entries',e);assert.equal(response.status,201);assert.equal(response.data.entries.length,3);
 assert.equal((await call(db,'a','/api/entries',e)).status,201);
 assert.equal((await call(db,'a','/api/entries',{...e,amount:12000,installments:5})).status,409);
 let state=(await call(db,'a','/api/state')).data;assert.equal(state.rows.length,3);assert.equal(state.rows.reduce((s,r)=>s+r.amount,0),10000);
 const second=response.data.entries[1];await call(db,'a','/api/entries/'+second.id+'/settle',{date:brazilToday()});
 state=(await call(db,'a','/api/state')).data;assert.equal(state.rows.filter(r=>r.paid).length,1);assert.equal(state.rows.find(r=>r.id===second.id).installment,2);
 assert.equal((await call(db,'a','/api/entries',e)).data.entries.length,3);
 }finally{db.sqlite.close();}
});
test('Falha no lote desfaz todas as parcelas',async()=>{
 const db=localDatabase();try{
 await createCompany(db,'a');
 db.sqlite.exec("CREATE TRIGGER fail_second BEFORE INSERT ON entries WHEN NEW.installment = 2 BEGIN SELECT RAISE(ABORT, 'test failure'); END");
 assert.equal((await call(db,'a','/api/entries',{...entry(),installments:3})).status,503);
 assert.equal((await call(db,'a','/api/state')).data.rows.length,0);
 }finally{db.sqlite.close();}
});
test('Pessoa física: cadastro, categoria pessoal, mudança de perfil preservando saldo e contas',async()=>{
 const db=localDatabase();try{
 const created=await call(db,'pf','/api/company',{name:'Pessoa de teste',profileType:'pf',opening:120000,openingDate:'2026-01-01'});
 assert.equal(created.status,201);assert.equal(created.data.company.profileType,'pf');
 const e={...entry(),category:'Alimentação'};assert.equal((await call(db,'pf','/api/entries',e)).status,201);
 await call(db,'pf','/api/entries/'+e.id+'/settle',{date:brazilToday()});
 await createCompany(db,'outra');
 const update=await call(db,'pf','/api/profile',{name:'Meu negócio',profileType:'pj',owner:'outra'});assert.equal(update.status,200);
 const state=(await call(db,'pf','/api/state')).data;assert.equal(state.company.profileType,'pj');assert.equal(state.company.opening,120000);assert.equal(state.rows[0].category,'Alimentação');assert.equal(state.rows[0].paid,brazilToday());
 assert.equal((await call(db,'outra','/api/state')).data.company.name,'Empresa outra');
 assert.equal((await call(db,'pf','/api/profile',{name:'Inválido',profileType:'admin'})).status,400);
 }finally{db.sqlite.close();}
});
test('Migração preserva cadastros antigos como PJ e seus lançamentos',()=>{
 const db=new DatabaseSync(':memory:');try{
 db.exec(readFileSync('drizzle/0000_mature_lizard.sql','utf8'));
 db.prepare('INSERT INTO companies VALUES (?, ?, ?, ?, ?, ?)').run('c','owner','Empresa existente',50000,'2026-01-01','2026-01-01');
 db.prepare('INSERT INTO entries (id, company_id, type, description, party, category, amount, due, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('e','c','out','Conta','Loja','Materiais',123,'2026-01-02','2026-01-01');
 db.exec(readFileSync('drizzle/0001_sparkling_sheva_callister.sql','utf8'));
 assert.equal(db.prepare('SELECT profile_type FROM companies').get().profile_type,'pj');assert.equal(db.prepare('SELECT amount FROM entries').get().amount,123);
 }finally{db.close();}
});
test('Persistência após reabrir o banco, centavos, quitação e reenvio idempotente',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'finance-api-'));const filename=join(dir,'db.sqlite');let db=localDatabase(filename);
 try{
 assert.equal((await createCompany(db,'a')).status,201);
 const e=entry();assert.equal((await call(db,'a','/api/entries',e)).status,201);assert.equal((await call(db,'a','/api/entries',e)).status,201);
 let state=(await call(db,'a','/api/state')).data;assert.equal(state.rows.length,1);assert.equal(totals(state.rows,state.company.opening,state.today).balance,500000);
 const path='/api/entries/'+e.id+'/settle';const results=await Promise.all([call(db,'a',path,{date:brazilToday()}),call(db,'a',path,{date:brazilToday()})]);results.forEach(r=>assert.equal(r.status,200));
 db.sqlite.close();db=localDatabase(filename);state=(await call(db,'a','/api/state')).data;
 assert.equal(state.rows.length,1);assert.equal(state.rows[0].paid,brazilToday());assert.equal(totals(state.rows,state.company.opening,state.today).balance,487655);
 assert.equal((await call(db,'a',path,{date:'2026-01-01'})).status,409);
 }finally{db.sqlite.close();rmSync(filename);rmdirSync(dir);}
});
test('Isolamento: outro usuário não consulta, duplica nem quita a conta alheia',async()=>{
 const db=localDatabase();try{
 await createCompany(db,'a');await createCompany(db,'b');const e=entry();await call(db,'a','/api/entries',e);
 assert.equal((await call(db,'b','/api/state')).data.rows.length,0);
 assert.equal((await call(db,'b','/api/entries/'+e.id+'/settle',{date:brazilToday()})).status,404);
 assert.equal((await call(db,'b','/api/entries',e)).status,409);
 assert.equal((await call(db,'a','/api/state')).data.rows[0].paid,null);
 const plan=db.sqlite.prepare('EXPLAIN QUERY PLAN SELECT id FROM entries WHERE company_id = ? ORDER BY due').all('x');assert.match(JSON.stringify(plan),/idx_entries_company_due/);
 }finally{db.sqlite.close();}
});
test('API nega anônimos, requisições de outra origem e dados inválidos',async()=>{
 const db=localDatabase();try{
 assert.equal((await call(db,null,'/api/state')).status,401);await createCompany(db,'a');
 assert.equal((await call(db,'a','/api/entries',entry(),{origin:'https://outro.example'})).status,403);
 assert.equal((await call(db,'a','/api/entries',{...entry(),amount:12.5})).status,400);
 assert.equal((await call(db,'a','/api/entries',{...entry(),due:'2026-02-30'})).status,400);
 const e=entry();await call(db,'a','/api/entries',e);
 assert.equal((await call(db,'a','/api/entries/'+e.id+'/settle',{date:'2100-01-01'})).status,400);
 assert.equal((await call(db,'a','/api/entries/'+e.id+'/settle',{date:'2025-12-31'})).status,400);
 assert.equal((await call(db,'a','/api/state')).data.rows[0].paid,null);
 assert.equal((await call(undefined,'a','/api/state')).status,503);
 }finally{db.sqlite.close();}
});

test('Editar parcela, quitar e reabrir preserva histórico, saldo e repetição segura',async()=>{
 const db=localDatabase();try{
 await createCompany(db,'a');await createCompany(db,'b');
 const created=(await call(db,'a','/api/entries',{...entry(),installments:2})).data.entries;
 const first=created[0],path='/api/entries/'+first.id;
 const edit={...first,revision:0,operationId:crypto.randomUUID(),reason:'Valor corrigido',amount:7500,description:'Conta corrigida'};
 assert.equal((await call(db,'a',path+'/edit',edit)).status,200);
 assert.equal((await call(db,'a',path+'/edit',edit)).status,200);
 assert.equal((await call(db,'a',path+'/edit',{...edit,amount:7600})).status,409);
 assert.equal((await call(db,'a',path+'/edit',{...edit,operationId:crypto.randomUUID()})).status,409);
 let state=(await call(db,'a','/api/state')).data;
 assert.equal(state.rows.find(r=>r.id===created[1].id).amount,created[1].amount);
 const settlement={revision:1,operationId:crypto.randomUUID(),date:brazilToday()};
 const concurrent=await Promise.all([call(db,'a',path+'/settle',settlement),call(db,'a',path+'/settle',settlement)]);concurrent.forEach(r=>assert.equal(r.status,200));
 assert.equal((await call(db,'a',path+'/edit',{...edit,revision:2,operationId:crypto.randomUUID()})).status,409);
 state=(await call(db,'a','/api/state')).data;assert.equal(totals(state.rows,state.company.opening,state.today).balance,492500);
 const reopen={revision:2,operationId:crypto.randomUUID(),reason:'Quitação registrada por engano'};
 for(const action of ['history','edit','reopen'])assert.equal((await call(db,'b',path+'/'+action,action==='history'?undefined:reopen)).status,404);
 assert.equal((await call(db,'a',path+'/reopen',reopen)).status,200);
 assert.equal((await call(db,'a',path+'/reopen',reopen)).status,200);
 state=(await call(db,'a','/api/state')).data;assert.equal(totals(state.rows,state.company.opening,state.today).balance,500000);
 const history=(await call(db,'a',path+'/history')).data.history;
 assert.deepEqual(history.map(h=>h.action),['reopened','settled','edited','created']);
 assert.equal(history[0].before.paid,brazilToday());assert.equal(history[0].after.paid,null);assert.equal(history[2].before.amount,first.amount);assert.equal(history[2].after.amount,7500);assert.equal(history[0].actor,'Você');
 }finally{db.sqlite.close();}
});
test('Falha ao gravar histórico impede alteração do lançamento',async()=>{
 const db=localDatabase();try{
 await createCompany(db,'a');const e=entry();await call(db,'a','/api/entries',e);
 db.sqlite.exec("CREATE TRIGGER fail_history BEFORE INSERT ON entry_history BEGIN SELECT RAISE(ABORT, 'test failure'); END");
 assert.equal((await call(db,'a','/api/entries/'+e.id+'/settle',{revision:0,operationId:crypto.randomUUID(),date:brazilToday()})).status,503);
 const row=(await call(db,'a','/api/state')).data.rows[0];assert.equal(row.paid,null);assert.equal(row.revision,0);
 assert.equal((await call(db,'a','/api/entries/'+e.id+'/history')).data.history.length,1);
 }finally{db.sqlite.close();}
});
test('Migrações de histórico preservam contas existentes sem inventar eventos anteriores',()=>{
 const db=new DatabaseSync(':memory:');try{
 for(const name of ['0000_mature_lizard','0001_sparkling_sheva_callister','0002_secret_nextwave'])db.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
 db.prepare('INSERT INTO companies (id,owner,name,opening,opening_date,created_at) VALUES (?,?,?,?,?,?)').run('c','owner','Existente',50000,'2026-01-01','2026-01-01');
 db.prepare('INSERT INTO entries (id,company_id,type,description,party,category,amount,due,created_at,paid) VALUES (?,?,?,?,?,?,?,?,?,?)').run('e','c','out','Conta','Loja','Materiais',123,'2026-01-02','2026-01-01','2026-01-02');
 for(const name of ['0003_sticky_greymalkin','0004_entry_history_triggers'])db.exec(readFileSync('drizzle/'+name+'.sql','utf8'));
 assert.equal(db.prepare('SELECT amount FROM entries').get().amount,123);assert.equal(db.prepare('SELECT paid FROM entries').get().paid,'2026-01-02');assert.equal(db.prepare('SELECT count(*) AS n FROM entry_history').get().n,0);
 }finally{db.close();}
});
