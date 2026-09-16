export function cents(value){const str=String(value).trim();if(!/^\d+([,.]\d{1,2})?$/.test(str))throw Error('Informe um valor válido, como 150,90.');const [whole,frac='']=str.replace(',','.').split('.');const n=Number(whole)*100+Number(frac.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n<=0||n>99999999999)throw Error('O valor deve estar entre R$ 0,01 e R$ 999.999.999,99.');return n;}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='2000-01-01'&&s<='2100-12-31'&&!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function totals(rows,opening,today){let income=0,expense=0,receivable=0,payable=0,late=0;for(const r of rows){if(r.paid){if(r.paid<=today){if(r.type==='in')income+=r.amount;else expense+=r.amount;}}else{if(r.type==='in')receivable+=r.amount;else payable+=r.amount;if(r.due<today)late++;}}return{income,expense,receivable,payable,late,balance:opening+income-expense,forecast:opening+income-expense+receivable-payable};}
export function settle(rows,id,date,today){if(!validDate(date)||date>today)throw Error('Informe uma data válida até hoje.');const row=rows.find(r=>r.id===id);if(!row)throw Error('Lançamento não encontrado.');if(row.paid)throw Error('Este lançamento já foi quitado.');row.paid=date;return row;}
export function installmentPlan(total,count,firstDue){
  if(!Number.isInteger(count)||count<1||count>36)throw Error('Escolha entre 1 e 36 parcelas.');
  if(!Number.isSafeInteger(total)||total<count||total>99999999999)throw Error('O total deve permitir pelo menos R$ 0,01 por parcela.');
  if(!validDate(firstDue))throw Error('Informe o primeiro vencimento.');
  const [year,month,day]=firstDue.split('-').map(Number),base=Math.floor(total/count),remainder=total%count;
  return Array.from({length:count},(_,i)=>{
    const d=new Date(Date.UTC(year,month-1+i,1,12));
    const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)).getUTCDate();
    d.setUTCDate(Math.min(day,last));const due=d.toISOString().slice(0,10);
    if(!validDate(due))throw Error('Os vencimentos devem ser anteriores a 2101.');
    return{amount:base+(i<remainder?1:0),due,installment:i+1,installmentCount:count};
  });
}
export function deadlineStatus(row,today){
  if(row.paid)return 'done';if(row.due<today)return 'late';
  const end=new Date(today+'T12:00:00Z');end.setUTCDate(end.getUTCDate()+7);
  return row.due<=end.toISOString().slice(0,10)?'soon':'open';
}
