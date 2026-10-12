import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {GET,POST,PUT} from '../app/api/[...path]/route.ts';
import {appRoot,dataRoot,closeStorage} from './storage.mjs';
const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||major===22&&minor<13)throw Error('Install Node.js 22.13 or newer to run Casebook Studio.');
const port=Number(process.env.CASEBOOK_PORT||8765);
if(!Number.isInteger(port)||port<1024||port>65535)throw Error('CASEBOOK_PORT must be between 1024 and 65535.');
const origin=`http://127.0.0.1:${port}`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const security={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'"};
let queue=Promise.resolve();
async function respond(req,res){
 try{
  const host=req.headers.host,allowed=[`127.0.0.1:${port}`,`localhost:${port}`];if(!allowed.includes(host)){res.writeHead(403,security);return res.end('Open the app using '+origin);}
  const here='http://'+host;
  if(req.headers.origin&&req.headers.origin!==here||req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403,security);return res.end('Cross-site requests are blocked.');}
  const url=new URL(req.url,here);
  if(url.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json',...security});return res.end(JSON.stringify({app:'Casebook Studio Local',version:'0.1.1',local:true}));}
  if(url.pathname.startsWith('/api/')){
   const handler={GET,POST,PUT}[req.method];if(!handler){res.writeHead(405,security);return res.end('Method not allowed.');}
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024){res.writeHead(413,security);return res.end('Upload exceeds 40 MB request limit.');}chunks.push(chunk);}
   const request=new Request(url,{method:req.method,headers:new Headers(Object.entries(req.headers).filter(([,v])=>v!==undefined).map(([k,v])=>[k,Array.isArray(v)?v.join(','):v])),...(req.method!=='GET'?{body:Buffer.concat(chunks)}:{})});
   const response=await handler(request);res.writeHead(response.status,{...Object.fromEntries(response.headers),...security});return res.end(Buffer.from(await response.arrayBuffer()));
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,security);return res.end('Method not allowed.');}
  const filename=path.resolve(appRoot,'public','.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!filename.startsWith(path.join(appRoot,'public')+path.sep)||!fs.existsSync(filename)||!fs.statSync(filename).isFile()){res.writeHead(404,security);return res.end('Not found.');}
  res.writeHead(200,{'Content-Type':types[path.extname(filename)]||'application/octet-stream','Cache-Control':url.pathname.startsWith('/assets/')?'public,max-age=31536000,immutable':'no-store',...security});if(req.method==='HEAD')return res.end();fs.createReadStream(filename).pipe(res);
 }catch(e){console.error('Local request failed:',e);if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json',...security});res.end(JSON.stringify({error:'Local request failed. Check the console; your previous saved data is retained.'}));}
}
const server=http.createServer((req,res)=>{queue=queue.then(()=>respond(req,res)).catch(e=>console.error(e));});
server.on('error',e=>{if(e.code==='EADDRINUSE')console.error('Port '+port+' is in use. Another Casebook Studio window may already be running.');else console.error(e);process.exitCode=1;closeStorage();});
server.listen(port,'127.0.0.1',()=>{
 console.log('\nI/O Shield Casebook Studio · LOCAL 0.1.1\n\nOpen: '+origin+'\nData: '+dataRoot+'\n\nKeep this window open. Press Ctrl+C to stop.\n');
 if(process.argv.includes('--open')){const cmd=process.platform==='win32'?['cmd',['/c','start','',origin]]:process.platform==='darwin'?['open',[origin]]:['xdg-open',[origin]];const child=spawn(cmd[0],cmd[1],{stdio:'ignore',detached:true});child.on('error',()=>{});child.unref();}
});
let shuttingDown=false;function stop(){if(shuttingDown)return;shuttingDown=true;server.close(async()=>{await queue;closeStorage();process.exit(0);});setTimeout(()=>process.exit(0),4000).unref();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
