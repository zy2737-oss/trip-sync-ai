// Planning is authorized and assembled from stored profiles by the group endpoint.
export async function POST() {
  return Response.json({message:"Join a group and ask its organizer to generate the itinerary."},{status:410,headers:{"Cache-Control":"no-store"}});
}
