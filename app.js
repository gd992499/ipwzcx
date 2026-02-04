const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");

const app = express();

/* =====================
   基础配置
===================== */

app.set("trust proxy", true); // 为 Cloudflare / Railway 获取真实 IP
app.use(bodyParser.urlencoded({ extended: false }));

app.use(
  session({
    secret: "change_this_secret",
    resave: false,
    saveUninitialized: false
  })
);

/* =====================
   简单内存数据
===================== */

const visits = [];

let adminUser = "admin";
let adminPass = "admin123";

/* =====================
   登录保护中间件
===================== */

function requireLogin(req, res, next) {
  if (req.session && req.session.login) return next();
  res.redirect("/login");
}

/* =====================
   前台页面（伪装普通网站）
===================== */

app.get("/", (req, res) => {
  const ip =
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.socket.remoteAddress;

  visits.push({
    ip,
    ua: req.headers["user-agent"],
    time: new Date().toLocaleString()
  });

  res.send(`
    <html>
      <head><title>Welcome</title></head>
      <body>
        <h1>Welcome to Our Company</h1>
        <p>Professional · Secure · Reliable</p>
      </body>
    </html>
  `);
});

/* =====================
   登录页面
===================== */

app.get("/login", (req, res) => {
  res.send(`
    <h2>Admin Login</h2>
    <form method="post">
      <input name="user" placeholder="Username"/><br/>
      <input name="pass" type="password" placeholder="Password"/><br/>
      <button>Login</button>
    </form>
  `);
});

app.post("/login", (req, res) => {
  const { user, pass } = req.body;
  if (user === adminUser && pass === adminPass) {
    req.session.login = true;
    res.redirect("/admin");
  } else {
    res.send("Login failed");
  }
});

/* =====================
   后台
===================== */

app.get("/admin", requireLogin, (req, res) => {
  res.send(`
    <h2>Admin Panel</h2>
    <h3>Visits</h3>
    <pre>${JSON.stringify(visits, null, 2)}</pre>

    <h3>Change Password</h3>
    <form method="post" action="/admin/pass">
      <input name="user" placeholder="New Username"/><br/>
      <input name="pass" placeholder="New Password"/><br/>
      <button>Change</button>
    </form>

    <a href="/logout">Logout</a>
  `);
});

app.post("/admin/pass", requireLogin, (req, res) => {
  adminUser = req.body.user || adminUser;
  adminPass = req.body.pass || adminPass;
  res.send("Credentials updated");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

/* =====================
   ⚠️ Railway 正确端口监听
===================== */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("服务运行在端口", PORT);
  console.log("初始化账号:", adminUser, "/", adminPass);
});
