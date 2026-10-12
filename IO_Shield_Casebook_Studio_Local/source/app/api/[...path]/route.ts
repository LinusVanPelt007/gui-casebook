import {db,bucket,identity,owned} from '@/lib/store';
import {parseWorkbook,exportWorkbook} from '@/lib/workbook';
import {validateEntry,rowsFor} from '@/lib/casebook';
import {zipSync,strToU8} from 'fflate';
const safeName=(v:string)=>v.replace(/[^A-Za-z0-9._-]/g,'_').slice(0,140)||'file';
const now=()=>new Date().toISOString();
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(request:Request){try{
 const owner=await identity(),path=new URL(request.url).pathname.split('/').slice(2),method=request.method;
 if(method!=='GET'){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new Response('Cross-site writes are not allowed.',{status:403});}
 if(path[0]==='books'&&!path[1]){
  if(method==='GET'){const r=await db().prepare('SELECT id,name,revision,created,updated FROM casebooks WHERE owner=? ORDER BY updated DESC').bind(owner).all();return json(r.results);}
  if(method==='POST'){
   const count=await db().prepare('SELECT COUNT(*) AS n FROM casebooks WHERE owner=?').bind(owner).first();if(count.n>=20)throw Error('The pilot supports up to 20 casebooks per person.');
   const form=await request.formData(),file=form.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))throw Error('Choose a .xlsx casebook.');if(file.size>30*1024*1024)throw Error('Casebooks must be smaller than 30 MB.');
   const bytes=new Uint8Array(await file.arrayBuffer()),data=parseWorkbook(bytes),parsed=JSON.stringify(data);if(parsed.length>8000000)throw Error('This casebook contains too much data for the pilot.');
   const id=crypto.randomUUID(),key=owner+'/'+id+'/original.xlsx',created=now();await bucket().put(key,bytes,{httpMetadata:{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}});
   await db().prepare('INSERT INTO casebooks (id,owner,name,original_key,parsed,edits,revision,created,updated) VALUES (?,?,?,?,?,\'{}\',0,?,?)').bind(id,owner,safeName(file.name),key,parsed,created,created).run();return json({id},201);
  }
 }
 if(path[0]==='files'&&path[1]&&method==='GET'){
  const f=await db().prepare('SELECT * FROM proof_files WHERE id=? AND owner=?').bind(path[1],owner).first();if(!f)throw new Response('File not found.',{status:404});await owned(f.book_id,owner);const o=await bucket().get(f.object_key);if(!o)throw Error('File is temporarily unavailable.');return new Response(o.body,{headers:{'Content-Type':'application/octet-stream','Content-Disposition':`attachment; filename="${safeName(f.name)}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'private, no-store'}});
 }
 if(path[0]!=='books'||!path[1])throw new Response('Not found.',{status:404});
 const b=await owned(path[1],owner),data=JSON.parse(b.parsed),edits=JSON.parse(b.edits);
 if(!path[2]&&method==='GET'){const fs=await db().prepare('SELECT id,name,hash,bytes,created FROM proof_files WHERE book_id=? AND owner=? ORDER BY created DESC').bind(b.id,owner).all();return json({id:b.id,name:b.name,revision:b.revision,created:b.created,updated:b.updated,data,edits,files:fs.results});}
 if(path[2]==='original'&&method==='GET'){const o=await bucket().get(b.original_key);if(!o)throw Error('Original unavailable.');return new Response(o.body,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${safeName(b.name)}"`,'Cache-Control':'no-store'}});}
 if(path[2]==='entries'&&method==='PUT'){
  if(+(request.headers.get('content-length')??0)>100000)throw Error('Entry is too large.');const body:any=await request.json();if(body.revision!==b.revision)return json({error:'This casebook changed in another window. Reload before saving; your form stays open.'},409);
  const {sheet,row,values}=body;if(!values||typeof values!=='object')throw Error('Entry fields are missing.');const current=validateEntry(data,edits,sheet,row,values),old=current?.values??{},defaults:any={};
  if(sheet==='Case Register')Object.assign(defaults,{L:'Pending Review',M:values.D==='Parent Project'?'0':'1',U:'No',S:'',T:''});
  if(sheet==='Competency Evidence')Object.assign(defaults,{N:'Pending Review',S:'No',O:'',P:'',U:'0.01',V:''});
  if(sheet==='Evidence Index')Object.assign(defaults,{L:'',M:''});
  if(sheet==='Portfolio')Object.assign(defaults,{F:'Private',J:'Pending Review',K:'',L:''});
  const updated={...values,...defaults};edits[sheet]??={};edits[sheet][row]={...edits[sheet][row],...updated};
  const cascades:any[]=[];
  if(current&&['Case Register','Session Ledger','Evidence Index'].includes(sheet)){
   const caseId=sheet==='Case Register'?values.A:sheet==='Session Ledger'?values.C:values.B;
   for(const claim of rowsFor(data,edits,'Competency Evidence').filter((r:any)=>r.values.B===caseId)){
    if(sheet==='Evidence Index'&&!claim.values.H?.split(/[,;\s]+/).includes(values.A))continue;
    const patch={N:'Pending Review',S:'No',O:'',P:'',V:''};edits['Competency Evidence']??={};edits['Competency Evidence'][claim.row]={...edits['Competency Evidence'][claim.row],...patch};cascades.push({sheet:'Competency Evidence',row:claim.row,before:claim.values,after:patch});
   }
   for(const item of rowsFor(data,edits,'Portfolio').filter((r:any)=>r.values.B===caseId)){const patch={J:'Pending Review',F:'Private',K:'',L:''};edits.Portfolio??={};edits.Portfolio[item.row]={...edits.Portfolio[item.row],...patch};cascades.push({sheet:'Portfolio',row:item.row,before:item.values,after:patch});}
   if(sheet!=='Case Register'){const c=rowsFor(data,edits,'Case Register').find((r:any)=>r.values.A===caseId);if(c){const patch={L:'Pending Review',U:'No',S:'',T:''};edits['Case Register']??={};edits['Case Register'][c.row]={...edits['Case Register'][c.row],...patch};cascades.push({sheet:'Case Register',row:c.row,before:c.values,after:patch});}}
  }
  const timestamp=now(),revision=b.revision+1;
  const results=await db().batch([
   db().prepare('UPDATE casebooks SET edits=?,revision=revision+1,updated=? WHERE id=? AND owner=? AND revision=?').bind(JSON.stringify(edits),timestamp,b.id,owner,b.revision),
   db().prepare('INSERT INTO casebook_events (id,book_id,actor,revision,detail,created) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),b.id,owner,revision,JSON.stringify({sheet,row,before:old,after:updated,cascades}),timestamp),
  ]);if(results[0].meta.changes!==1)return json({error:'Another update arrived first. Reload before saving.'},409);return json({revision,edits,updated:timestamp});
 }
 if(path[2]==='files'&&method==='POST'){
  const totals=await db().prepare('SELECT SUM(bytes) AS bytes,COUNT(*) AS n FROM proof_files WHERE book_id=?').bind(b.id).first(),form=await request.formData(),f=form.get('file');if(!(f instanceof File))throw Error('Choose a supporting file.');
  if(!/\.(pdf|png|jpg|jpeg|webp|txt|md|csv|json|log|pcap|pcapng|conf|yaml|yml|docx|xlsx)$/i.test(f.name))throw Error('Use a document, image, log, configuration, or packet capture.');
  if(f.size<=0||f.size>10*1024*1024)throw Error('Files must be nonempty and no larger than 10 MB.');if((totals.bytes??0)+f.size>40*1024*1024||totals.n>=100)throw Error('The pilot allows 100 files and 40 MB of proof per casebook.');
  const bytes=await f.arrayBuffer(),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join(''),id=crypto.randomUUID(),name=safeName(f.name),key=owner+'/'+b.id+'/proof/'+id,created=now();await bucket().put(key,bytes);
  await db().prepare('INSERT INTO proof_files (id,book_id,owner,name,object_key,hash,bytes,created) VALUES (?,?,?,?,?,?,?,?)').bind(id,b.id,owner,name,key,hash,f.size,created).run();return json({id,name,hash,bytes:f.size,created,ref:`attachments/${id}/${name}`},201);
 }
 if(path[2]==='history'&&method==='GET'){const r=await db().prepare('SELECT revision,detail,created FROM casebook_events WHERE book_id=? ORDER BY revision DESC LIMIT 100').bind(b.id).all();return json(r.results);}
 if((path[2]==='export'||path[2]==='bundle')&&method==='GET'){
  const o=await bucket().get(b.original_key);if(!o)throw Error('The original workbook is unavailable.');const bytes=exportWorkbook(new Uint8Array(await o.arrayBuffer()),edits),filename=b.name.replace(/\.xlsx$/i,'')+`_revision_${b.revision}.xlsx`;
  if(path[2]==='export')return new Response(bytes as any,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'}});
  const fs=await db().prepare('SELECT * FROM proof_files WHERE book_id=? AND owner=?').bind(b.id,owner).all(),out:Record<string,Uint8Array>={[filename]:bytes};
  for(const f of fs.results){const obj=await bucket().get(f.object_key);if(!obj)throw Error(`A proof file is unavailable: ${f.name}.`);out[`attachments/${f.id}/${f.name}`]=new Uint8Array(await obj.arrayBuffer());}
  const history=await db().prepare('SELECT revision,detail,created FROM casebook_events WHERE book_id=? ORDER BY revision').bind(b.id).all();out['casebook-change-history.json']=strToU8(JSON.stringify(history.results,null,2));out['README.txt']=strToU8('Casebook Studio export\nOpen the workbook in Excel or LibreOffice to recalculate its preserved formulas.\nSupporting files are in attachments/. Evidence Index file references are relative to this folder.\nSHA-256 hashes document uploaded bytes; they do not certify authenticity or chain of custody.\nOriginal imported workbook remains available separately in the portal.\n');return new Response(zipSync(out,{level:0}) as any,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="casebook_revision_${b.revision}_with_proof.zip"`,'Cache-Control':'no-store'}});
 }
 throw new Response('Not found.',{status:404});
 }catch(e){if(e instanceof Response)return e;console.error('Casebook request failed',e);return json({error:e instanceof Error?e.message:'The request could not be completed. Your entry has not been discarded.'},400);}}
export const GET=handle;export const POST=handle;export const PUT=handle;
