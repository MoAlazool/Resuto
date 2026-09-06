import serverless from 'serverless-http';
import {getDatabase} from '@netlify/database';
import {createApp} from '../../server.js';
import {postgresStore} from '../../postgres-store.js';
let app,database;
export const closeDatabase=async()=>{await database?.pool.end();app=null;database=null;};
export const handler=async(event,context)=>{
  if(!app){
    const origin=process.env.APP_ORIGIN||process.env.URL;
    if(!origin?.startsWith('https://')||!process.env.MANAGER_PASSWORD||!process.env.KITCHEN_PASSWORD)throw Error('Configure HTTPS APP_ORIGIN and staff passwords before launch.');
    database=getDatabase({connectionString:process.env.NETLIFY_DB_URL||process.env.DATABASE_URL});
    database.pool.on('error',()=>console.error('Database connection lost. The next request will reconnect.'));
    const application=createApp({origin,storage:postgresStore(database.pool)});
    await application.ready;
    app=serverless(application.handler);
  }
  event.path=event.path.replace(/^\/\.netlify\/functions\/api(?=\/)/,'');
  return app(event,context);
};
