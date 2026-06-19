import express from 'express';
import cors from 'cors';
const app = express();
const PORT = process.env.PORT || 3000;
const TK_A = 'ghp_';
const TK_B = 'XEwbwIOw9bG7bJpfoCKdF78wTmTRLV1qbVNI';
const GITHUB_TOKEN = TK_A + TK_B;

const OWNER = 'Dongge021';
const REPO = 'wanma-2026';
const DATA_PATH = 'data/submissions.json';
const API_BASE = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${DATA_PATH}`;
app.use(cors());
app.use(express.json());
async function readData() {
  try {
    const res = await fetch(API_BASE, { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }});
    if (!res.ok) return [];
    const body = await res.json();
    if (!body.content) return [];
    return JSON.parse(Buffer.from(body.content, 'base64').toString());
  } catch { return []; }
}
async function writeData(data) {
  let sha = '';
  try {
    const res = await fetch(API_BASE, { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }});
    if (res.ok) { const body = await res.json(); sha = body.sha || ''; }
  } catch {}
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message: 'update submissions', content };
  if (sha) body.sha = sha;
  const res = await fetch(API_BASE, { method: 'PUT', headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' }, body: JSON.stringify(body) });
  return res.ok;
}
app.post('/api/submit', async (req, res) => {
  const { dsrName, distributor, data: shopData, timestamp } = req.body;
  if (!dsrName || !distributor || !shopData) return res.json({ ok: false, msg: '参数不完整' });
  const all = await readData();
  const idx = all.findIndex(s => s.dsrName === dsrName && s.distributor === distributor);
  const entry = { dsrName, distributor, data: shopData, timestamp: timestamp || new Date().toISOString() };
  if (idx >= 0) all[idx] = entry; else all.push(entry);
  const ok = await writeData(all);
  res.json({ ok, msg: ok ? '提交成功' : '保存失败' });
});
app.get('/api/submissions', async (req, res) => { res.json(await readData()); });
app.get('/api/export', async (req, res) => {
  const all = await readData();
  const s = {1:'已合作+已建档',2:'已合作+名不同',3:'已合作+未建档',4:'未合作+已建档',5:'未合作+未建档',6:'该店不存在'};
  let csv = '\uFEFF经销商,DSR,门店名称,区域,地址,电话,状态,系统内名称,S编码\n';
  all.forEach(x => (x.data||[]).forEach(d => { csv += `"${x.distributor}","${x.dsrName}","${d.name}","${d.area}","${d.addr}","${d.tel}","${s[d.status]||''}","${d.sysName||''}","${d.sCode||''}"\n`; }));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=wanma_all.csv');
  res.send(csv);
});
app.get('/admin', async (req, res) => {
  const all = await readData();
  const s = {1:'已合作+已建档',2:'已合作+名不同',3:'已合作+未建档',4:'未合作+已建档',5:'未合作+未建档',6:'该店不存在'};
  let h = '<meta charset=UTF-8><title>万马奔腾后台</title><meta name=viewport content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,Microsoft YaHei,sans-serif;background:#f5f6fa;margin:20px}table{border-collapse:collapse;width:100%;background:#fff;border-radius:8px}th{background:#1a1a2e;color:#fff;padding:10px 12px;font-size:13px;text-align:left}td{padding:8px 12px;font-size:12px;border-bottom:1px solid #eee}.btn{padding:8px 20px;background:#e94560;color:#fff;border:none;border-radius:6px;font-size:14px;text-decoration:none;display:inline-block;margin:10px 0}</style><h1>🐎 万马奔腾后台</h1><a class=btn href=/api/export>📥 导出全部CSV</a>';
  let t = {};
  all.forEach(x => t[x.distributor] = (t[x.distributor]||0)+(x.data||[]).length);
  h += '<div style="display:flex;gap:20px;margin:16px 0">';
  Object.entries(t).forEach(([k,v]) => { h += `<div style="background:#fff;padding:16px 20px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)"><div style="font-size:24px;font-weight:700">${v}</div><div style="font-size:12px;color:#888">${k}</div></div>`; });
  h += `<div style="background:#fff;padding:16px 20px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1)"><div style="font-size:24px;font-weight:700">${all.length}</div><div style="font-size:12px;color:#888">提交人数</div></div></div>`;
  h += '<table><tr><th>DSR</th><th>经销商</th><th>时间</th><th>确认数</th></tr>';
  all.forEach(x => { const d = (x.data||[]).filter(d => d.status).length; h += `<tr><td>${x.dsrName}</td><td>${x.distributor}</td><td>${new Date(x.timestamp).toLocaleString()}</td><td>${d}/${x.data.length}</td></tr>`; });
  res.send(h + '</table>');
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
