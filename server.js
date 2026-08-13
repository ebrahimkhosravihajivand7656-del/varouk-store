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
  process.env.JWT_SECRET || "CHANGE_THIS_SECRET_IN_PRODUCTION";

/* =========================
   DATA / DATABASE
========================= */

const dataDir = path.join(__dirname, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "varouk.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(
  express.json({
    limit: "2mb",
  })
);

app.use(express.urlencoded({ extended: true }));

const publicDir = path.join(__dirname, "public");

app.use(express.static(publicDir));

/* =========================
   DATABASE TABLES
========================= */

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  phone TEXT UNIQUE,
  password_hash TEXT,
  role TEXT DEFAULT 'customer',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  slug TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
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
  name TEXT,
  price INTEGER,
  unit TEXT DEFAULT 'کیلو',
  supplier TEXT,
  active INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_transactions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER,
  type TEXT,
  qty REAL,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS addresses(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  title TEXT,
  address TEXT,
  postal_code TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
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

CREATE TABLE IF NOT EXISTS discounts(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  type TEXT,
  value INTEGER,
  min_order INTEGER DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  active INTEGER DEFAULT 1
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

CREATE TABLE IF NOT EXISTS audit_logs(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  entity TEXT,
  entity_id INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

/* =========================
   HELPERS
========================= */

function slug(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06ff-]/g, "");
}

const q = (sql, ...args) => db.prepare(sql).all(...args);

const one = (sql, ...args) => db.prepare(sql).get(...args);

/* =========================
   SEED DATA
========================= */

function seed() {
  /* ADMIN */

  if (!db.prepare("SELECT 1 FROM users LIMIT 1").get()) {
    const hash = bcrypt.hashSync("admin12345", 10);

    db.prepare(
      "INSERT INTO users(name,phone,password_hash,role) VALUES(?,?,?,?)"
    ).run(
      "مدیر واروک",
      "09000000000",
      hash,
      "admin"
    );
  }

  /* CATEGORIES */

  if (!db.prepare("SELECT 1 FROM categories LIMIT 1").get()) {
    const categories = [
      "پروتئینی",
      "لبنیات",
      "مواد غذایی",
      "نوشیدنی",
      "خشکبار",
      "تنقلات",
      "شوینده",
      "سلولزی",
    ];

    const insertCategory = db.prepare(
      "INSERT INTO categories(name,slug) VALUES(?,?)"
    );

    categories.forEach((name) => {
      insertCategory.run(name, slug(name));
    });
  }

  /* PRODUCTS */

  if (!db.prepare("SELECT 1 FROM products LIMIT 1").get()) {
    const getCategory = (name) =>
      db
        .prepare("SELECT id FROM categories WHERE name=?")
        .get(name).id;

    const insertProduct = db.prepare(`
      INSERT INTO products(
        name,
        slug,
        category_id,
        price,
        old_price,
        unit,
        sku,
        stock,
        min_stock,
        description,
        emoji
      )
      VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `);

    const products = [
      [
        "مرغ کامل تازه",
        "مرغ کامل تازه",
        "پروتئینی",
        345000,
        null,
        "کیلو",
        "VRK-CH-001",
        100,
        10,
        "مرغ تازه و باکیفیت",
        "🍗",
      ],

      [
        "فیله مرغ",
        "فیله مرغ",
        "پروتئینی",
        700000,
        null,
        "کیلو",
        "VRK-CH-002",
        70,
        10,
        "فیله مرغ تازه",
        "🥩",
      ],

      [
        "شنیسل مرغ",
        "شنیسل مرغ",
        "پروتئینی",
        660000,
        null,
        "کیلو",
        "VRK-CH-003",
        55,
        8,
        "شنیسل مرغ",
        "🍗",
      ],

      [
        "ران مرغ",
        "ران مرغ",
        "پروتئینی",
        330000,
        null,
        "کیلو",
        "VRK-CH-004",
        80,
        10,
        "ران مرغ تازه",
        "🍗",
      ],

      [
        "پنیر پیتزا ۲ کیلویی",
        "پنیر پیتزا ۲ کیلویی",
        "لبنیات",
        950000,
        1060000,
        "بسته",
        "VRK-DA-001",
        30,
        5,
        "پنیر پیتزا دو کیلویی",
        "🧀",
      ],

      [
        "نوشابه",
        "نوشابه",
        "نوشیدنی",
        39000,
        null,
        "عدد",
        "VRK-DR-001",
        200,
        20,
        "نوشیدنی",
        "🥤",
      ],

      [
        "تخمه اعلا",
        "تخمه اعلا",
        "خشکبار",
        850000,
        null,
        "کیلو",
        "VRK-NK-001",
        35,
        5,
        "تخمه اعلا در چند طعم",
        "🥜",
      ],

      [
        "پودر لباسشویی تست ۵۰۰ گرم",
        "پودر لباسشویی تست ۵۰۰ گرم",
        "شوینده",
        79800,
        null,
        "بسته",
        "VRK-CL-001",
        60,
        8,
        "پودر لباسشویی",
        "🧴",
      ],
    ];

    products.forEach((p) => {
      insertProduct.run(
        p[0],
        slug(p[1]),
        getCategory(p[2]),
        p[3],
        p[4],
        p[5],
        p[6],
        p[7],
        p[8],
        p[9],
        p[10]
      );
    });
  }

  /* DAILY PRICES */

  if (!db.prepare("SELECT 1 FROM daily_prices LIMIT 1").get()) {
    const insertPrice = db.prepare(`
      INSERT INTO daily_prices(
        name,
        price,
        unit,
        supplier
      )
      VALUES(?,?,?,?)
    `);

    const prices = [
      ["مرغ کامل تازه", 345000, "کیلو", "بهسا (خمین)"],
      ["شنیسل", 660000, "کیلو", "بهسا (خمین)"],
      ["فیله", 700000, "کیلو", "بهسا (خمین)"],
      ["ران", 330000, "کیلو", "بهسا (خمین)"],
      ["کتف و بال", 370000, "کیلو", "بهسا (خمین)"],
      ["جگر", 94000, "کیلو", "بهسا (خمین)"],
      ["دل", 165000, "کیلو", "بهسا (خمین)"],
      ["سنگدان", 215000, "کیلو", "بهسا (خمین)"],
      ["پای مرغ", 61000, "کیلو", "بهسا (خمین)"],
    ];

    prices.forEach((item) => insertPrice.run(...item));
  }
}

seed();

/* =========================
   AUTH
========================= */

function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "ورود لازم است",
      });
    }

    const tokenValue = header.slice(7);

    req.user = jwt.verify(tokenValue, SECRET);

    next();
  } catch (error) {
    return res.status(401).json({
      error: "نشست نامعتبر است",
    });
  }
}

function admin(req, res, next) {
  auth(req, res, () => {
    if (req.user.role === "admin") {
      return next();
    }

    return res.status(403).json({
      error: "دسترسی مدیر لازم است",
    });
  });
}

function token(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
    SECRET,
    {
      expiresIn: "7d",
    }
  );
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "varouk-store",
  });
});

/* =========================
   CATEGORIES
========================= */

app.get("/api/categories", (req, res) => {
  res.json(
    q("SELECT * FROM categories ORDER BY id")
  );
});

/* =========================
   PRODUCTS
========================= */

app.get("/api/products", (req, res) => {
  let {
    search = "",
    category = "",
    active = "1",
  } = req.query;

  let sql = `
    SELECT
      p.*,
      c.name category
    FROM products p
    LEFT JOIN categories c
      ON c.id = p.category_id
    WHERE 1=1
  `;

  const args = [];

  if (active === "1") {
    sql += " AND p.active=1";
  }

  if (search) {
    sql += " AND p.name LIKE ?";
    args.push("%" + search + "%");
  }

  if (category) {
    sql += " AND c.slug=?";
    args.push(category);
  }

  sql += " ORDER BY p.id DESC";

  res.json(q(sql, ...args));
});

app.get("/api/products/:id", (req, res) => {
  const product = one(
    `
    SELECT
      p.*,
      c.name category
    FROM products p
    LEFT JOIN categories c
      ON c.id=p.category_id
    WHERE p.id=?
    `,
    req.params.id
  );

  if (!product) {
    return res.status(404).json({
      error: "محصول یافت نشد",
    });
  }

  res.json(product);
});

/* =========================
   DAILY PRICES
========================= */

app.get("/api/daily-prices", (req, res) => {
  res.json(
    q(
      `
      SELECT *
      FROM daily_prices
      WHERE active=1
      ORDER BY id
      `
    )
  );
});

/* =========================
   REGISTER
========================= */

app.post("/api/auth/register", (req, res) => {
  const {
    name,
    phone,
    password,
  } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({
      error: "اطلاعات ناقص",
    });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);

    const result = db
      .prepare(
        `
        INSERT INTO users(
          name,
          phone,
          password_hash
        )
        VALUES(?,?,?)
        `
      )
      .run(name, phone, hash);

    const user = one(
      "SELECT * FROM users WHERE id=?",
      result.lastInsertRowid
    );

    res.json({
      token: token(user),
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(409).json({
      error: "این شماره قبلاً ثبت شده است",
    });
  }
});

/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", (req, res) => {
  const {
    phone,
    password,
  } = req.body;

  const user = one(
    "SELECT * FROM users WHERE phone=?",
    phone
  );

  if (
    !user ||
    !bcrypt.compareSync(
      password || "",
      user.password_hash
    )
  ) {
    return res.status(401).json({
      error: "شماره یا رمز عبور نادرست است",
    });
  }

  res.json({
    token: token(user),
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
    },
  });
});

/* =========================
   CURRENT USER
========================= */

app.get("/api/me", auth, (req, res) => {
  res.json(req.user);
});

/* =========================
   CART
========================= */

app.get("/api/cart", auth, (req, res) => {
  const cart = one(
    "SELECT * FROM carts WHERE user_id=?",
    req.user.id
  );

  res.json(
    cart
      ? JSON.parse(cart.items_json)
      : []
  );
});

app.put("/api/cart", auth, (req, res) => {
  db.prepare(`
    INSERT INTO carts(
      user_id,
      items_json
    )
    VALUES(?,?)
    ON CONFLICT(user_id)
    DO UPDATE SET
      items_json=excluded.items_json,
      updated_at=CURRENT_TIMESTAMP
  `).run(
    req.user.id,
    JSON.stringify(req.body.items || [])
  );

  res.json({
    ok: true,
  });
});

/* =========================
   ORDERS
========================= */

app.post("/api/orders", auth, (req, res) => {
  const {
    items = [],
    name,
    phone,
    address,
    discountCode = "",
  } = req.body;

  if (!items.length) {
    return res.status(400).json({
      error: "سبد خرید خالی است",
    });
  }

  let subtotal = 0;
  const cleanItems = [];

  for (const item of items) {
    const product = one(
      `
      SELECT *
      FROM products
      WHERE id=?
      AND active=1
      `,
      item.productId
    );

    if (!product) {
      return res.status(400).json({
        error: "محصول نامعتبر",
      });
    }

    const qty = Number(item.qty);

    if (
      qty <= 0 ||
      qty > product.stock
    ) {
      return res.status(400).json({
        error: `موجودی ${product.name} کافی نیست`,
      });
    }

    subtotal += product.price * qty;

    cleanItems.push({
      product,
      qty,
    });
  }

  let discount = 0;

  if (discountCode) {
    const discountData = one(
      `
      SELECT *
      FROM discounts
      WHERE code=?
      AND active=1
      `,
      discountCode
    );

    if (
      discountData &&
      subtotal >= discountData.min_order &&
      (
        !discountData.max_uses ||
        discountData.used_count <
          discountData.max_uses
      )
    ) {
      discount =
        discountData.type === "percent"
          ? Math.floor(
              subtotal *
              discountData.value /
              100
            )
          : discountData.value;
    }
  }

  const total = Math.max(
    0,
    subtotal - discount
  );

  const orderNumber =
    "VRK-" +
    Date.now()
      .toString()
      .slice(-8);

  const transaction = db.transaction(() => {
    const order = db
      .prepare(`
        INSERT INTO orders(
          order_no,
          user_id,
          name,
          phone,
          address,
          subtotal,
          discount,
          total
        )
        VALUES(?,?,?,?,?,?,?,?)
      `)
      .run(
        orderNumber,
        req.user.id,
        name || req.user.name,
        phone || req.user.phone,
        address || "",
        subtotal,
        discount,
        total
      );

    const insertOrderItem = db.prepare(`
      INSERT INTO order_items(
        order_id,
        product_id,
        name,
        qty,
        unit_price,
        unit
      )
      VALUES(?,?,?,?,?,?)
    `);

    const updateInventory = db.prepare(`
      UPDATE products
      SET
        stock=stock-?,
        updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `);

    const insertInventoryTransaction =
      db.prepare(`
        INSERT INTO inventory_transactions(
          product_id,
          type,
          qty,
          note
        )
        VALUES(?,?,?,?)
      `);

    for (const item of cleanItems) {
      insertOrderItem.run(
        order.lastInsertRowid,
        item.product.id,
        item.product.name,
        item.qty,
        item.product.price,
        item.product.unit
      );

      updateInventory.run(
        item.qty,
        item.product.id
      );

      insertInventoryTransaction.run(
        item.product.id,
        "sale",
        -item.qty,
        `سفارش ${orderNumber}`
      );
    }

    db.prepare(
      "DELETE FROM carts WHERE user_id=?"
    ).run(req.user.id);

    return order.lastInsertRowid;
  });

  const orderId = transaction();

  res.status(201).json(
    one(
      "SELECT * FROM orders WHERE id=?",
      orderId
    )
  );
});

app.get("/api/orders", auth, (req, res) => {
  res.json(
    q(
      `
      SELECT *
      FROM orders
      WHERE user_id=?
      ORDER BY id DESC
      `,
      req.user.id
    )
  );
});

/* =========================
   WHOLESALE
========================= */

app.post("/api/wholesale", (req, res) => {
  const {
    name,
    company,
    phone,
    businessType,
    details,
  } = req.body;

  if (!name || !phone) {
    return res.status(400).json({
      error: "نام و شماره تماس الزامی است",
    });
  }

  const result = db
    .prepare(`
      INSERT INTO wholesale_requests(
        name,
        company,
        phone,
        business_type,
        details
      )
      VALUES(?,?,?,?,?)
    `)
    .run(
      name,
      company || "",
      phone,
      businessType || "",
      details || ""
    );

  res.status(201).json({
    id: result.lastInsertRowid,
    message: "درخواست ثبت شد",
  });
});

/* =========================
   ADMIN STATS
========================= */

app.get(
  "/api/admin/stats",
  admin,
  (req, res) => {
    const sales = one(
      `
      SELECT COALESCE(SUM(total),0) x
      FROM orders
      WHERE date(created_at)=date('now')
      `
    ).x;

    const orders = one(
      `
      SELECT COUNT(*) x
      FROM orders
      WHERE date(created_at)=date('now')
      `
    ).x;

    const customers = one(
      `
      SELECT COUNT(*) x
      FROM users
      WHERE role='customer'
      `
    ).x;

    const low = one(
      `
      SELECT COUNT(*) x
      FROM products
      WHERE active=1
      AND stock<=min_stock
      `
    ).x;

    res.json({
      sales,
      orders,
      customers,
      low,
    });
  }
);

/* =========================
   ADMIN ORDERS
========================= */

app.get(
  "/api/admin/orders",
  admin,
  (req, res) => {
    res.json(
      q(
        `
        SELECT *
        FROM orders
        ORDER BY id DESC
        `
      )
    );
  }
);

app.patch(
  "/api/admin/orders/:id",
  admin,
  (req, res) => {
    const allowed = [
      "pending",
      "paid",
      "preparing",
      "ready",
      "shipping",
      "delivered",
      "cancelled",
    ];

    if (
      !allowed.includes(req.body.status)
    ) {
      return res.status(400).json({
        error: "وضعیت نامعتبر",
      });
    }

    db.prepare(`
      UPDATE orders
      SET
        status=?,
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
      one(
        "SELECT * FROM orders WHERE id=?",
        req.params.id
      )
    );
  }
);

/* =========================
   ADMIN PRODUCTS
========================= */

app.post(
  "/api/admin/products",
  admin,
  (req, res) => {
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
      emoji,
    } = req.body;

    if (
      !name ||
      !categoryId ||
      !price ||
      !sku
    ) {
      return res.status(400).json({
        error:
          "اطلاعات اصلی محصول ناقص است",
      });
    }

    try {
      const result = db
        .prepare(`
          INSERT INTO products(
            name,
            slug,
            category_id,
            price,
            old_price,
            unit,
            sku,
            stock,
            min_stock,
            description,
            emoji
          )
          VALUES(?,?,?,?,?,?,?,?,?,?,?)
        `)
        .run(
          name,
          slug(
            name +
              "-" +
              Date.now()
          ),
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
        one(
          "SELECT * FROM products WHERE id=?",
          result.lastInsertRowid
        )
      );
    } catch (error) {
      res.status(409).json({
        error: "SKU تکراری است",
      });
    }
  }
);

app.patch(
  "/api/admin/products/:id",
  admin,
  (req, res) => {
    const product = one(
      "SELECT * FROM products WHERE id=?",
      req.params.id
    );

    if (!product) {
      return res.status(404).json({
        error: "یافت نشد",
      });
    }

    const body = req.body;

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
      body.name,
      body.price,
      body.oldPrice ??
        product.old_price,
      body.stock,
      body.minStock,
      body.active,
      body.description,
      req.params.id
    );

    res.json(
      one(
        "SELECT * FROM products WHERE id=?",
        req.params.id
      )
    );
  }
);

/* =========================
   ADMIN DAILY PRICES
========================= */

app.post(
  "/api/admin/daily-prices",
  admin,
  (req, res) => {
    const {
      name,
      price,
      unit,
      supplier,
    } = req.body;

    const result = db
      .prepare(`
        INSERT INTO daily_prices(
          name,
          price,
          unit,
          supplier
        )
        VALUES(?,?,?,?)
      `)
      .run(
        name,
        price,
        unit || "کیلو",
        supplier || ""
      );

    res.status(201).json(
      one(
        "SELECT * FROM daily_prices WHERE id=?",
        result.lastInsertRowid
      )
    );
  }
);

app.patch(
  "/api/admin/daily-prices/:id",
  admin,
  (req, res) => {
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
      one(
        "SELECT * FROM daily_prices WHERE id=?",
        req.params.id
      )
    );
  }
);

/* =========================
   ADMIN WHOLESALE
========================= */

app.get(
  "/api/admin/wholesale",
  admin,
  (req, res) => {
    res.json(
      q(
        `
        SELECT *
        FROM wholesale_requests
        ORDER BY id DESC
        `
      )
    );
  }
);

app.patch(
  "/api/admin/wholesale/:id",
  admin,
  (req, res) => {
    db.prepare(
      `
      UPDATE wholesale_requests
      SET status=?
      WHERE id=?
      `
    ).run(
      req.body.status,
      req.params.id
    );

    res.json(
      one(
        "SELECT * FROM wholesale_requests WHERE id=?",
        req.params.id
      )
    );
  }
);

/* =========================
   ADMIN PRODUCT LIST
========================= */

app.get(
  "/api/admin/products",
  admin,
  (req, res) => {
    res.json(
      q(`
        SELECT
          p.*,
          c.name category
        FROM products p
        LEFT JOIN categories c
          ON c.id=p.category_id
        ORDER BY p.id DESC
      `)
    );
  }
);

/* =========================
   ADMIN CUSTOMERS
========================= */

app.get(
  "/api/admin/customers",
  admin,
  (req, res) => {
    res.json(
      q(`
        SELECT
          id,
          name,
          phone,
          created_at
        FROM users
        WHERE role='customer'
        ORDER BY id DESC
      `)
    );
  }
);

/* =========================
   ADMIN INVENTORY
========================= */

app.get(
  "/api/admin/inventory",
  admin,
  (req, res) => {
    res.json(
      q(`
        SELECT
          p.id,
          p.name,
          p.stock,
          p.min_stock,
          p.unit,
          CASE
            WHEN p.stock<=p.min_stock
            THEN 'low'
            ELSE 'ok'
          END status
        FROM products p
        ORDER BY p.stock ASC
      `)
    );
  }
);

/* =========================
   ADMIN REPORTS
========================= */

app.get(
  "/api/admin/reports/sales",
  admin,
  (req, res) => {
    const byDay = q(`
      SELECT
        date(created_at) day,
        COUNT(*) orders,
        COALESCE(SUM(total),0) sales
      FROM orders
      GROUP BY date(created_at)
      ORDER BY day DESC
      LIMIT 30
    `);

    const top = q(`
      SELECT
        name,
        SUM(qty) qty,
        SUM(qty*unit_price) sales
      FROM order_items
      GROUP BY product_id
      ORDER BY qty DESC
      LIMIT 20
    `);

    res.json({
      byDay,
      top,
    });
  }
);

/* =========================
   FRONTEND FALLBACK
   مهم:
   به جای app.get("*")
   از app.use استفاده شده
========================= */

app.use((req, res) => {
  const indexFile = path.join(
    publicDir,
    "index.html"
  );

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  res.status(404).send(
    "فایل index.html پیدا نشد."
  );
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Varouk Store running on port ${PORT}`
  );
});
