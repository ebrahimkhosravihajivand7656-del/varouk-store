const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();

const PORT = process.env.PORT || 3000;
const SECRET =
  process.env.JWT_SECRET || "VAROUK_SECRET_CHANGE_IN_PRODUCTION";

const dataDir = path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "varouk.db"));

db.pragma("journal_mode = WAL");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

function slug(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06ff-]/g, "");
}

const all = (sql, ...params) =>
  db.prepare(sql).all(...params);

const get = (sql, ...params) =>
  db.prepare(sql).get(...params);

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 phone TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT DEFAULT 'customer',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT UNIQUE NOT NULL,
 slug TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS products(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 slug TEXT UNIQUE,
 category_id INTEGER,
 price INTEGER NOT NULL,
 old_price INTEGER,
 unit TEXT DEFAULT 'عدد',
 sku TEXT UNIQUE,
 stock REAL DEFAULT 0,
 min_stock REAL DEFAULT 0,
 active INTEGER DEFAULT 1,
 description TEXT,
 emoji TEXT DEFAULT '🛒',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_prices(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 price INTEGER NOT NULL,
 unit TEXT DEFAULT 'کیلو',
 supplier TEXT,
 active INTEGER DEFAULT 1,
 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS carts(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER UNIQUE,
 items_json TEXT DEFAULT '[]',
 updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_no TEXT UNIQUE,
 user_id INTEGER,
 name TEXT,
 phone TEXT,
 address TEXT,
 status TEXT DEFAULT 'pending',
 subtotal INTEGER,
 discount INTEGER DEFAULT 0,
 shipping INTEGER DEFAULT 0,
 total INTEGER,
 payment_status TEXT DEFAULT 'unpaid',
 payment_ref TEXT,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER,
 product_id INTEGER,
 name TEXT,
 qty REAL,
 unit_price INTEGER,
 unit TEXT
);

CREATE TABLE IF NOT EXISTS wholesale_requests(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT,
 company TEXT,
 phone TEXT,
 business_type TEXT,
 details TEXT,
 status TEXT DEFAULT 'new',
 created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

function seed() {
  if (!get("SELECT 1 FROM users LIMIT 1")) {
    const hash = bcrypt.hashSync("admin12345", 10);

    db.prepare(`
      INSERT INTO users(name,phone,password_hash,role)
      VALUES(?,?,?,?)
    `).run(
      "مدیر واروک",
      "09000000000",
      hash,
      "admin"
    );
  }

  if (!get("SELECT 1 FROM categories LIMIT 1")) {
    const categories = [
      "پروتئینی",
      "لبنیات",
      "مواد غذایی",
      "نوشیدنی",
      "خشکبار",
      "تنقلات",
      "شوینده",
      "سلولزی"
    ];

    const insert = db.prepare(
      "INSERT INTO categories(name,slug) VALUES(?,?)"
    );

    for (const name of categories) {
      insert.run(name, slug(name));
    }
  }

  if (!get("SELECT 1 FROM products LIMIT 1")) {
    const category = name =>
      get("SELECT id FROM categories WHERE name=?", name).id;

    const insert = db.prepare(`
      INSERT INTO products
      (name,slug,category_id,price,old_price,unit,sku,stock,min_stock,description,emoji)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `);

    const products = [
      [
        "مرغ کامل تازه",
        "پروتئینی",
        345000,
        null,
        "کیلو",
        "VRK-001",
        100,
        10,
        "مرغ تازه و باکیفیت",
        "🍗"
      ],
      [
        "فیله مرغ",
        "پروتئینی",
        700000,
        null,
        "کیلو",
        "VRK-002",
        70,
        10,
        "فیله مرغ تازه",
        "🥩"
      ],
      [
        "شنیسل مرغ",
        "پروتئینی",
        660000,
        null,
        "کیلو",
        "VRK-003",
        55,
        8,
        "شنیسل مرغ",
        "🍗"
      ],
      [
        "ران مرغ",
        "پروتئینی",
        330000,
        null,
        "کیلو",
        "VRK-004",
        80,
        10,
        "ران مرغ تازه",
        "🍗"
      ],
      [
        "کتف و بال",
        "پروتئینی",
        370000,
        null,
        "کیلو",
        "VRK-005",
        60,
        8,
        "کتف و بال مرغ",
        "🍗"
      ],
      [
        "پنیر پیتزا ۲ کیلویی",
        "لبنیات",
        950000,
        1060000,
        "بسته",
        "VRK-006",
        30,
        5,
        "پنیر پیتزا دو کیلویی",
        "🧀"
      ],
      [
        "نوشابه",
        "نوشیدنی",
        39000,
        null,
        "عدد",
        "VRK-007",
        200,
        20,
        "نوشیدنی",
        "🥤"
      ],
      [
        "تخمه اعلا",
        "خشکبار",
        850000,
        null,
        "کیلو",
        "VRK-008",
        35,
        5,
        "تخمه اعلا در چند طعم",
        "🥜"
      ],
      [
        "پودر لباسشویی تست ۵۰۰ گرم",
        "شوینده",
        79800,
        null,
        "بسته",
        "VRK-009",
        60,
        8,
        "پودر لباسشویی تست",
        "🧴"
      ]
    ];

    for (const p of products) {
      insert.run(
        p[0],
        slug(p[0]),
        category(p[1]),
        p[2],
        p[3],
        p[4],
        p[5],
        p[6],
        p[7],
        p[8],
        p[9]
      );
    }
  }

  if (!get("SELECT 1 FROM daily_prices LIMIT 1")) {
    const insert = db.prepare(`
      INSERT INTO daily_prices(name,price,unit,supplier)
      VALUES(?,?,?,?)
    `);

    const prices = [
      ["مرغ کامل تازه",345000,"کیلو","بهسا (خمین)"],
      ["شنیسل",660000,"کیلو","بهسا (خمین)"],
      ["فیله",700000,"کیلو","بهسا (خمین)"],
      ["ران",330000,"کیلو","بهسا (خمین)"],
      ["کتف و بال",370000,"کیلو","بهسا (خمین)"],
      ["جگر",94000,"کیلو","بهسا (خمین)"],
      ["دل",165000,"کیلو","بهسا (خمین)"],
      ["سنگدان",215000,"کیلو","بهسا (خمین)"],
      ["پای مرغ",61000,"کیلو","بهسا (خمین)"]
    ];

    for (const p of prices) {
      insert.run(...p);
    }
  }
}

seed();

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role
    },
    SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req,res,next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "ورود لازم است"
      });
    }

    req.user = jwt.verify(
      header.slice(7),
      SECRET
    );

    next();
  } catch {
    res.status(401).json({
      error: "نشست نامعتبر است"
    });
  }
}

function admin(req,res,next) {
  auth(req,res,() => {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        error: "دسترسی مدیر لازم است"
      });
    }

    next();
  });
}

/* HEALTH */

app.get("/api/health",(req,res)=>{
  res.json({
    ok:true,
    service:"varouk-store"
  });
});

/* CATEGORIES */

app.get("/api/categories",(req,res)=>{
  res.json(
    all("SELECT * FROM categories ORDER BY id")
  );
});

/* PRODUCTS */

app.get("/api/products",(req,res)=>{
  const {
    search="",
    category="",
    active="1"
  } = req.query;

  let sql = `
    SELECT p.*,c.name AS category
    FROM products p
    LEFT JOIN categories c
    ON c.id=p.category_id
    WHERE 1=1
  `;

  const params=[];

  if(active==="1"){
    sql += " AND p.active=1";
  }

  if(search){
    sql += " AND p.name LIKE ?";
    params.push("%"+search+"%");
  }

  if(category){
    sql += " AND c.slug=?";
    params.push(category);
  }

  sql += " ORDER BY p.id DESC";

  res.json(all(sql,...params));
});

app.get("/api/products/:id",(req,res)=>{
  const product = get(
    `
    SELECT p.*,c.name AS category
    FROM products p
    LEFT JOIN categories c
    ON c.id=p.category_id
    WHERE p.id=?
    `,
    req.params.id
  );

  if(!product){
    return res.status(404).json({
      error:"محصول یافت نشد"
    });
  }

  res.json(product);
});

/* DAILY PRICES */

app.get("/api/daily-prices",(req,res)=>{
  res.json(
    all(`
      SELECT *
      FROM daily_prices
      WHERE active=1
      ORDER BY id
    `)
  );
});

/* REGISTER */

app.post("/api/auth/register",(req,res)=>{
  const {
    name,
    phone,
    password
  } = req.body;

  if(!name || !phone || !password){
    return res.status(400).json({
      error:"نام، شماره تماس و رمز عبور الزامی است"
    });
  }

  try {
    const hash =
      bcrypt.hashSync(password,10);

    const result = db.prepare(`
      INSERT INTO users
      (name,phone,password_hash)
      VALUES(?,?,?)
    `).run(name,phone,hash);

    const user = get(
      "SELECT * FROM users WHERE id=?",
      result.lastInsertRowid
    );

    res.json({
      token:createToken(user),
      user:{
        id:user.id,
        name:user.name,
        phone:user.phone,
        role:user.role
      }
    });

  } catch {
    res.status(409).json({
      error:"این شماره قبلاً ثبت شده است"
    });
  }
});

/* LOGIN */

app.post("/api/auth/login",(req,res)=>{
  const {
    phone,
    password
  } = req.body;

  const user = get(
    "SELECT * FROM users WHERE phone=?",
    phone
  );

  if(
    !user ||
    !bcrypt.compareSync(
      password || "",
      user.password_hash
    )
  ){
    return res.status(401).json({
      error:"شماره یا رمز عبور نادرست است"
    });
  }

  res.json({
    token:createToken(user),
    user:{
      id:user.id,
      name:user.name,
      phone:user.phone,
      role:user.role
    }
  });
});

/* CURRENT USER */

app.get("/api/me",auth,(req,res)=>{
  res.json(req.user);
});

/* CART */

app.get("/api/cart",auth,(req,res)=>{
  const cart = get(
    "SELECT * FROM carts WHERE user_id=?",
    req.user.id
  );

  res.json(
    cart ? JSON.parse(cart.items_json) : []
  );
});

app.put("/api/cart",auth,(req,res)=>{
  const items = req.body.items || [];

  db.prepare(`
    INSERT INTO carts(user_id,items_json)
    VALUES(?,?)
    ON CONFLICT(user_id)
    DO UPDATE SET
      items_json=excluded.items_json,
      updated_at=CURRENT_TIMESTAMP
  `).run(
    req.user.id,
    JSON.stringify(items)
  );

  res.json({ok:true});
});

/* ORDERS */

app.post("/api/orders",auth,(req,res)=>{
  const {
    items=[],
    name,
    phone,
    address
  } = req.body;

  if(!items.length){
    return res.status(400).json({
      error:"سبد خرید خالی است"
    });
  }

  let subtotal=0;
  const clean=[];

  for(const item of items){

    const product = get(
      "SELECT * FROM products WHERE id=? AND active=1",
      item.productId
    );

    if(!product){
      return res.status(400).json({
        error:"محصول نامعتبر است"
      });
    }

    const qty=Number(item.qty);

    if(
      !Number.isFinite(qty) ||
      qty<=0 ||
      qty>product.stock
    ){
      return res.status(400).json({
        error:`موجودی ${product.name} کافی نیست`
      });
    }

    subtotal += product.price * qty;

    clean.push({
      product,
      qty
    });
  }

  const total=subtotal;
  const orderNo =
    "VRK-" +
    Date.now().toString().slice(-8);

  const transaction=db.transaction(()=>{

    const order=db.prepare(`
      INSERT INTO orders
      (order_no,user_id,name,phone,address,subtotal,total)
      VALUES(?,?,?,?,?,?,?)
    `).run(
      orderNo,
      req.user.id,
      name || req.user.name,
      phone || req.user.phone,
      address || "",
      subtotal,
      total
    );

    const itemInsert=db.prepare(`
      INSERT INTO order_items
      (order_id,product_id,name,qty,unit_price,unit)
      VALUES(?,?,?,?,?,?)
    `);

    const updateStock=db.prepare(`
      UPDATE products
      SET stock=stock-?,
          updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `);

    for(const item of clean){

      itemInsert.run(
        order.lastInsertRowid,
        item.product.id,
        item.product.name,
        item.qty,
        item.product.price,
        item.product.unit
      );

      updateStock.run(
        item.qty,
        item.product.id
      );
    }

    db.prepare(
      "DELETE FROM carts WHERE user_id=?"
    ).run(req.user.id);

    return order.lastInsertRowid;
  });

  const id=transaction();

  res.status(201).json(
    get("SELECT * FROM orders WHERE id=?",id)
  );
});

app.get("/api/orders",auth,(req,res)=>{
  res.json(
    all(
      "SELECT * FROM orders WHERE user_id=? ORDER BY id DESC",
      req.user.id
    )
  );
});

/* WHOLESALE */

app.post("/api/wholesale",(req,res)=>{
  const {
    name,
    company,
    phone,
    businessType,
    details
  } = req.body;

  if(!name || !phone){
    return res.status(400).json({
      error:"نام و شماره تماس الزامی است"
    });
  }

  const result=db.prepare(`
    INSERT INTO wholesale_requests
    (name,company,phone,business_type,details)
    VALUES(?,?,?,?,?)
  `).run(
    name,
    company || "",
    phone,
    businessType || "",
    details || ""
  );

  res.status(201).json({
    id:result.lastInsertRowid,
    message:"درخواست شما ثبت شد"
  });
});

/* ADMIN */

app.get("/api/admin/stats",admin,(req,res)=>{

  const sales=get(`
    SELECT COALESCE(SUM(total),0) AS value
    FROM orders
    WHERE date(created_at)=date('now')
  `).value;

  const orders=get(`
    SELECT COUNT(*) AS value
    FROM orders
    WHERE date(created_at)=date('now')
  `).value;

  const customers=get(`
    SELECT COUNT(*) AS value
    FROM users
    WHERE role='customer'
  `).value;

  const low=get(`
    SELECT COUNT(*) AS value
    FROM products
    WHERE active=1
    AND stock<=min_stock
  `).value;

  res.json({
    sales,
    orders,
    customers,
    low
  });
});

app.get("/api/admin/orders",admin,(req,res)=>{
  res.json(
    all("SELECT * FROM orders ORDER BY id DESC")
  );
});

app.patch("/api/admin/orders/:id",admin,(req,res)=>{

  const allowed=[
    "pending",
    "paid",
    "preparing",
    "ready",
    "shipping",
    "delivered",
    "cancelled"
  ];

  if(!allowed.includes(req.body.status)){
    return res.status(400).json({
      error:"وضعیت نامعتبر است"
    });
  }

  db.prepare(`
    UPDATE orders
    SET status=?,
    payment_status=
      CASE
        WHEN ?='paid'
        THEN 'paid'
        ELSE payment_status
      END
    WHERE id=?
  `).run(
    req.body.status,
    req.body.status,
    req.params.id
  );

  res.json(
    get(
      "SELECT * FROM orders WHERE id=?",
      req.params.id
    )
  );
});

app.get("/api/admin/products",admin,(req,res)=>{
  res.json(
    all(`
      SELECT p.*,c.name AS category
      FROM products p
      LEFT JOIN categories c
      ON c.id=p.category_id
      ORDER BY p.id DESC
    `)
  );
});

app.post("/api/admin/products",admin,(req,res)=>{

  const {
    name,
    categoryId,
    price,
    oldPrice,
    unit,
    sku,
    stock,
    minStock,
    description,
    emoji
  }=req.body;

  if(!name || !categoryId || !price || !sku){
    return res.status(400).json({
      error:"اطلاعات اصلی محصول ناقص است"
    });
  }

  try{

    const result=db.prepare(`
      INSERT INTO products
      (name,slug,category_id,price,old_price,unit,sku,stock,min_stock,description,emoji)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      name,
      slug(name+"-"+Date.now()),
      categoryId,
      price,
      oldPrice || null,
      unit || "عدد",
      sku,
      stock || 0,
      minStock || 0,
      description || "",
      emoji || "🛒"
    );

    res.status(201).json(
      get(
        "SELECT * FROM products WHERE id=?",
        result.lastInsertRowid
      )
    );

  }catch{
    res.status(409).json({
      error:"SKU تکراری است"
    });
  }
});

app.patch("/api/admin/products/:id",admin,(req,res)=>{

  const product=get(
    "SELECT * FROM products WHERE id=?",
    req.params.id
  );

  if(!product){
    return res.status(404).json({
      error:"محصول یافت نشد"
    });
  }

  const b=req.body;

  db.prepare(`
    UPDATE products
    SET
      name=COALESCE(?,name),
      price=COALESCE(?,price),
      old_price=?,
      stock=COALESCE(?,stock),
      min_stock=COALESCE(?,min_stock),
      active=COALESCE(?,active),
      description=COALESCE(?,description),
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    b.name,
    b.price,
    b.oldPrice ?? product.old_price,
    b.stock,
    b.minStock,
    b.active,
    b.description,
    req.params.id
  );

  res.json(
    get(
      "SELECT * FROM products WHERE id=?",
      req.params.id
    )
  );
});

app.get("/api/admin/customers",admin,(req,res)=>{
  res.json(
    all(`
      SELECT id,name,phone,created_at
      FROM users
      WHERE role='customer'
      ORDER BY id DESC
    `)
  );
});

app.get("/api/admin/wholesale",admin,(req,res)=>{
  res.json(
    all(`
      SELECT *
      FROM wholesale_requests
      ORDER BY id DESC
    `)
  );
});

app.get("/api/admin/inventory",admin,(req,res)=>{
  res.json(
    all(`
      SELECT
        id,
        name,
        stock,
        min_stock,
        unit,
        CASE
          WHEN stock<=min_stock
          THEN 'low'
          ELSE 'ok'
        END AS status
      FROM products
      ORDER BY stock ASC
    `)
  );
});

app.post("/api/admin/daily-prices",admin,(req,res)=>{

  const {
    name,
    price,
    unit,
    supplier
  }=req.body;

  const result=db.prepare(`
    INSERT INTO daily_prices
    (name,price,unit,supplier)
    VALUES(?,?,?,?)
  `).run(
    name,
    price,
    unit || "کیلو",
    supplier || ""
  );

  res.status(201).json(
    get(
      "SELECT * FROM daily_prices WHERE id=?",
      result.lastInsertRowid
    )
  );
});

app.patch("/api/admin/daily-prices/:id",admin,(req,res)=>{

  db.prepare(`
    UPDATE daily_prices
    SET
      name=?,
      price=?,
      unit=?,
      supplier=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    req.body.name,
    req.body.price,
    req.body.unit || "کیلو",
    req.body.supplier || "",
    req.params.id
  );

  res.json(
    get(
      "SELECT * FROM daily_prices WHERE id=?",
      req.params.id
    )
  );
});

/* IMPORTANT FOR EXPRESS 5 */

app.get("/{*splat}",(req,res)=>{
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});

app.listen(PORT,()=>{
  console.log(
    `Varouk Store running on port ${PORT}`
  );
});
