import { groupApi } from "@/lib/group-api";
import { searchGroupActivities } from "@/lib/activity-search";
export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){const {code}=await params;return groupApi(db=>searchGroupActivities(db,code,request));}
