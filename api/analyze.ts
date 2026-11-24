import { validateRequest } from '../core/index.js';
import { createCapacityAnalyzer } from './_lib/capacity.js';
import { json } from './_lib/http.js';
const analyzeWithCapacity=createCapacityAnalyzer();
import type { IncomingMessage, ServerResponse } from 'node:http';
export interface ApiRequest extends IncomingMessage { body?: unknown }
export async function readBody(req:ApiRequest):Promise<unknown>{
  if(req.body!==undefined)return typeof req.body==='string'?JSON.parse(req.body):req.body;
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000)throw new Error('Request too large');}return JSON.parse(body);
}
export default async function handler(req:ApiRequest,res:ServerResponse){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'Use POST'});}
  let body;try{body=await readBody(req);validateRequest(body);}catch{return json(res,400,{error:'Invalid JSON, listing, profile, or mode'});}
  try{return json(res,200,await analyzeWithCapacity(body,(Array.isArray(req.headers['x-forwarded-for'])?req.headers['x-forwarded-for'][0]:req.headers['x-forwarded-for'])?.split(',')[0].trim()||req.socket?.remoteAddress||'unknown'));}catch{return json(res,500,{error:'Analysis failed'});}
}
