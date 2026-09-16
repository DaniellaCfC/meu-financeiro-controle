const installDialog=document.querySelector('#install-dialog');
const installAction=document.querySelector('#install-action');
const installMessage=document.querySelector('#install-message');
let pendingPrompt=null;
function installedWindow(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
function showInstall(){
  installMessage.textContent=installedWindow()?'Você já está usando o aplicativo em uma janela própria.':'';
  installAction.hidden=!pendingPrompt||installedWindow();
  installDialog.showModal();
}
document.querySelector('#install-help').addEventListener('click',showInstall);
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();pendingPrompt=event;
  installAction.hidden=installedWindow();
});
installAction.addEventListener('click',async()=>{
  if(!pendingPrompt)return;
  const prompt=pendingPrompt;pendingPrompt=null;installAction.disabled=true;
  try{
    await prompt.prompt();const choice=await prompt.userChoice;
    installMessage.textContent=choice.outcome==='accepted'?'Instalação solicitada. Aguarde a confirmação do navegador.':'Você pode instalar depois pelo menu do navegador.';
  }catch{installMessage.textContent='Use as instruções abaixo para instalar pelo navegador.';}
  finally{installAction.disabled=false;installAction.hidden=true;}
});
window.addEventListener('appinstalled',()=>{pendingPrompt=null;installAction.hidden=true;installMessage.textContent='Aplicativo instalado. Procure o ícone Meu Financeiro no seu aparelho.';});
function connection(){document.querySelector('#connection-status').hidden=navigator.onLine;}
window.addEventListener('online',connection);window.addEventListener('offline',connection);connection();
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{
    document.querySelector('#install-fallback').textContent='Este navegador não ativou o recurso de instalação. Você pode continuar usando pelo site e tentar abrir o link no Chrome ou Safari do seu celular.';
  });
}
