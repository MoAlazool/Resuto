import {NetlifyDB} from '@netlify/database-dev';
const db=new NetlifyDB({logger:()=>{}});
process.env.DATABASE_URL=await db.start();process.env.NETLIFY_DB_URL=process.env.DATABASE_URL;
process.env.APP_ORIGIN='https://resuto.example';process.env.MANAGER_PASSWORD='bundled-manager-test';process.env.KITCHEN_PASSWORD='bundled-kitchen-test';
let bundled;
try{await db.applyMigrations('netlify/database/migrations');bundled=await import('../artifacts/netlify-unpacked/netlify/functions/api.mjs');const response=await bundled.handler({httpMethod:'GET',path:'/.netlify/functions/api/api/public',headers:{host:'resuto.example'},requestContext:{identity:{sourceIp:'127.0.0.1'}},queryStringParameters:{}},{});if(response.statusCode!==200||JSON.parse(response.body).tables.length!==6)throw Error('Bundled API failed');console.log('PASS deployed ESM bundle imports and serves persisted public data through Netlify rewrite.');}finally{await bundled?.closeDatabase();await db.stop();}
