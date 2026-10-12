import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {unzipSync,strFromU8} from 'fflate';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'casebook-local-test-'));
const port=18765,base=`http://127.0.0.1:${port}`;
let child;
async function start(){return new Promise((resolve,reject)=>{child=spawn(process.execPath,[path.join(process.env.CASEBOOK_TEST_RELEASE_DIR||'..','server.mjs')],{cwd:process.cwd(),env:{...process.env,CASEBOOK_DATA_DIR:temp,CASEBOOK_PORT:String(port)},stdio:['ignore','pipe','pipe']});let out='';child.stdout.on('data',d=>{out+=d.toString();if(out.includes('Open:'))resolve();});child.stderr.on('data',d=>{out+=d.toString();});child.on('error',reject);child.on('exit',c=>{if(c)reject(Error(out));});setTimeout(()=>reject(Error('Startup timeout: '+out)),10000).unref();});}
async function stop(){return new Promise(resolve=>{child.once('exit',resolve);child.kill('SIGTERM');});}
async function get(url,init){return fetch(base+url,init);}
try{
 await start();let r=await get('/');assert.equal(r.status,200);const html=await r.text();assert(html.includes('I/O Shield Casebook Studio'));
 const js=/src="([^"]+\.js)"/.exec(html)[1];r=await get(js);assert.equal(r.status,200);assert(!(await r.text()).includes('https://io-shield-casebook-studio'));
 const original=fs.readFileSync(process.argv[2]),form=new FormData();form.set('file',new File([original],'Casebook.xlsx'));r=await get('/api/books',{method:'POST',body:form});assert.equal(r.status,201,await r.clone().text());const {id}=await r.json();
 r=await get('/api/books/'+id);let book=await r.json();assert.equal(book.data.sheetNames.length,23);
 const values={A:'LOCAL-TEST-001',B:'',C:'Local persistence test',D:'Training Case',E:'Training',F:'2026-10-01',G:'',H:'01',I:'',J:'',K:'Ongoing',N:'T4',V:'Sanitized',W:'Local testing',X:'Verified local workbook operations.',Y:'Passed',Z:''};
 r=await get(`/api/books/${id}/entries`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sheet:'Case Register',row:53,revision:0,values})});assert.equal(r.status,200,await r.clone().text());assert.equal((await r.json()).revision,1);
 const proof=new FormData();proof.set('file',new File(['Local test proof'],'local-proof.txt'));r=await get(`/api/books/${id}/files`,{method:'POST',body:proof});assert.equal(r.status,201,await r.clone().text());const f=await r.json();assert.equal(f.hash.length,64);
 r=await get(`/api/books/${id}/export`);assert.equal(r.status,200);assert(unzipSync(new Uint8Array(await r.arrayBuffer()))['xl/workbook.xml']);
 r=await get(`/api/books/${id}/bundle`);assert.equal(r.status,200);const bundle=unzipSync(new Uint8Array(await r.arrayBuffer()));assert.equal(strFromU8(bundle[`attachments/${f.id}/${f.name}`]),'Local test proof');
 r=await get(`/api/books/${id}/original`);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),new Uint8Array(original));
 r=await get('/api/books',{headers:{Origin:'https://outside.example'}});assert.equal(r.status,403);
 r=await get('/api/books',{headers:{'Sec-Fetch-Site':'cross-site'}});assert.equal(r.status,403);
 const hostileHostStatus=await new Promise((resolve,reject)=>{const request=http.request(base+'/api/books',{headers:{Host:'outside.example'}},response=>{response.resume();resolve(response.statusCode);});request.on('error',reject);request.end();});assert.equal(hostileHostStatus,403);
 await stop();await start();r=await get('/api/books/'+id);book=await r.json();assert.equal(book.revision,1);assert.equal(book.files[0].name,'local-proof.txt');assert.equal(book.edits['Case Register']['53'].C,'Local persistence test');
 r=await get('/api/files/'+f.id);assert.equal(await r.text(),'Local test proof');
 console.log(JSON.stringify({passed:true,mode:'standalone localhost',checks:14,sheets:23,restartPersistence:true,proofStoredOnDisk:true,externalOriginsRejected:true}));
}finally{if(child&&child.exitCode===null)await stop();fs.rmSync(temp,{recursive:true,force:true});}
