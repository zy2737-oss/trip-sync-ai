import { env } from "cloudflare:workers";
import { ZodError } from "zod";
import { GroupError } from "./group-store";

export const groupHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
export async function groupApi(run:(db:D1Database)=>Promise<unknown>) {
  try {
    if(!env.DB) throw new GroupError(503,"Shared storage is not connected yet. Please try again after deployment.");
    return Response.json(await run(env.DB),{headers:groupHeaders});
  } catch(error) {
    const status=error instanceof GroupError?error.status:error instanceof ZodError?400:500;
    const message=error instanceof GroupError?error.message:error instanceof ZodError?"Please check the nickname, invitation and questionnaire values.":"Could not update the group. Please try again.";
    return Response.json({message},{status,headers:groupHeaders});
  }
}
