import type { IncomingMessage,ServerResponse } from 'node:http';
import { json } from './_lib/http.js';
export default function handler(req:IncomingMessage,res:ServerResponse){if(req.method!=='GET')return json(res,405,{error:'Use GET'});return json(res,200,{ok:true,liveConfigured:!!process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL??'gemini-3-flash-preview'});}
