import {defineConfig} from 'vite';
import path from 'node:path';
import tailwind from '@tailwindcss/postcss';
export default defineConfig({root:path.resolve('web'),resolve:{alias:{'@':path.resolve('.')}},css:{postcss:{plugins:[tailwind()]}},build:{outDir:path.resolve('../public'),emptyOutDir:true}});
