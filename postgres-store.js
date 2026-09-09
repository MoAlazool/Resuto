// A row lock serializes single-restaurant domain transactions across function instances.
export function postgresStore(pool) {
  const transaction=async fn=>{const client=await pool.connect();try{await client.query('BEGIN');const {rows}=await client.query('SELECT document FROM resuto_state WHERE id=1 FOR UPDATE');if(!rows.length)throw Error('Database is not initialized');const state=rows[0].document;const result=await fn(state);await client.query('UPDATE resuto_state SET document=$1 WHERE id=1',[JSON.stringify(state)]);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}};
  const schema=`CREATE TABLE IF NOT EXISTS resuto_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  document JSONB NOT NULL
)`;
  return {async initialize(seed,migrate){await pool.query(schema);await pool.query('INSERT INTO resuto_state (id, document) VALUES (1,$1) ON CONFLICT (id) DO NOTHING',[JSON.stringify(seed())]);await transaction(migrate);},async read(){return (await pool.query('SELECT document FROM resuto_state WHERE id=1')).rows[0].document;},transaction};
}
