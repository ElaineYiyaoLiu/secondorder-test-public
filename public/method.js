const query=new URLSearchParams(location.search),buttons=document.querySelectorAll('[data-method-language]');
function language(lang){document.documentElement.lang=lang==='zh'?'zh-CN':'en';document.querySelectorAll('[data-en]').forEach(el=>el.textContent=el.dataset[lang]);buttons.forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.methodLanguage===lang));b.textContent=b.dataset.methodLanguage==='zh'?'中':'EN';});document.querySelector('nav a').href='/?lang='+lang;}
buttons.forEach(b=>b.onclick=()=>language(b.dataset.methodLanguage));language(query.get('lang')==='zh'?'zh':'en');
if(query.get('embedded')==='1')document.querySelector('nav').hidden=true;
for(const el of document.querySelectorAll('[data-tex]')){try{if(!globalThis.katex)throw Error('Formula renderer unavailable');katex.render(el.dataset.tex,el,{displayMode:true,throwOnError:true,trust:false,strict:'error'});}catch{el.textContent=el.dataset.tex;el.classList.add('equation-fallback');}}
document.getElementById('print').onclick=()=>window.print();
