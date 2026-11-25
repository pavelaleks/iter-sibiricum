"""Газеттир: исторические написания → место, регион, координаты (GeoNames cities1000 через пакет reverse_geocoder;
если пункта нет в выборке GeoNames (население < 1000 или исчез) – координаты вручную, с пометкой coord_source=manual)."""
import re, csv, os, pathlib
import reverse_geocoder

SIBERIA = {'west_siberia', 'east_siberia', 'yakutia_ne', 'far_east', 'kamchatka_chukotka', 'arctic_siberia', 'kazakh_steppe'}

# place_id, label_ru, regex variants, region, (geonames name, cc, admin hint) or (lat, lon) manual, type
P = [
 ('paris','Париж',r"\bParis\b",'europe',('Paris','FR','Île-de-France'),'city'),
 ('london','Лондон',r"\bLondon\b|\bLondres\b",'europe',('London','GB','England'),'city'),
 ('berlin','Берлин',r"\bBerlin\b",'europe',('Berlin','DE','Berlin'),'city'),
 ('helsinki','Хельсинки',r"\bHelsin\w*|\bHelsingfors\b",'europe',('Helsinki','FI',''),'city'),
 ('viipuri','Выборг',r"\bViipur\w*|\b[VW]iborg\b",'european_russia',('Vyborg','RU',''),'city'),
 ('stpetersburg','Санкт-Петербург',r"\b(?:St\.? ?|Saint[- ]|Sankt[- ])?P[ée]t[ea]rsb[ou]u?rg\w*|\bPietari\w*|\bPetrograd\w*",'european_russia',('Saint Petersburg','RU',''),'city'),
 ('moscow','Москва',r"\bMoscow\b|\bMoscou\b|\bMoskau\b|\bMoskova\w*",'european_russia',('Moscow','RU',''),'city'),
 ('nizhny','Нижний Новгород',r"\bNi[jzs]c?h?n[iy][- ]Nov[go]orod\b|\bNijni\b",'european_russia',('Nizhniy Novgorod','RU',''),'city'),
 ('kazan','Казань',r"\bKa[sz]an\w*",'european_russia',('Kazan','RU',''),'city'),
 ('perm','Пермь',r"\bPerm\b|\bPermi\w*",'urals',('Perm','RU',''),'city'),
 ('ekaterinburg','Екатеринбург',r"\b[EJIY]e?[ck]ath?[ae]rin(?:[aeo]n?)?[bB][eou]?u?rg\w*",'urals',('Yekaterinburg','RU',''),'city'),
 ('chelyabinsk','Челябинск',r"\bT?[CT]s?ch?el[iy]a?j?ab[iy]nsk\w*",'urals',('Chelyabinsk','RU',''),'city'),
 ('zlatoust','Златоуст',r"\bZlato[uo]u?st\w*",'urals',('Zlatoust','RU',''),'city'),
 ('ural','Уральские горы',r"\bUral(?:s|-?Gebirge|in)?\b|\bOu?ral\b|\bOeral\b",'urals',(59.0,59.5),'mountains'),
 ('tyumen','Тюмень',r"\bT[iy]?(?:[uo]u?|oe)men\w*|\bTjumen\w*",'west_siberia',('Tyumen','RU',''),'city'),
 ('tobolsk','Тобольск',r"\bTobolsk\w*",'west_siberia',(58.198,68.254),'city'),
 ('omsk','Омск',r"\bOmsk\w*",'west_siberia',('Omsk','RU',''),'city'),
 ('tomsk','Томск',r"\bTomsk\w*",'west_siberia',('Tomsk','RU',''),'city'),
 ('ishim','Ишим',r"\bI[s]?c?hi?m\b|\bIchim\b",'west_siberia',('Ishim','RU',''),'city'),
 ('tara','Тара',r"\bTara\b",'west_siberia',('Tara','RU',''),'city'),
 ('kainsk','Каинск (Куйбышев)',r"\bKa[iï]nsk\w*",'west_siberia',('Kuybyshev','RU','Novosibirsk'),'city'),
 ('kolyvan','Колывань',r"\bKol[yi]van\w*|\bKolywan\w*",'west_siberia',(55.307,82.739),'town'),
 ('barnaul','Барнаул',r"\bBarna[uo]u?l\w*",'west_siberia',('Barnaul','RU',''),'city'),
 ('biysk','Бийск',r"\bBi[iyj]sk\w*",'west_siberia',('Biysk','RU',''),'city'),
 ('narym','Нарым',r"\bNarym\w*|\bNarim\b",'west_siberia',(58.960,81.640),'village'),
 ('tymskoye','Тымское',r"\bTymsk\w*",'west_siberia',(59.470,80.290),'village'),
 ('berezov','Берёзово',r"\bBere?[sz][oa]w?v\b|\bBerjosow\b|\bBérézov\b",'west_siberia',(63.934,65.045),'village'),
 ('surgut','Сургут',r"\bSurgut\w*|\bSourgout\b",'west_siberia',(61.25,73.4167),'town'),
 ('obdorsk','Обдорск (Салехард)',r"\bObdorsk\w*",'west_siberia',(66.53,66.60),'town'),
 ('kurgan','Курган',r"\bKourgan\b|\bKurgan\b",'west_siberia',('Kurgan','RU',''),'city'),
 ('novonikolaevsk','Ново-Николаевск',r"\bNovo-?[Nn]ikola[ie]v?sk\w*|\bNowo-?Nikolajewsk\w*",'west_siberia',('Novosibirsk','RU',''),'city'),
 ('mariinsk','Мариинск',r"\bMar[ii]i?nsk\w*",'west_siberia',('Mariinsk','RU',''),'city'),
 ('ob','р. Обь',r"\bObi?\b(?![a-zäö])|\bObin\b|\bObi-joki\w*",'west_siberia',(61.0,76.0),'river'),
 ('irtysh','р. Иртыш',r"\bIrt[iy]s?c?h\w*|\bIrtych\b|\bIrtisch\w*",'west_siberia',(58.0,68.5),'river'),
 ('ket','р. Кеть',r"\bKet-?joe?\w*|\bKetin\b",'west_siberia',(58.5,84.0),'river'),
 ('karasea','Карское море',r"\bKara Sea\b|\bKarisches Meer\b",'arctic_siberia',(72.0,70.0),'sea'),
 ('semipalatinsk','Семипалатинск',r"\bSemipalatinsk\w*",'kazakh_steppe',(50.411,80.227),'city'),
 ('akmolinsk','Акмолинск',r"\bAkmolinsk\w*",'kazakh_steppe',(51.18,71.45),'town'),
 ('petropavlovsk_kz','Петропавловск (Степной край)',None,'kazakh_steppe',(54.873,69.143),'city'),
 ('om_colonies','финские колонии на р. Омь (Рыжково и др.)',None,'west_siberia',(55.1,75.4),'villages'),
 ('krasnoyarsk','Красноярск',r"\bKra[sn]{1,2}o[iyj]?a?r?sk\w*|\bKrasnojarsk\w*|\bKrasnoiarsk\w*",'east_siberia',('Krasnoyarsk','RU',''),'city'),
 ('yeniseisk','Енисейск',r"\b[YJI][eé]n[iïe]s+[eé]i?sk\w*",'east_siberia',('Yeniseysk','RU',''),'town'),
 ('yenisei','р. Енисей',r"\b[YJI][eé]n[iïe]s+[eé]i\b|\bJenisei\w*|\bJenissei\b|\bYenisei\b|\bJeniseje?\w*|\bJenisej\w*",'east_siberia',(62.0,90.0),'river'),
 ('achinsk','Ачинск',r"\bAt?s?chinsk\w*|\bAtchinsk\b",'east_siberia',('Achinsk','RU',''),'city'),
 ('kansk','Канск',r"\bKansk\w*",'east_siberia',('Kansk','RU',''),'city'),
 ('minusinsk','Минусинск',r"\bMinou?sinsk\w*",'east_siberia',('Minusinsk','RU',''),'city'),
 ('nizhneudinsk','Нижнеудинск',r"\bNi[jzs]c?h?n[eiy][- ]?[OU]u?dinsk\w*",'east_siberia',('Nizhneudinsk','RU',''),'city'),
 ('irkutsk','Иркутск',r"\bIrk(?:[ou]u?|oe)tsk\w*|\bIrkuck\w*",'east_siberia',('Irkutsk','RU',''),'city'),
 ('baikal','оз. Байкал',r"\bBa[iïj]kal\w*",'east_siberia',(53.5,108.0),'lake'),
 ('angara','р. Ангара',r"\bAngara\w*",'east_siberia',(57.0,100.0),'river'),
 ('listvyanka','Листвянка',r"\bListv[ie]ni?t?c?h\w*|\bListvianka\b",'east_siberia',(51.856,104.866),'village'),
 ('verkhneudinsk','Верхнеудинск (Улан-Удэ)',r"\bVer(?:kh?|ch)[nu][eiy]?[- ]?[OU]u?dinsk\w*|\bWerchne-?Udinsk\w*",'east_siberia',('Ulan-Ude','RU',''),'city'),
 ('kiakhta','Кяхта',r"\bKi[aä]k?h?c?h?ta\w*|\bKjachta\w*|\bKiaxta\b",'east_siberia',('Kyakhta','RU',''),'town'),
 ('selenginsk','Селенгинск',r"\bSelenginsk\w*",'east_siberia',(51.300,106.880),'village'),
 ('chita','Чита',r"\bT?[CT]s?chita\w*|\bChita\b",'east_siberia',('Chita','RU',''),'city'),
 ('nerchinsk','Нерчинск',r"\bNer[ct]s?chinsk\w*|\bNerchinsk\b",'east_siberia',('Nerchinsk','RU',''),'town'),
 ('sretensk','Сретенск',r"\bS[tr]?r[ei]e?t[ei]nsk\w*",'east_siberia',('Sretensk','RU',''),'town'),
 ('kirensk','Киренск',r"\bKirensk\w*",'east_siberia',('Kirensk','RU',''),'town'),
 ('kachug','Качуг',r"\bKat?chug\w*",'east_siberia',('Kachug','RU',''),'village'),
 ('zhigalovo','Жигалово',r"\b[JZ]h?igalov\w*",'east_siberia',('Zhigalovo','RU',''),'village'),
 ('vitim','Витим',r"\bVitim\w*",'east_siberia',('Vitim','RU',''),'village'),
 ('lena','р. Лена',r"\bLena\b(?! Rivers)|\bLenaa\b|\bLenan\b",'yakutia_ne',(60.0,120.0),'river'),
 ('olekminsk','Олёкминск',r"\bOlekminsk\w*",'yakutia_ne',(60.374,120.426),'town'),
 ('yakutsk','Якутск',r"\b[YJI]ak(?:[ou]u?|oe)tsk\w*|\bJakuck\w*",'yakutia_ne',('Yakutsk','RU',''),'city'),
 ('verkhoyansk','Верхоянск',r"\bVerk?h?o[iy]ansk\w*|\bWerchojansk\w*",'yakutia_ne',('Verkhoyansk','RU',''),'town'),
 ('srednekolymsk','Среднеколымск',r"\bSredn[eiy]-?Kolymsk\w*",'yakutia_ne',('Srednekolymsk','RU',''),'town'),
 ('nizhnekolymsk','Нижнеколымск',r"\bNi[jz]h?n[eiy]-?Kolymsk\w*",'yakutia_ne',(68.533,160.917),'village'),
 ('kolyma','р. Колыма',r"\bKolyma\b",'yakutia_ne',(67.0,155.0),'river'),
 ('blagoveshchensk','Благовещенск',r"\bBlagov\w*|\bBlagowest\w*",'far_east',(50.2796,127.5405),'city'),
 ('khabarovsk','Хабаровск',r"\b[KH]h?abarov\w*|\bHabarof\w*|\bChabarowsk\w*",'far_east',('Khabarovsk','RU',''),'city'),
 ('vladivostok','Владивосток',r"\b[VW]ladiv?w?ostok\w*",'far_east',('Vladivostok','RU',''),'city'),
 ('nikolaevsk','Николаевск-на-Амуре',r"\bNi[ck]ola(?:[iy]?e?[vu]|ie?v?|yc?u)sk\w*",'far_east',('Nikolayevsk-on-Amure','RU',''),'town'),
 ('okhotsk','Охотск',r"\bO[ck]?h?otsk\w*|\bOchotsk\w*",'far_east',('Okhotsk','RU',''),'town'),
 ('sakhalin','о. Сахалин',r"\bSa[gk]h?al[iy]e?n\w*|\bSachalin\w*",'far_east',(50.5,142.8),'island'),
 ('amur','р. Амур',r"\bAm(?:u|oo|ou|oe)r\b|\bAmurin\b",'far_east',(52.0,130.0),'river'),
 ('ussuri','р. Уссури',r"\bOu?ss?ou?ri\w*",'far_east',(46.5,134.0),'river'),
 ('ayan','Аян',r"\bAyan\b|\bAjan\b",'far_east',(56.453,138.168),'village'),
 ('gizhiga','Гижига',r"\bGh?i[zj]h?i[gn]?ga\w*|\bGichiga\b",'kamchatka_chukotka',(61.98,160.35),'village'),
 ('petropavlovsk','Петропавловск-Камчатский',r"\bPetrop[ao]u?[vl]\w*sk[iy]?\b",'kamchatka_chukotka',(53.0444,158.6508),'town'),
 ('kamchatka','Камчатка',r"\bKam(?:t|s)?[cs]?ch?atk\w*|\bKam(?:cz|č|ci|tsj)atk\w*",'kamchatka_chukotka',(56.0,159.0),'peninsula'),
 ('tigil','Тигиль',r"\bTigil\w*",'kamchatka_chukotka',(57.76,158.67),'village'),
 ('anadyr','Анадырь',r"\bAnad[iy]r\w*",'kamchatka_chukotka',('Anadyr','RU',''),'town'),
 ('markovo','Марково',r"\bMarkov[oa]\b",'kamchatka_chukotka',(64.68,170.41),'village'),
 ('eastcape','мыс Дежнёва / Уэлен',r"\bEast Cape\b|\bUelen\b|\bOumwaidjik\w*",'kamchatka_chukotka',(66.16,-169.80),'cape'),
 ('beringstrait','Берингов пролив',r"\bBe[h]?ring(?:'s)? Strai?ts?\b|\bBehring\b",'kamchatka_chukotka',(65.8,-169.0),'strait'),
 ('urga','Урга (Улан-Батор)',r"\b[OU]u?rgh?a\b",'mongolia',('Ulaanbaatar','MN',''),'city'),
 ('maimachin','Маймачен',r"\bMa[iï]-?ma-?t?chin\w*|\bMaimatschin\w*",'mongolia',(50.32,106.46),'town'),
 ('gobi','пустыня Гоби',r"\bGobi\w*",'mongolia',(43.0,106.0),'desert'),
 ('kalgan','Калган (Чжанцзякоу)',r"\bKalgan\w*|\bChan[g]?-?kia-?kow\w*",'china',(40.81,114.88),'city'),
 ('peking','Пекин',r"\bP[eé]kin[g]?\w*",'china',(39.9075,116.3972),'city'),
 ('tientsin','Тяньцзинь',r"\bTien-?tsin\w*",'china',(39.142,117.177),'city'),
 ('shanghai','Шанхай',r"\bShanghai\b|\bSchanghai\b",'china',(31.222,121.458),'city'),
 ('taiyuan','Тайюань',r"\bT'?ai[- ]?Yuan\w*",'china',(37.869,112.560),'city'),
 ('harbin','Харбин',r"\b[KC]?[Hh]arbin\w*",'manchuria',(45.75,126.65),'city'),
 ('mukden','Мукден',r"\bMukden\w*|\bMoukden\b",'manchuria',(41.79,123.43),'city'),
 ('portarthur','Порт-Артур',r"\bPort[- ]Arthur\w*",'manchuria',(38.81,121.26),'city'),
 ('japan','Япония',r"\bJapan\b|\bJapon\b|\bNagasaki\b|\bTok[iy]o\b|\bYokohama\b",'japan_korea',(35.68,139.69),'country'),
 ('korea','Корея',r"\b[KC]orea\b|\bSeoul\b|\bF[uo]u?san\b",'japan_korea',(37.56,126.97),'country'),
 ('alaska','Аляска',r"\bAlaska\w*|\bNome\b|\bDawson\b|\bYukon\b|\bCape Prince of Wales\b",'america',(64.5,-165.4),'region'),
 ('sanfrancisco','Сан-Франциско',r"\bSan Francisco\b",'america',(37.77,-122.42),'city'),
 ('newyork','Нью-Йорк',r"\bNew York\b",'america',(40.71,-74.01),'city'),
]
# переопределения по произведениям: неоднозначный «Петропавловск»
WORK_OVERRIDES = {('michie1864','petropavlovsk'):'petropavlovsk_kz', ('meignan1885','petropavlovsk'):'petropavlovsk_kz',
                  ('dewindt1889','petropavlovsk'):'petropavlovsk_kz', ('price1892','petropavlovsk'):'petropavlovsk_kz',
                  ('barzini1908','petropavlovsk'):'petropavlovsk_kz', ('grano1893','petropavlovsk'):'petropavlovsk_kz'}

def build():
    d = os.path.dirname(reverse_geocoder.__file__)
    G = list(csv.DictReader(open(os.path.join(d, 'rg_cities1000.csv'), encoding='utf-8')))
    rows = []
    for pid, lab, rx, reg, geo, typ in P:
        if isinstance(geo[0], str):
            name, cc, adm = geo
            m = [g for g in G if g['name'].lower() == name.lower() and g['cc'] == cc and (not adm or adm.lower() in g['admin1'].lower())]
            if not m: m = [g for g in G if g['name'].lower() == name.lower() and g['cc'] == cc]
            if not m: raise SystemExit(f'not found in GeoNames: {name}')
            lat, lon, src = float(m[0]['lat']), float(m[0]['lon']), f"geonames_cities1000:{m[0]['name']}|{m[0]['admin1']}"
        else:
            lat, lon, src = geo[0], geo[1], 'manual (approximate; verify)' if typ not in ('river','lake','sea','region','country','peninsula','desert','mountains','island','strait','cape') else 'manual centroid (area feature)'
        rows.append(dict(place_id=pid, label_ru=lab, pattern=rx or '', region=reg, in_siberia=reg in SIBERIA, type=typ,
                         lat=round(lat, 4), lon=round(lon, 4), coord_source=src))
    return rows

if __name__ == '__main__':
    rows = build(); root = pathlib.Path(__file__).resolve().parents[1]
    with open(root/'data/places.csv', 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    from collections import Counter
    print(len(rows), 'places', Counter(r['coord_source'].split(':')[0].split(' (')[0] for r in rows))
