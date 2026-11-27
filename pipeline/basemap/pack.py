import os, json
from pmtiles.writer import Writer
from pmtiles.tile import zxy_to_tileid, TileType, Compression
root='build/tiles'; tiles=[]
for z in os.listdir(root):
    for x in os.listdir(f'{root}/{z}'):
        for f in os.listdir(f'{root}/{z}/{x}'):
            tiles.append((zxy_to_tileid(int(z),int(x),int(f[:-4])), f'{root}/{z}/{x}/{f}'))
tiles.sort()
with open('basemap.pmtiles','wb') as fo:
    w=Writer(fo)
    for tid,p in tiles: w.write_tile(tid, open(p,'rb').read())
    w.finalize({'tile_type':TileType.MVT,'tile_compression':Compression.GZIP,'min_zoom':0,'max_zoom':8,
      'min_lon_e7':-1800000000,'min_lat_e7':-850000000,'max_lon_e7':1800000000,'max_lat_e7':850000000,'center_zoom':3,'center_lon_e7':1000000000,'center_lat_e7':600000000},
      {'name':'Iter Sibiricum basemap','attribution':'Natural Earth','vector_layers':[{'id':'land','fields':{}},{'id':'lakes','fields':{}},{'id':'rivers','fields':{}}]})
print(len(tiles), os.path.getsize('basemap.pmtiles')//1024,'KB')
