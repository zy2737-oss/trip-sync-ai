import { groupApi } from "@/lib/group-api";
import { acceptPlan } from "@/lib/group-store";
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}) { const {code}=await params; return groupApi(db=>acceptPlan(db,code,request)); }
