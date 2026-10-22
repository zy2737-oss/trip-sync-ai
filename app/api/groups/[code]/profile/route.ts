import { groupApi } from "@/lib/group-api";
import { saveProfile } from "@/lib/group-store";
export async function PUT(request:Request,{params}:{params:Promise<{code:string}>}) { const {code}=await params; return groupApi(db=>saveProfile(db,code,request)); }
