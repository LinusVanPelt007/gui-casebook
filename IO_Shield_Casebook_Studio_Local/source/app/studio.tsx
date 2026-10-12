'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Upload,Plus,Download,FolderOpen,Clock,FileCheck,Layers,Briefcase,Search,Shield,FileText,Check,ChevronsUpDown,ChevronDown,ChevronLeft,History,Paperclip,X,Pencil,Sun,Moon} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Checkbox} from '@/components/ui/checkbox';
import {Popover,PopoverTrigger,PopoverContent} from '@/components/ui/popover';
import {Command,CommandInput,CommandList,CommandEmpty,CommandItem} from '@/components/ui/command';
import {SidebarProvider,Sidebar,SidebarHeader,SidebarContent,SidebarMenu,SidebarMenuItem,SidebarMenuButton,SidebarInset,SidebarTrigger} from '@/components/ui/sidebar';
import {Toaster,toast} from 'sonner';
import {BookData,Edits,Row,editable,required,dateColumns,labels,timeNames,levels,rowsFor,excelDate,domainCode,clockTime,hoursBetween,nextNumberedId,nextCaseId,proofTypeFor,addHours} from '@/lib/casebook';
type FileRecord={id:string,name:string,hash:string,bytes:number,created:string};
type Book={id:string,name:string,revision:number,updated:string,data:BookData,edits:Edits,files:FileRecord[]};
type Upload={id:string,name:string,hash:string,ref:string};
type Form={sheet:string,row:number,existing:boolean};
const CASES='Case Register',SESSIONS='Session Ledger',PROOF='Evidence Index',CLAIMS='Competency Evidence',PORTFOLIO='Portfolio';
const caseCol=(sheet:string)=>sheet===SESSIONS?'C':'B';
// Form layout: rows of related fields side by side. "more" holds optional or rarely changed fields.
const layouts:Record<string,{rows:string[][],more:string[]}>={
 [CASES]:{rows:[['C'],['B','D','E'],['F','G','N'],['H','I'],['X'],['W']],more:['K','J','Y','V','Z','A']},
 [SESSIONS]:{rows:[['C','B'],['D'],['J','K','L','I'],['O'],['E','F','P'],['G','H']],more:['N','R','A']},
 [PROOF]:{rows:[['B','C'],['F'],['E'],['D','H'],['I','J']],more:['K','N','A']},
 [CLAIMS]:{rows:[['B','C'],['E'],['H'],['K','J'],['D','G']],more:['L','M','Q','R','T','A']},
 [PORTFOLIO]:{rows:[['B','C'],['D'],['E','G'],['M'],['I']],more:['H','A']},
};
// Will's own definitions from the casebook template, shown when hovering a field label.
const fieldTips:Record<string,string>={
 'Main Domain':'The technical area where you want the most depth.',
 'Support Domain':'A second area that makes the main domain stronger. Add it only when it truly matters.',
 'Scope / Permission':'Required for assessment, professional, or investigative work.',
 'Time Class':'How well the time is proven. Do not guess old hours.',
 'Work Level':'Pick the level you worked at. The reviewer makes the final call.',
 'Hours':'Leave blank for T4 and T5.',
 'What It Shows':'Write what the proof actually shows, not just the file name.',
 'NICE Link':'Draft mapping to the NIST NICE framework. Still being refined.',
 'Type':'Parent projects group smaller cases and normally get no extra case credit.',
 'Context':'Label practice work. Training and simulation stay clearly marked.',
};
// Free-text fields where earlier answers are offered as suggestions.
const suggestCols:Record<string,string[]>={[CASES]:['J'],[SESSIONS]:['N'],[PROOF]:['K']};
const longFields=['What I Did','Result','Notes','What I Worked On','What It Shows','Scope / Permission','Fix / Recovery','Privacy / Cleanup'];
// Used only when an older import has no dropdown lists stored with it.
const fallbackLists:Record<string,Record<string,string[]>>={
 [CASES]:{D:['Training Case','Project Case','Investigation Case','Assessment Case','Engineering Case','Research Case','Professional Case','Parent Project'],E:['Training','Simulation','Internal Project','Professional','Research','Mentorship'],K:['Ongoing','Completed','On Hold','Closed','Archived']},
 [SESSIONS]:{E:['Instructional','Practical','Professional','Research','Review','Mentorship'],F:['Training','Simulation','Internal Project','Professional','Research','Mentorship']},
 [PROOF]:{D:['Screenshot','Configuration','Command Log','Report','Diagram','Source Code','Ticket','PCAP','Forensic Image','Hash','Photo','Email/Message','External Record','Other'],H:['Public','Internal','Sensitive','Client/Restricted','Law-Enforcement / Controlled'],I:['Yes','No','Conditional','N/A'],J:['Yes','No','Conditional','N/A']},
 [CLAIMS]:{G:['Training','Simulation','Internal Project','Professional','Research','Mentorship'],K:['Met','Needs Correction','Not Yet','Safety / Scope Stop'],L:['Yes','No'],Q:['Yes','No']},
 [PORTFOLIO]:{E:['Project Page','Write-up','Diagram','Lab Report','Presentation'],G:['Yes','No','N/A']},
};
const today=()=>new Date().toLocaleDateString('en-CA');
async function api(path:string,init?:RequestInit):Promise<any>{const r=await fetch('/api/'+path,init);if(!r.ok){let message='The request could not be completed.';try{const t=await r.text();try{message=JSON.parse(t).error??message;}catch{message=t;}}catch{}throw Error(message);}return r.json();}
function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
type Option=[string,string]|[string,string,string];
function Choice({value,onChange,options,label}:{value:string,onChange:(v:string)=>void,options:Option[],label:string}){const safe:Option[]=value&&!options.some(o=>o[0]===value)?[[value,value],...options]:options;const tip=safe.find(o=>o[0]===value)?.[2];return <Select value={value||undefined} onValueChange={onChange}><SelectTrigger aria-label={label} className="w-full" title={tip}><SelectValue placeholder="Choose…"/></SelectTrigger><SelectContent>{safe.map(([v,l,t])=><SelectItem key={v} value={v} title={t}>{l}</SelectItem>)}</SelectContent></Select>;}
function SearchChoice({value,onChange,options,label,placeholder='Choose…'}:{value:string,onChange:(v:string)=>void,options:[string,string][],label:string,placeholder?:string}){const [open,setOpen]=useState(false);return <Popover modal open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" className="picker" role="combobox" aria-expanded={open} aria-label={label}><span>{options.find(o=>o[0]===value)?.[1]??(value||placeholder)}</span><ChevronsUpDown size={15}/></Button></PopoverTrigger><PopoverContent className="w-[min(520px,88vw)] p-0" align="start"><Command><CommandInput placeholder="Search…"/><CommandList><CommandEmpty>No matches.</CommandEmpty>{options.map(([id,name])=><CommandItem key={id||'none'} value={id+' '+name} onSelect={()=>{onChange(id);setOpen(false);}}>{value===id?<Check size={15}/>:<span className="w-[15px]"/>}<span>{name}</span></CommandItem>)}</CommandList></Command></PopoverContent></Popover>;}
export default function Studio({displayName}:{displayName:string}){
 const [books,setBooks]=useState<any[]>([]),[book,setBook]=useState<Book|null>(null),[view,setView]=useState<'cases'|'case'|'skills'|'history'>('cases'),[openCase,setOpenCase]=useState(''),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState('');
 const [form,setForm]=useState<Form|null>(null),[values,setValues]=useState<Record<string,string>>({}),[pending,setPending]=useState<Upload[]>([]),[formError,setFormError]=useState(''),[saving,setSaving]=useState(false),[history,setHistory]=useState<any[]>([]),[portfolio,setPortfolio]=useState<Row|null>(null),[publicCheck,setPublicCheck]=useState(false),[dragging,setDragging]=useState(false);
 const [dark,setDark]=useState(()=>document.documentElement.classList.contains('dark'));
 function toggleTheme(){const next=!dark;setDark(next);document.documentElement.classList.toggle('dark',next);try{localStorage.setItem('theme',next?'dark':'light');}catch{}}
 const uploadRef=useRef<HTMLInputElement>(null),fileRef=useRef<HTMLInputElement>(null),lastForm=useRef<Form|null>(null);
 if(form)lastForm.current=form;
 const shown=form??lastForm.current;
 const getRows=(s:string)=>book?rowsFor(book.data,book.edits,s):[];
 const cases=getRows(CASES),sessions=getRows(SESSIONS),claims=getRows(CLAIMS),proof=getRows(PROOF),stories=getRows(PORTFOLIO);
 const domains:Option[]=book?.data.sheets['Domain Framework']?.rows.filter(r=>/^\d+(\.0+)?$/.test(r.values.A.trim())).map(r=>[domainCode(r.values.A),domainCode(r.values.A)+' · '+r.values.C])??[];
 const domainLabel=(v:string)=>domains.find(d=>d[0]===domainCode(v))?.[1]??v;
 const catalog=book?.data.sheets['Competency Catalog']?.rows??[];
 const defs=useMemo(()=>{const out={level:{} as Record<string,[string,string]>,time:{} as Record<string,[string,string]>,caseType:{} as Record<string,string>};for(const r of book?.data.sheets['Lists & Definitions']?.rows??[]){const v=r.values;if(/^[0-5](\.0+)?$/.test(v.A??'')&&v.B)out.level[String(parseInt(v.A))]??=[v.B,v.C??''];if(/^T[1-5]$/.test(v.E??'')&&v.F)out.time[v.E]??=[v.F,[v.G,v.H].filter(Boolean).join(' ')];if(/Case$|^Parent Project$/.test(v.A??'')&&v.B)out.caseType[v.A]=v.B;}return out;},[book?.id]);
 const domainTip=(code:string)=>book?.data.sheets['Domain Framework']?.rows.find(r=>domainCode(r.values.A)===code)?.values.D;
 const findCase=(id:string)=>cases.find(r=>r.values.A===id);
 const isParent=(r:Row)=>r.values.D==='Parent Project';
 // Parent Project may hold the parent's ID or (in older sheets) its name.
 const parentOf=(r:Row)=>{const p=(r.values.B??'').trim();return p?cases.find(c=>c!==r&&(c.values.A===p||c.values.C?.trim()===p)):undefined;};
 const listFor=(sheet:string,col:string)=>book?.data.sheets[sheet]?.lists?.[col]??fallbackLists[sheet]?.[col];
 const suggestions=(sheet:string,col:string)=>[...new Set(getRows(sheet).map(r=>r.values[col]?.trim()).filter(Boolean))].slice(-30) as string[];
 async function refreshBooks(){const list=await api('books');setBooks(list);return list;}
 async function openBook(id:string){setBusy(true);setError('');try{setBook(await api('books/'+id));setView('cases');setOpenCase('');setSearch('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 useEffect(()=>{refreshBooks().then(list=>list.length&&openBook(list[0].id)).catch(e=>setError(e.message)).finally(()=>setLoaded(true));},[]);
 useEffect(()=>{if(view==='history'&&book)api(`books/${book.id}/history`).then(setHistory).catch(e=>setError(e.message));},[view,book?.id,book?.revision]);
 useEffect(()=>{const ctx=(document as any).modelContext;if(!ctx?.registerTool)return;const controller=new AbortController();Promise.resolve(ctx.registerTool({name:'read_casebook_records',title:'Read casebook records',description:'Read records in the selected personal casebook without changing them.',inputSchema:{type:'object',properties:{sheet:{type:'string',enum:Object.keys(labels)}},required:['sheet'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:any)=>{if(!book)throw Error('Upload or open a casebook first.');if(!input||!Object.keys(labels).includes(input.sheet))throw Error('Choose a supported sheet.');return {sheet:input.sheet,revision:book.revision,records:rowsFor(book.data,book.edits,input.sheet)};}},{signal:controller.signal})).catch(()=>{});return()=>controller.abort();},[book]);
 async function importBook(file:File){setBusy(true);setError('');try{const f=new FormData();f.set('file',file);const {id}=await api('books',{method:'POST',body:f});await refreshBooks();await openBook(id);toast.success('Casebook imported.');}catch(e){setError((e as Error).message);}finally{setBusy(false);if(uploadRef.current)uploadRef.current.value='';}}
 function goCase(id:string){setOpenCase(id);setView('case');setSearch('');}

 // Everything the user would otherwise retype comes from the case and the last session on it.
 function inferFromCase(sheet:string,caseId:string,base:Record<string,string>,keepId=false){
  const c=findCase(caseId),last=[...sessions].reverse().find(r=>r.values.C===caseId),next={...base,[caseCol(sheet)]:caseId};
  const ids=getRows(sheet).map(r=>r.values.A);
  if(!keepId){const suffix={[SESSIONS]:'S',[PROOF]:'P',[CLAIMS]:'D',[PORTFOLIO]:'PORT'}[sheet];next.A=nextNumberedId(ids,`${caseId||'CASE'}-${suffix}`);}
  if(!c)return next;
  const main=domainCode(c.values.H??''),support=domainCode(c.values.I??''),context=c.values.E??'';
  if(sheet===SESSIONS)Object.assign(next,{F:context||next.F,G:main||next.G,H:support,I:last?.values.I||next.I||'T1',P:last?.values.P||next.P||'1',N:last?.values.N??next.N??'',E:last?.values.E||next.E||'Practical'});
  if(sheet===CLAIMS){const known=new Set(proof.filter(r=>r.values.B===caseId).map(r=>r.values.A));Object.assign(next,{D:main||next.D,G:context||next.G,J:last?.values.P||next.J||'1',H:(last?.values.O??'').split(/[,;\s]+/).filter(id=>known.has(id)).join(', ')});}
  if(sheet===PORTFOLIO)Object.assign(next,{C:main||next.C,D:next.D||c.values.C||'',I:[...new Set(claims.filter(r=>r.values.B===caseId).map(r=>r.values.F))].join(', ')});
  return next;
 }
 function start(sheet:string,row?:Row,caseId?:string){
  if(!book)return;setFormError('');setPending([]);
  const used=getRows(sheet);let rowNum=row?.row??5;while(!row&&used.some(r=>r.row===rowNum))rowNum++;
  if(rowNum>book.data.sheets[sheet].capacity){toast.error('This template has reached its supported capacity.');return;}
  let init:Record<string,string>={};for(const c of editable[sheet])init[c]=row?.values[c]??'';
  for(const c of dateColumns[sheet]??[])if(c in init)init[c]=excelDate(init[c]);
  for(const c of ['H','I'])if(sheet===CASES)init[c]=domainCode(init[c]);
  if(sheet===SESSIONS){init.G=domainCode(init.G);init.H=domainCode(init.H);init.J=clockTime(init.J)||init.J;init.K=clockTime(init.K)||init.K;}
  if(sheet===CLAIMS||sheet===PORTFOLIO){const k=sheet===CLAIMS?'D':'C';init[k]=domainCode(init[k]);}
  if(!row){
   const target=caseId??(view==='case'?openCase:'');
   const fallbackCase=target||[...sessions].reverse()[0]?.values.C||cases.filter(r=>!isParent(r)).at(-1)?.values.A||'';
   if(sheet===CASES)Object.assign(init,{A:nextCaseId(cases.map(r=>r.values.A),'',new Date().getFullYear()),D:'Training Case',E:'Training',F:today(),H:domainCode(book.data.profile['Main Domain']??'')||domains[0]?.[0]||'01',I:domainCode(book.data.profile['Support Domain']??''),K:'Ongoing',N:'T4'});
   if(sheet===CASES&&caseId)init=withParent(init,caseId);
   if(sheet===SESSIONS)init=inferFromCase(sheet,fallbackCase,{...init,B:today(),E:'Practical',F:'Training',G:'01',I:'T1',P:'1'});
   if(sheet===PROOF)init=inferFromCase(sheet,fallbackCase,{...init,C:today(),D:'Screenshot',H:'Internal',I:'No',J:'No',K:book.data.profile.Name??displayName});
   if(sheet===CLAIMS)init=inferFromCase(sheet,fallbackCase,{...init,C:today(),D:'01',G:'Training',J:'1',K:'Met',L:'No',Q:'No'});
   if(sheet===PORTFOLIO)init=inferFromCase(sheet,fallbackCase,{...init,E:'Project Page',G:'No'});
  }
  setValues(init);setForm({sheet,row:rowNum,existing:!!row});
 }
 function withParent(next:Record<string,string>,parentId:string){const p=findCase(parentId);next.B=p?.values.A??'';next.A=nextCaseId(cases.map(r=>r.values.A),p?.values.A??'',new Date().getFullYear());if(p)Object.assign(next,{D:next.D==='Training Case'?'Project Case':next.D,E:p.values.E||next.E,H:domainCode(p.values.H??'')||next.H,I:domainCode(p.values.I??'')||next.I,J:p.values.J||next.J});return next;}
 function change(col:string,v:string){setValues(old=>{
  if(!form)return old;const sheet=form.sheet;let next={...old,[col]:v};
  if(!form.existing&&col===caseCol(sheet)&&sheet!==CASES)next=inferFromCase(sheet,v,next);
  if(sheet===CASES&&col==='B'&&!form.existing)next=withParent(next,v);
  if(sheet===SESSIONS&&(col==='J'||col==='K')){const h=hoursBetween(next.J,next.K);if(h)next.L=h;}
  if(sheet===SESSIONS&&col==='L'&&next.J)next.K=addHours(next.J,v);
  if(sheet===SESSIONS&&col==='I'&&['T4','T5'].includes(v))Object.assign(next,{J:'',K:'',L:''});
  if(sheet===CLAIMS&&col==='E'){const skill=catalog.find(r=>r.values.A===v);if(skill){next.F=skill.values.C;next.D=domainCode(skill.values.B);}}
  return next;});}
 async function uploadFiles(list:FileList|File[]){
  if(!book||!form)return;setSaving(true);setFormError('');
  try{for(const file of Array.from(list)){const f=new FormData();f.set('file',file);const r=await api(`books/${book.id}/files`,{method:'POST',body:f});setBook(b=>b&&{...b,files:[r,...b.files]});
   if(form.sheet===PROOF){setValues(v=>({...v,F:r.ref,G:'SHA256:'+r.hash,D:proofTypeFor(r.name),E:v.E||r.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ')}));}
   else setPending(p=>[...p,{id:r.id,name:r.name,hash:r.hash,ref:r.ref}]);}}
  catch(e){setFormError((e as Error).message);}finally{setSaving(false);if(fileRef.current)fileRef.current.value='';}
 }
 async function put(rev:number,sheet:string,row:number,vals:Record<string,string>){return api(`books/${book!.id}/entries`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({sheet,row,revision:rev,values:vals})});}
 // Files dropped on a session or skill claim become proof records on the same case first.
 async function saveEntry(){if(!form||!book)return;setSaving(true);setFormError('');
  try{
   let rev=book.revision,edits=book.edits,updated=book.updated;const vals={...values},caseId=vals[caseCol(form.sheet)];
   if(pending.length&&form.sheet!==PROOF){
    const live=rowsFor(book.data,edits,PROOF);let row=5;const ids=live.map(r=>r.values.A),made:string[]=[];
    for(const f of pending){while(live.some(r=>r.row===row))row++;const id=nextNumberedId([...ids,...made],`${caseId}-P`);
     const r=await put(rev,PROOF,row,{A:id,B:caseId,C:vals.B&&form.sheet===SESSIONS?vals.B:vals.C||today(),D:proofTypeFor(f.name),E:(form.sheet===SESSIONS?vals.D:vals.F)||f.name,F:f.ref,G:'SHA256:'+f.hash,H:'Internal',I:'No',J:'No',K:book.data.profile.Name??displayName,N:''});
     rev=r.revision;edits=r.edits;updated=r.updated;made.push(id);row++;}
    const col=form.sheet===SESSIONS?'O':'H';vals[col]=[...(vals[col]?vals[col].split(/[,;\s]+/).filter(Boolean):[]),...made].join(', ');
   }
   const r=await put(rev,form.sheet,form.row,vals);
   setBook({...book,revision:r.revision,edits:r.edits,updated:r.updated});setForm(null);setPending([]);await refreshBooks();
   if(form.sheet===CASES&&!form.existing)goCase(vals.A);
   toast.success(`${labels[form.sheet]} saved.`);
  }catch(e){setFormError((e as Error).message);try{setBook(await api('books/'+book.id));}catch{}}finally{setSaving(false);}
 }
 async function download(kind:string){if(!book)return;setBusy(true);try{const r=await fetch(`/api/books/${book.id}/${kind}`);if(!r.ok)throw Error((await r.json() as any).error??'Export failed.');const name=/filename="([^"]+)"/.exec(r.headers.get('content-disposition')??'')?.[1]??'casebook.xlsx';downloadBlob(await r.blob(),name);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}

 function field(col:string){
  const form=shown;if(!book||!form)return null;const sheet=form.sheet,label=book.data.sheets[sheet].headers[col]??col,value=values[col]??'',set=(v:string)=>change(col,v),req=required[sheet].includes(col),wide=longFields.includes(label)||sheet===PORTFOLIO&&col==='M';
  if(sheet!==CASES&&col===caseCol(sheet))return <Field key={col} label="Case" required={req}><SearchChoice value={value} onChange={set} options={cases.filter(r=>!isParent(r)).map(r=>[r.values.A,r.values.A+' · '+r.values.C])} label="Case"/></Field>;
  if(sheet===CASES&&col==='B')return <Field key={col} label="Parent project"><SearchChoice value={findCase(value)?.values.A??value} onChange={set} placeholder="None" options={[['','None'],...cases.filter(r=>isParent(r)&&r.values.A!==values.A).map(r=>[r.values.A,r.values.A+' · '+r.values.C] as [string,string])]} label="Parent project"/></Field>;
  if(sheet===CLAIMS&&col==='E'){const c=findCase(values.B),mine=[domainCode(c?.values.H??''),domainCode(c?.values.I??'')];const sorted=[...catalog].sort((a,b)=>+mine.includes(domainCode(b.values.B))-+mine.includes(domainCode(a.values.B)));return <Field key={col} label="Skill" required><SearchChoice value={value} onChange={set} options={sorted.map(r=>[r.values.A,r.values.C+'  ·  '+r.values.A])} label="Skill"/></Field>;}
  if(sheet===CLAIMS&&col==='H'){const chosen=value.split(/[,;\s]+/).filter(Boolean),mine=proof.filter(r=>r.values.B===values.B);const toggle=(id:string)=>set((chosen.includes(id)?chosen.filter(x=>x!==id):[...chosen,id]).join(', '));
   return <Field key={col} label="Proof" required wide group><div className="chips">{mine.map(r=><button type="button" key={r.values.A} className={'chip'+(chosen.includes(r.values.A)?' on':'')} onClick={()=>toggle(r.values.A)} title={r.values.E}>{chosen.includes(r.values.A)&&<Check size={13}/>}{r.values.A}<span>{r.values.E}</span></button>)}{pending.map(f=><span key={f.id} className="chip on"><Paperclip size={13}/>{f.name}</span>)}<AttachButton/></div></Field>;}
  if(sheet===SESSIONS&&col==='O')return <Field key={col} label={label} wide group><div className="chips">{value.split(/[,;\s]+/).filter(Boolean).map(id=><span key={id} className="chip on">{id}</span>)}{pending.map(f=><span key={f.id} className="chip on"><Paperclip size={13}/>{f.name}</span>)}<AttachButton/></div></Field>;
  if(sheet===SESSIONS&&['J','K'].includes(col)){if(['T4','T5'].includes(values.I))return null;return <Field key={col} label={label}><Input type="time" value={clockTime(value)||value} onChange={e=>set(e.target.value)} aria-label={label}/></Field>;}
  if(sheet===SESSIONS&&col==='L'){if(['T4','T5'].includes(values.I))return null;return <Field key={col} label="Hours"><Input type="number" step="0.25" min={0} max={24} value={value} onChange={e=>set(e.target.value)} aria-label="Hours"/></Field>;}
  if(sheet===PROOF&&col==='F')return <Field key={col} label="File or link" required wide>{value.startsWith('attachments/')?<div className="file-chip"><FileText size={16}/><span>{value.replace(/^attachments\/[^/]+\//,'')}</span><button type="button" aria-label="Remove file" onClick={()=>setValues(v=>({...v,F:'',G:''}))}><X size={14}/></button></div>:<div className="drop"><Button type="button" variant="outline" onClick={()=>fileRef.current?.click()} disabled={saving}><Upload size={15}/>Choose file</Button>{book.files.length>0&&<Choice label="Saved file" value="" onChange={id=>{const f=book.files.find(f=>f.id===id)!;setValues(v=>({...v,F:`attachments/${f.id}/${f.name}`,G:'SHA256:'+f.hash,D:proofTypeFor(f.name)}));}} options={book.files.map(f=>[f.id,f.name])}/>}<Input placeholder="or paste a link" value={value} onChange={e=>set(e.target.value)} aria-label="Link"/></div>}</Field>;
  if(sheet===PROOF&&col==='G')return null;
  let options:Option[]|undefined;
  if(label.includes('Domain')||sheet===CLAIMS&&col==='D')options=domains.map(([v,l])=>[v,l,domainTip(v)??'']);
  else if(label==='Time Class')options=Object.keys(timeNames).map(k=>[k,`${k} · ${defs.time[k]?.[0]??timeNames[k as keyof typeof timeNames].slice(5)}`,defs.time[k]?.[1]??'']);
  else if(label==='Work Level')options=levels.map(v=>[v[0],`${v[0]} · ${defs.level[v[0]]?.[0]??v.slice(4)}`,defs.level[v[0]]?.[1]??'']);
  else{const list=listFor(sheet,col);if(list)options=list.map(v=>[v,v,sheet===CASES&&col==='D'?defs.caseType[v]??'':'']);}
  if(sheet===CLAIMS&&col==='F')return null;
  if(options)return <Field key={col} label={label} required={req}><Choice label={label} options={options} value={label.includes('Domain')||sheet===CLAIMS&&col==='D'?domainCode(value):value} onChange={set}/></Field>;
  if(wide)return <Field key={col} label={sheet===PORTFOLIO&&col==='M'?'Story':label} required={req} wide><Textarea rows={3} value={value} onChange={e=>set(e.target.value)}/></Field>;
  const date=(dateColumns[sheet]??[]).includes(col);
  if(suggestCols[sheet]?.includes(col))return <Field key={col} label={label} required={req}><SuggestInput label={label} value={value} onChange={set} options={suggestions(sheet,col)}/></Field>;
  return <Field key={col} label={label} required={req}><Input aria-label={label} value={value} type={date?'date':'text'} onChange={e=>set(e.target.value)} readOnly={col==='A'&&form.existing}/></Field>;
 }
 function AttachButton(){return <button type="button" className="chip add" onClick={()=>fileRef.current?.click()} disabled={saving}><Paperclip size={13}/>Attach</button>;}

 const current=findCase(openCase);
 const q=search.toLowerCase(),match=(r:Row)=>!q||Object.values(r.values).join(' ').toLowerCase().includes(q);
 const tracked=sessions.filter(r=>r.values.I==='T1').reduce((n,r)=>n+(+r.values.L||0),0),rebuilt=sessions.filter(r=>['T2','T3'].includes(r.values.I)).reduce((n,r)=>n+(+r.values.L||0),0);
 const caseHours=(id:string)=>sessions.filter(r=>r.values.C===id).reduce((n,r)=>n+(+r.values.L||0),0);
 const nav=[{id:'cases',label:'Cases',icon:FolderOpen},{id:'skills',label:'Skills',icon:Layers},{id:'history',label:'History',icon:History}] as const;
 const status=(v?:string)=>v?<span className={'badge'+(v==='Verified'||v==='Approved'?' ok':'')}>{v}</span>:null;
 const fileFor=(ref?:string)=>book?.files.find(f=>ref?.includes(f.id));
 const parents=cases.filter(isParent),loose=cases.filter(r=>!isParent(r)&&!parentOf(r));

 return <SidebarProvider style={{'--sidebar-width':'13rem'} as React.CSSProperties}><Toaster position="bottom-right"/>
 <Sidebar className="studio-sidebar" collapsible="icon"><SidebarHeader><div className="brand"><Shield size={18}/><strong>Casebook Studio</strong></div></SidebarHeader><SidebarContent><SidebarMenu>{nav.map(s=><SidebarMenuItem key={s.id}><SidebarMenuButton tooltip={s.label} isActive={view===s.id||s.id==='cases'&&view==='case'} onClick={()=>{setView(s.id);setSearch('');}} disabled={!book}><s.icon/><span>{s.label}</span></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu><button className="theme-btn" onClick={toggleTheme} aria-label={dark?'Light mode':'Dark mode'} title={dark?'Light mode':'Dark mode'}>{dark?<Sun size={16}/>:<Moon size={16}/>}</button></SidebarContent></Sidebar>
 <SidebarInset><header className="topbar"><div className="topbar-left"><SidebarTrigger/>{view==='case'&&current&&<button className="crumb" onClick={()=>setView('cases')}><ChevronLeft size={16}/>Cases</button>}</div>
  <div className="topbar-actions">{book&&<Button className="primary-button" size="sm" onClick={()=>start(SESSIONS)} disabled={busy||!cases.some(r=>!isParent(r))}><Clock size={15}/>Log session</Button>}
  <Popover><PopoverTrigger asChild><Button variant="ghost" size="sm" className="book-menu">{book?.data.profile.Name||book?.name.replace(/\.xlsx$/i,'')||'Casebook'}<ChevronDown size={15}/></Button></PopoverTrigger><PopoverContent align="end" className="menu w-64 p-1.5">
   {books.length>1&&<>{books.map(b=><button key={b.id} className="menu-item" onClick={()=>openBook(b.id)}>{book?.id===b.id?<Check size={15}/>:<span className="w-[15px]"/>}<span className="truncate">{b.name}</span></button>)}<hr/></>}
   <button className="menu-item" onClick={()=>uploadRef.current?.click()}><Upload size={15}/>Import casebook</button>
   {book&&<><hr/><button className="menu-item" onClick={()=>download('export')}><Download size={15}/>Download Excel</button><button className="menu-item" onClick={()=>download('bundle')}><Download size={15}/>Download Excel + proof</button><button className="menu-item" onClick={()=>download('original')}><Download size={15}/>Download original</button></>}
  </PopoverContent></Popover></div></header>
 <input ref={uploadRef} type="file" accept=".xlsx" className="hidden" onChange={e=>e.target.files?.[0]&&importBook(e.target.files[0])}/>
 <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.csv,.json,.log,.pcap,.pcapng,.conf,.yaml,.yml,.docx,.xlsx" onChange={e=>e.target.files?.length&&uploadFiles(e.target.files)}/>
 <main className="workspace">
 {error&&<div role="alert" className="error-banner">{error}<Button variant="ghost" size="sm" onClick={()=>{setError('');refreshBooks().catch(e=>setError(e.message));}}>Retry</Button></div>}
 {!book?<section className={'import'+(dragging?' over':'')} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f&&!busy)importBook(f);}}><h1>Open your casebook</h1><p>Drop your casebook .xlsx here.</p><Button className="primary-button" disabled={busy||!loaded} onClick={()=>uploadRef.current?.click()}><Upload size={16}/>{busy?'Importing…':'Choose file'}</Button></section>:
 view==='cases'?<>
  <div className="heading"><h1>Cases</h1><div className="heading-actions"><div className="search"><Search size={15}/><Input placeholder="Search" aria-label="Search cases" value={search} onChange={e=>setSearch(e.target.value)}/></div><Button variant="outline" onClick={()=>start(CASES)}><Plus size={15}/>New case</Button></div></div>
  <div className="stats"><Stat label="Cases" value={cases.filter(r=>!isParent(r)).length}/><Stat label="Tracked hours" value={tracked.toFixed(1)}/><Stat label="Rebuilt hours" value={rebuilt.toFixed(1)}/><Stat label="Skill claims" value={claims.length}/></div>
  {cases.length===0?<div className="empty"><p>No cases yet.</p><Button variant="outline" onClick={()=>start(CASES)}><Plus size={15}/>New case</Button></div>:
  [...parents.map(p=>({p,kids:cases.filter(r=>!isParent(r)&&parentOf(r)===p)})),{p:undefined,kids:loose}].filter(g=>g.kids.length||g.p).map(g=>{const kids=g.kids.filter(match);if(q&&!kids.length&&!(g.p&&match(g.p)))return null;return <section className="group" key={g.p?.values.A??'loose'}>
   {g.p?<div className="group-head"><span className="mono">{g.p.values.A}</span><h2>{g.p.values.C}</h2><button className="icon-btn" aria-label="Edit project" onClick={()=>start(CASES,g.p)}><Pencil size={14}/></button><button className="text-btn" onClick={()=>start(CASES,undefined,g.p!.values.A)}><Plus size={14}/>Add case to project</button></div>:parents.length>0&&g.kids.length>0&&<div className="group-head"><h2>Other cases</h2></div>}
   <div className="list">{kids.map(r=><div key={r.row} role="button" tabIndex={0} className="case-row with-action" onClick={()=>goCase(r.values.A)} onKeyDown={e=>{if(e.key==='Enter')goCase(r.values.A);}}><span className="mono">{r.values.A}</span><span className="case-name">{r.values.C}</span><span className="muted">{domainLabel(r.values.H??'')}</span><span className="muted num">{caseHours(r.values.A).toFixed(1)} h</span>{status(r.values.L)}<button className="row-action" aria-label={`Log session for ${r.values.A}`} title="Log session" onClick={e=>{e.stopPropagation();start(SESSIONS,undefined,r.values.A);}}><Clock size={15}/></button></div>)}</div>
  </section>;})}
 </>:
 view==='case'&&current?<CaseView/>:
 view==='skills'?<>
  <div className="heading"><h1>Skills</h1><div className="heading-actions"><div className="search"><Search size={15}/><Input placeholder="Search" aria-label="Search skills" value={search} onChange={e=>setSearch(e.target.value)}/></div><Button variant="outline" onClick={()=>start(CLAIMS)} disabled={!cases.length}><Plus size={15}/>Claim skill</Button></div></div>
  {claims.length===0?<div className="empty"><p>No skill claims yet.</p></div>:domains.map(([code,name])=>{const mine=claims.filter(r=>domainCode(r.values.D)===code&&match(r));if(!mine.length)return null;return <section className="group" key={code}><div className="group-head"><h2>{name}</h2></div><div className="list">{mine.map(r=><button key={r.row} className="case-row" onClick={()=>start(CLAIMS,r)}><span className="mono">{r.values.E}</span><span className="case-name">{r.values.F}</span><span className="muted">{findCase(r.values.B)?.values.C??r.values.B}</span><span className="muted">{levels[+r.values.J]?.slice(4)??''}</span>{status(r.values.N)}</button>)}</div></section>;})}
 </>:
 view==='history'?<>
  <div className="heading"><h1>History</h1></div>
  {history.length===0?<div className="empty"><p>No changes yet.</p></div>:<div className="list">{history.map(h=>{const d=JSON.parse(h.detail),added=!d.before?.A,heads=book.data.sheets[d.sheet]?.headers??{},changed=Object.keys(d.after).filter(k=>(d.before?.[k]??'')!==(d.after[k]??'')).map(k=>heads[k]??k);return <details className="history-row" key={h.revision}><summary><span className="case-name">{added?'Added':'Edited'} {labels[d.sheet]?.toLowerCase()} {d.after.A}</span><span className="muted truncate">{added?'':changed.join(', ')}</span><span className="muted num">{new Date(h.created).toLocaleString()}</span></summary><div className="history-diff">{Object.keys(d.after).filter(k=>(d.before?.[k]??'')!==(d.after[k]??'')).map(k=><div key={k}><span className="muted">{heads[k]??k}</span><span>{d.before?.[k]?<><s>{d.before[k]}</s> → </>:''}{d.after[k]||'—'}</span></div>)}</div></details>;})}</div>}
 </>:null}
 </main></SidebarInset>

 <Dialog open={!!form} onOpenChange={open=>{if(!open&&!saving)setForm(null);}}><DialogContent className="entry-dialog"><DialogHeader><DialogTitle>{shown?.existing?'Edit':shown?.sheet===SESSIONS?'Log':shown?.sheet===CLAIMS?'Claim':'New'} {shown&&(shown.sheet===CLAIMS?'skill':labels[shown.sheet].toLowerCase())}</DialogTitle><DialogDescription className="mono">{values.A}</DialogDescription></DialogHeader>
  <div className={'entry-scroll'+(dragging?' over':'')} onDragOver={e=>{if(form?.sheet!==CASES&&form?.sheet!==PORTFOLIO){e.preventDefault();setDragging(true);}}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files.length)uploadFiles(e.dataTransfer.files);}} onPaste={e=>{const files=[...e.clipboardData.files];if(files.length&&form?.sheet!==CASES&&form?.sheet!==PORTFOLIO){e.preventDefault();uploadFiles(files);}}}>
  {formError&&<div className="form-error" role="alert">{formError}</div>}
  {shown&&<><div className="form-rows">{layouts[shown.sheet].rows.map((row,i)=>{const cells=row.map(c=>field(c)).filter(Boolean);return cells.length?<div key={i} className="form-row" style={{gridTemplateColumns:`repeat(${cells.length},minmax(0,1fr))`}}>{cells}</div>:null;})}</div>
  <details className="more"><summary>More</summary><div className="form-grid">{layouts[shown.sheet].more.map(c=>field(c))}</div></details></>}
  </div>
  <div className="dialog-actions"><Button variant="ghost" onClick={()=>setForm(null)} disabled={saving}>Cancel</Button><Button className="primary-button" onClick={saveEntry} disabled={saving}>{saving?'Saving…':'Save'}</Button></div>
 </DialogContent></Dialog>

 <Dialog open={!!portfolio} onOpenChange={open=>!open&&setPortfolio(null)}><DialogContent className="portfolio-dialog"><DialogHeader><DialogTitle>{portfolio?.values.D}</DialogTitle><DialogDescription>{portfolio?.values.J??'Pending Review'}</DialogDescription></DialogHeader><p className="portfolio-story">{portfolio?.values.M||'No story yet.'}</p>{portfolio?.values.I&&<p className="muted">{portfolio.values.I}</p>}<label className="confirm-label"><Checkbox checked={publicCheck} onCheckedChange={v=>setPublicCheck(v===true)}/><span>Reviewed and OK to share</span></label><Button className="primary-button" disabled={!publicCheck||portfolio?.values.G!=='Yes'||!portfolio?.values.M} title={portfolio?.values.G!=='Yes'?'Set Cleaned Up to Yes first':undefined} onClick={()=>{if(!portfolio)return;const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));const title=escape(portfolio.values.D),story=escape(portfolio.values.M),skills=escape(portfolio.values.I??''),state=escape(portfolio.values.J==='Approved'?'Approved project record':'Learning record · Review pending');const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:18px/1.7 system-ui;color:#1b2a33;background:#f6f7f8;margin:0;padding:7vw}main{max-width:850px;margin:auto;background:white;padding:5vw;border-radius:10px}h1{font-size:2.5em;line-height:1.15}p{white-space:pre-wrap}.meta{font-size:14px;color:#5b6b75}</style><main><p class="meta">I/O Shield · Project portfolio</p><h1>${title}</h1><p class="meta">${state}</p><p>${story}</p><h2>Skills described</h2><p>${skills}</p></main></html>`;downloadBlob(new Blob([html],{type:'text/html'}),'portfolio-project.html');}}><Download size={15}/>Download page</Button></DialogContent></Dialog>
 </SidebarProvider>;

 function CaseView(){
  const c=current!,id=c.values.A,mySessions=sessions.filter(r=>r.values.C===id),myProof=proof.filter(r=>r.values.B===id),myClaims=claims.filter(r=>r.values.B===id),myStories=stories.filter(r=>r.values.B===id),parent=parentOf(c);
  return <>
   <div className="case-head"><div><p className="mono muted">{parent?`${parent.values.C} · `:''}{id}</p><h1>{c.values.C}</h1><p className="meta-line">{[c.values.D,c.values.E,domainLabel(c.values.H??''),c.values.K].filter(Boolean).join(' · ')} {status(c.values.L)}</p></div><button className="icon-btn" aria-label="Edit case" title="Edit case" onClick={()=>start(CASES,c)}><Pencil size={15}/></button></div>
   {c.values.X&&<p className="case-summary">{c.values.X}</p>}
   <Section title="Sessions" count={mySessions.length} extra={`${caseHours(id).toFixed(1)} h`} add={()=>start(SESSIONS,undefined,id)} addLabel="Log session">
    {mySessions.map(r=><button key={r.row} className="case-row" onClick={()=>start(SESSIONS,r)}><span className="muted num">{excelDate(r.values.B)}</span><span className="case-name">{r.values.D}</span><span className="muted">{clockTime(r.values.J)&&clockTime(r.values.K)?`${clockTime(r.values.J)}–${clockTime(r.values.K)}`:''}</span><span className="muted num">{r.values.L?`${(+r.values.L).toFixed(2)} h`:''}</span><span className="badge">{r.values.I}</span></button>)}
   </Section>
   <Section title="Proof" count={myProof.length} add={()=>start(PROOF,undefined,id)} addLabel="Add proof">
    {myProof.map(r=>{const f=fileFor(r.values.F);return <div key={r.row} className="case-row"><span className="mono">{r.values.A}</span><button className="case-name link" onClick={()=>start(PROOF,r)}>{r.values.E}</button><span className="muted">{r.values.D}</span>{f?<a className="text-btn" href={'/api/files/'+f.id}><Download size={14}/>{f.name}</a>:<span className="muted truncate">{r.values.F}</span>}</div>;})}
   </Section>
   <Section title="Skills" count={myClaims.length} add={()=>start(CLAIMS,undefined,id)} addLabel="Claim skill">
    {myClaims.map(r=><button key={r.row} className="case-row" onClick={()=>start(CLAIMS,r)}><span className="mono">{r.values.E}</span><span className="case-name">{r.values.F}</span><span className="muted">{levels[+r.values.J]?.slice(4)??''}</span><span className="muted">{r.values.K}</span>{status(r.values.N)}</button>)}
   </Section>
   <Section title="Portfolio" count={myStories.length} add={()=>start(PORTFOLIO,undefined,id)} addLabel="Write story">
    {myStories.map(r=><div key={r.row} className="case-row"><span className="mono">{r.values.A}</span><button className="case-name link" onClick={()=>start(PORTFOLIO,r)}>{r.values.D}</button>{status(r.values.J)}<button className="text-btn" onClick={()=>{setPortfolio(r);setPublicCheck(false);}}>Preview</button></div>)}
   </Section>
  </>;
 }
}
function SuggestInput({value,onChange,options,label}:{value:string,onChange:(v:string)=>void,options:string[],label:string}){const [open,setOpen]=useState(false);const list=options.filter(o=>o!==value&&o.toLowerCase().includes(value.toLowerCase())).slice(0,8);return <div className="suggest"><Input aria-label={label} value={value} onChange={e=>{onChange(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} onBlur={()=>setTimeout(()=>setOpen(false),120)}/>{open&&list.length>0&&<div className="suggest-list" role="listbox">{list.map(o=><button type="button" role="option" key={o} onMouseDown={e=>{e.preventDefault();onChange(o);setOpen(false);}}>{o}</button>)}</div>}</div>;}
function Section({title,count,extra,add,addLabel,children}:{title:string,count:number,extra?:string,add:()=>void,addLabel:string,children:React.ReactNode}){return <section className="group"><div className="group-head"><h2>{title}</h2><span className="muted">{count||''}{extra&&count?` · ${extra}`:''}</span><button className="text-btn" onClick={add}><Plus size={14}/>{addLabel}</button></div>{count>0&&<div className="list">{children}</div>}</section>;}
function Field({label,required=false,wide=false,group=false,children}:{label:string,required?:boolean,wide?:boolean,group?:boolean,children:React.ReactNode}){const Tag=group?'div':'label',tip=fieldTips[label];return <Tag className={'field '+(wide?'wide':'')}><span title={tip} className={tip?'has-tip':undefined}>{label}{required&&<b> *</b>}</span>{children}</Tag>;}
function Stat({label,value}:{label:string,value:string|number}){return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;}
