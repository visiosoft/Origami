require('dotenv').config();
const sql = require('mssql');
(async () => {
  const p = await sql.connect({ server: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, options: { encrypt: true } });
  const q = async (s) => (await p.request().query(s)).recordset;
  console.log(await q("select id,name,stage from projects order by id"));
  console.log(await q("select id,companyName,contactPerson,email,userId,status from contractors"));
  console.log(await q("select id,number,contractorId,projectId,status from commitments"));
  console.log(await q("select id,name,email,tier,kind,projects from people where tier in ('Client','Consultant')"));
  console.log(await q("select id,name,email,tier,roleKey,status from users"));
  console.log(await q("select [key],tier,permissions from roles where [key] in ('client','vendor_portal')"));
  console.log(await q("select max(id) m from people"));
  await p.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
