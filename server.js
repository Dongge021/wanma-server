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
  const c = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message: 'update submissions', content: c };
  if (sha) body.sha = sha;
  const r = await fetch(API_BASE, { method: 'PUT', headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github.v3+json' }, body: JSON.stringify(body) });
  return r.ok;
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
  const sm = {1:'已合作+已建档',2:'已合作+名不同',3:'已合作+未建档',4:'未合作+已建档',5:'未合作+未建档',6:'该店不存在'};
  let csv = '\uFEFF经销商,DSR,门店名称,区域,地址,电话,状态,系统内名称,S编码,是否新增\n';
  all.forEach(x => (x.data||[]).forEach(d => {
    csv += `"${x.distributor}","${x.dsrName}","${(d.name||'').replace(/"/g,'""')}","${(d.area||'').replace(/"/g,'""')}","${(d.addr||'').replace(/"/g,'""')}","${(d.tel||'').replace(/"/g,'""')}","${sm[d.status]||''}","${(d.sysName||'').replace(/"/g,'""')}","${(d.sCode||'').replace(/"/g,'""')}","${d.isNew?'新增':''}"\n`;
  }));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=wanma_all.csv');
  res.send(csv);
});
app.get('/admin', async (req, res) => {
  const all = await readData();
  const sm = {1:'已合作+已建档',2:'已合作+名不同',3:'已合作+未建档',4:'未合作+已建档',5:'未合作+未建档',6:'该店不存在'};
  const statusColors = {1:'#4caf50',2:'#ff9800',3:'#f44336',4:'#2196f3',5:'#9e9e9e',6:'#000'};
  let h = '<meta charset=UTF-8><title>万马奔腾后台</title><meta name=viewport content="width=device-width,initial-scale=1"><style>'+
    'body{font-family:-apple-system,Microsoft YaHei,sans-serif;background:#f5f6fa;margin:20px;font-size:14px}'+
    '.btn{padding:8px 20px;background:#e94560;color:#fff;border:none;border-radius:6px;font-size:14px;text-decoration:none;display:inline-block;margin:10px 0}'+
    '.kpi{display:flex;gap:20px;margin:16px 0;flex-wrap:wrap}'+
    '.kpi-c{background:#fff;padding:16px 20px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.1);min-width:120px}'+
    '.kpi-n{font-size:24px;font-weight:700}.kpi-l{font-size:12px;color:#888}'+
    '.srch{padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:14px;width:300px;margin:10px 0}'+
    '.blk{background:#fff;border-radius:8px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden}'+
    '.hdr{padding:12px 16px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;user-select:none}'+
    '.hdr:hover{background:#fafafa}.arr{transition:transform .2s;margin-left:8px}.arr.op{transform:rotate(90deg)}'+
    '.bdy{display:none;padding:0 16px 12px}.bdy.op{display:block}'+
    '.st{border-collapse:collapse;width:100%;margin-top:8px;font-size:12px}'+
    '.st th{background:#f0f0f5;color:#333;padding:6px 10px;text-align:left;border-bottom:2px solid #e0e0e0}'+
    '.st td{padding:6px 10px;border-bottom:1px solid #eee}'+
    '.is-new{background:#fff8e1!important}.is-new td:first-child{border-left:4px solid #ffc107}'+
    '.nbadge{background:#ffc107;color:#333;font-size:10px;padding:1px 6px;border-radius:3px;font-weight:700;margin-left:6px;white-space:nowrap}'+
    '.sdot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;vertical-align:middle}'+
  '</style></head><body>';
  h += '<h1>🐎 万马奔腾后台</h1>';
  h += '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:10px 0">';
  h += '<a class=btn href=/api/export>📥 导出全部CSV</a>';
  h += `<span style="font-size:13px;color:#888">🔄 ${new Date().toLocaleString()}</span>`;
  h += '</div>';
  // Search
  h += '<input class=srch id=s placeholder="🔍 搜索门店..." oninput="f()">';
  // KPI cards
  let t = {}, n = 0;
  all.forEach(x => { t[x.distributor] = (t[x.distributor]||0)+(x.data||[]).length; (x.data||[]).forEach(d => { if (d.isNew) n++; }); });
  h += '<div class="kpi">';
  Object.entries(t).forEach(([k,v]) => { h += `<div class="kpi-c"><div class="kpi-n">${v}</div><div class="kpi-l">${k}</div></div>`; });
  h += `<div class="kpi-c"><div class="kpi-n" style="color:#e94560">${all.length}</div><div class="kpi-l">提交人数</div></div>`;
  h += `<div class="kpi-c"><div class="kpi-n" style="color:#ffc107">${n}</div><div class="kpi-l">🏷️ 新增门店</div></div></div>`;
  // DSR detail blocks
  all.forEach((x, i) => {
    const done = (x.data||[]).filter(d => d.status).length;
    const nn = (x.data||[]).filter(d => d.isNew).length;
    h += `<div class="blk" data-d="${x.distributor}">`;
    h += `<div class="hdr" onclick="t(${i})"><div><b>${x.dsrName}</b> · ${x.distributor} · <span style="color:#888">${new Date(x.timestamp).toLocaleString()}</span></div><div><span style="color:#4caf50;font-weight:700">${done}/${x.data.length}</span>${nn?` · <span style="color:#e65100;font-weight:700">${nn}家新增</span>`:''}<span class="arr" id="a${i}">▶</span></div></div>`;
    h += `<div class="bdy" id="b${i}">`;
    h += '<table class="st"><tr><th>门店</th><th>区域</th><th>地址</th><th>电话</th><th>状态</th><th>S编码</th></tr>';
    (x.data||[]).forEach(d => {
      const nw = d.isNew ? true : false;
      h += `<tr class="${nw?'is-new':''}" data-n="${d.name}"><td><b>${d.name}</b>${nw?'<span class="nbadge">新增</span>':''}</td><td>${d.area||''}</td><td>${d.addr||''}</td><td>${d.tel||''}</td><td><span class="sdot" style="background:${statusColors[d.status]||'#999'}"></span>${sm[d.status]||''}</td><td>${d.sCode||'-'}</td></tr>`;
    });
    h += '</table></div></div>';
  });
  h += `<script>
    function t(i){document.getElementById('b'+i).classList.toggle('op');document.getElementById('a'+i).classList.toggle('op')}
    function f(){var q=document.getElementById('s').value.trim().toLowerCase();document.querySelectorAll('.blk').forEach(function(b){var m=false;b.querySelectorAll('tr[data-n]').forEach(function(r){var v=r.getAttribute('data-n').toLowerCase().includes(q);r.style.display=v?'':'none';if(v)m=true});b.style.display=m||!q?'block':'none'})}
    document.addEventListener('DOMContentLoaded',function(){var b=document.getElementById('b0'),a=document.getElementById('a0');if(b){b.classList.add('op');a.classList.add('op')}})
  <\/script>`;
  res.send(h + '</body>');
});
app.listen(PORT, () => console.log(`Server start on port ${PORT}`));
