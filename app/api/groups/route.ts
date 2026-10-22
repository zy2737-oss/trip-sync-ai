import { groupApi } from "@/lib/group-api";
import { createGroup } from "@/lib/group-store";
export async function POST(request:Request) { return groupApi(db=>createGroup(db,request)); }
