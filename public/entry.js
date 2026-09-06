import {switcher,watchLegacy} from './i18n.js';
if(location.pathname==='/')await import('./marketing.js');
else if(!location.pathname.startsWith('/manager')&&location.pathname!=='/kitchen')await import('./guest.js');
else{await import('./app.js');const el=document.createElement('div');el.className='staff-language';el.innerHTML=switcher();document.body.append(el);watchLegacy();}
