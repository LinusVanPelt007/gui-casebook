import {createRoot} from 'react-dom/client';
import Studio from '../app/studio';
import '../app/globals.css';
import '../app/studio.css';
let saved:string|null=null;try{saved=localStorage.getItem('theme');}catch{}
document.documentElement.classList.toggle('dark',saved==='dark');
createRoot(document.getElementById('root')!).render(<Studio displayName="Local user"/>);
