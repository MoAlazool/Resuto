import test from 'node:test';
import assert from 'node:assert/strict';
import {NetlifyDB} from '@netlify/database-dev';
import pg from 'pg';
import serverless from 'serverless-http';
import {createApp} from '../server.js';
import {postgresStore} from '../postgres-store.js';
test('Netlify Postgres migration, cold starts, atomic writes and Lambda adapter',async()=>{
 const emulator=new NetlifyDB({logger:()=>{}}),connectionString=await emulator.start(),pool=new pg.Pool({connectionString,max:4});
 try{
 const a=createApp({storage:postgresStore(pool),origin:'https://resuto.example',managerPassword:'manager-test',kitchenPassword:'kitchen-test'});await a.ready;
 const first=await a.read();const b=createApp({storage:postgresStore(pool),origin:'https://resuto.example',managerPassword:'manager-test',kitchenPassword:'kitchen-test'});await b.ready;assert.deepEqual((await b.read()).tables.map(t=>t.qr),first.tables.map(t=>t.qr));
 const lambda=serverless(a.handler);const invoke=async(path,body,cookie,token)=>{const r=await lambda({httpMethod:body?'POST':'GET',path,headers:{host:'resuto.example','content-type':'application/json',...(cookie?{cookie}:{}),...(token?{authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):null,requestContext:{identity:{sourceIp:'127.0.0.1'}},queryStringParameters:{}},{});return {...r,data:JSON.parse(r.body)};};
 const login=await invoke('/api/login',{role:'manager',password:'manager-test'});assert.equal(login.statusCode,200);const cookie=(login.multiValueHeaders?.['set-cookie']?.[0]||login.headers['set-cookie']).split(';')[0];
 await invoke('/api/seat',{tableId:'t1'},cookie);const session=await invoke('/api/table-session',{qr:first.tables[0].qr});assert.ok(session.data.token);
 const orders=await Promise.all([invoke('/api/order',{lines:[{id:'m0',qty:10,price:14500}],key:'one'},null,session.data.token),invoke('/api/order',{lines:[{id:'m0',qty:10,price:14500}],key:'two'},null,session.data.token)]);assert.deepEqual(orders.map(r=>r.statusCode).sort(),[200,409]);assert.equal((await b.read()).menu[0].stock,8);assert.equal((await b.read()).orders.length,1);
 const store=postgresStore(pool);await assert.rejects(store.transaction(s=>{s.menu[0].stock=0;throw Error('rollback')}));assert.equal((await a.read()).menu[0].stock,8);
 }finally{await pool.end();await emulator.stop();}
});
