import {cents} from './finance.mjs';
import {validateInvestment,calculateInvestment} from './investments.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const displayDate=s=>s.split('-').reverse().join('/');
export function createInvestmentsUI(ctx){
 let items=[],loaded=false,loading=false,current=null,rateDate='',rateBusy=false;
 const form=$('#investment-form'),f=form.elements;
 const breakdown=(d,which)=>{const r=calculateInvestment(d,which);return r?`<p>Bruto: <strong>${money(r.gross)}</strong></p><p>IR / impostos: ${money(r.ir)}${r.irRate!==null?' ('+r.irRate+'% sobre rendimento após IOF)':''}<br>IOF: ${money(r.iof)}<br>Taxas: ${money(r.fees)}</p><p>Líquido estimado: <strong>${money(r.net)}</strong><br>Resultado líquido: ${money(r.profit)}</p>`:'<p>Informe a cotação bruta da corretora para calcular.</p>';};
 const comparison=d=>`<div class="investment-comparison"><section><h3>Vencimento · ${displayDate(d.end)}</h3>${breakdown(d,'end')}</section><section><h3>Retirada · ${displayDate(d.exitDate)}</h3>${breakdown(d,'exit')}</section></div>`;
 function render(){ $('#investment-list').innerHTML=items.length?items.map(d=>`<article class="panel investment-card"><div class="panel-heading"><div><h2>${esc(d.name)}</h2><p>${esc(d.kind)} · Aplicado: <strong>${money(d.principal)}</strong> em ${displayDate(d.start)}</p></div><button data-investment-edit="${esc(d.id)}">Editar / atualizar cotação</button></div><p class="muted">${d.model==='manual'?'Valor bruto informado':`Cenário: taxa ${d.rate}% a.a.${d.model==='cdi'?' · '+d.percent+'% do CDI':''} · adicional ${d.spread}% a.a.`} ${d.rateDate?'· '+esc(d.rateDate):''}</p>${comparison(d)}</article>`).join(''):'<p class="panel">Nenhum investimento cadastrado. Comece pelo botão ＋ Investimento.</p>'; }
 async function refresh(){if(loading)return;loading=true;$('#investment-error').textContent='';try{items=(await ctx.api('/api/investments')).investments;loaded=true;render();}catch(e){$('#investment-error').textContent=e.message;}finally{loading=false;}}
 function visibility(){const model=f.model.value;$('#investment-rate-fields').hidden=model==='manual';$('#investment-manual-gross').hidden=model!=='manual';$('#investment-rate').disabled=rateBusy||!['cdi','selic'].includes(model);f.percent.closest('label').hidden=model!=='cdi';f.spread.closest('label').hidden=model==='manual';for(const key of ['endTax','exitTax']){f[key].closest('label').hidden=f.tax.value==='regressive';} }
 function open(d){current=d||{id:crypto.randomUUID(),revision:0};form.reset();rateDate=d?.rateDate||'';for(const key of ['name','kind','start','end','exitDate','model','tax','rate','percent','spread'])if(d)f[key].value=d[key];
  if(!d){f.start.value=ctx.today();f.exitDate.value=ctx.today();f.tax.value=ctx.company().profileType==='pf'?'regressive':'manual';}
  for(const key of ['principal','endFees','exitFees','endTax','exitTax','endGross','exitGross'])f[key].value=d?(d[key]===null?'':(d[key]/100).toFixed(2).replace('.',',')):key==='principal'||key==='endGross'||key==='exitGross'?'':'0,00';
  f.tax.querySelector('[value="regressive"]').disabled=ctx.company().profileType!=='pf';
  $('#investment-rate-source').textContent=rateDate;$('#investment-preview').innerHTML='';$('#investment-form-error').textContent='';visibility();$('#investment-dialog').showModal();
 }
 function read(){const d={};for(const key of ['name','kind','start','end','exitDate','model','tax'])d[key]=f[key].value;
  for(const key of ['rate','percent','spread']){const raw=f[key].value.trim().replace(',','.');d[key]=raw===''?NaN:Number(raw);}
  for(const key of ['principal','endFees','exitFees','endTax','exitTax','endGross','exitGross']){const raw=f[key].value.trim();d[key]=!raw&&['endGross','exitGross'].includes(key)?null:/^0([,.]0{1,2})?$/.test(raw)?0:cents(raw);}
  d.rateDate=rateDate;return validateInvestment(d);
 }
 function calculate(){const d=read();$('#investment-preview').innerHTML=comparison(d);return d;}
 $('#investment-new').onclick=()=>open();$('#investment-refresh').onclick=refresh;
 $('#investment-list').onclick=e=>{const b=e.target.closest('[data-investment-edit]');if(b)open(items.find(d=>d.id===b.dataset.investmentEdit));};
 f.model.onchange=()=>{rateDate='';$('#investment-rate-source').textContent='';visibility();$('#investment-preview').innerHTML='';};f.tax.onchange=visibility;
 f.rate.oninput=()=>{rateDate='Taxa informada manualmente';$('#investment-rate-source').textContent=rateDate;};
 form.addEventListener('input',()=>$('#investment-preview').innerHTML='');
 $('#investment-calculate').onclick=()=>{try{$('#investment-form-error').textContent='';calculate();}catch(e){$('#investment-form-error').textContent=e.message;}};
 $('#investment-rate').onclick=async()=>{if(rateBusy)return;rateBusy=true;visibility();const model=f.model.value,requestId=current.id;$('#investment-rate-source').textContent='Consultando Banco Central…';try{const r=await ctx.api('/api/investment-rate?model='+model);if(f.model.value!==model||current.id!==requestId||!$('#investment-dialog').open)return;f.rate.value=String(r.rate).replace('.',',');rateDate=r.source+' · referência '+r.date;$('#investment-rate-source').textContent=rateDate;$('#investment-preview').innerHTML='';}catch(e){$('#investment-rate-source').textContent=e.message;}finally{rateBusy=false;visibility();}};
 form.onsubmit=async e=>{e.preventDefault();if(form.dataset.busy||rateBusy)return;let data;try{data=calculate();}catch(e){$('#investment-form-error').textContent=e.message;return;}form.dataset.busy='1';const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);$('#investment-form-error').textContent='';try{const r=await ctx.api('/api/investments',{...data,id:current.id,revision:current.revision});const i=items.findIndex(d=>d.id===r.investment.id);if(i<0)items.unshift(r.investment);else items[i]=r.investment;render();$('#investment-dialog').close();ctx.notify('Investimento salvo. As projeções não movimentam seu saldo.');}catch(e){$('#investment-form-error').textContent=e.message;}finally{delete form.dataset.busy;buttons.forEach(b=>b.disabled=false);visibility();}};
 return {show(){if(!loaded)refresh();},refresh};
}
