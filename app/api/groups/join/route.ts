import { groupApi } from "@/lib/group-api";
import { joinGroup } from "@/lib/group-store";
export async function POST(request:Request) { return groupApi(db=>joinGroup(db,request)); }
