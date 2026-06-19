import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'submissions.json');

app.use(express.json());
app.use(express.static('public'));

// 初始化数据文件
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// DSR提交数据
app.post('/api/submit', (req, res) => {
  const { dsrName, distributor, data: shopData, timestamp } = req.body;
  if (!dsrName || !distributor || !shopData) {
    return res.json({ ok: false, msg: '参数不完整' });
  }
  const all = readData();
  // 如果该DSR+经销商已提交过，覆盖
  const idx = all.findIndex(s => s.dsrName === dsrName && s.distributor === distributor);
  const entry = { dsrName, distributor, data: shopData, timestamp: timestamp || new Date().toISOString() };
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  writeData(all);
  res.json({ ok: true });
});

// 管理员查看所有提交
app.get('/api/submissions', (req, res) => {
  const all = readData();
  res.json(all);
});

// 管理员导出CSV
app.get('/api/export', (req, res) => {
  const all = readData();
  const statusMap = {1:'已合作+已建档',2:'已合作+名不同',3:'已合作+未建档',4:'未合作+已建档',5:'未合作+未建档',6:'该店不存在'};
  let csv = '\uFEFF经销商,DSR,门店名称,区域,地址,电话,状态,系统内名称,S编码\n';
  all.forEach(s => {
    (s.data || []).forEach(d => {
      csv += `"${s.distributor}","${s.dsrName}","${d.name}","${d.area}","${d.addr}","${d.tel}","${statusMap[d.status]||'未确认'}","${d.sysName||''}","${d.sCode||''}"\n`;
    });
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=wanma_all.csv');
  res.send(csv);
});

// 管理页面
app.get('/admin', (req, res) => {
  const all = readData();
  const statusMap = {1:'已合作+已建档',2:'已合作+名不同',3:'已合作+未建档',4:'未合作+已建档',5:'未合作+未建档',6:'该店不存在'};
  let html = `<!DOCTYPE html><html lang=zh-CN><head><meta charset=UTF-8>
  <title>万马奔腾 - 后台管理</title>
  <meta name=viewport content="width=device-width,initial-scale=1">
  <style>body{font-family:-apple-system,Microsoft YaHei,sans-serif;background:#f5f6fa;margin:0;padding:20px}
  h1{font-size:20px;color:#1a1a2e}
  table{border-collapse:collapse;width:100%;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  th{background:#1a1a2e;color:#fff;padding:10px 12px;font-size:13px;text-align:left}
  td{padding:8px 12px;font-size:12px;border-bottom:1px solid #eee}
  tr:hover td{background:#f0f0f0}
  .summary{display:flex;gap:20px;margin:16px 0;flex-wrap:wrap}
  .card{background:#fff;padding:16px 20px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);min-width:120px}
  .card .num{font-size:24px;font-weight:700;color:#1a1a2e}
  .card .label{font-size:12px;color:#888;margin-top:4px}
  .btn{padding:8px 20px;background:#e94560;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;text-decoration:none;display:inline-block;margin:10px 0}
  .btn:hover{background:#d63850}
  </style></head><body>
  <h1>🐎 万马奔腾 · 后台管理</h1>
  <a class=btn href=/api/export>📥 导出全部CSV</a>
  <div class=summary>`;
  const totals = {};
  all.forEach(s => totals[s.distributor] = (totals[s.distributor]||0) + (s.data||[]).length);
  Object.entries(totals).forEach(([k,v]) => {
    html += `<div class=card><div class=num>${v}</div><div class=label>${k} 已确认</div></div>`;
  });
  html += `<div class=card><div class=num>${all.length}</div><div class=label>提交人数</div></div></div>`;

  html += `<table><tr><th>DSR</th><th>经销商</th><th>提交时间</th><th>确认数</th><th>操作</th></tr>`;
  all.forEach((s, i) => {
    const done = (s.data||[]).filter(d => d.status && d.status !== 0).length;
    html += `<tr><td>${s.dsrName}</td><td>${s.distributor}</td><td>${new Date(s.timestamp).toLocaleString()}</td>
    <td>${done}/${s.data.length}</td>
    <td><a href=/api/detail/${i}>查看</a></td></tr>`;
  });
  html += `</table></body></html>`;
  res.send(html);
});

// 查看单个DSR详情
app.get('/api/detail/:idx', (req, res) => {
  const all = readData();
  const s = all[parseInt(req.params.idx)];
  if (!s) return res.status(404).send('not found');
  const statusMap = {1:'已合作+已建档',2:'已合作+名不同',3:'已合作+未建档',4:'未合作+已建档',5:'未合作+未建档',6:'该店不存在'};
  let html = `<!DOCTYPE html><html lang=zh-CN><head><meta charset=UTF-8>
  <title>${s.dsrName} - ${s.distributor}</title>
  <style>body{font-family:-apple-system,Microsoft YaHei,sans-serif;background:#f5f6fa;padding:20px}
  table{border-collapse:collapse;width:100%;background:#fff;border-radius:8px}
  th{background:#1a1a2e;color:#fff;padding:8px 10px;font-size:12px;text-align:left}
  td{padding:6px 10px;font-size:12px;border-bottom:1px solid #eee}
  h2{font-size:18px;color:#1a1a2e}
  </style></head><body>
  <h2>${s.dsrName} - ${s.distributor}</h2>
  <p>提交时间: ${new Date(s.timestamp).toLocaleString()}</p>
  <table><tr><th>门店</th><th>区域</th><th>状态</th><th>系统内名称</th><th>S编码</th></tr>`;
  (s.data||[]).forEach(d => {
    html += `<tr><td>${d.name}</td><td>${d.area}</td><td>${statusMap[d.status]||'未确认'}</td><td>${d.sysName||''}</td><td>${d.sCode||''}</td></tr>`;
  });
  html += `</table></body></html>`;
  res.send(html);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
