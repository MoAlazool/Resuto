import serverless from 'serverless-http';
import pg from 'pg';
import {getStore} from '@netlify/blobs';
import {createApp} from '../../server.js';
import {postgresStore} from '../../postgres-store.js';
import {blobMediaStore} from '../../media-store.js';
let app,pool;
export const closeDatabase=async()=>{await pool?.end();app=null;pool=null;};
export const handler=async(event,context)=>{
  if(!app){
    const origin=process.env.APP_ORIGIN||process.env.URL;
    if(!origin?.startsWith('https://')||!process.env.MANAGER_PASSWORD||!process.env.KITCHEN_PASSWORD)throw Error('Configure HTTPS APP_ORIGIN and staff passwords before launch.');
    // Any Postgres works: Netlify's own database when the account has it,
    // otherwise a DATABASE_URL from Neon, Supabase or anywhere else.
    const connectionString=process.env.NETLIFY_DB_URL||process.env.DATABASE_URL;
    if(!connectionString)throw Error('Set DATABASE_URL to a Postgres connection string before launch.');
    pool=new pg.Pool({connectionString,max:4,ssl:/localhost|127\.0\.0\.1/.test(connectionString)?false:{rejectUnauthorized:false}});
    pool.on('error',()=>console.error('Database connection lost. The next request will reconnect.'));
    const application=createApp({origin,storage:postgresStore(pool),mediaStore:blobMediaStore(getStore('resuto-media'))});
    await application.ready;
    app=serverless(application.handler);
  }
  event.path=event.path.replace(/^\/\.netlify\/functions\/api(?=\/)/,'');
  return app(event,context);
};
