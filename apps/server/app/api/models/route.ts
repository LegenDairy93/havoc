import { clean, headers, json } from "../../../lib/http";
// @ts-ignore bundled JavaScript runner
import { fetchFreeModels } from "../../../lib/runner/openrouter.js";
let cache:{at:number;data:any[]}={at:0,data:[]};
export function OPTIONS(request:Request){return new Response(null,{status:204,headers:headers(request)})}
export async function GET(request:Request){const key=process.env.OPENROUTER_API_KEY;if(!key)return json(request,{configured:false,models:[]},503);try{if(Date.now()-cache.at>300000||!cache.data.length)cache={at:Date.now(),data:await fetchFreeModels(key,{signal:AbortSignal.timeout(20000)})};return json(request,{configured:true,models:cache.data})}catch(error){return json(request,{error:clean(error),models:[]},502)}}