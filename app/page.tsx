import CMS from "./cms";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await getChatGPTUser();
  if (!user) return <main className="signin"><img className="school-logo" src="/bsvg-logo.svg" alt="Berufsschule Vöcklabruck-Gmunden" width={340} height={248}/><h1>Willkommen in der CMS-Werkstatt.</h1><p>Diese Entwicklungsumgebung ist geschützt. Eigene CMS-Benutzerkonten folgen im nächsten Ausbauschritt.</p><a className="button primary" href={chatGPTSignInPath("/")} target="_top">Werkstatt öffnen</a></main>;
  return <CMS displayName={user.displayName} mode="sites" />;
}

