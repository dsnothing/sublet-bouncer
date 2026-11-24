import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import analyze from './analyze.js';
import health from './health.js';
if(existsSync('.env'))process.loadEnvFile('.env');
const server=createServer((req,res)=>{
  const path=new URL(req.url??'/', 'http://localhost').pathname;
  if(path==='/api/analyze')void analyze(req,res);
  else if(path==='/api/health')health(req,res);
  else {res.statusCode=404;res.end('Not found');}
});
server.listen(Number(process.env.PORT??8787),'127.0.0.1',()=>console.log('Sublet Bouncer API listening on http://127.0.0.1:'+String(process.env.PORT??8787)));
