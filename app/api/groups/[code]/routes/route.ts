import { groupApi } from "@/lib/group-api";
import { checkGroupRoute } from "@/lib/group-evidence";
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){const {code}=await params;return groupApi(db=>checkGroupRoute(db,code,request));}
