import {deadlineStatus} from './finance.mjs';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function filterRows(rows,{from='',to='',category='',query='',status='all',type='all'}={},today){
 return rows.filter(r=>{const day=r.paid||r.due;return (!from||day>=from)&&(!to||day<=to)&&(!category||r.category===category)&&(!query||normalize(r.description+' '+r.party).includes(normalize(query.trim())))&&(type==='all'||r.type===type)&&(status==='all'||status==='done'&&!!r.paid||status==='open'&&!r.paid||status==='late'&&deadlineStatus(r,today)==='late'||status==='soon'&&deadlineStatus(r,today)==='soon');});
}
export function summarize(rows){const s={received:0,paid:0,receivable:0,payable:0,categories:{}};for(const r of rows){s[r.paid?(r.type==='in'?'received':'paid'):(r.type==='in'?'receivable':'payable')]+=r.amount;if(r.paid&&r.type==='out')s.categories[r.category]=(s.categories[r.category]||0)+r.amount;}return s;}
const cell=value=>'"'+String(value??'').replace(/^[\s]*[=+\-@]/,"'$&").replace(/"/g,'""')+'"';
export function toCsv(rows){const header=['Tipo','Descrição','Pessoa ou empresa','Categoria','Valor (R$)','Vencimento','Quitação','Situação','Parcela'];return '\uFEFF'+[header,...rows.map(r=>[r.type==='in'?'A receber':'A pagar',r.description,r.party,r.category,(r.amount/100).toFixed(2).replace('.',','),r.due,r.paid||'',r.paid?(r.type==='in'?'Recebido':'Pago'):'Em aberto',`${r.installment||1}/${r.installmentCount||1}`])].map(row=>row.map(cell).join(';')).join('\r\n');}
