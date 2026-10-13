// Servidor mínimo sin dependencias: sirve /public y guarda las listas de la casa en un archivo JSON.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'items.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PEOPLE = ['', 'Mafer', 'Jorge', 'Ambos'];

const SEED = [
  'Desconectar todo en la casa',
  'Cerrar todas las ventanas',
  'Comprar costal para llevar los regalos',
  'Distribuir la comida de Curuba',
  'Lavar las cobijas para Karol',
  'Sacar la basura (incluida la tierra del estudio)',
  'Recoger la arena de las gatas y rellenar',
  'Lavar los baños',
  'Ir al CC Uniko',
  'Lavar sandalias',
  'Ir a Home Center (Si no llega pedido antes de las 5:00 pm)',
].map((t, i) => ({ id: 'a' + (i + 1), t, d: false, r: '' }));

fs.mkdirSync(DATA_DIR, { recursive: true });
const uid = (p) => p + crypto.randomBytes(5).toString('hex');
const newList = (name, items = []) => ({ id: uid('l'), name, items });

// Formato actual: { lists: [{ id, name, items: [{ id, t, d, r }] }] }.
// Formato anterior (v1): un arreglo plano de ítems -> pasa a ser la lista "Antes de viajar".
let lists;
try {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (Array.isArray(raw)) {
    fs.copyFileSync(DATA_FILE, DATA_FILE + '.v1.bak');
    lists = [newList('Antes de viajar', raw)];
    save();
  } else lists = raw.lists;
} catch (e) {
  if (e.code !== 'ENOENT') throw e; // archivo ilegible: no lo pisamos con el seed
  lists = [newList('Antes de viajar', SEED)]; save();
}

function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ lists }, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const reply = (res, extra) => send(res, 200, { lists, ...extra });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 10_000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

const cleanName = (v) => String(v || '').trim().slice(0, 60);

async function api(req, res, url) {
  const p = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent); // sin "api"
  const [root, lid, sub, iid] = p;
  if (root === 'health') return send(res, 200, { ok: true });
  if (root !== 'lists') return send(res, 404, { error: 'not found' });
  if (!lid) {
    if (req.method === 'GET') return reply(res);
    if (req.method === 'POST') {
      const name = cleanName((await readBody(req)).name);
      if (!name) return send(res, 400, { error: 'nombre vacío' });
      if (lists.length >= 30) return send(res, 400, { error: 'demasiadas listas' });
      const l = newList(name); lists.push(l); save(); return reply(res, { id: l.id });
    }
    return send(res, 405, { error: 'método no permitido' });
  }

  const list = lists.find((l) => l.id === lid);
  if (!list) return send(res, 404, { error: 'lista no encontrada' });

  if (!sub) {
    if (req.method === 'PATCH') {
      const name = cleanName((await readBody(req)).name);
      if (!name) return send(res, 400, { error: 'nombre vacío' });
      list.name = name; save(); return reply(res);
    }
    if (req.method === 'DELETE') {
      if (lists.length === 1) return send(res, 400, { error: 'debe quedar al menos una lista' });
      lists = lists.filter((l) => l !== list); save(); return reply(res);
    }
    return send(res, 405, { error: 'método no permitido' });
  }

  if (sub === 'reset' && req.method === 'POST') {
    list.items.forEach((i) => { i.d = false; }); save(); return reply(res);
  }
  if (sub === 'order' && req.method === 'PUT') {
    const ids = (await readBody(req)).ids;
    if (!Array.isArray(ids)) return send(res, 400, { error: 'ids inválidos' });
    const byId = new Map(list.items.map((i) => [i.id, i]));
    const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
    const seen = new Set(ordered);
    list.items = ordered.concat(list.items.filter((i) => !seen.has(i))); // lo que no venga, al final
    save(); return reply(res);
  }
  if (sub !== 'items') return send(res, 404, { error: 'not found' });

  if (!iid && req.method === 'POST') {
    const b = await readBody(req);
    const t = String(b.t || '').trim().slice(0, 200);
    if (!t) return send(res, 400, { error: 'texto vacío' });
    list.items.push({ id: uid('i'), t, d: false, r: PEOPLE.includes(b.r) ? b.r : '' });
    save(); return reply(res);
  }
  if (iid && req.method === 'PATCH') {
    const it = list.items.find((i) => i.id === iid);
    if (!it) return reply(res);
    const b = await readBody(req);
    if (typeof b.d === 'boolean') it.d = b.d;
    if (PEOPLE.includes(b.r)) it.r = b.r;
    if (typeof b.t === 'string') {
      const t = b.t.trim().slice(0, 200);
      if (!t) return send(res, 400, { error: 'texto vacío' });
      it.t = t;
    }
    save(); return reply(res);
  }
  if (iid && req.method === 'DELETE') {
    list.items = list.items.filter((i) => i.id !== iid); save(); return reply(res);
  }
  return send(res, 405, { error: 'método no permitido' });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const file = path.join(PUBLIC_DIR, rel);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'prohibido', 'text/plain');
    fs.readFile(file, (err, buf) => {
      if (err) return send(res, 404, 'no encontrado', 'text/plain');
      send(res, 200, buf, TYPES[path.extname(file)] || 'application/octet-stream');
    });
  } catch (e) {
    send(res, 400, { error: 'solicitud inválida' });
  }
}).listen(PORT, () => console.log('Antes de viajar escuchando en el puerto ' + PORT));
