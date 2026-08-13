const express=require("express"), path=require("path"), fs=require("fs"), Database=require("better-sqlite3"), bcrypt=require("bcryptjs"), jwt=require("jsonwebtoken"), cors=require("cors");

const app=express(), PORT=process.env.PORT||3000, SECRET=process.env.JWT_SECRET||"CHANGE_THIS_SECRET_IN_PRODUCTION";

const dataDir=path.join(__dirname,"data");
if(!fs.existsSync(dataDir)) fs.mkdirSync(dataDir,{recursive:true});

const db=new Database(path.join(dataDir,"varouk.db"));
db.pragma("journal_mode=WAL");

app.use(cors());
app.use(express.json({limit:"2mb"}));
app.use(express.static(path.join(__dirname,"public")));

db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,phone TEXT UNIQUE,password_hash TEXT,role TEXT DEFAULT 'customer',created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT UNIQUE,slug TEXT UNIQUE);

CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,slug TEXT UNIQUE,category_id INTEGER,price INTEGER NOT NULL,old_price INTEGER,unit TEXT DEFAULT 'عدد',sku TEXT UNIQUE,stock REAL DEFAULT 0,min_stock REAL DEFAULT 0,active INTEGER DEFAULT 1,description TEXT,emoji TEXT DEFAULT '🛒',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS daily_prices(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,price INTEGER,unit TEXT DEFAULT 'کیلو',supplier TEXT,active INTEGER DEFAULT 1,updated_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS inventory_transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,product_id INTEGER,type TEXT,qty REAL,note TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS addresses(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,title TEXT,address TEXT,postal_code TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS carts(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER UNIQUE,items_json TEXT DEFAULT '[]',updated_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,order_no TEXT UNIQUE,user_id INTEGER,name TEXT,phone TEXT,address TEXT,status TEXT DEFAULT 'pending',subtotal INTEGER,discount INTEGER DEFAULT 0,shipping INTEGER DEFAULT 0,total INTEGER,payment_status TEXT DEFAULT 'unpaid',payment_ref TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER,product_id INTEGER,name TEXT,qty REAL,unit_price INTEGER,unit TEXT);

CREATE TABLE IF NOT EXISTS discounts(id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE,type TEXT,value INTEGER,min_order INTEGER DEFAULT 0,max_uses INTEGER,used_count INTEGER DEFAULT 0,starts_at TEXT,ends_at TEXT,active INTEGER DEFAULT 1);

CREATE TABLE IF NOT EXISTS wholesale_requests(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT,company TEXT,phone TEXT,business_type TEXT,details TEXT,status TEXT DEFAULT 'new',created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,action TEXT,entity TEXT,entity_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

function slug(s){
return s.toString().trim().toLowerCase().replace(/\s+/g,"-").replace(/[^\w\u0600-\u06ff-]/g,"")
}

function seed(){

if(!db.prepare("SELECT 1 FROM users LIMIT 1").get()){

const hash=bcrypt.hashSync("admin12345",10);

db.prepare("INSERT INTO users(name,phone,password_hash,role) VALUES(?,?,?,?)").run("مدیر واروک","09000000000",hash,"admin");

}

if(!db.prepare("SELECT 1 FROM categories LIMIT 1").get()){

const cs=["پروتئینی","لبنیات","مواد غذایی","نوشیدنی","خشکبار","تنقلات","شوینده","سلولزی"];

const ins=db.prepare("INSERT INTO categories(name,slug) VALUES(?,?)");
cs.forEach(x=>ins.run(x,slug(x)));

}

if(!db.prepare("SELECT 1 FROM products LIMIT 1").get()){

const cat=n=>db.prepare("SELECT id FROM categories WHERE name=?").get(n).id;

const ins=db.prepare("INSERT INTO products(name,slug,category_id,price,old_price,unit,sku,stock,min_stock,description,emoji) VALUES(?,?,?,?,?,?,?,?,?,?,?)");

[
["مرغ کامل تازه","مرغ کامل تازه","پروتئینی",345000,null,"کیلو","VRK-CH-001",100,10,"مرغ تازه و باکیفیت","🍗"],
["فیله مرغ","فیله مرغ","پروتئینی",700000,null,"کیلو","VRK-CH-002",70,10,"فیله مرغ تازه","🥩"],
["شنیسل مرغ","شنیسل مرغ","پروتئینی",660000,null,"کیلو","VRK-CH-003",55,8,"شنیسل مرغ","🍗"],
["ران مرغ","ران مرغ","پروتئینی",330000,null,"کیلو","VRK-CH-004",80,10,"ران مرغ تازه","🍗"],
["پنیر پیتزا ۲ کیلویی","پنیر پیتزا ۲ کیلویی","لبنیات",950000,1060000,"بسته","VRK-DA-001",30,5,"پنیر پیتزا دو کیلویی","🧀"],
["نوشابه","نوشابه","نوشیدنی",39000,null,"عدد","VRK-DR-001",200,20,"نوشیدنی","🥤"],
["تخمه اعلا","تخمه اعلا","خشکبار",850000,null,"کیلو","VRK-NK-001",35,5,"تخمه اعلا در چند طعم","🥜"],
["پودر لباسشویی تست ۵۰۰ گرم","پودر لباسشویی تست ۵۰۰ گرم","شوینده",79800,null,"بسته","VRK-CL-001",60,8,"پودر لباسشویی","🧴"]
].forEach(p=>ins.run(p[0],slug(p[1]),cat(p[2]),p[3],p[4],p[5],p[6],p[7],p[8],p[9],p[10]));

}

if(!db.prepare("SELECT 1 FROM daily_prices LIMIT 1").get()){

const ins=db.prepare("INSERT INTO daily_prices(name,price,unit,supplier) VALUES(?,?,?,?)");

[
["مرغ کامل تازه",345000,"کیلو","بهسا (خمین)"],
["شنیسل",660000,"کیلو","بهسا (خمین)"],
["فیله",700000,"کیلو","بهسا (خمین)"],
["ران",330000,"کیلو","بهسا (خمین)"],
["کتف و بال",370000,"کیلو","بهسا (خمین)"],
["جگر",94000,"کیلو","بهسا (خمین)"],
["دل",165000,"کیلو","بهسا (خمین)"],
["سنگدان",215000,"کیلو","بهسا (خمین)"],
["پای مرغ",61000,"کیلو","بهسا (خمین)"]
].forEach(x=>ins.run(...x));

}

}

seed();

function auth(req,res,next){
try{
const h=req.headers.authorization||"";
if(!h.startsWith("Bearer "))return res.status(401).json({error:"ورود لازم است"});
req.user=jwt.verify(h.slice(7),SECRET);
next()
}catch(e){
res.status(401).json({error:"نشست نامعتبر است"})
}
}

function admin(req,res,next){
auth(req,res,()=>req.user.role==="admin"?next():res.status(403).json({error:"دسترسی مدیر لازم است"}))
}

function token(u){
return jwt.sign({id:u.id,name:u.name,phone:u.phone,role:u.role},SECRET,{expiresIn:"7d"})
}

const q=(sql,...a)=>db.prepare(sql).all(...a);
const one=(sql,...a)=>db.prepare(sql).get(...a);

app.get("/api/health",(req,res)=>res.json({ok:true,service:"varouk-store"}));

app.get("/api/categories",(req,res)=>res.json(q("SELECT * FROM categories ORDER BY id")));

app.get("/api/products",(req,res)=>{
let {search="",category="",active="1"}=req.query;
let sql=`SELECT p.*,c.name category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE 1=1`;
let a=[];
if(active==="1"){sql+=" AND p.active=1"}
if(search){sql+=" AND p.name LIKE ?";a.push("%"+search+"%")}
if(category){sql+=" AND c.slug=?";a.push(category)}
res.json(q(sql+" ORDER BY p.id DESC",...a))
});

app.get("/api/products/:id",(req,res)=>{
const p=one("SELECT p.*,c.name category FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=?",req.params.id);
p?res.json(p):res.status(404).json({error:"محصول یافت نشد"})
});

app.get("/api/daily-prices",(req,res)=>res.json(q("SELECT * FROM daily_prices WHERE active=1 ORDER BY id")));

app.post("/api/auth/register",(req,res)=>{
const {name,phone,password}=req.body;
if(!name||!phone||!password)return res.status(400).json({error:"اطلاعات ناقص"});
try{
const r=db.prepare("INSERT INTO users(name,phone,password_hash) VALUES(?,?,?)").run(name,phone,bcrypt.hashSync(password,10));
const u=one("SELECT * FROM users WHERE id=?",r.lastInsertRowid);
res.json({token:token(u),user:{id:u.id,name:u.name,phone:u.phone,role:u.role}})
}catch(e){
res.status(409).json({error:"این شماره قبلاً ثبت شده است"})
}
});

app.post("/api/auth/login",(req,res)=>{
const {phone,password}=req.body;
const u=one("SELECT * FROM users WHERE phone=?",phone);
if(!u||!bcrypt.compareSync(password||"",u.password_hash))return res.status(401).json({error:"شماره یا رمز عبور نادرست است"});
res.json({token:token(u),user:{id:u.id,name:u.name,phone:u.phone,role:u.role}})
});

app.get("/api/me",auth,(req,res)=>res.json(req.user));

app.get("/api/cart",auth,(req,res)=>{
const c=one("SELECT * FROM carts WHERE user_id=?",req.user.id);
res.json(c?JSON.parse(c.items_json):[])
});

app.put("/api/cart",auth,(req,res)=>{
db.prepare("INSERT INTO carts(user_id,items_json) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET items_json=excluded.items_json,updated_at=CURRENT_TIMESTAMP").run(req.user.id,JSON.stringify(req.body.items||[]));
res.json({ok:true})
});

app.post("/api/orders",auth,(req,res)=>{
const {items=[],name,phone,address,discountCode=""}=req.body;
if(!items.length)return res.status(400).json({error:"سبد خرید خالی است"});
let subtotal=0,clean=[];

for(const i of items){
const p=one("SELECT * FROM products WHERE id=? AND active=1",i.productId);
if(!p)return res.status(400).json({error:"محصول نامعتبر"});
const qty=Number(i.qty);
if(qty<=0||qty>p.stock)return res.status(400).json({error:`موجودی ${p.name} کافی نیست`});
subtotal+=p.price*qty;
clean.push({p,qty})
}

let discount=0;

if(discountCode){
const d=one("SELECT * FROM discounts WHERE code=? AND active=1",discountCode);
if(d&&subtotal>=d.min_order&&(!d.max_uses||d.used_count<d.max_uses)){
discount=d.type==="percent"?Math.floor(subtotal*d.value/100):d.value
}
}

const total=Math.max(0,subtotal-discount);
const no="VRK-"+Date.now().toString().slice(-8);

const tx=db.transaction(()=>{
const o=db.prepare("INSERT INTO orders(order_no,user_id,name,phone,address,subtotal,discount,total) VALUES(?,?,?,?,?,?,?,?)").run(no,req.user.id,name||req.user.name,phone||req.user.phone,address||"",subtotal,discount,total);

const oi=db.prepare("INSERT INTO order_items(order_id,product_id,name,qty,unit_price,unit) VALUES(?,?,?,?,?,?)");

const inv=db.prepare("UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=?");

const it=db.prepare("INSERT INTO inventory_transactions(product_id,type,qty,note) VALUES(?,?,?,?)");

for(const x of clean){
oi.run(o.lastInsertRowid,x.p.id,x.p.name,x.qty,x.p.price,x.p.unit);
inv.run(x.qty,x.p.id);
it.run(x.p.id,"sale",-x.qty,`سفارش ${no}`)
}

db.prepare("DELETE FROM carts WHERE user_id=?").run(req.user.id);

return o.lastInsertRowid
});

const id=tx();

res.status(201).json(one("SELECT * FROM orders WHERE id=?",id))
});

app.get("/api/orders",auth,(req,res)=>res.json(q("SELECT * FROM orders WHERE user_id=? ORDER BY id DESC",req.user.id)));

app.post("/api/wholesale",(req,res)=>{
const {name,company,phone,businessType,details}=req.body;
if(!name||!phone)return res.status(400).json({error:"نام و شماره تماس الزامی است"});
const r=db.prepare("INSERT INTO wholesale_requests(name,company,phone,business_type,details) VALUES(?,?,?,?,?)").run(name,company||"",phone,businessType||"",details||"");
res.status(201).json({id:r.lastInsertRowid,message:"درخواست ثبت شد"})
});

app.get("/api/admin/stats",admin,(req,res)=>{
const sales=one("SELECT COALESCE(SUM(total),0) x FROM orders WHERE date(created_at)=date('now')").x;
const orders=one("SELECT COUNT(*) x FROM orders WHERE date(created_at)=date('now')").x;
const customers=one("SELECT COUNT(*) x FROM users WHERE role='customer'").x;
const low=one("SELECT COUNT(*) x FROM products WHERE active=1 AND stock<=min_stock").x;
res.json({sales,orders,customers,low})
});

app.get("/api/admin/orders",admin,(req,res)=>res.json(q("SELECT * FROM orders ORDER BY id DESC")));

app.patch("/api/admin/orders/:id",admin,(req,res)=>{
const allowed=["pending","paid","preparing","ready","shipping","delivered","cancelled"];
if(!allowed.includes(req.body.status))return res.status(400).json({error:"وضعیت نامعتبر"});
db.prepare("UPDATE orders SET status=?,payment_status=CASE WHEN ?='paid' THEN 'paid' ELSE payment_status END WHERE id=?").run(req.body.status,req.body.status,req.params.id);
res.json(one("SELECT * FROM orders WHERE id=?",req.params.id))
});

app.post("/api/admin/products",admin,(req,res)=>{
const {name,categoryId,price,oldPrice,unit,sku,stock,minStock,description,emoji}=req.body;
if(!name||!categoryId||!price||!sku)return res.status(400).json({error:"اطلاعات اصلی محصول ناقص است"});
try{
const r=db.prepare("INSERT INTO products(name,slug,category_id,price,old_price,unit,sku,stock,min_stock,description,emoji) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(name,slug(name+"-"+Date.now()),categoryId,price,oldPrice||null,unit||"عدد",sku,stock||0,minStock||0,description||"",emoji||"🛒");
res.status(201).json(one("SELECT * FROM products WHERE id=?",r.lastInsertRowid))
}catch(e){
res.status(409).json({error:"SKU تکراری است"})
}
});

app.patch("/api/admin/products/:id",admin,(req,res)=>{
const p=one("SELECT * FROM products WHERE id=?",req.params.id);
if(!p)return res.status(404).json({error:"یافت نشد"});
const b=req.body;
db.prepare("UPDATE products SET name=COALESCE(?,name),price=COALESCE(?,price),old_price=?,stock=COALESCE(?,stock),min_stock=COALESCE(?,min_stock),active=COALESCE(?,active),description=COALESCE(?,description),updated_at=CURRENT_TIMESTAMP WHERE id=?").run(b.name,b.price,b.oldPrice??p.old_price,b.stock,b.minStock,b.active,b.description,req.params.id);
res.json(one("SELECT * FROM products WHERE id=?",req.params.id))
});

app.post("/api/admin/daily-prices",admin,(req,res)=>{
const {name,price,unit,supplier}=req.body;
const r=db.prepare("INSERT INTO daily_prices(name,price,unit,supplier) VALUES(?,?,?,?)").run(name,price,unit||"کیلو",supplier||"");
res.status(201).json(one("SELECT * FROM daily_prices WHERE id=?",r.lastInsertRowid))
});

app.patch("/api/admin/daily-prices/:id",admin,(req,res)=>{
db.prepare("UPDATE daily_prices SET name=?,price=?,unit=?,supplier=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(req.body.name,req.body.price,req.body.unit||"کیلو",req.body.supplier||"",req.params.id);
res.json(one("SELECT * FROM daily_prices WHERE id=?",req.params.id))
});

app.get("/api/admin/wholesale",admin,(req,res)=>res.json(q("SELECT * FROM wholesale_requests ORDER BY id DESC")));

app.patch("/api/admin/wholesale/:id",admin,(req,res)=>{
db.prepare("UPDATE wholesale_requests SET status=? WHERE id=?").run(req.body.status,req.params.id);
res.json(one("SELECT * FROM wholesale_requests WHERE id=?",req.params.id))
});

app.get("/api/admin/products",admin,(req,res)=>res.json(q("SELECT p.*,c.name category FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.id DESC")));

app.get("/api/admin/customers",admin,(req,res)=>res.json(q("SELECT id,name,phone,created_at FROM users WHERE role='customer' ORDER BY id DESC")));

app.get("/api/admin/inventory",admin,(req,res)=>res.json(q("SELECT p.id,p.name,p.stock,p.min_stock,p.unit,CASE WHEN p.stock<=p.min_stock THEN 'low' ELSE 'ok' END status FROM products p ORDER BY p.stock ASC")));

app.get("/api/admin/reports/sales",admin,(req,res)=>{
const byDay=q("SELECT date(created_at) day,COUNT(*) orders,COALESCE(SUM(total),0) sales FROM orders GROUP BY date(created_at) ORDER BY day DESC LIMIT 30");
const top=q("SELECT name,SUM(qty) qty,SUM(qty*unit_price) sales FROM order_items GROUP BY product_id ORDER BY qty DESC LIMIT 20");
res.json({byDay,top})
});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

app.listen(PORT,()=>console.log(`Varouk running on http://localhost:${PORT}`));
