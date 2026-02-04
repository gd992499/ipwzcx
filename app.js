const express = require('express');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();

/* ========== Cloudflare 必须 ========== */
app.set('trust proxy', true);
app.use(express.urlencoded({ extended: true }));

/* ========== 配置 ========== */
let ADMIN_USER = 'admin';
let ADMIN_PASS = '123456';
const LOGIN_PATH = '/__admin_login_9x3';

const loginFailMap = {};
const links = {};
const logs = [];

/* ========== Session ========== */
app.use(session({
  secret: 'CHANGE_THIS_SECRET',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: true,      // Cloudflare https
    sameSite: 'lax'
  }
}));

/* ========== Cloudflare 真实 IP ========== */
function getIP(req) {
  // 只信 Cloudflare 头
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }
  if (req.headers['true-client-ip']) {
    return req.headers['true-client-ip'];
  }
  return req.socket.remoteAddress || 'unknown';
}

/* ========== 登录校验 ========== */
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect(LOGIN_PATH);
  next();
}

/* ========== 伪装官网 ========== */
app.get('/', (req, res) => {
  res.send(`
    <h1>XX 科技有限公司</h1>
    <p>企业级互联网解决方案提供商</p>
    <a href="/about">关于我们</a> |
    <a href="/contact">联系我们</a>
  `);
});

app.get('/about', (req, res) => {
  res.send('<h2>关于我们</h2><p>服务全球客户</p>');
});

app.get('/contact', (req, res) => {
  res.send('<h2>联系我们</h2><p>contact@example.com</p>');
});

/* ========== 隐藏登录 ========== */
app.get(LOGIN_PATH, (req, res) => {
  res.send(`
    <form method="post">
      <input name="username" placeholder="用户名"><br/>
      <input name="password" type="password" placeholder="密码"><br/>
      <button>登录</button>
    </form>
  `);
});

app.post(LOGIN_PATH, (req, res) => {
  const ip = getIP(req);
  const now = Date.now();

  if (!loginFailMap[ip]) loginFailMap[ip] = { count: 0, time: now };
  const r = loginFailMap[ip];

  if (r.count >= 5 && now - r.time < 10 * 60 * 1000) {
    return res.status(429).send('Too Many Attempts');
  }

  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    delete loginFailMap[ip];
    req.session.user = username;
    return res.redirect('/admin');
  }

  r.count++;
  r.time = now;
  res.send('Login Failed');
});

/* ========== 后台 ========== */
app.get('/admin', requireLogin, (req, res) => {
  res.send(`
    <a href="/create">生成链接</a><br/>
    <a href="/logs">访问记录</a><br/>
    <a href="/settings">账号设置</a><br/>
    <a href="/logout">退出</a>
  `);
});

/* ========== 修改账号密码 ========== */
app.get('/settings', requireLogin, (req, res) => {
  res.send(`
    <form method="post">
      <input name="username" placeholder="新用户名"><br/>
      <input name="password" placeholder="新密码"><br/>
      <button>保存</button>
    </form>
  `);
});

app.post('/settings', requireLogin, (req, res) => {
  const { username, password } = req.body;
  if (username) ADMIN_USER = username;
  if (password) ADMIN_PASS = password;
  req.session.destroy(() => res.send('已修改，请重新登录'));
});

/* ========== 一次性链接 ========== */
app.get('/create', requireLogin, (req, res) => {
  const id = uuidv4().slice(0, 8);
  links[id] = true;
  res.send(`<a href="/l/${id}">/l/${id}</a>`);
});

app.get('/l/:id', (req, res) => {
  if (!links[req.params.id]) return res.status(404).send('Not Found');

  logs.push({
    id: req.params.id,
    ip: getIP(req),
    ua: req.headers['user-agent'],
    time: new Date().toLocaleString()
  });

  delete links[req.params.id];
  res.send('OK');
});

/* ========== 日志 ========== */
app.get('/logs', requireLogin, (req, res) => {
  res.send(`<pre>${JSON.stringify(logs, null, 2)}</pre>`);
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect(LOGIN_PATH));
});

/* ========== 防扫描 404 ========== */
app.use(() => {
  return arguments[1].status(404).send('404');
});

/* ========== 启动 ========== */
const PORT = process.env.PORT || 3000;
// ===== 首页伪装（普通企业官网）=====
app.get('/', (req, res) => {
  res.send(`
    <!doctype html>
    <html lang="zh-CN">
    <head>
      <meta charset="utf-8">
      <title>XX科技有限公司</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: Arial; background:#f5f6f7; margin:0 }
        header { background:#0b5ed7; color:#fff; padding:30px }
        main { padding:40px }
        footer { background:#222; color:#aaa; padding:20px; text-align:center }
      </style>
    </head>
    <body>
      <header>
        <h1>XX科技有限公司</h1>
        <p>专注企业信息化解决方案</p>
      </header>
      <main>
        <h2>关于我们</h2>
        <p>我们为企业提供稳定、安全、高效的技术服务。</p>

        <h2>业务范围</h2>
        <ul>
          <li>系统集成</li>
          <li>云计算服务</li>
          <li>网络安全</li>
        </ul>
      </main>
      <footer>
        © 2026 XX Technology Co., Ltd.
      </footer>
    </body>
    </html>
  `);
});
app.listen(PORT, () => console.log('Service Running')); 
