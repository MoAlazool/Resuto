// Explicit offline transfer: never overwrite an existing hosted restaurant.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import pg from 'pg';
import {migrateFloor} from '../floor-domain.js';
const source=process.argv[2];
if(!source||!(process.env.DATABASE_URL||process.env.NETLIFY_DB_URL))throw Error('Usage: set DATABASE_URL privately, then node scripts/migrate-to-postgres.mjs path/to/resuto.sqlite');
const local=new DatabaseSync(source,{readOnly:true});let state;try{state=JSON.parse(local.prepare('SELECT json FROM state WHERE id=1').get().json)}finally{local.close();}
migrateFloor(state);state.sessions=[];
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL||process.env.NETLIFY_DB_URL});const client=await pool.connect();
try{await client.query('BEGIN');await client.query(readFileSync('netlify/database/migrations/001_state.sql','utf8'));await client.query('LOCK TABLE resuto_state IN EXCLUSIVE MODE');if((await client.query('SELECT id FROM resuto_state')).rows.length)throw Error('Target already contains a restaurant. Refusing to overwrite it. Import before opening the hosted app.');await client.query('INSERT INTO resuto_state(id,document) VALUES(1,$1)',[JSON.stringify(state)]);await client.query('COMMIT');console.log('Restaurant transferred with table IDs, QR identifiers, reservations, orders and balances preserved. Staff sessions cleared.');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await pool.end();}
