const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");

const app = express();

/* ===============================
   Cloudflare 真实 IP 支持
================================ */
app.set("trust proxy", true);
function getRealIP(req) {
  return (
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress
  );
}

/* ===============================
   基础中间件
================================ */
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(
  session({
    secret: "secure-site-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

/* ===============================
   简单 WAF（防爆破）
================================ */
const ipHits = {};
app.use((req, res, next) => {
  const ip = getRealIP(req);
  ipHits[ip] = (ipHits[ip] || 0) + 1;

  if (ipHits[ip] > 300) {
    return res.status(429).send("Too Many Requests");
  }
  next();
});

/* ===============================
   访问统计
================================ */
const visits = {};
app.use((req, res, next) => {
  const ip = getRealIP(req);
  visits[ip] = (visits[ip] || 0) + 1;
  next();
});

/* ===============================
   管理员账号（可后台修改）
================================ */
let adminUser = "admin";
let adminPass = "admin123";

/* ===============================
   登录校验
================================ */
function requireLogin(req, res, next) {
  if (req.session && req.session.auth) return next();
  res.redirect("/portal-login");
}

/* ===============================
   企业官网伪装首页
================================ */
app.get("/", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Acme Solutions</title>
      <style>
        body{font-family:Arial;background:#f4f6f8;padding:40px}
        .box{max-width:700px;margin:auto;background:#fff;padding:30px;border-radius:8px}
      </style>
    </head>
    <body>
      <div class="box">
        <h1>Acme Solutions</h1>
        <p>We provide enterprise-grade infrastructure and security services.</p>
        <p>Service Status: <b>Operational</b></p>
      </div>
    </body>
    </html>
  `);
});

/* ===============================
   隐藏后台登录入口
================================ */
app.get("/portal-login", (req, res) => {
  res.send(`
    <h2>Management Login</h2>
    <form method="post">
      <input name="user" placeholder="Username"/><br/>
      <input name="pass" type="password" placeholder="Password"/><br/>
      <button>Login</button>
    </form>
  `);
});

app.post("/portal-login", (req, res) => {
  if (req.body.user === adminUser && req.body.pass === adminPass) {
    req.session.auth = true;
    return res.redirect("/portal-panel");
  }
  res.send("Login failed");
});

/* ===============================
   隐藏后台面板
================================ */
app.get("/portal-panel", requireLogin, (req, res) => {
  res.send(`
    <h2>Admin Panel</h2>

    <h3>Visits</h3>
    <pre>${JSON.stringify(visits, null, 2)}</pre>

    <h3>Change Credentials</h3>
    <form method="post" action="/portal-cred">
      <input name="user" placeholder="New Username"/><br/>
      <input name="pass" placeholder="New Password"/><br/>
      <button>Update</button>
    </form>

    <br/>
    <a href="/portal-logout">Logout</a>
  `);
});

app.post("/portal-cred", requireLogin, (req, res) => {
  adminUser = req.body.user || adminUser;
  adminPass = req.body.pass || adminPass;
  res.send("Credentials updated");
});

app.get("/portal-logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/portal-login");
  });
});

/* ===============================
   Railway 正确端口监听
================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("服务运行在端口", PORT);
  console.log("初始账号:", adminUser, "/", adminPass);
});
