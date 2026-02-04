const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456';
const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const app = express();
const db = new sqlite3.Database('./data.db');

app.set('trust proxy', true);
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'CHANGE_THIS_SECRET_123456',
  resave: false,
  saveUninitialized: false
}));

/* ========== 工具函数 ========== */
function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress
  );
}

function auth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

/* ========== 初始化数据库 ========== */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password_hash TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT,
      ip TEXT,
      user_agent TEXT,
      visited_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* ========== 登录 ========== */
app.get('/login', (req, res) => {
  res.send(`
    <h2>后台登录</h2>
    <form method="post">
      <input name="username" placeholder="用户名" required /><br><br>
      <input name="password" type="password" placeholder="密码" required /><br><br>
      <button>登录</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username=?',
    username,
    async (err, user) => {
      if (!user) return res.send('用户名或密码错误');

      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.send('用户名或密码错误');

      req.session.user = username;
      res.redirect('/admin');
    }
  );
});

/* ========== 后台首页 ========== */
app.get('/admin', auth, (req, res) => {
  res.send(`
    <h2>后台管理</h2>
    <p>当前用户：${req.session.user}</p>
    <a href="/admin/create">生成随机链接</a><br><br>
    <a href="/admin/visits">查看访问记录</a><br><br>
    <a href="/logout">退出登录</a>
  `);
});

/* ========== 生成链接 ========== */
app.get('/admin/create', auth, (req, res) => {
  const token = uuidv4().replace(/-/g, '');
  db.run('INSERT INTO links (token) VALUES (?)', token);
  res.send(`
    <p>生成成功：</p>
    <code>/l/${token}</code><br><br>
    <a href="/admin">返回后台</a>
  `);
});

/* ========== 访问链接 ========== */
app.get('/l/:token', (req, res) => {
  const ip = getIP(req);

  db.run(
    'INSERT INTO visits (token, ip, user_agent) VALUES (?, ?, ?)',
    [req.params.token, ip, req.headers['user-agent']]
  );

  res.send('访问成功');
});

/* ========== 查看记录 ========== */
app.get('/admin/visits', auth, (req, res) => {
  db.all(
    'SELECT * FROM visits ORDER BY visited_at DESC',
    (err, rows) => {
      let html = '<h2>访问记录</h2><table border="1"><tr><th>链接</th><th>IP</th><th>UA</th><th>时间</th></tr>';
      rows.forEach(r => {
        html += `<tr>
          <td>${r.token}</td>
          <td>${r.ip}</td>
          <td>${r.user_agent}</td>
          <td>${r.visited_at}</td>
        </tr>`;
      });
      html += '</table><br><a href="/admin">返回后台</a>';
      res.send(html);
    }
  );
});

/* ========== 退出 ========== */
app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ========== 启动 ========== */
app.get('/', (req, res) => {
  res.send('服务已启动');
});
app.listen(3000, () => {
  console.log('网站已启动：http://localhost:3000');
});
