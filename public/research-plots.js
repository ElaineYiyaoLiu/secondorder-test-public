export const colors=['#315b99','#9c6445','#819ba9'];
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(inner,label,box='0 0 600 250',cls='research-lines')=>`<svg viewBox="${box}" role="img" aria-label="${escape(label)}" class="${cls}">${inner}</svg>`;
export function graph(snapshot,channel,epsilon,selected,zh){
 const symbols=snapshot.symbols,d=snapshot[channel+'Distances'],n=symbols.length,points=symbols.map((_,i)=>({x:300+155*Math.cos(2*Math.PI*i/n-Math.PI/2),y:175+135*Math.sin(2*Math.PI*i/n-Math.PI/2)})),edges=[],triangles=[];
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(d[i][j]<=epsilon)edges.push([i,j]);
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)for(let k=j+1;k<n;k++)if(Math.max(d[i][j],d[i][k],d[j][k])<=epsilon)triangles.push([i,j,k]);
 const parent=Array.from({length:n},(_,i)=>i),root=i=>parent[i]===i?i:(parent[i]=root(parent[i]));edges.forEach(([i,j])=>parent[root(i)]=root(j));const components=new Set(parent.map((_,i)=>root(i))).size,loops=snapshot[channel][1].filter(([b,d])=>b<=epsilon&&d>epsilon).length;
 const meta=`<div class="graph-meta"><span>${zh?'资产':'Assets'} <b>${n}</b></span><span>${zh?'边':'Edges'} <b>${edges.length}</b></span><span>β₀ <b>${components}</b></span><span>β₁ <b>${loops}</b></span><span>${zh?'填充三角形':'Triangles'} <b>${triangles.length}</b></span></div>`;
 const content=triangles.map(indices=>`<polygon points="${indices.map(i=>points[i].x+','+points[i].y).join(' ')}" fill="#315b99" opacity=".018"/>`).join('')+edges.map(([i,j])=>`<line x1="${points[i].x}" y1="${points[i].y}" x2="${points[j].x}" y2="${points[j].y}" stroke="${symbols[i]===selected||symbols[j]===selected?'#315b99':'#bccad5'}" stroke-width="1"><title>${escape(symbols[i]+' / '+symbols[j])}: d=${d[i][j].toFixed(4)}</title></line>`).join('')+points.map((p,i)=>`<g class="asset-node" tabindex="0" role="button" data-asset="${escape(symbols[i])}" aria-label="${escape(symbols[i])}"><circle cx="${p.x}" cy="${p.y}" r="${symbols[i]===selected?7:5}" fill="${symbols[i]===selected?'#9c6445':'#315b99'}"/><text x="${p.x+(p.x<300?-12:12)}" y="${p.y+4}" text-anchor="${p.x<300?'end':'start'}" fill="#49677c" font-size="12">${escape(symbols[i])}</text></g>`).join('');
 return meta+svg(content,zh?'VR 过滤网络，布局不表示距离':'VR filtration network. Layout is not a distance embedding.','0 0 600 350','research-network');
}
export function persistence(diagram,dimension,epsilon,zh){
 const x=v=>45+v*120,y=v=>280-v*120;
 let body='<line x1="45" y1="280" x2="285" y2="40" stroke="#c4ced7" stroke-dasharray="4 4"/><line x1="45" y1="280" x2="285" y2="280" stroke="#a9bac8"/><line x1="45" y1="280" x2="45" y2="40" stroke="#a9bac8"/>';
 body+=`<line x1="${x(epsilon)}" y1="280" x2="${x(epsilon)}" y2="40" stroke="#819ba9" stroke-dasharray="3 3"/><line x1="45" y1="${y(epsilon)}" x2="285" y2="${y(epsilon)}" stroke="#819ba9" stroke-dasharray="3 3"/>`;
 body+=diagram.map(([b,d])=>`<circle cx="${x(b)}" cy="${y(d)}" r="${b<=epsilon&&d>epsilon?5:3.5}" fill="${dimension?'#9c6445':'#315b99'}"><title>H${dimension}: ${b.toFixed(5)} → ${d.toFixed(5)}</title></circle>`).join('');
 body+=`<text x="45" y="300" font-size="11">0</text><text x="280" y="300" font-size="11">2</text><text x="29" y="45" font-size="11">2</text><text x="160" y="322" text-anchor="middle" font-size="12">${zh?'出生':'Birth'}</text><text x="10" y="170" transform="rotate(-90,10,170)" font-size="12">${zh?'死亡':'Death'}</text>`;
 if(!diagram.length)body+=`<text x="165" y="145" text-anchor="middle" fill="#667b8d" font-size="12">${zh?'没有有限持久类':'No finite persistence classes'}</text>`;
 return svg(body,zh?'持久图':'Persistence diagram','0 0 330 335','research-diagram');
}
export function landscape(diagram,zh){
 const pts=Array.from({length:161},(_,i)=>{const e=i/80;return [35+e*245,115-90*Math.max(0,...diagram.map(([b,d])=>Math.min(e-b,d-e)))];});
 return svg(`<line x1="35" y1="115" x2="525" y2="115" stroke="#c4ced7"/><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#315b99" stroke-width="2"/><text x="35" y="138" font-size="12">0</text><text x="525" y="138" text-anchor="end" font-size="12">2 ε</text><text x="12" y="22" font-size="12">λ₁</text>`,zh?'第一层持久景观':'First persistence landscape layer','0 0 550 150','research-landscape');
}
export function barcodes(diagram,dimension,zh){
 if(!diagram.length)return `<p class="research-note">${zh?'该窗口没有正寿命的有限持久类。':'This window has no positive-lifetime finite classes.'}</p>`;
 return `<div class="research-barcodes">${diagram.map(([b,d])=>`<div title="H${dimension}: ${b.toFixed(5)} / ${d.toFixed(5)}"><i style="left:${b/2*100}%;width:${(d-b)/2*100}%;background:${dimension?'#9c6445':'#315b99'}"></i></div>`).join('')}</div>`;
}
export function lines(series,labels,title){
 const finite=series.flat().filter(Number.isFinite);if(!finite.length)return `<p class="research-note">No measured observations / 暂无可用观测</p>`;
 const lo=Math.min(0,...finite),hi=Math.max(...finite),span=hi-lo||1,x=i=>45+i/(Math.max(1,labels.length-1))*510,y=v=>185-(v-lo)/span*150;
 let body=[0,.5,1].map(f=>`<line x1="45" x2="555" y1="${35+f*150}" y2="${35+f*150}" stroke="#e5ebf0"/><text x="38" y="${39+f*150}" text-anchor="end" font-size="11" fill="#667b8d">${(hi-f*span).toFixed(3)}</text>`).join('');
 for(let j=0;j<series.length;j++){let segments=[],current=[];series[j].forEach((v,i)=>{if(Number.isFinite(v))current.push([x(i),y(v)]);else{if(current.length)segments.push(current);current=[]}});if(current.length)segments.push(current);body+=segments.map(pts=>pts.length===1?`<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="3" fill="${colors[j%3]}"/>`:`<polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${colors[j%3]}" stroke-width="1.6"/>`).join('');}
 body+=`<text x="45" y="215" font-size="11">${escape(labels[0]||'')}</text><text x="555" y="215" font-size="11" text-anchor="end">${escape(labels.at(-1)||'')}</text>`;
 return svg(body,title);
}
export function heatmap(timeline,channel,dimension,zh){
 const max=Math.max(1e-12,...timeline.flatMap(r=>[20,60,120].map(w=>r.scales[w]?.channels?.[channel]?.[dimension].velocity)).filter(Number.isFinite));
 return [20,60,120].map(w=>`<div class="research-heat-row"><span>${w}D</span><div>${timeline.map(r=>{const v=r.scales[w]?.channels?.[channel]?.[dimension].velocity;return `<i style="background:${Number.isFinite(v)?`rgba(49,91,153,${.06+.94*v/max})`:'#eceff1'}" title="${r.date} · ${w}D: ${Number.isFinite(v)?v.toFixed(5):'unavailable'}"></i>`}).join('')}</div></div>`).join('')+`<p class="research-note">${escape(timeline[0]?.date||'')} / ${escape(timeline.at(-1)?.date||'')} · ${zh?'W₂ 共用色阶；灰色表示缺少数据':'W₂ shared color scale; grey indicates missing data'}</p>`;
}
