import { getChatGPTUser } from "../../chatgpt-auth";
import { sitesStore } from "../../../lib/cms-store";
import { handleApi } from "../../../core/cms.mjs";
export const dynamic = "force-dynamic";
async function dispatch(request:Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error:"Bitte zuerst anmelden." },{ status:401 });
  // Owner-private Werkstatt. Vor zusätzlicher Freigabe sind CMS-Rollen erforderlich.
  return handleApi(request,sitesStore(),user.userId);
}
export const GET = dispatch;
export const POST = dispatch;
export const PUT = dispatch;
export const DELETE = dispatch;
