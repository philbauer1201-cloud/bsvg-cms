import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from './http-server.mjs';
export {startServer};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const app=await startServer();
  console.log(`BSVG CMS: http://${process.env.CMS_HOST??'127.0.0.1'}:${app.server.address().port}`);
  if(process.argv.includes('--local-preview'))console.log('Lokale Entwicklungswerkstatt unter /werkstatt. Eigene Anmeldung unter /anmelden. Nur auf diesem Rechner.');
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}
