export type Row={row:number,values:Record<string,string>};
export type BookData={profile:Record<string,string>,sheets:Record<string,{path:string,headers:Record<string,string>,rows:Row[],capacity:number,lists?:Record<string,string[]>}>,sheetNames:string[]};
export type Edits=Record<string,Record<string,Record<string,string>>>;
export const limits:Record<string,number>={'Case Register':254,'Session Ledger':504,'Evidence Index':754,'Competency Evidence':1004,'Portfolio':254};
export const editable:Record<string,string[]>={
 'Case Register':['A','B','C','D','E','F','G','H','I','J','K','N','V','W','X','Y','Z'],
 'Session Ledger':['A','B','C','D','E','F','G','H','I','J','K','L','N','O','P','R'],
 'Evidence Index':['A','B','C','D','E','F','G','H','I','J','K','N'],
 'Competency Evidence':['A','B','C','D','E','F','G','H','I','J','K','L','M','Q','R','T'],
 'Portfolio':['A','B','C','D','E','G','H','I','M'],
};
export const required:Record<string,string[]>={'Case Register':['A','C','D','E','F','H','N','W','X'],'Session Ledger':['A','B','C','D','E','F','G','I','P'],'Evidence Index':['A','B','C','D','E','F','H'],'Competency Evidence':['A','B','C','D','E','F','G','H','J','K'],'Portfolio':['A','B','C','D','E','M']};
export const dateColumns:Record<string,string[]>={'Case Register':['F','G','T'],'Session Ledger':['B'],'Evidence Index':['C','M'],'Competency Evidence':['C','P'],'Portfolio':['L']};
export const numericColumns:Record<string,string[]>={'Case Register':['M'],'Session Ledger':['L','P'],'Competency Evidence':['J']};
export const labels:Record<string,string>={'Case Register':'Case','Session Ledger':'Session','Evidence Index':'Proof','Competency Evidence':'Skill claim','Portfolio':'Portfolio draft'};
export const timeNames={T1:'T1 · Exact tracked time',T2:'T2 · Reconstructed from records',T3:'T3 · Proven minimum time',T4:'T4 · Work known, hours unknown',T5:'T5 · Recollection awaiting proof'};
export const levels=['0 · Observed','1 · Assisted','2 · Supervised','3 · Independent','4 · Lead','5 · Mentor'];
export function rowsFor(data:BookData,edits:Edits,sheet:string):Row[]{const out=new Map((data.sheets[sheet]?.rows??[]).map(r=>[r.row,{row:r.row,values:{...r.values}}]));for(const [n,v]of Object.entries(edits[sheet]??{}))out.set(+n,{row:+n,values:{...out.get(+n)?.values,...v}});return [...out.values()].filter(r=>r.values.A).sort((a,b)=>a.row-b.row);}
export function excelDate(value:string):string {if(!value)return '';if(/^\d+(\.\d+)?$/.test(value)){const n=Number(value);if(n>1&&n<100000)return new Date(Date.UTC(1899,11,30)+n*86400000).toISOString().slice(0,10);}return value.slice(0,10);}
export function dateSerial(value:string):string {if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return value;return String(Math.round((Date.parse(value+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000));}
export function validateEntry(data:BookData,edits:Edits,sheet:string,row:number,values:Record<string,string>){
 if(!editable[sheet]||!data.sheets[sheet])throw Error('Unsupported sheet.');
 if(!Number.isInteger(row)||row<5||row>data.sheets[sheet].capacity)throw Error('This sheet has reached its supported template capacity.');
 for(const [k,v]of Object.entries(values))if(!editable[sheet].includes(k)||typeof v!=='string'||v.length>32000)throw Error('An entry field is invalid.');
 for(const col of required[sheet])if(!values[col]?.trim())throw Error(`Complete ${data.sheets[sheet].headers[col]}.`);
 const current=rowsFor(data,edits,sheet).find(r=>r.row===row);
 if(current&&current.values.A!==values.A)throw Error('Record IDs cannot be changed.');
 if(rowsFor(data,edits,sheet).some(r=>r.row!==row&&r.values.A===values.A))throw Error('This record ID already exists.');
 if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(values.A))throw Error('Use letters, numbers, periods, underscores, or hyphens in the record ID.');
 const caseId=sheet==='Session Ledger'?values.C:values.B;
 if(sheet!=='Case Register'&&!rowsFor(data,edits,'Case Register').some(r=>r.values.A===caseId))throw Error('Select a case from this casebook.');
 for(const col of dateColumns[sheet]??[])if(values[col]&&(!/^\d{4}-\d{2}-\d{2}$/.test(values[col])||new Date(values[col]+'T00:00:00Z').toISOString().slice(0,10)!==values[col]))throw Error('Enter a valid date.');
 if(sheet==='Session Ledger'){
  if(!Object.keys(timeNames).includes(values.I))throw Error('Choose a time class.');
  if(['T4','T5'].includes(values.I)&&values.L)throw Error('Leave hours blank for T4 and T5.');
  if(['T1','T2','T3'].includes(values.I)&&(!values.L||!Number.isFinite(+values.L)||+values.L<=0||+values.L>24))throw Error('Enter proven session hours greater than 0 and no more than 24.');
  if(!/^[0-5]$/.test(values.P))throw Error('Choose a work level.');
 }
 if(sheet==='Case Register'&&!Object.keys(timeNames).includes(values.N))throw Error('Choose a time class.');
 if(sheet==='Competency Evidence'){
  if(!/^[0-5]$/.test(values.J))throw Error('Choose a work level.');
  const skill=data.sheets['Competency Catalog'].rows.find(r=>r.values.A===values.E);if(!skill||skill.values.C!==values.F)throw Error('Choose a skill from the uploaded catalog.');
  const proofIds=values.H.split(/[,;\s]+/).filter(Boolean),known=rowsFor(data,edits,'Evidence Index');if(proofIds.some(id=>!known.some(r=>r.values.A===id&&r.values.B===values.B)))throw Error('Every proof ID must belong to the selected case.');
 }return current;
}
// Google Sheets exports store codes like 2 or 8 as "2.0" / "8.0"; the template uses "02" / "08".
export function domainCode(value:string):string {const v=(value??'').trim();return /^\d+(\.0+)?$/.test(v)?String(parseInt(v,10)).padStart(2,'0'):v;}
// Accepts "19:00", "7:00 PM", or an Excel time fraction like 0.79; returns "HH:MM" or ''.
export function clockTime(value:string):string {
 const v=(value??'').trim();if(!v)return '';
 if(/^0?\.\d+$|^0$/.test(v)){const m=Math.round(+v*1440);return `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;}
 const m=/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/.exec(v);if(!m)return '';
 let h=+m[1];if(m[3]){h=h%12+(/p/i.test(m[3])?12:0);}return h<24&&+m[2]<60?`${String(h).padStart(2,'0')}:${m[2]}`:'';
}
export function hoursBetween(start:string,end:string):string {
 const a=clockTime(start),b=clockTime(end);if(!a||!b)return '';
 const mins=(t:string)=>+t.slice(0,2)*60+ +t.slice(3);let d=mins(b)-mins(a);if(d<=0)d+=1440;
 return String(Math.round(d/60*100)/100);
}
// Next "<prefix>NNN" ID that is not used anywhere in the sheet.
export function nextNumberedId(ids:string[],prefix:string):string {
 const used=new Set(ids);let n=Math.max(0,...ids.filter(id=>id.startsWith(prefix)).map(id=>+(/(\d+)$/.exec(id.slice(prefix.length))?.[1]??0)))+1;
 while(used.has(prefix+String(n).padStart(3,'0')))n++;return prefix+String(n).padStart(3,'0');
}
// Child cases use the parent ID plus a letter (2026-001A); new projects use YEAR-NNN.
export function nextCaseId(ids:string[],parentId:string,year:number):string {
 const used=new Set(ids);
 if(parentId){for(let i=0;i<26*27;i++){const s=i<26?String.fromCharCode(65+i):String.fromCharCode(64+Math.floor(i/26))+String.fromCharCode(65+i%26);if(!used.has(parentId+s))return parentId+s;}}
 const top=ids.map(id=>new RegExp(`^${year}-(\\d{3})`).exec(id)?.[1]).filter(Boolean).map(Number);
 let n=Math.max(0,...top)+1;while(used.has(`${year}-${String(n).padStart(3,'0')}`))n++;return `${year}-${String(n).padStart(3,'0')}`;
}
export function proofTypeFor(name:string):string {
 const ext=(/\.([a-z0-9]+)$/i.exec(name)?.[1]??'').toLowerCase();
 if(['png','jpg','jpeg','webp'].includes(ext))return 'Screenshot';
 if(['log','txt'].includes(ext))return 'Command Log';
 if(['pcap','pcapng'].includes(ext))return 'PCAP';
 if(['conf','yaml','yml','json'].includes(ext))return 'Configuration';
 if(['pdf','docx','md'].includes(ext))return 'Report';
 return 'Other';
}
export function addHours(start:string,hours:string):string {
 const a=clockTime(start),h=+hours;if(!a||!Number.isFinite(h)||h<=0)return '';
 const m=(+a.slice(0,2)*60+ +a.slice(3)+Math.round(h*60))%1440;return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
}
