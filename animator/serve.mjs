import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, normalize, join } from 'node:path';
const root = process.cwd();
const types = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
createServer(async (req,res)=>{
  try{
    let p = decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/demo.html';
    const f = join(root, normalize(p));
    const data = await readFile(f);
    res.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream'}); res.end(data);
  }catch(e){ res.writeHead(404); res.end('404'); }
}).listen(8078, ()=>console.log('animator demo on http://localhost:8078/demo.html'));
