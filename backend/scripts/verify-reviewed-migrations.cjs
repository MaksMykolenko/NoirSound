'use strict';
// Read-only verification of the exact additive SQL reviewed for this release.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function verifyHistory(applied,migrations,reviewed) {
 const names=new Set(migrations.map(m=>m.name));
 for(const a of applied) {
  if(a.rolled_back_at)continue;
  if(!a.finished_at || !names.has(a.migration_name) || migrations.find(m=>m.name===a.migration_name).sha256!==a.checksum)throw new Error('Failed or divergent migration history.');
 }
 const done=new Set(applied.filter(a=>a.finished_at&&!a.rolled_back_at).map(a=>a.migration_name));const pending=migrations.filter(m=>!done.has(m.name));
 if(!pending.length)throw new Error('Migration status failed without a pending reviewed migration.');
 for(const m of pending)if(reviewed[m.name]!==m.sha256)throw new Error('Unreviewed pending migration.');
 return pending.map(m=>m.name);
}
async function main(){
 const reviewed=JSON.parse(fs.readFileSync(path.join(root,'prisma/reviewed-additive-migrations.json')));
 const dir=path.join(root,'prisma/migrations');const migrations=fs.readdirSync(dir,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>({name:d.name,sha256:digest(fs.readFileSync(path.join(dir,d.name,'migration.sql')))}));
 const {createPrismaClient}=require(path.join(root,'src/lib/prisma'));const db=createPrismaClient();
 try {const applied=await db.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`;const pending=verifyHistory(applied,migrations,reviewed);console.log('Verified exact reviewed additive migrations: '+pending.join(', '));}finally{await db.$disconnect();}
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={verifyHistory};
