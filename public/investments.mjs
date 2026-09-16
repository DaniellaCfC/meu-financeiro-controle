import {validDate} from './finance.mjs';
export const daysBetween=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
const iof=[100,96,93,90,86,83,80,76,73,70,66,63,60,56,53,50,46,43,40,36,33,30,26,23,20,16,13,10,6,3];
export function validateInvestment(v){
 const d={};for(const k of ['name','kind']){if(typeof v[k]!=='string'||!v[k].trim()||v[k].length>100)throw Error('Preencha nome e tipo com até 100 caracteres.');d[k]=v[k].trim();}
 for(const k of ['start','end','exitDate']){if(!validDate(v[k]))throw Error('Informe datas válidas.');d[k]=v[k];}if(d.end<=d.start||d.exitDate<d.start||d.exitDate>d.end)throw Error('O vencimento deve ser posterior à aplicação e a retirada deve estar entre essas datas.');
 if(!['fixed','cdi','selic','manual'].includes(v.model)||!['regressive','manual'].includes(v.tax))throw Error('Selecione o cálculo e a tributação.');d.model=v.model;d.tax=v.tax;
 for(const k of ['principal','endFees','exitFees','endTax','exitTax']){if(!Number.isSafeInteger(v[k])||v[k]<0||v[k]>99999999999||k==='principal'&&v[k]===0)throw Error('Confira os valores em reais.');d[k]=v[k];}
 for(const k of ['endGross','exitGross']){if(v[k]!==null&&(!Number.isSafeInteger(v[k])||v[k]<0||v[k]>99999999999))throw Error('Valor bruto inválido.');d[k]=v[k];}
 for(const k of ['rate','percent','spread']){if(typeof v[k]!=='number'||!Number.isFinite(v[k])||v[k]<(k==='spread'?-20:0)||v[k]>(k==='percent'?300:100))throw Error('Taxa inválida.');d[k]=v[k];}
 d.rateDate=typeof v.rateDate==='string'?v.rateDate.slice(0,40):'';if(d.model==='manual'&&d.endGross===null)throw Error('Informe o valor bruto estimado no vencimento.');return d;
}
export function calculateInvestment(d,which){
 const date=which==='end'?d.end:d.exitDate,days=daysBetween(d.start,date),fees=which==='end'?d.endFees:d.exitFees;
 let gross=which==='end'?d.endGross:d.exitGross;
 if(which==='end'&&d.model!=='manual'){
  // Scenario only: 252 business-day annual rate converted using 365 calendar-day years.
  const daily=d.model==='cdi'?1+(Math.pow(1+d.rate/100,1/252)-1)*d.percent/100:Math.pow(1+d.rate/100,1/252);
  const factor=Math.pow(daily,252*days/365)*Math.pow(1+d.spread/100,days/365);
  gross=Math.round(d.principal*factor);
 }
 if(gross===null)return null;
 if(!Number.isSafeInteger(gross)||gross>99999999999)throw Error('Projeção acima do limite. Revise taxa e prazo.');
 const profit=Math.max(0,gross-d.principal),iofValue=d.tax==='regressive'?Math.round(profit*(iof[days]||0)/100):0;
 const rate=days<=180?22.5:days<=360?20:days<=720?17.5:15;
 const ir=d.tax==='regressive'?Math.round((profit-iofValue)*rate/100):(which==='end'?d.endTax:d.exitTax);
 return {gross,iof:iofValue,ir,fees,net:gross-iofValue-ir-fees,profit:gross-iofValue-ir-fees-d.principal,days,irRate:d.tax==='regressive'?rate:null};
}
