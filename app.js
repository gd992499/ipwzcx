const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

/* ===== 基础设置 ===== */
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'site_session',
  secret: 'CHANGE_THIS_SECRET',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax'
  }
}));

/* ===== 数据库 ===== */
const db = new sqlite3.Database('./data.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    )
  `);

  // 初始化管理员账号（只会执行一次）
  db.get(`SELECT COUNT(*) AS c FROM users`, async (err, row) => {
    if (row.c === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      db.run(`INSERT INTO users (username, password) VALUES (?, ?)`,
        ['admin', hash]);
      console.log('初始化账号：admin / admin123');
    }
  });
});

/* ===== 防爆破（仅登录接口） ===== */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});

/* ===== 登录校验 ===== */
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

/* ===== 首页（伪装为企业官网） ===== */
app.get('/', (req, res) => {
  res.send(`
    <html>
    <head><title>XX科技有限公司</title></head>
    <body style="font-family:sans-serif">
      <h1>XX科技有限公司</h1>
      <p>我们致力于提供高质量的信息化解决方案。</p>
      <p>联系方式：contact@example.com</p>
    </body>
    </html>
  `);
});

/* ===== 登录页 ===== */
app.get('/login', (req, res) => {
  res.send(`
    <h2>后台登录</h2>
    <form method="POST">
      <input name="username" placeholder="用户名"/><br/>
      <input type="password" name="password" placeholder="密码"/><br/>
      <button>登录</button>
    </form>
  `);
});

/* ===== 登录处理 ===== */
app.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;

  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (!user) return res.send('账号或密码错误');

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.send('账号或密码错误');

    req.session.user = user.username;
    res.redirect('/dashboard');
  });
});

/* ===== 后台 ===== */
app.get('/dashboard', requireLogin, (req, res) => {
  res.send(`
    <h2>后台管理</h2>
    <p>当前用户：${req.session.user}</p>
    <a href="/change-password">修改密码</a><br/>
    <a href="/logout">退出</a>
  `);
});

/* ===== 修改密码 ===== */
app.get('/change-password', requireLogin, (req, res) => {
  res.send(`
    <form method="POST">
      <input type="password" name="password" placeholder="新密码"/>
      <button>修改</button>
    </form>
  `);
});

app.post('/change-password', requireLogin, async (req, res) => {
  const hash = await bcrypt.hash(req.body.password, 10);
  db.run(`UPDATE users SET password = ? WHERE username = ?`,
    [hash, req.session.user]);
  res.send('密码已修改');
});

/* ===== 退出 ===== */
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

/* ===== 启动 ===== */
app.listen(PORT, () => {
  console.log('服务运行在端口', PORT);
}); 
