const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();

/* ================== 基础配置 ================== */

// Railway 必须
const PORT = process.env.PORT || 8080;

// 管理员账号（强烈建议在 Railway 里设置环境变量）
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

// session 密钥
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_this_secret';

// 内存存储（演示用）
const links = {};        // { token: { createdAt } }
const visitLogs = [];   // 访问记录
const loginFails = {};  // 简单防爆破

/* ================== 中间件 ================== */

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(session({
  name: 'site.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

/* ================== 工具函数 ================== */

function isLoggedIn(req) {
  return req.session && req.session.loggedIn;
}

function requireLogin(req, res, next) {
  if (!isLoggedIn(req)) {
    return res.redirect('/login');
  }
  next();
}

function getClientIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.socket.remoteAddress ||
    ''
  );
}

/* ================== 页面 ================== */

// 首页（普通企业风格占位）
app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome</h1>
    <p>Official Website</p>
  `);
});

/* ---------- 登录 ---------- */

app.get('/login', (req, res) => {
  res.send(`
    <h2>Admin Login</h2>
    <form method="post">
      <input name="username" placeholder="Username"/><br/>
      <input name="password" type="password" placeholder="Password"/><br/>
      <button>Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const ip = getClientIP(req);
  const now = Date.now();

  // 简单防爆破：10 分钟 5 次
  loginFails[ip] = loginFails[ip] || [];
  loginFails[ip] = loginFails[ip].filter(t => now - t < 10 * 60 * 1000);

  if (loginFails[ip].length >= 5) {
    return res.send('Too many attempts, try later.');
  }

  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.loggedIn = true;
    loginFails[ip] = [];
    return res.redirect('/admin');
  } else {
    loginFails[ip].push(now);
    return res.send('Login failed');
  }
});

/* ---------- 后台 ---------- */

app.get('/admin', requireLogin, (req, res) => {
  const list = visitLogs.map(v => `
    <tr>
      <td>${v.time}</td>
      <td>${v.ip}</td>
      <td>${v.ua}</td>
      <td>${v.token}</td>
    </tr>
  `).join('');

  res.send(`
    <h2>Admin Panel</h2>
    <a href="/admin/new">Generate Link</a> |
    <a href="/logout">Logout</a>
    <table border="1" cellpadding="5">
      <tr>
        <th>Time</th><th>IP</th><th>User-Agent</th><th>Token</th>
      </tr>
      ${list}
    </table>
  `);
});

app.get('/admin/new', requireLogin, (req, res) => {
  const token = crypto.randomBytes(6).toString('hex');
  links[token] = { createdAt: new Date() };

  const url = `${req.protocol}://${req.get('host')}/v/${token}`;

  res.send(`
    <p>Link created:</p>
    <code>${url}</code><br/><br/>
    <a href="/admin">Back</a>
  `);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

/* ---------- 访问记录 ---------- */

app.get('/v/:token', (req, res) => {
  const { token } = req.params;

  if (!links[token]) {
    return res.status(404).send('Not Found');
  }

  visitLogs.push({
    token,
    ip: getClientIP(req),
    ua: req.headers['user-agent'] || '',
    time: new Date().toLocaleString(),
  });

  res.send(`
    <h1>Thank you</h1>
    <p>Your visit has been recorded.</p>
  `);
});

/* ================== 启动 ================== */

app.listen(PORT, '0.0.0.0', () => {
  console.log('服务运行在端口', PORT);
  console.log(`初始化账号：${ADMIN_USER} / ${ADMIN_PASS}`);
});
