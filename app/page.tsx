import CMS from "./cms";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getChatGPTUser();
  if (!user) return <main className="signin"><img className="school-logo" src="/bsvg-logo.svg" alt="Berufsschule Vöcklabruck-Gmunden" width={340} height={248}/><h1>Verwaltung</h1><p>Melde dich an, um die Verwaltung zu öffnen.</p><a className="button primary" href={chatGPTSignInPath("/")} target="_top">Anmelden</a></main>;
  return <CMS displayName={user.displayName} mode="sites" />;
}

