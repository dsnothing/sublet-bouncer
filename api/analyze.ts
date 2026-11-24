import { analyze, validateRequest } from '../core/index';
import { createGeminiAdapter } from './gemini';
import type { IncomingMessage, ServerResponse } from 'node:http';
export interface ApiRequest extends IncomingMessage { body?: unknown }
export async function readBody(req:ApiRequest):Promise<unknown>{
  if(req.body!==undefined)return typeof req.body==='string'?JSON.parse(req.body):req.body;
  let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>100000)throw new Error('Request too large');}return JSON.parse(body);
}
export function json(res:ServerResponse,status:number,body:unknown){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(body));}
export default async function handler(req:ApiRequest,res:ServerResponse){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{error:'Use POST'});}
  let body;try{body=await readBody(req);validateRequest(body);}catch{return json(res,400,{error:'Invalid JSON, listing, profile, or mode'});}
  try{return json(res,200,await analyze(body,{llm:createGeminiAdapter()}));}catch{return json(res,500,{error:'Analysis failed'});}
}
