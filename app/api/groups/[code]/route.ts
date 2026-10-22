import { groupApi } from "@/lib/group-api";
import { snapshot, deleteGroup } from "@/lib/group-store";
type Context={params:Promise<{code:string}>};
export async function GET(request:Request,{params}:Context) { const {code}=await params; return groupApi(db=>snapshot(db,code,request)); }
export async function DELETE(request:Request,{params}:Context) { const {code}=await params; return groupApi(db=>deleteGroup(db,code,request)); }
