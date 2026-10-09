import {cp, mkdir, rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
for(const file of ['legacy-engine.js','legacy-worker.js','legacy-evidence.js'])await rm('dist/'+file,{force:true});
console.log('SecondOrder Test v0.9 built.');



