// Builds download-and-double-click zips for Windows, Mac and Linux with Node bundled in runtime/.
// Usage: npm run release   (after npm run build). Output goes to ../../release/.
// Picks the newest Node 24 LTS automatically and checks every download against nodejs.org's SHA-256 list.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {gunzipSync,unzipSync,zipSync} from 'fflate';

const app=path.resolve('..'),out=path.resolve('../../release'),cache=path.resolve('.release-cache');
const NODE_LINE='v24';
const targets=[
 {name:'Windows',launcher:'Start_Casebook_Windows.cmd',nodes:[{dist:'win-x64',ext:'zip',as:'node.exe'}]},
 {name:'Mac',launcher:'Start_Casebook_Mac_Linux.command',nodes:[{dist:'darwin-arm64',ext:'tar.gz',as:'node-arm64'},{dist:'darwin-x64',ext:'tar.gz',as:'node-x64'}]},
 {name:'Linux',launcher:'Start_Casebook_Mac_Linux.command',nodes:[{dist:'linux-x64',ext:'tar.gz',as:'node-x64'},{dist:'linux-arm64',ext:'tar.gz',as:'node-arm64'}]},
];

async function get(url){const r=await fetch(url);if(!r.ok)throw Error(`Download failed (${r.status}): ${url}`);return new Uint8Array(await r.arrayBuffer());}
const sha256=(b)=>crypto.createHash('sha256').update(b).digest('hex');

// Minimal tar reader: returns the files whose path (minus the top folder) is one of `wanted`.
function untar(bytes,wanted){
 const found={};let i=0,longName='';
 while(i+512<=bytes.length){
  const h=bytes.subarray(i,i+512);if(h.every(b=>b===0))break;
  const str=(a,n)=>new TextDecoder().decode(h.subarray(a,a+n)).replace(/\0.*$/s,'');
  const size=parseInt(str(124,12).trim()||'0',8),type=str(156,1),prefix=str(345,155);
  let name=longName||(prefix?prefix+'/':'')+str(0,100);longName='';
  const body=bytes.subarray(i+512,i+512+size);
  if(type==='L')longName=new TextDecoder().decode(body).replace(/\0.*$/s,'');
  else if(type==='x'){const m=/\d+ path=([^\n]+)\n/.exec(new TextDecoder().decode(body));if(m)longName=m[1];}
  else if(type==='0'||type==='\0'||type===''){const rel=name.replace(/^[^/]+\//,'');if(wanted.includes(rel))found[rel]=body.slice();}
  i+=512+Math.ceil(size/512)*512;
 }
 return found;
}

function walk(dir,base=dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const p=path.join(dir,e.name);return e.isDirectory()?walk(p,base):[path.relative(base,p).split(path.sep).join('/')];});}

const index=JSON.parse(new TextDecoder().decode(await get('https://nodejs.org/dist/index.json')));
const version=index.find(v=>v.version.startsWith(NODE_LINE+'.')&&v.lts)?.version;
if(!version)throw Error(`No ${NODE_LINE} LTS release found on nodejs.org.`);
const sums=Object.fromEntries(new TextDecoder().decode(await get(`https://nodejs.org/dist/${version}/SHASUMS256.txt`)).trim().split('\n').map(l=>l.trim().split(/\s+/).reverse()));
console.log(`Bundling Node ${version}`);
fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(out,{recursive:true});

const common=['START_HERE.txt','THIRD_PARTY_NOTICES.txt','server.mjs',...walk(path.join(app,'public')).map(f=>'public/'+f)];
const exec=0o100755<<16,plain=0o100644<<16,root='IO_Shield_Casebook_Studio/';
for(const t of targets){
 const files={};
 for(const f of [...common,t.launcher])files[root+f]=[new Uint8Array(fs.readFileSync(path.join(app,f))),{os:3,attrs:f===t.launcher?exec:plain}];
 for(const n of t.nodes){
  const file=`node-${version}-${n.dist}.${n.ext}`,local=path.join(cache,file);
  let bytes=fs.existsSync(local)?new Uint8Array(fs.readFileSync(local)):await get(`https://nodejs.org/dist/${version}/${file}`);
  if(sha256(bytes)!==sums[file])throw Error(`Checksum mismatch for ${file}. Delete source/.release-cache and try again.`);
  fs.writeFileSync(local,bytes);
  let node,license;
  if(n.ext==='zip'){const z=unzipSync(bytes,{filter:f=>/^[^/]+\/(node\.exe|LICENSE)$/.test(f.name)});for(const [k,v]of Object.entries(z)){if(k.endsWith('/node.exe'))node=v;else license=v;}}
  else{const found=untar(gunzipSync(bytes),['bin/node','LICENSE']);node=found['bin/node'];license=found.LICENSE;}
  if(!node||!license)throw Error(`Could not find node in ${file}.`);
  files[root+'runtime/'+n.as]=[node,{os:3,attrs:exec}];
  files[root+'runtime/NODE_LICENSE.txt']=[license,{os:3,attrs:plain}];
 }
 const zip=path.join(out,`IO_Shield_Casebook_Studio_${t.name}.zip`);
 fs.writeFileSync(zip,zipSync(files,{level:6}));
 console.log(`${path.relative(process.cwd(),zip)}  ${(fs.statSync(zip).size/1048576).toFixed(0)} MB`);
}
console.log('Upload these zips to a GitHub release.');
