import { env } from "cloudflare:workers";
import { groupApi } from "@/lib/group-api";
import { generateGroupPlan } from "@/lib/group-store";
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){const {code}=await params;return groupApi(db=>generateGroupPlan(db,code,request,env.DEEPSEEK_API_KEY,env.DEEPSEEK_MODEL,fetch,true));}
