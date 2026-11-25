"""Тест очистки OCR на фрагментах реальных сканов archive.org (Lansdell 1882, Cotteau 1885, Hansteen 1854)."""
import sys, pathlib; sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]/'analysis'))
from ocr_clean import clean, quality

EN_PAGE = """ating  subject,  though  the  more  respectable  amongst  the  Russians  regard 
the  matter  in  various  lights.  Others,  again,  make  allowance  for  their  great  tempta- 
tions. On  five  festivals  in  the  year,  at  least,  such  as  Christmas,  New 
Year,  Easter,  etc.,  the  priest  is  supposed  to  go  the  round  of  his  parish  and 
say  a  prayer  in  every  house  ;  and  on  these  festive  occasions  refreshment 
stands  on  the  sideboard,  and  vodka,  or  spirits,  is  offered  as  drink— the 
evil  results  of  which  I  myself  could  not  but  observe  in  the 


{n}  THROUGH  SIBERIA. 

villages  of  the  Ob,  where  the  clergy,  like  the  peasants,  seemed  decidedly 
superior  to  those  in  Russia.  On  arriving  at  a  post -station,  I  not  unfrequently  sent  for 
or  called  upon  the  priest,  gave  him  tracts  to  circulate 
in  his  parish. 

Let  me  now  pass  to  the  monastic  clergy,  who  alone 
fill  all  the  higher  offices  in  the  Russian  Church. 

Digitized by Google
"""
FR_PAGE = """Le smotritiel de la vingt-quatrième station est un juif. 
Il prétend qu’il n’a pas de chevaux disponibles. Les filles se promènent en 
troupes, vêtues de robes de cou- 
leur éblouissante, rouge, rose, vert tendre et jaune foncé. 



{n} 


A TRAVERS LA SIBÉRIE 


Nous sommes passés du bassin de l’Ob dans celui de 
l’Yeniseï, sans nous en apercevoir. 




Forêt de bouleaux 
"""
DE_GARBAGE = """«  ntd)t,  ©ie  Stoffen  werfen  gewöhnlich,  ehe  fte  ben  Gmag 
hülfen  /  eine  97?efferfyi£e  tooü  Salj  in«  ®la«. Seine  Softer  Süfe,  bic  Don  ihrem  achten  Satire  an  in  einer  eng* 
Ufd;en  $enjton«anflalt  in  $ari«  enogen  worben  mar,  war  ba«  Saljr  vor 
unferer  Stnfunft  jurücfgefehrt  unb  traf  erjl  ihren  SSater  in  9lertf$tn$f"""

def run():
    en = ''.join(EN_PAGE.format(n=170 + i) for i in range(6))
    out, log, q = clean(en, 'en')
    assert 'THROUGH SIBERIA' not in out, 'running head left'
    assert 'temptations' in out and 'tempta-' not in out, 'dehyphenation failed'
    assert 'Digitized by Google' not in out, 'boilerplate left'
    assert 'observe in the villages of the Ob' in out, 'page-break paragraph not joined'
    assert q['verdict'] == 'good', q
    fr = ''.join(FR_PAGE.format(n=182 + i) for i in range(5))
    out2, log2, q2 = clean(fr, 'fr')
    assert 'A TRAVERS LA SIBÉRIE' not in out2 and 'couleur éblouissante' in out2, out2[:400]
    assert '[Illustration: Forêt de bouleaux]' in out2
    assert q2['verdict'] in ('good', 'usable'), q2
    q3 = quality(DE_GARBAGE, 'de'); assert q3['verdict'] == 'reject', q3
    print('EN', log, q); print('FR', log2, q2); print('DE garbage', q3); print('OK')
run()
