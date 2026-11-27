"""Растровая подложка «рельеф»: Natural Earth I (1:50 млн, отмывка рельефа + цвет высот, с водой), общественное достояние.
Вход: NE1_50M_SR_W.tif (10800×5400, равнопромежуточная проекция). Выход: data/tiles/relief.pmtiles (WebP, Web Mercator):
весь мир z0–4, Северная Евразия и Тихий океан (долгота 0…200°, широта 15…82°) — z5–6."""
import sys, io, math, os
import numpy as np
from PIL import Image
from scipy.ndimage import map_coordinates
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid, TileType, Compression
Image.MAX_IMAGE_PIXELS = None
src, out = sys.argv[1], sys.argv[2]
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32); H, W, _ = im.shape
def tile_ll(z, x, y, n=256):
    i = (np.arange(n) + .5) / n; X = (x + i[None, :]) / 2**z * 360 - 180; Yn = (y + i[:, None]) / 2**z
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * Yn))))
    return np.broadcast_to(X, (n, n)), np.broadcast_to(lat, (n, n))
def lon2x(lon, z): return int((lon + 180) / 360 * 2**z) % 2**z
def lat2y(lat, z): r = math.radians(lat); return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2**z)
tiles = []
for z in range(0, 7):
    if z <= 4: xs, ys = range(2**z), range(2**z)
    else: xs = list(range(lon2x(0, z), 2**z)) + list(range(0, lon2x(-160, z) + 1)); ys = range(lat2y(82, z), lat2y(15, z) + 1)
    n = 0
    for x in xs:
        for y in ys:
            lon, lat = tile_ll(z, x, y)
            px = ((lon + 180) % 360) / 360 * W - .5; py = (90 - lat) / 180 * H - .5
            rgb = np.stack([map_coordinates(im[..., k], [py.ravel(), px.ravel()], order=1, mode='wrap').reshape(px.shape) for k in range(3)], -1)
            buf = io.BytesIO(); Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB').save(buf, 'WEBP', quality=80, method=5)
            tiles.append((zxy_to_tileid(z, x, y), buf.getvalue())); n += 1
    print('z', z, n, flush=True)
tiles.sort()
with open(out, 'wb') as f:
    w = Writer(f)
    for t, d in tiles: w.write_tile(t, d)
    w.finalize({'tile_type': TileType.WEBP, 'tile_compression': Compression.NONE, 'min_zoom': 0, 'max_zoom': 6, 'min_lon_e7': -1800000000, 'min_lat_e7': -850000000, 'max_lon_e7': 1800000000, 'max_lat_e7': 850000000,
                'center_zoom': 3, 'center_lon_e7': 1000000000, 'center_lat_e7': 550000000},
               {'name': 'Natural Earth I with Shaded Relief and Water, 1:50m', 'attribution': 'Natural Earth (public domain)'})
print(len(tiles), os.path.getsize(out) // 1024, 'KB')
