import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/method.html',import.meta.url),'utf8');
const script=readFileSync(new URL('../public/method.js',import.meta.url),'utf8');
const decode=s=>s.replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&').replaceAll('&quot;','"').replaceAll('&#x27;',"'");
const formulas=[...html.matchAll(/data-tex="([^"]+)"/g)].map(m=>decode(m[1]));
test('all Method formulas render with the bundled KaTeX instead of displaying source code',()=>{
 const c={};vm.runInNewContext(readFileSync(new URL('../public/vendor/katex/katex.min.js',import.meta.url),'utf8'),c);
 assert.equal(formulas.length,14);for(const formula of formulas)assert.match(c.katex.renderToString(formula,{displayMode:true,throwOnError:true,strict:'error'}),/katex-html/);
});
test('Method translates every caption and isolates a formula failure from later formulas and controls',()=>{
 const translated=[...html.matchAll(/data-en="([^"]*)" data-zh="([^"]*)"/g)].map(m=>({dataset:{en:decode(m[1]),zh:decode(m[2])}}));
 const buttons=['zh','en'].map(lang=>({dataset:{methodLanguage:lang},setAttribute(k,v){this[k]=v;}}));
 const equations=formulas.map(tex=>({dataset:{tex},classList:{add(){}}}));const nav={},link={},print={};let calls=0;
 const context={URLSearchParams,location:{search:'?embedded=1&lang=en'},window:{print(){}},katex:{render(tex,el){calls++;if(calls===2)throw Error('one failed equation');el.rendered=true;}},document:{documentElement:{},querySelectorAll:q=>q==='[data-method-language]'?buttons:q==='[data-en]'?translated:equations,querySelector:q=>q==='nav'?nav:link,getElementById:()=>print}};
 vm.runInNewContext(script,context);assert.equal(nav.hidden,true);assert.equal(context.document.documentElement.lang,'en');assert.equal(calls,14);assert.equal(equations.at(-1).rendered,true);assert.ok(print.onclick);
 assert.ok(translated.every(el=>!/[\u3400-\u9fff]/.test(el.textContent)));assert.equal(buttons[0].textContent,'ZH');
 buttons[0].onclick();assert.equal(context.document.documentElement.lang,'zh-CN');assert.ok(translated.some(el=>/[\u3400-\u9fff]/.test(el.textContent)));assert.equal(link.href,'/?lang=zh');
});
