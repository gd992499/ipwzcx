const express = require('express');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');

const app = express();

/* ===== 配置 ===== */
const ADMIN_USER = 'admin';
const ADMIN_PASS = '123456';

app.set('trust proxy', true);
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: 'CHANGE_ME_123456',
    resave: false,
    saveUninitialized: false
  })
);

/* ===== 工具函数：获取真实 IP ===== */
function getIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/* ===== 内存存储（最简单，先跑通） ===== */
const logs = [];
const links = {};

/* ===== 首页（解决 Cannot GET /） ===== */
app.get('/', (req, res) => {
  res.send('服务已启动');
});

/* ===== 登录 ===== */
app.get('/login', (req, res) => {
  res.send(`
    <h2>登录</h2>
    <form method="POST">
      <input name="username" placeholder="用户名" /><br/>
      <input name="password" type="password" placeholder="密码" /><br/>
      <button>登录</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.user = username;
    return res.redirect('/admin');
  }
  res.send('登录失败');
});

/* ===== 后台 ===== */
app.get('/admin', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const linkList = Object.keys(links)
    .map(id => `<li>${id}</li>`)
    .join('');

  const logList = logs
    .map(l => `<li>${l.time} | ${l.ip} | ${l.id}</li>`)
    .join('');

  res.send(`
    <h2>后台</h2>
    <form method="POST" action="/admin/create">
      <button>生成随机链接</button>
    </form>

    <h3>链接</h3>
    <ul>${linkList}</ul>

    <h3>访问记录</h3>
    <ul>${logList}</ul>
  `);
});

/* ===== 生成随机链接 ===== */
app.post('/admin/create', (req, res) => {
  if (!req.session.user) return res.redirect('/login');

  const id = uuidv4();
  links[id] = true;
  res.redirect('/admin');
});

/* ===== 对方访问的链接 ===== */
app.get('/l/:id', (req, res) => {
  const { id } = req.params;
  if (!links[id]) return res.status(404).send('链接不存在');

  logs.push({
    id,
    ip: getIP(req),
    time: new Date().toLocaleString()
  });

  res.send('已访问');
});

/* ===== 启动 ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('服务已启动');
}); 
