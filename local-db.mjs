// SQLite adapter used only in automated tests and loopback development, never in the deployed Worker.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export function localDatabase(file=':memory:'){
  const sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  for(const name of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()){
    if(sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name))continue;
    sqlite.exec('BEGIN');try{sqlite.exec(readFileSync('drizzle/'+name,'utf8'));sqlite.prepare('INSERT INTO local_migrations VALUES (?)').run(name);sqlite.exec('COMMIT');}catch(e){sqlite.exec('ROLLBACK');throw e;}
  }
  sqlite.exec('PRAGMA optimize');
  return {sqlite,async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(statement.execute());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},prepare(sql){return{bind(...values){const statement=sqlite.prepare(sql);return{execute(){return{meta:statement.run(...values)}},async first(){return statement.get(...values)||null},async all(){return{results:statement.all(...values)}},async run(){return{meta:statement.run(...values)}}}}}}};
}
