import test from 'node:test';import assert from 'node:assert/strict';import {cents,validDate,totals,settle,installmentPlan,deadlineStatus} from './public/finance.mjs';
test('Valores em centavos e rejeição de entrada inválida',()=>{assert.equal(cents('150,90'),15090);assert.equal(cents('0.01'),1);for(const v of ['0','-2','1.001','1e4','abc','999999999999999999'])assert.throws(()=>cents(v));});
test('Previsto não altera saldo realizado; quitação preserva projeção',()=>{const rows=[{id:'a',type:'in',amount:300000,due:'2026-09-12',paid:null},{id:'b',type:'out',amount:600000,due:'2026-09-09',paid:null}];let t=totals(rows,500000,'2026-09-10');assert.equal(t.balance,500000);assert.equal(t.forecast,200000);assert.equal(t.late,1);settle(rows,'a','2026-09-10','2026-09-10');t=totals(rows,500000,'2026-09-10');assert.equal(t.balance,800000);assert.equal(t.forecast,200000);assert.equal(t.receivable,0);assert.throws(()=>settle(rows,'a','2026-09-10','2026-09-10'));});
test('Datas inválidas e quitação futura não alteram contas',()=>{assert.equal(validDate('2026-02-30'),false);const rows=[{id:'b',paid:null}];assert.throws(()=>settle(rows,'b','2026-09-11','2026-09-10'));assert.equal(rows[0].paid,null);});
test('Parcelas preservam total, fim do mês, ano bissexto e limites',()=>{
 const plan=installmentPlan(10000,3,'2026-01-31');assert.deepEqual(plan.map(p=>p.amount),[3334,3333,3333]);assert.deepEqual(plan.map(p=>p.due),['2026-01-31','2026-02-28','2026-03-31']);
 assert.equal(installmentPlan(200,2,'2028-01-31')[1].due,'2028-02-29');
 for(let n=1;n<=36;n++)assert.equal(installmentPlan(10000,n,'2026-01-31').reduce((s,p)=>s+p.amount,0),10000);
 assert.throws(()=>installmentPlan(1,2,'2026-01-01'));assert.throws(()=>installmentPlan(100,37,'2026-01-01'));assert.throws(()=>installmentPlan(100,2,'2100-12-31'));
});
test('Avisos: atraso, hoje, limite de sete dias e contas quitadas',()=>{
 assert.equal(deadlineStatus({due:'2026-09-10',paid:null},'2026-09-11'),'late');
 assert.equal(deadlineStatus({due:'2026-09-11',paid:null},'2026-09-11'),'soon');
 assert.equal(deadlineStatus({due:'2026-09-18',paid:null},'2026-09-11'),'soon');
 assert.equal(deadlineStatus({due:'2026-09-19',paid:null},'2026-09-11'),'open');
 assert.equal(deadlineStatus({due:'2026-09-10',paid:'2026-09-10'},'2026-09-11'),'done');
});
