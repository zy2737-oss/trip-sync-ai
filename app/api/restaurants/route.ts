import { env } from "cloudflare:workers";
import { groupApi } from "@/lib/group-api";
import { groupRestaurants } from "@/lib/group-restaurants";

export async function GET(request: Request) {
  return groupApi(db=>groupRestaurants(db,request,env.GOOGLE_PLACES_API_KEY));
}
