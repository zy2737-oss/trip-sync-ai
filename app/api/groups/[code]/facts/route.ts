import { groupApi } from "@/lib/group-api";
import { checkGroupFacts } from "@/lib/group-evidence";
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){const {code}=await params;return groupApi(db=>checkGroupFacts(db,code,request));}
