require('dotenv').config();
const sql = require('mssql');
const crypto = require('crypto');
const { hashPassword, verifyPassword } = require('../dist/auth/crypto.util');
const pw = (tag) => `${tag}-${crypto.randomBytes(3).toString('hex')}!`;
(async () => {
  const p = await sql.connect({ server: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASS, database: process.env.DB_NAME, options: { encrypt: true } });
  const r = () => p.request();
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const out = {};
  const exists = async (email) => (await r().input('e', email).query('select id from users where lower(email)=lower(@e)')).recordset.length;

  // ---- sample client: linked to project 8 through the People directory
  const clientEmail = 'demo-client@origami.example';
  if (!(await exists(clientEmail))) {
    const pass = pw('Client');
    await r().input('id', 'U-DEMOCLIENT').input('name', 'Demo Client').input('email', clientEmail).input('h', hashPassword(pass)).input('at', now).input('d', today)
      .query("insert into users (id,name,email,tier,roleKey,status,createdAt,passwordHash,passwordSetAt) values (@id,@name,@email,'client','client','active',@d,@h,@at)");
    const pid = (await r().query('select max(id)+1 n from people')).recordset[0].n;
    await r().input('id', pid).input('email', clientEmail)
      .query(`insert into people (id,name,role,company,kind,tier,phone,email,projects,openTasks,since,last,categories) values (@id,'Demo Client','Owner (sample login)','Demo Client','Client','Client','',@email,'["Origami DB Development"]',0,'${today.slice(0, 4)}','Today','["Client"]')`);
    out.client = { email: clientEmail, password: pass, personId: pid };
  } else out.client = 'already exists';

  // ---- sample subcontractor: portal login for Ehsan Afzal's company (SC-001 on project 8)
  const subEmail = 'demo-sub@origami.example';
  if (!(await exists(subEmail))) {
    const pass = pw('Sub');
    await r().input('id', 'U-VDEMOSUB').input('name', 'Demo Subcontractor').input('email', subEmail).input('h', hashPassword(pass)).input('at', now).input('d', today)
      .query("insert into users (id,name,email,tier,roleKey,status,createdAt,passwordHash,passwordSetAt) values (@id,@name,@email,'consultant','vendor_portal','active',@d,@h,@at)");
    await r().input('u', 'U-VDEMOSUB').input('at', now).query("update contractors set userId=@u, updatedAt=@at where id='CTR-MUFLD0PQ0AJ2' and userId is null");
    out.sub = { email: subEmail, password: pass };
  } else out.sub = 'already exists';

  console.log(JSON.stringify(out, null, 2));
  console.log((await r().query("select u.id,u.email,u.tier,u.roleKey,u.status,c.companyName from users u left join contractors c on c.userId=u.id where u.id in ('U-DEMOCLIENT','U-VDEMOSUB')")).recordset);
  for (const k of ['client', 'sub']) if (out[k].password) {
    const h = (await r().input('e', out[k].email).query('select passwordHash from users where email=@e')).recordset[0].passwordHash;
    console.log(k, 'password verifies:', verifyPassword(out[k].password, h));
  }
  await p.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
