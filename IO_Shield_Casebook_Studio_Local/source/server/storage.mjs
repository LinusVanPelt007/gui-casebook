import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import schema from './schema.sql';
export const appRoot=path.dirname(fileURLToPath(import.meta.url));
export const dataRoot=path.resolve(process.env.CASEBOOK_DATA_DIR||path.join(appRoot,'data'));
fs.mkdirSync(path.join(dataRoot,'objects'),{recursive:true});
const database=new DatabaseSync(path.join(dataRoot,'casebooks.sqlite'));
database.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
const version=database.prepare('PRAGMA user_version').get().user_version;
if(version===0){database.exec('BEGIN');try{database.exec(schema.replaceAll('--> statement-breakpoint',''));database.exec('PRAGMA user_version=1; COMMIT;');}catch(e){database.exec('ROLLBACK');throw e;}}
if(version>1)throw Error('This data folder needs a newer Casebook Studio release.');
const prepared=(sql,values=[])=>({bind(...v){return prepared(sql,v);},async run(){const r=database.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};},async first(){return database.prepare(sql).get(...values)??null;},async all(){return {results:database.prepare(sql).all(...values)};}});
const objectPath=key=>{if(!/^[A-Za-z0-9_./-]+$/.test(key)||key.split('/').includes('..'))throw Error('Invalid file key.');return path.join(dataRoot,'objects',...key.split('/'));};
export const env={DB:{prepare:prepared,async batch(statements){database.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());database.exec('COMMIT');return result;}catch(e){database.exec('ROLLBACK');throw e;}}},BUCKET:{async put(key,bytes){const filename=objectPath(key);fs.mkdirSync(path.dirname(filename),{recursive:true});const temp=filename+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(temp,new Uint8Array(bytes));fs.renameSync(temp,filename);},async get(key){const filename=objectPath(key);if(!fs.existsSync(filename))return null;const bytes=fs.readFileSync(filename);return {body:bytes,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};}}};
export function closeStorage(){database.close();}
