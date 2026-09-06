import {zipFunctions} from '@netlify/zip-it-and-ship-it';
import {mkdir} from 'node:fs/promises';
await mkdir('artifacts/netlify-functions',{recursive:true});
const results=await zipFunctions('netlify/functions','artifacts/netlify-functions',{config:{'*':{nodeBundler:'esbuild',nodeModuleFormat:'esm',nodeVersion:'24.x',externalNodeModules:['@netlify/database','pg','qrcode','serverless-http']}}});
for(const result of results)console.log(`Packaged ${result.name}: ${result.path}`);
