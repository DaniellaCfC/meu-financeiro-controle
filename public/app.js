import {createBillingUI} from './billing-ui.mjs';
import {createInvestmentsUI} from './investments-ui.mjs';
import {filterRows,summarize,toCsv} from './reports.mjs';
import {cents,validDate,totals,installmentPlan,deadlineStatus} from './finance.mjs';
import {profileCategories} from './profiles.mjs';
const $=s=>document.querySelector(s);
const money=n=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const date=s=>s.split('-').reverse().join('/');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let rows=[],company=null,today='',email='',view='all',selected=null,entryId=null,toastTimer,ready=false,mutation=null,historyRequest=0;

async function api(path,data){
  let response;
  try{response=await fetch(path,{method:data?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});}
  catch{throw Error('Sem conexão. Seus dados no formulário foram mantidos. Tente novamente.');}
  if(response.status===401){$('#signin').hidden=false;throw Error('Sua sessão expirou. Entre novamente para continuar.');}
  let result;try{result=await response.json();}catch{throw Error('Não foi possível confirmar a operação. Entre novamente ou tente mais tarde.');}
  if(!response.ok)throw Error(result.error||'Não foi possível concluir a operação.');
  return result;
}
function notify(text){$('#toast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').textContent='',5000);}
function upsert(entry){const i=rows.findIndex(r=>r.id===entry.id);if(i<0)rows.push(entry);else rows[i]=entry;render();}
async function load(){
  $('#load-error').textContent='';$('#reload').disabled=true;
  try{
    const subscription=await billingUI.refresh();
    const state=await api('/api/state');
    rows=state.rows;company=state.company;today=state.today;email=state.user.email;ready=true;
    $('#signin').hidden=true;$('#loading').hidden=true;$('#onboarding').hidden=!!company;$('#dashboard').hidden=!company;
    $('#company-name').textContent=company?.name||'Cadastre seu perfil';$('#account-email').textContent=email;
    $('#company-form').elements.openingDate.max=today;
    if(!$('#company-form').elements.openingDate.value)$('#company-form').elements.openingDate.value=today;
    $('#new').disabled=!company;
    $('#profile-settings').disabled=!company;
    if(company)render();
    if(!company&&!subscription.active){$('#onboarding').hidden=true;billingUI.open();}
  }catch(error){$('#load-error').textContent=error.message;$('#loading').hidden=false;}
  finally{$('#reload').disabled=false;}
}
function render(){
  if(!company)return;
  for(const child of $('#dashboard').children)child.hidden=view==='investments'?child.id!=='investment-panel':child.id==='investment-panel';
  if(view==='investments'){investmentsUI.show();return;}
  const personal=company.profileType==='pf';
  $('#company-name').textContent=company.name;
  $('#profile-badge').textContent=personal?'PESSOA FÍSICA · CPF':'EMPRESA · CNPJ';
  $('#finance-caption').textContent=personal?'FINANÇAS PESSOAIS':'CONTROLE FINANCEIRO';
  $('#forecast-title').textContent=personal?'Como ficam suas finanças?':'Como fica o seu caixa?';
  $('#aside-message').textContent=personal?'Sua vida, com as contas em dia.':'Seu negócio, com as contas em dia.';
  $('#party-label').textContent=personal?'Pessoa, loja ou origem do valor':'Cliente ou fornecedor';
  $('#entry-form').elements.party.placeholder=personal?'Ex.: Supermercado ou empregador':'Nome da pessoa ou empresa';
  const t=totals(rows,company.opening,today);
  renderAlerts();
  $('#today').textContent=new Date(today+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('#opening-note').textContent=`Movimentações quitadas desde ${date(company.openingDate)}. Saldo inicial: ${money(company.opening)}.`;
  $('#cards').innerHTML=[['Saldo atual',t.balance,'Saldo inicial + movimentações quitadas',''],['A receber',t.receivable,'Todos os recebimentos em aberto','green'],['A pagar',t.payable,'Todos os pagamentos em aberto','red'],['Resultado realizado',t.income-t.expense,'Entradas menos saídas, sem saldo inicial','']].map(([label,value,note,color])=>`<article class="card"><p>${label}</p><strong class="${color}">${money(value)}</strong><small>${note}</small></article>`).join('');
  $('#forecast').textContent=money(t.forecast);
  const max=Math.max(t.income,t.expense,1);
  $('#bars').innerHTML=[['Recebimentos',t.income,''],['Pagamentos',t.expense,'out']].map(([label,n,c])=>`<div class="bar-label"><span>${label}</span><strong>${money(n)}</strong></div><div class="track"><div class="fill ${c}" style="width:${n/max*100}%"></div></div>`).join('');
  $('#title').textContent=({all:'Visão geral',out:'Contas a pagar',in:'Contas a receber',flow:'Fluxo de caixa'})[view];
  const status=$('#status').value;$('#status').closest('label').hidden=view==='flow';
  const filteredBase=rows.filter(r=>(view==='all'||view==='flow'||r.type===view)&&(view==='flow'||status==='all'||status==='done'&&r.paid||status==='open'&&!r.paid||status==='late'&&deadlineStatus(r,today)==='late'||status==='soon'&&deadlineStatus(r,today)==='soon'));
  $('#report').hidden=view==='flow';
  const filtered=view==='flow'?filteredBase:reportRows();
  if(view!=='flow')renderReport(filtered);
  $('#empty').hidden=filtered.length>0;$('#ledger-title').textContent=view==='flow'?'Movimentação e projeção':'Lançamentos';
  $('#count').textContent=view==='flow'?'Saldo atual seguido das contas em aberto, incluindo atrasadas.':`${filtered.length} lançamento(s) · ${t.late} em atraso no total`;
  if(view==='flow'){
    $('#thead').innerHTML='<tr><th>Data</th><th>Descrição</th><th>Situação</th><th>Entrada / saída</th><th>Saldo acumulado</th></tr>';
    const realized=filtered.filter(r=>r.paid).sort((a,b)=>a.paid.localeCompare(b.paid)||a.id.localeCompare(b.id));
    const planned=filtered.filter(r=>!r.paid).sort((a,b)=>a.due.localeCompare(b.due)||a.id.localeCompare(b.id));
    let balance=company.opening;
    $('#rows').innerHTML=`<tr><td>${date(company.openingDate)}</td><td><strong>Saldo inicial</strong></td><td>Inicial</td><td>—</td><td class="money">${money(balance)}</td></tr>`+[...realized,...planned].map(r=>{
      balance+=r.type==='in'?r.amount:-r.amount;
      return `<tr><td>${date(r.paid||r.due)}</td><td><strong>${esc(r.description)}${parcelLabel(r)}</strong><small>${esc(r.party)}</small></td><td><span class="badge ${r.paid?'done':''}">${r.paid?'Realizado':'Previsto'}</span></td><td class="money ${r.type==='in'?'green':'red'}">${r.type==='in'?'+':'−'} ${money(r.amount)}</td><td class="money">${money(balance)}</td></tr>`;
    }).join('');return;
  }
  $('#thead').innerHTML='<tr><th>Descrição / pessoa</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ação</th></tr>';
  filtered.sort((a,b)=>a.due.localeCompare(b.due));
  $('#rows').innerHTML=filtered.map(r=>`<tr><td><strong>${esc(r.description)}${parcelLabel(r)}</strong><small>${esc(r.party)} · ${esc(r.category)}</small></td><td>${date(r.due)}</td><td class="money ${r.type==='in'?'green':'red'}">${r.type==='in'?'+':'−'} ${money(r.amount)}</td><td><span class="badge ${deadlineStatus(r,today)}">${r.paid?(r.type==='in'?'Recebido':'Pago'):r.due<today?'Atrasado':r.due===today?'Vence hoje':deadlineStatus(r,today)==='soon'?'A vencer':'Em aberto'}</span>${r.paid?`<small>${date(r.paid)}</small>`:''}</td><td>${r.paid?`<button data-reopen="${esc(r.id)}">Desfazer quitação</button>`:`<button data-edit="${esc(r.id)}">Editar</button> <button data-settle="${esc(r.id)}">${r.type==='in'?'Receber':'Pagar'}</button>`} <button data-history="${esc(r.id)}">Histórico</button></td></tr>`).join('');
}
function parcelLabel(row){return row.installmentCount>1?` <span class="parcel-label">${row.installment}/${row.installmentCount}</span>`:'';}
function renderAlerts(){
  const late=rows.filter(r=>deadlineStatus(r,today)==='late');
  const soon=rows.filter(r=>deadlineStatus(r,today)==='soon');
  $('#alert-late').textContent=`Atrasadas: ${late.length}`;$('#alert-soon').textContent=`Hoje e próximos 7 dias: ${soon.length}`;
  $('#alert-description').textContent=late.length||soon.length?'Pagamentos e recebimentos em aberto. Os avisos são atualizados ao abrir ou atualizar o aplicativo.':'Nenhuma conta atrasada ou vencendo nos próximos 7 dias.';
  const important=[...late,...soon].sort((a,b)=>a.due.localeCompare(b.due));
  $('#alert-list').innerHTML=important.slice(0,5).map(r=>`<li><div><strong>${esc(r.description)}${parcelLabel(r)}</strong><small>${r.type==='out'?'A pagar':'A receber'} · ${date(r.due)} · ${r.due<today?'Atrasada':r.due===today?'Vence hoje':'A vencer'}</small></div><strong class="money ${r.type==='out'?'red':'green'}">${money(r.amount)}</strong></li>`).join('');
  $('#alert-extra').textContent=important.length>5?`Exibindo 5 de ${important.length} avisos. Use os filtros acima para ver todos.`:'';
}
function previewInstallments(){
  const f=$('#entry-form').elements;
  $('#due-label').textContent=Number(f.installments.value)>1?'Primeiro vencimento':'Vencimento';
  if(!f.amount.value.trim()){$('#installment-preview').textContent='Informe o valor total para conferir as parcelas.';return;}
  try{
    const plan=installmentPlan(cents(f.amount.value),Number(f.installments.value),f.due.value);
    $('#installment-preview').innerHTML=`<strong>Total: ${money(cents(f.amount.value))}</strong><ul>${plan.map(p=>`<li>Parcela ${p.installment}/${p.installmentCount} · ${date(p.due)} · ${money(p.amount)}</li>`).join('')}</ul>`;
  }catch(e){$('#installment-preview').textContent=e.message;}
}
async function submit(form,errorSelector,work){
  if(form.dataset.busy)return;form.dataset.busy='1';$(errorSelector).textContent='';
  const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
  try{await work();}catch(error){$(errorSelector).textContent=error.message;}
  finally{delete form.dataset.busy;buttons.forEach(b=>b.disabled=false);}
}
$('#reload').onclick=load;
$('#refresh').onclick=load;
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{view=b.dataset.view;document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('active',n===b));render();});
$('#status').onchange=render;
$('#new').onclick=()=>{
  if(!ready||!company)return;
  const f=$('#entry-form');f.reset();entryId=crypto.randomUUID();f.elements.due.value=today;f.elements.type.value=view==='in'?'in':'out';
  f.elements.category.innerHTML=profileCategories[company.profileType||'pj'].map(c=>`<option>${esc(c)}</option>`).join('');
  f.elements.description.placeholder=company.profileType==='pf'?'Ex.: Compra no supermercado':'Ex.: Serviço de manutenção';
  previewInstallments();
  $('#entry-error').textContent='';$('#entry').showModal();
};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('cancel',e=>{if(d.querySelector('form').dataset.busy)e.preventDefault();}));
$('#company-form').onsubmit=e=>{
  e.preventDefault();const form=e.target;
  submit(form,'#company-error',async()=>{
    const f=form.elements,raw=f.opening.value.trim(),negative=raw.startsWith('-'),unsigned=negative?raw.slice(1):raw;
    let opening=/^0([,.]0{1,2})?$/.test(unsigned)?0:cents(unsigned);if(negative)opening=-opening;
    await api('/api/company',{name:f.companyName.value.trim(),profileType:f.profileType.value,opening,openingDate:f.openingDate.value});
    await load();notify('Perfil cadastrado. Você já pode lançar suas contas.');
  });
};
$('#entry-form').onsubmit=e=>{
  e.preventDefault();const form=e.target;
  submit(form,'#entry-error',async()=>{
    const f=form.elements,description=f.description.value.trim(),party=f.party.value.trim();
    if(!description||!party)throw Error('Preencha a descrição e a pessoa ou origem do valor.');
    if(!validDate(f.due.value))throw Error('Informe um vencimento válido.');
    const result=await api('/api/entries',{id:entryId,type:f.type.value,description,party,category:f.category.value,amount:cents(f.amount.value),due:f.due.value,installments:Number(f.installments.value)});
    $('#status').value='all';for(const entry of result.entries||[result.entry]){const i=rows.findIndex(r=>r.id===entry.id);if(i<0)rows.push(entry);else rows[i]=entry;}
    render();$('#entry').close();notify((result.entries?.length||1)>1?`${result.entries.length} parcelas salvas. Cada uma pode ser quitada separadamente.`:'Lançamento salvo no seu financeiro.');
  });
};
$('#rows').onclick=e=>{
  const b=e.target.closest('[data-settle],[data-edit],[data-reopen],[data-history]');if(!b)return;
  const action=Object.keys(b.dataset)[0];selected=b.dataset[action];
  const r=rows.find(r=>r.id===selected);if(!r)return;
  mutation={revision:r.revision,operationId:crypto.randomUUID()};
  const label=r.description+(r.installmentCount>1?` · Parcela ${r.installment}/${r.installmentCount}`:'')+' · '+money(r.amount);
  if(action==='history'){showHistory(r);return;}
  if(action==='edit'){
    const form=$('#edit-form');form.reset();const f=form.elements;
    f.category.innerHTML=[...new Set([...profileCategories[company.profileType||'pj'],r.category])].map(c=>`<option>${esc(c)}</option>`).join('');
    for(const key of ['type','description','party','category','due'])f[key].value=r[key];
    f.amount.value=(r.amount/100).toFixed(2).replace('.',',');
    $('#edit-description').textContent=r.installmentCount>1?label+'. A alteração vale somente para esta parcela. As demais parcelas não mudam.':label;
    $('#edit-error').textContent='';$('#edit').showModal();return;
  }
  if(action==='reopen'){
    $('#reopen-form').reset();$('#reopen-description').textContent=label+' · Quitada em '+date(r.paid);
    $('#reopen-error').textContent='';$('#reopen').showModal();return;
  }
  $('#settle-title').textContent=r.type==='in'?'Registrar recebimento':'Registrar pagamento';
  $('#settle-description').textContent=label;
  const input=$('#settle-form').elements.date;input.value=today;input.max=today;input.min=company.openingDate;
  $('#settle-error').textContent='';$('#settle').showModal();
};
async function showHistory(r){
  const request=++historyRequest;$('#history-description').textContent=r.description;$('#history-list').textContent='Carregando histórico…';$('#history').showModal();
  try{
    const result=await api(`/api/entries/${r.id}/history`);if(request!==historyRequest)return;
    const labels={type:'Tipo',description:'Descrição',party:'Pessoa ou empresa',category:'Categoria',amount:'Valor',due:'Vencimento',paid:'Quitação'};
    const format=(key,value)=>value==null?'Em aberto':key==='amount'?money(value):['due','paid'].includes(key)?date(value):key==='type'?(value==='in'?'A receber':'A pagar'):value;
    $('#history-list').innerHTML=result.history.length?result.history.map(h=>{
      const changes=Object.keys(labels).filter(key=>!h.before||h.before[key]!==h.after[key]);
      return `<article class="history-item"><strong>${esc(({created:'Lançamento criado',edited:'Lançamento editado',settled:'Quitação registrada',reopened:'Quitação desfeita'})[h.action]||h.action)}</strong><small>${esc(new Date(h.occurredAt).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}))} · ${esc(h.actor)}</small><p>${esc(h.reason)}</p><ul>${changes.map(key=>`<li>${labels[key]}: ${h.before?esc(format(key,h.before[key]))+' → ':''}${esc(format(key,h.after[key]))}</li>`).join('')}</ul></article>`;
    }).join('')+(result.hasMore?'<p class="muted">Exibindo as 100 alterações mais recentes.</p>':''):'Nenhuma alteração registrada desde a ativação do histórico.';
  }catch(error){if(request===historyRequest)$('#history-list').textContent=error.message;}
}
for(const action of ['edit','reopen'])$('#'+action+'-form').onsubmit=e=>{
  e.preventDefault();const form=e.target;
  submit(form,'#'+action+'-error',async()=>{
    const f=form.elements;const data={...mutation,reason:f.reason.value.trim()};
    if(action==='edit'){for(const key of ['type','description','party','category','due'])data[key]=f[key].value;data.amount=cents(f.amount.value);}
    const result=await api(`/api/entries/${selected}/${action}`,data);
    upsert(result.entry);$('#'+action).close();notify(action==='edit'?'Alteração salva no histórico.':'Quitação desfeita. Conta em aberto e saldo atualizado.');
  });
};
$('#settle-form').onsubmit=e=>{
  e.preventDefault();const form=e.target;
  submit(form,'#settle-error',async()=>{
    const result=await api(`/api/entries/${selected}/settle`,{...mutation,date:form.elements.date.value});
    upsert(result.entry);$('#settle').close();notify('Quitação salva. Saldo atualizado.');
  });
};
if(document.modelContext?.registerTool){
  for(const tool of [
    {name:'read_financial_summary',description:'Consultar os dados carregados do perfil em centavos de real.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw Error('Não são aceitos parâmetros.');if(!ready||!company)throw Error('Carregue e cadastre seu perfil primeiro.');return totals(rows,company.opening,today);}},
    {name:'start_entry_creation',description:'Abrir o formulário de lançamento; não salva uma conta.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||Object.keys(input).length)throw Error('Não são aceitos parâmetros.');if(!ready||!company)throw Error('Cadastre seu perfil primeiro.');if(!$('#entry').open)$('#new').click();return{formOpen:true};}}
  ])try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}
}
function profileLabels(form){
  const personal=form.elements.profileType.value==='pf';
  form.querySelector('[data-name-label]').textContent=personal?'Seu nome':'Nome da empresa';
  const name=form.elements.companyName||form.elements.profileName;
  name.placeholder=personal?'Como você se chama?':'Como sua empresa se chama?';
  name.autocomplete=personal?'name':'organization';
}
for(const form of [$('#company-form'),$('#profile-form')]){form.elements.profileType.onchange=()=>profileLabels(form);profileLabels(form);}
$('#profile-settings').onclick=()=>{
  if(!company)return;
  const form=$('#profile-form');form.elements.profileName.value=company.name;form.elements.profileType.value=company.profileType||'pj';
  profileLabels(form);$('#profile-error').textContent='';$('#profile-dialog').showModal();
};
$('#profile-form').onsubmit=e=>{
  e.preventDefault();const form=e.target;
  submit(form,'#profile-error',async()=>{
    const result=await api('/api/profile',{name:form.elements.profileName.value.trim(),profileType:form.elements.profileType.value});
    company=result.company;render();$('#profile-dialog').close();notify('Perfil atualizado. Seus lançamentos foram mantidos.');
  });
};
for(const key of ['amount','installments','due'])$('#entry-form').elements[key].addEventListener('input',previewInstallments);
for(const [selector,status] of [['#alert-late','late'],['#alert-soon','soon']])$(selector).onclick=()=>{
  view='all';$('#status').value=status;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='all'));render();$('.ledger').scrollIntoView({behavior:'smooth',block:'start'});
};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&ready&&!document.querySelector('dialog[open]'))load();});
setInterval(()=>{if(!company||document.hidden)return;today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());render();},60000);
const billingUI=createBillingUI({api,notify,reload:()=>load()});
const investmentsUI=createInvestmentsUI({api,notify,company:()=>company,today:()=>today});
load();

function reportRows(){
 const from=$('#report-from').value,to=$('#report-to').value;
 const invalid=from&&to&&from>to;$('#report-error').textContent=invalid?'A data inicial deve ser anterior ou igual à final.':'';
 return invalid?[]:filterRows(rows,{from,to,category:$('#report-category').value,query:$('#report-query').value,status:$('#status').value,type:['in','out'].includes(view)?view:'all'},today);
}
function renderReport(filtered){
 const select=$('#report-category'),current=select.value,categories=[...new Set(rows.map(r=>r.category))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 select.innerHTML='<option value="">Todas</option>'+categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');select.value=categories.includes(current)?current:'';
 const s=summarize(filtered);
 $('#report-summary').innerHTML=[['Recebido',s.received],['Pago',s.paid],['A receber',s.receivable],['A pagar',s.payable]].map(([label,value])=>`<div><span>${label}</span><strong>${money(value)}</strong></div>`).join('');
 const groups=Object.entries(s.categories).sort((a,b)=>b[1]-a[1]);
 $('#report-chart').innerHTML=groups.length?groups.map(([category,value])=>`<div class="bar-label"><span>${esc(category)}</span><strong>${money(value)} · ${(value/s.paid*100).toFixed(1).replace('.',',')}%</strong></div><div class="track"><div class="fill out" style="width:${value/s.paid*100}%"></div></div>`).join(''):'<p class="muted">Nenhum pagamento nos filtros selecionados.</p>';
 $('#export-csv').disabled=!filtered.length;
}
for(const id of ['report-from','report-to','report-category','report-query'])$('#'+id).addEventListener('input',()=>{if(id==='report-from'||id==='report-to')$('#report-month').value='';render();});
$('#report-month').onchange=()=>{const month=$('#report-month').value;if(!month)return;const [year,m]=month.split('-').map(Number);$('#report-from').value=month+'-01';$('#report-to').value=month+'-'+new Date(year,m,0).getDate();render();};
$('#report-clear').onclick=()=>{for(const id of ['report-month','report-from','report-to','report-category','report-query'])$('#'+id).value='';$('#status').value='all';render();};
$('#export-csv').onclick=()=>{const filtered=reportRows();if(!filtered.length)return;const url=URL.createObjectURL(new Blob([toCsv(filtered)],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='meu-financeiro-'+today+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('CSV exportado com os lançamentos dos filtros selecionados.');};
