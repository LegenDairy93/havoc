import { headers, json } from "../../../lib/http";
export function OPTIONS(request:Request){return new Response(null,{status:204,headers:headers(request)})}
export function GET(request:Request){return json(request,{configured:Boolean(process.env.OPENROUTER_API_KEY?.startsWith("sk-or-")),mode:"hosted-demo",packs:4})}