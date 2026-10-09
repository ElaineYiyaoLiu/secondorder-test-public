import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import history from '../api/history.js';
const root=resolve('public');
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/history'){req.query=Object.fromEntries(url.searchParams);res.status=n=>{res.statusCode=n;return res;};res.json=data=>res.end(JSON.stringify(data));return history(req,res);}
 try {const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+'/'))throw Error();const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.csv':'text/csv'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.writeHead(404);res.end('Not found');}
}).listen(3000,'0.0.0.0',()=>console.log('Stock: http://localhost:3000'));

