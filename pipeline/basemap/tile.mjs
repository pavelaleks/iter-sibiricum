import fs from 'fs'; import zlib from 'zlib';
import * as GV from 'geojson-vt'; const geojsonvt = (d, o) => (GV.default && typeof GV.default === 'function' && !/^class/.test(GV.default.toString()) ? GV.default(d, o) : new (GV.GeoJSONVT || GV.default)(d, o)); import vtpbf from 'vt-pbf';
const rd = (f) => JSON.parse(fs.readFileSync(f));
const opt = (mz) => ({maxZoom: mz, indexMaxZoom: 4, indexMaxPoints: 0, tolerance: 2.2, extent: 4096, buffer: 64});
const W = geojsonvt(rd('build/land_world.json'), opt(4)), L = geojsonvt(rd('build/land.json'), opt(8)),
  K = geojsonvt(rd('build/lakes.json'), opt(8)), R = geojsonvt(rd('build/rivers.json'), opt(8));
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
fs.mkdirSync('build/tiles', {recursive: true}); let n = 0, bytes = 0;
const boxes = [[-15, 25, 180, 82], [-180, 25, -165, 82]];
for (let z = 0; z <= 8; z++) {
  const set = new Set();
  if (z <= 4) { for (let x = 0; x < 2 ** z; x++) for (let y = 0; y < 2 ** z; y++) set.add(x + ',' + y); }
  else for (const [a, b, c, d] of boxes) for (let x = lon2x(a, z); x <= Math.min(2 ** z - 1, lon2x(c - 1e-9, z)); x++) for (let y = lat2y(d, z); y <= lat2y(b, z); y++) set.add(x + ',' + y);
  for (const k of set) {
    const [x, y] = k.split(',').map(Number); const layers = {};
    const lt = (z <= 4 ? W : L).getTile(z, x, y); if (lt) layers.land = lt;
    if (z >= 2) { const kt = K.getTile(z, x, y); if (kt) layers.lakes = kt; const rt = R.getTile(z, x, y); if (rt) layers.rivers = rt; }
    if (!Object.keys(layers).length) continue;
    const buf = zlib.gzipSync(Buffer.from(vtpbf.fromGeojsonVt(layers, {version: 2})));
    fs.mkdirSync(`build/tiles/${z}/${x}`, {recursive: true}); fs.writeFileSync(`build/tiles/${z}/${x}/${y}.pbf`, buf); n++; bytes += buf.length;
  }
  console.log('z', z, set.size);
}
console.log(n, 'build/tiles', Math.round(bytes / 1024), 'KB');
