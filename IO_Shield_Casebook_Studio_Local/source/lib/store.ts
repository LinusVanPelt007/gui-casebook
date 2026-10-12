import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){const b=(env as any).DB;if(!b)throw Error('Casebook storage is temporarily unavailable.');return b;}
export function bucket(){const b=(env as any).BUCKET;if(!b)throw Error('File storage is temporarily unavailable.');return b;}
export async function identity(){const u=await getChatGPTUser();if(!u)throw new Response('Sign in to access your casebooks.',{status:401});return u.userId;}
export async function owned(id:string,owner:string){const b=await db().prepare('SELECT * FROM casebooks WHERE id=? AND owner=?').bind(id,owner).first();if(!b)throw new Response('Casebook not found.',{status:404});return b;}
