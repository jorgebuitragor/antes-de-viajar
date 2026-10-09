// Servidor mínimo sin dependencias: sirve /public y guarda la lista en un archivo JSON.
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
let items;
try { items = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
catch { items = SEED; save(); }

function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(items, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const reply = (res) => send(res, 200, { items });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 10_000) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

async function api(req, res, url) {
  const m = url.pathname.match(/^\/api\/items(?:\/([^/]+))?$/);
  if (url.pathname === '/api/health') return send(res, 200, { ok: true });
  if (url.pathname === '/api/reset' && req.method === 'POST') {
    items.forEach((i) => { i.d = false; }); save(); return reply(res);
  }
  if (!m) return send(res, 404, { error: 'not found' });
  const id = m[1] && decodeURIComponent(m[1]);

  if (!id && req.method === 'GET') return reply(res);
  if (!id && req.method === 'POST') {
    const b = await readBody(req);
    const t = String(b.t || '').trim().slice(0, 200);
    if (!t) return send(res, 400, { error: 'texto vacío' });
    items.push({ id: 'i' + crypto.randomBytes(5).toString('hex'), t, d: false, r: PEOPLE.includes(b.r) ? b.r : '' });
    save(); return reply(res);
  }
  const it = items.find((i) => i.id === id);
  if (id && req.method === 'PATCH') {
    if (!it) return reply(res);
    const b = await readBody(req);
    if (typeof b.d === 'boolean') it.d = b.d;
    if (typeof b.t === 'string') {
      const t = b.t.trim().slice(0, 200);
      if (!t) return send(res, 400, { error: 'texto vacío' });
      it.t = t;
    }
    if (PEOPLE.includes(b.r)) it.r = b.r;
    save(); return reply(res);
  }
  if (id && req.method === 'DELETE') {
    items = items.filter((i) => i.id !== id); save(); return reply(res);
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
