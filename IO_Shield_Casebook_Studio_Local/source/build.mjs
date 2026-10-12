import fs from 'node:fs';
import path from 'node:path';
import {build as bundle} from 'esbuild';
import {build as frontend} from 'vite';
await frontend({configFile:path.resolve('vite.config.mjs')});
await bundle({entryPoints:['server/main.mjs'],bundle:true,platform:'node',format:'esm',target:'node22',outfile:'../server.mjs',alias:{'@':path.resolve('.'),'@/app/chatgpt-auth':path.resolve('server/local-auth.mjs'),'cloudflare:workers':path.resolve('server/storage.mjs')},loader:{'.sql':'text'}});
fs.copyFileSync('web/favicon.svg','../public/favicon.svg');
console.log('Local application rebuilt. Run the launcher in the parent folder.');
