# پروژه Full-Stack هایپر پروتئین واروک

## اجرا
نیازمندی: Node.js 20+
1. پوشه را استخراج کنید.
2. در ترمینال:
   npm install
   npm start
3. مرورگر: http://localhost:3000

## حساب مدیر آزمایشی
شماره: 09000000000
رمز: admin12345
حتماً قبل از انتشار رمز و JWT_SECRET را تغییر دهید.

## APIهای اصلی
GET /api/products
GET /api/categories
GET /api/daily-prices
POST /api/auth/register
POST /api/auth/login
GET /api/me
GET/PUT /api/cart
POST /api/orders
GET /api/orders
POST /api/wholesale

## APIهای مدیریت
GET /api/admin/stats
GET /api/admin/products
POST/PATCH /api/admin/products
GET/PATCH /api/admin/orders
GET /api/admin/inventory
GET /api/admin/customers
GET /api/admin/wholesale
GET/PATCH /api/admin/daily-prices
GET /api/admin/reports/sales

## نکته مهم تولید واقعی
درگاه پرداخت، SMS OTP، سرویس ارسال، دامنه، SSL، ذخیره تصاویر و اتصال به سیستم حسابداری نیازمند اطلاعات و سرویس‌های واقعی فروشگاه هستند و عمداً به صورت Fake یا ادعای اتصال واقعی در این پروژه قرار نگرفته‌اند.

## لوگو
فایل public/assets/varouk-logo.svg فقط Placeholder است. برای رعایت دقیق لوگوی تأییدشده واروک، فایل اصلی لوگو باید توسط صاحب برند در همین مسیر جایگزین شود. هیچ بازطراحی یا تغییر فونتی انجام نشده است.
