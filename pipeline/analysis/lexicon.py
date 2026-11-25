"""Многоязычный словарь этнонимов: форма источника → группа + уверенность сопоставления.

Порядок важен: более специфичные формы идут раньше (Ostyak-Samoyed раньше Ostyak),
совпавший фрагмент маскируется, чтобы не считаться дважды.
conf: high – однозначное сопоставление; medium – преобладающее значение, возможны иные;
      low – сильная неоднозначность (группа приводится как гипотеза).
ci = регистронезависимый поиск (используется для финских форм с падежными окончаниями).
"""
import csv, re, pathlib

L = []
def add(eid, src_label, group, conf, lang, pattern, ci=False, note=''):
    L.append(dict(ethnonym_id=eid, source_form=src_label, group_id=group, conf=conf, lang=lang,
                  pattern=pattern, ci=ci, note=note))

# --- сначала составные и специфичные формы ---
add('ostyak_samoyed','Ostyak-Samoyed','selkup','high','en/fr/de', r"\bOst[iy]a[ck]k?s?[- ]Samoy[eè]d\w*|\bOstjak-Samojed\w*")
add('ostyak_samoyed','ostjakkisamojedi','selkup','high','fi', r"\bostjakki-?samojed\w*", ci=True)
add('yenisei_ostyak','Yenisei Ostyak','ket','high','en/fr/de', r"\bYenis[es]e?i?[- ]Ost[iy]a[ck]k?s?\b|\bJenissei-Ostjak\w*")
add('yenisei_ostyak','jenisein ostjakki','ket','high','fi', r"\bjenisein ostjak\w*", ci=True)
add('political_exile','political exile','political_exiles','high','en', r"\bpolitical (?:exiles?|prisoners?|offenders?|convicts?)\b|\bpoliticals\b|\b[Nn]ihilists?\b|\bpolitiki\b")
add('political_exile','exilé politique','political_exiles','high','fr', r"\b(?:exilés?|condamnés?|déportés?) politiques?\b")
add('political_exile','politische Verbannte','political_exiles','high','de', r"\bpolitische[nr]? (?:Verbannte[nr]?|Gefangene[nr]?|Sträflinge?)\b")
add('political_exile','poliittinen vanki','political_exiles','high','fi', r"\bpoliittis\w* (?:vang\w*|karkotet\w*|karkoitet\w*|pakolai\w*)", ci=True)
add('little_russian','Little Russian','ukrainian','high','en/de/fr', r"\bLittle[- ]Russians?\b|\bUkrainians?\b|\bMalo-?[Rr]ussians?\b|\bPetits?-Russiens?\b|\bKleinrussen\b")
add('little_russian','vähävenäläinen','ukrainian','high','fi', r"\bvähävenäläi\w*", ci=True)
add('old_believer','Old Believer / Raskolnik','old_believer','high','en/fr/de', r"\bOld[- ]Believers?\b|\bRaskolniks?\b|\bStarover\w*|\bvieux[- ]croyants\b|\bAltgläubige\w*")
add('old_believer','vanhauskolainen','old_believer','high','fi', r"\bvanhauskoi\w*|\bvanhauskolai\w*|\braskolnik\w*", ci=True)

# --- коренные народы ---
add('ostyak','Ostyak / Ostiak','khanty','medium','en', r"\bOst[iy]a(?:c?k)s?\b|\bOstjaks?\b", note='default Khanty; may denote Selkups (Narym) or Kets (Yenisei)')
add('ostyak','Ostiak / Ostiaque','khanty','medium','fr', r"\bOstia(?:k|que)s?\b")
add('ostyak','Ostjake','khanty','medium','de', r"\bOstjak(?:en|e)\b")
add('ostyak','ostjakki','khanty','medium','fi', r"\bostjak\w*", ci=True, note='in Narym/Tym region (Donner, Svinhufvud) likely Selkups')
add('vogul','Vogul','mansi','high','en/fr/de', r"\b[VW]ogou?l(?:s|es|en)?\b")
add('vogul','voguli','mansi','high','fi', r"\bvogul\w*", ci=True)
add('yurak','Yurak','nenets','high','en/de/fi', r"\bYuraks?\b|\bJuraken\b|\bjurakk\w*")
add('samoyed','Samoyed','samoyedic','high','en/fr', r"\bSamo[iy][eè]d(?:e|es|s)?\b")
add('samoyed','Samojede','samoyedic','high','de', r"\bSamojeden?\b")
add('samoyed','samojedi','samoyedic','high','fi', r"\bsamojed\w*", ci=True, note="Donner's 'samojedit' are mostly Selkups and Kamassians")
add('kamas','Kamassian','kamas','high','all', r"\b[Kk]amass\w*|\b[Kk]amasilai\w*")
add('tungus','Tungus','evenki_even','high','en/fr', r"\bT[ou]{1,2}ng[ou]{1,2}s(?:es|ians?|e)?\b|\bTongouses?\b")
add('tungus','Tunguse','evenki_even','high','de', r"\bTungusen?\b")
add('tungus','tunguusi','evenki_even','high','fi', r"\btunguus\w*", ci=True)
add('lamut','Lamut','evenki_even','high','en/fr', r"\bLam[ou]{1,2}t(?:e|es|s)?\b|\bOrochons?\b")
add('yakut','Yakut / Yakute','sakha','high','en', r"\bYak[ou]{1,2}t(?:e|es|s)?\b|\bIakout(?:e|es)?\b")
add('yakut','Jakute','sakha','high','de/fr', r"\bJakut(?:e|en)\b|\bIakoutes?\b")
add('yakut','jakuutti','sakha','high','fi', r"\bjakuut\w*", ci=True)
add('buryat','Buriat','buryat','high','en/fr/de', r"\bBour?[iy]at(?:e|es|s)?\b|\bBuriät\w*|\bBurjät\w*|\bBuräten\b|\bBratski\b(?![- ]?Ostrog)")
add('buryat','burjaatti','buryat','high','fi', r"\bburjaat\w*|\bburjat\w*", ci=True)
add('chukchi','Chukchi / Tchuktchi','chukchi','high','en/fr', r"\bT?[CT]h?ouk?t?chi?s?\b|\bT?[CT]h?ukch[ei]e?s?\b|\bTchuktchis?\b|\bTchoutches\b")
add('chukchi','Tschuktschen','chukchi','high','de', r"\bTschuktsch\w*")
add('chukchi','Tuski (Hooper 1853)','chukchi','medium','en', r"\bTuski\b")
add('chukchi','tšuktši','chukchi','high','fi', r"\btšuktš\w*|\btshuktsh\w*", ci=True)
add('koryak','Koryak / Korak','koryak','high','en/fr/de', r"\bKor[iy]?aks?\b|\bKoriaques\b|\bKorjaken\b")
add('kamchadal','Kamchadal','itelmen_kamchadal','medium','en/fr/de', r"\bKam(?:t|s)?[cs]?ch?adal(?:e|es|s)?\b|\bKamtschadal\w*|\bItelm\w*", note='often mixed Itelmen-Russian population')
add('yukaghir','Yukaghir','yukaghir','high','en/fr/de', r"\b[YJ]?[UO]u?kag[h]?ir\w*|\bYoukaghir\w*")
add('gilyak','Gilyak','nivkh','high','en/fr/de', r"\bGh?il[iy]a(?:k|ck|que)s?\b|\bGiljaken\b")
add('ainu','Aino / Ainu','ainu','high','en/fr/de', r"\bAin[ou]s?\b")
add('gold','Gold / Goldi','nanai_amur','high','en', r"\bGold(?:i|s)\b(?![- ]?(?:mine|field|dust|digg))|\bOrotch\w*|\bOroch\w*|\bManegr\w*")
add('soyot','Soyot / Uriankhai','tuvan','high','en/de', r"\bSoyots?\b|\bSojoten\b|\bUriankha\w*")
add('kalmyk','Kalmyk / Calmuck','altai_kalmyk','low','en/fr/de', r"\b[KC]alm[uyo]u?c?ks?\b|\bKalmouks?\b|\bKalmück\w*|\bKalmyk\w*")
add('kalmyk','kalmukki','altai_kalmyk','low','fi', r"\bkalmuk\w*", ci=True)
add('kirghiz','Kirghiz','kazakh_kirghiz','medium','en/fr', r"\bKirgh?[iue][zs]\w*|\bKirguises?\b|\bKazakhs?\b", note='19th-c. "Kirghiz" in W. Siberia = Kazakhs')
add('kirghiz','Kirgise','kazakh_kirghiz','medium','de', r"\bKirgis\w*")
add('kirghiz','kirgiisi','kazakh_kirghiz','medium','fi', r"\bkirgii?s\w*", ci=True)
add('tartar','Tartar / Tatar','siberian_tatar','low','en', r"\bT[ae]rtars?\b(?! [Cc]ity| [Gg]ate| [Ww]all)|\bTatars?\b", note='very ambiguous: Siberian/Volga Tatars, Mongols, generic Asians')
add('tartar','Tartare','siberian_tatar','low','fr', r"\bTartares?\b|\bTatars?\b")
add('tartar','Tatare','siberian_tatar','low','de', r"\bTatar(?:en|e)\b|\bTartaren\b")
add('tartar','tataari','siberian_tatar','low','fi', r"\btataar\w*", ci=True)
add('mongol','Mongol','mongol','high','en/fr/de', r"\bMongols?\b|\bMongolians\b|\bMongolen\b|\bKhalkhas?\b")
add('mongol','mongoli','mongol','high','fi', r"\bmongolit\b|\bmongolien\b|\bmongolilai\w*", ci=True)
add('natives','natives / aborigines','natives_generic','high','en', r"\b[Nn]atives\b|\b[Aa]borigines\b|\b[Ii]norodt?[sz]\w*")
add('natives','indigènes','natives_generic','high','fr', r"\bindigènes\b|\bnaturels du pays\b|\baborigènes\b")
add('natives','Eingeborene','natives_generic','high','de', r"\bEingeborene[n]?\b")
add('natives','alkuasukkaat','natives_generic','high','fi', r"\balkuasuk\w*|\balkuasukkai\w*", ci=True)

# --- переселенцы и иные ---
add('russian','Russians / moujik','russian','medium','en', r"\bRussians\b|\bmou?[jz]h?iks?\b|\bMou?[jz]h?iks?\b", note='noun plural and muzhik only; adjective not counted')
add('russian','Russes','russian','medium','fr', r"\b(?:[Ll]es|des|aux|deux|ces) Russes\b|\bmoujiks?\b")
add('russian','Russen','russian','medium','de', r"\bRussen\b")
add('russian','venäläiset','russian','medium','fi', r"\bvenäläis(?:et|ten|iä|ille|ilta|iin|issä|iltä|ilä)\b", ci=True)
add('russian_pejor','ryssä (pejorative)','russian','medium','fi', r"\bryss\w*", ci=True, note='pejorative Finnish term')
add('cossack','Cossack','cossack','high','en/fr/de', r"\b[CK]oss?acks?\b|\bCosaques?\b|\bKosak\w*")
add('cossack','kasakka','cossack','high','fi', r"\bkasak\w*|\bkasakk\w*", ci=True)
add('sibiriak','Siberians / Sibiriaks','sibiriak','medium','en/fr/de', r"\bSiberians\b|\bSibiriaks?\b|\bSibiri?aki\b|\bSibériens\b|\bSibirier\w*|\bSibirjaken\b", note='may mean all inhabitants of Siberia')
add('sibiriak','siperialainen','sibiriak','medium','fi', r"\bsiperialai(?:set|sten|sia|siin|sille)\b", ci=True)
add('settlers','settlers / emigrants','pereselentsy','medium','en', r"\b(?:emigrants|immigrants|colonists|settlers|pereselentsi|pereselentsy)\b")
add('settlers','colons / émigrants','pereselentsy','medium','fr', r"\bcolons\b|\bémigrants\b")
add('settlers','Ansiedler / Kolonisten','pereselentsy','medium','de', r"\bAnsiedler\w*|\bKolonisten\b|\bÜbersiedler\w*|\bAuswanderer\b")
add('settlers','siirtolaiset','pereselentsy','medium','fi', r"\bsiirtolai\w*|\buudisasuk\w*", ci=True, note="in Granö mostly Finnish colonists")
add('pole','Poles','pole','high','en', r"\bPoles\b|\bPolish (?:exiles?|prisoners?|insurgents?|convicts?|gentleman|lady)\b|\b(?:a|young|old|another|one) Pole\b")
add('pole','Polonais','pole','high','fr', r"\bPolonais(?:es?)?\b")
add('pole','Polen (people)','pole','high','de', r"\b(?:die|der|den|zwei|drei|einige|viele|als) Polen\b|\bPole\b(?!n)")
add('pole','puolalainen','pole','high','fi', r"\bpuolalai\w*", ci=True)
add('jew','Jews','jew','high','en', r"\bJews?\b|\bJewess\w*|\bHebrews\b")
add('jew','Juifs','jew','high','fr', r"\bJuifs?\b|\bJuives?\b|\bIsraélites\b")
add('jew','Juden','jew','high','de', r"\bJuden?\b|\bJüdin\w*")
add('jew','juutalainen','jew','high','fi', r"\bjuutalai\w*", ci=True)
add('finn','Finns / Esthonians','finn_estonian','high','en/fr/de', r"\bFinns\b|\bFinlanders\b|\bEst?honians?\b|\bFinnois\b|\bFinlandais\b|\bFinnen\b|\bEsten\b")
add('finn','suomalaiset / virolaiset','finn_estonian','high','fi', r"\bsuomalai\w*|\bvirolai\w*|\beestiläi\w*", ci=True)
add('german','Germans','german','medium','en/fr/de', r"\bGermans\b|\bAllemands\b|\b(?:die|der|den) Deutschen\b")
add('german','saksalaiset','german','medium','fi', r"\bsaksalai\w*", ci=True)
add('volga','Chuvash/Mordvin/Bashkir/Zyrian/Votyak','volga_peoples','high','all', r"\bT?[Cc]h?uvash\w*|\bTschuwasch\w*|\bMordv\w*|\bMordw\w*|\bBa[cs]h?kirs?\b|\bBaschkir\w*|\bZyri?ans?\b|\bSyrjänen\b|\bsyrjään\w*|\bVotj?a?i?aks?\b|\bWotjaken\b|\bCheremiss\w*|\bTscheremiss\w*")
PEOPLE_NOUNS = r"(?:merchants?|traders?|coolies|labou?rers?|workmen|workers|people|population|soldiers|troops|officials?|officers?|shopkeepers?|settlers|inhabitants|women|men|man|woman|boys?|girls?|servants?|pedlars|peddlers|colonists|subjects|residents|community|crowd|guests?|clerks?|bandits|brigands|robbers|hunghutzes|gardeners|farmers|peasants|mandarins?|interpreters?|carters|drivers|boatmen|cook|wife|wives|children|families|immigrants)"
add('chinese','Chinese (people)','chinese','high','en', r"\b(?:[Tt]he|many|some|two|three|four|several|few|of|by|with|and|rich|poor|these|those|our|his|whom)\s+Chinese\b(?!\s+(?:[a-z]|Empire|Government|Eastern|Frontier|Wall|Republic|Revolution|Railway|Turkestan|Customs|Emperor))|\bChinese\s+" + PEOPLE_NOUNS + r"\b|\bChinam[ae]n\b|\bCelestials\b", note='adjectival uses (Chinese tea, Chinese side) excluded')
add('chinese','Chinois','chinese','medium','fr', r"\bChinois(?:es?)?\b")
add('chinese','Chinesen','chinese','medium','de', r"\bChinese[n]?\b")
add('chinese','kiinalainen','chinese','medium','fi', r"\bkiinalai\w*", ci=True)
add('korean','Koreans','korean','high','en/fr/de', r"\b[KC]oreans\b|\b(?:a|the|one|my|two|three|old|young) [KC]orean\b(?!\s+(?:[a-z]|Peninsula|Empire|Government))|\bCoréens\b|\bKoreaner\b")
add('manchu','Manchu','manchu','high','en/fr/de', r"\bMan(?:t?ch|dch|dsch)o?us?\b|\bManchoos?\b|\bMandschu(?:s|en)?\b")
add('japanese','Japanese (people)','japanese','high','en', r"\b(?:[Tt]he|many|some|two|three|several|few|of|by|with|and|these|those|our|whom)\s+Japanese\b(?!\s+(?:[a-z]|Empire|Government|Sea|Islands?|Emperor))|\bJapanese\s+" + PEOPLE_NOUNS + r"\b|\bJaps?\b", note="'Japs' pejorative; adjectival uses excluded")
add('japanese','Japonais/Japaner','japanese','medium','fr/de/fi', r"\bJaponais\b|\bJapaner\w*|\bjapanilai\w*")
add('czech','Czechs','czech_slovak','high','en/fr/de/fi', r"\bCzechs?\b|\bCzecho-?[Ss]lovaks?\b|\bTchèques\b|\bTschechen\b|\btšekki\w*")
add('exile','exiles / convicts','exiles','medium','en', r"\b(?:exiles|convicts?|deportees?|forçats?|katorzhniks?|katorshniks?)\b|\b(?:an|the|this|that|old|young|every|each|one|another|female|male|political|Polish) exile\b(?!\s+(?:system|life|road|station|of|in))", note='prisoners (POWs) excluded')
add('exile','exilés / forçats','exiles','medium','fr', r"\b(?:exilés?|déportés?|forçats|condamnés)\b")
add('exile','Verbannte / Sträflinge','exiles','medium','de', r"\b(?:Verbannte[nr]?|Sträflinge?|Deportierte[nr]?|Zwangsarbeiter)\b")
add('exile','karkotetut / pakkotyövangit','exiles','medium','fi', r"\bkarkotet\w*|\bkarkoitet\w*|\bpakkotyö\w*|\bmaanpakolai\w*", ci=True)
add('tramp','brodyagi / tramps','tramps','high','en/fr/de/fi', r"\bbrodiag\w*|\bbrodyag\w*|\bbrodjag\w*|\bBrodjag\w*|\bescaped convicts?\b|\bvagabonds\b")

# --- нидерландские формы (Delpher, переводы XIX в.) ---
add('ostyak','Ostjak (nl)','khanty','medium','nl', r"\bOstjak(?:en|ken)\b")
add('vogul','Wogul (nl)','mansi','high','nl', r"\b[VW]ogul(?:en|s)\b")
add('samoyed','Samojeed (nl)','samoyedic','high','nl', r"\bSamoje(?:e|)d(?:en)?\b")
add('tungus','Toengoes (nl)','evenki_even','high','nl', r"\bT(?:oe|u)ngoe[sz](?:en)?\b|\bTungus(?:en)?\b")
add('yakut','Jakoet (nl)','sakha','high','nl', r"\bJakoet(?:en)?\b|\bJakut(?:en)?\b")
add('buryat','Boerjaat (nl)','buryat','high','nl', r"\bBoerja(?:a)?t(?:en)?\b|\bBurjat(?:en)?\b")
add('chukchi','Tsjoektsjen (nl)','chukchi','high','nl', r"\bTsjoektsj\w*|\bTschuktsch\w*")
add('koryak','Korjaken (nl)','koryak','high','nl', r"\bKor[ij]ak(?:en)?\b")
add('kamchadal','Kamtschadalen (nl)','itelmen_kamchadal','medium','nl', r"\bKamtsch?adal(?:en)?\b")
add('gilyak','Giljaken (nl)','nivkh','high','nl', r"\bGil[jy]ak(?:en)?\b")
add('kirghiz','Kirgiezen (nl)','kazakh_kirghiz','medium','nl', r"\bKirgie?z(?:en)?\b|\bKirgiezen\b")
add('tartar','Tartaren (nl)','siberian_tatar','low','nl', r"\bTart(?:aren|aar)\b|\bTatar(?:en)?\b")
add('mongol','Mongolen (nl)','mongol','high','nl', r"\bMongol(?:en)?\b")
add('natives','inboorlingen (nl)','natives_generic','high','nl', r"\binboorlingen\b|\binlanders\b")
add('russian','Russen (nl)','russian','medium','nl', r"\bRussen\b|\bmoe[sz]j?iks?\b")
add('cossack','Kozakken (nl)','cossack','high','nl', r"\bKozak(?:ken)?\b")
add('pole','Polen (nl, people)','pole','high','nl', r"\b(?:de|der|twee|drie|vele|enige|enkele) Polen\b|\bPool\b")
add('jew','Joden (nl)','jew','high','nl', r"\bJo(?:o|)d(?:en)?\b|\bJodin\b")
add('chinese','Chineezen (nl)','chinese','medium','nl', r"\bChinee[sz](?:en)?\b")
add('german','Duitsers (nl)','german','medium','nl', r"\bDuitsers\b")
add('finn','Finnen (nl)','finn_estonian','high','nl', r"\bFinnen\b")
add('exile','bannelingen (nl)','exiles','medium','nl', r"\bbanneling(?:en)?\b|\bgedeporteerden\b|\bdwangarbeiders\b|\bgevangenen\b")
add('settlers','kolonisten (nl)','pereselentsy','medium','nl', r"\bkolonisten\b|\bvolksplanters\b|\blandverhuizers\b")

# --- v0.3: итальянский (it), датский/норвежский (da/no), польский (pl), чешский (cs) ---
# Формы с падежными окончаниями ищутся регистронезависимо по основе (ci=True) только там, где основа однозначна.
for lang, rules in {
 'it': [('ostyak','Ostiacchi','khanty','medium', r"\bOstiacch?[ih]\b|\bOstiaco\b"),('vogul','Voguli','mansi','high', r"\bVogul[ie]\b"),
        ('samoyed','Samoiedi','samoyedic','high', r"\bSamoied[ie]\b|\bSamojed[ie]\b"),('yurak','Juraki','nenets','high', r"\bJurak[ih]?\b"),
        ('tungus','Tungusi','evenki_even','high', r"\bTungus[ie]\b"),('yakut','Iacuti','sakha','high', r"\b[IJY]akut[ie]\b|\bJacut[ie]\b"),
        ('buryat','Buriati','buryat','high', r"\bBuriat[ie]\b|\bBurjat[ie]\b"),('chukchi','Ciukci','chukchi','high', r"\bCiukc[ie]\b|\bTsciukts\w*"),
        ('kirghiz','Chirghisi','kazakh_kirghiz','medium', r"\bChirghis[ie]\b|\bKirghis[ie]\b"),('tartar','Tartari','siberian_tatar','low', r"\bTartar[io]\b|\bTatar[io]\b"),
        ('mongol','Mongoli','mongol','high', r"\bMongol[io]\b"),('kalmyk','Calmucchi','altai_kalmyk','medium', r"\bCalmucch?[io]\b"),
        ('natives','indigeni','natives_generic','high', r"\bindigen[ie]\b|\baborigen[ie]\b"),('russian','Russi','russian','medium', r"\b(?:i|dei|ai|coi|dai|degli) Russi\b|\bmugik\w*"),
        ('cossack','Cosacchi','cossack','high', r"\bCosacch?[io]\b"),('exile','esiliati','exiles','medium', r"\besiliat[io]\b|\bdeportat[io]\b|\bforzat[io]\b"),
        ('chinese','Cinesi','chinese','medium', r"\b(?:i|dei|ai|coi) Cinesi\b"),('jew','Ebrei','jew','high', r"\bEbre[io]\b"),('pole','Polacchi','pole','high', r"\bPolacch[ih]\b")],
 'da/no': [('ostyak','Ostjaker','khanty','medium', r"\bOstjak(?:er|erne|kerne)?\b"),('samoyed','Samojeder','samoyedic','high', r"\bSamojed(?:er|erne)?\b"),
        ('yurak','Juraker','nenets','high', r"\bJurak(?:er|erne)\b"),('tungus','Tunguser','evenki_even','high', r"\bTungus(?:er|erne)?\b"),
        ('yakut','Jakuter','sakha','high', r"\bJakut(?:er|erne)?\b"),('buryat','Burjater','buryat','high', r"\bBur[ij]at(?:er|erne)?\b"),
        ('chukchi','Tsjuktsjer','chukchi','high', r"\bTs?(?:j|ch)uk(?:t)?s?(?:j|ch)\w*"),('kirghiz','Kirgiser','kazakh_kirghiz','medium', r"\bKirgis(?:er|erne)?\b"),
        ('tartar','Tatarer','siberian_tatar','low', r"\bTatar(?:er|erne)\b|\bTartar(?:er|erne)\b"),('mongol','Mongoler','mongol','high', r"\bMongol(?:er|erne)\b"),
        ('kalmyk','Kalmukker','altai_kalmyk','medium', r"\bKalmuk(?:ker|kerne)?\b"),('natives','indfødte','natives_generic','high', r"\b[Ii]ndfødte\b|\b[Ii]nnfødte\b"),
        ('russian','Russere','russian','medium', r"\bRusser(?:e|ne)\b|\bmuzjik\w*|\bmushik\w*"),('cossack','Kosakker','cossack','high', r"\bKosak(?:ker|kerne)?\b"),
        ('exile','forvisede','exiles','medium', r"\b[Ff]orvis(?:te|ede)\b|\b[Dd]eporter(?:te|ede)\b|\b[Ff]anger(?:ne)?\b|\b[Ss]traffange\w*"),
        ('chinese','Kinesere','chinese','medium', r"\bKines(?:er|ere|erne)\b"),('jew','Jøder','jew','high', r"\bJød(?:er|erne)?\b"),('pole','Polakker','pole','high', r"\bPolak(?:ker|kerne)?\b"),
        ('settlers','nybyggere','pereselentsy','medium', r"\b[Nn]ybygger(?:e|ne)?\b|\b[Kk]olonist(?:er|erne)\b|\b[Uu]dvandrer(?:e|ne)\b")],
 'pl': [('ostyak','Ostiacy','khanty','medium', r"\bOstia(?:cy|k\w*)"),('samoyed','Samojedzi','samoyedic','high', r"\bSamojed\w*"),('tungus','Tunguzi','evenki_even','high', r"\bTungu[zs]\w*"),
        ('yakut','Jakuci','sakha','high', r"\bJaku(?:ci|t\w*)"),('buryat','Buriaci','buryat','high', r"\bBur[iy]a(?:ci|t\w*)"),('chukchi','Czukcze','chukchi','high', r"\bCzukcz\w*"),
        ('kirghiz','Kirgizi','kazakh_kirghiz','medium', r"\bKirgi[zs](?!k)\w*"),('tartar','Tatarzy','siberian_tatar','low', r"\bTatar(?:zy|ów|ami|om|a|em|in\w*)\b"),
        ('mongol','Mongołowie','mongol','high', r"\bMongoł\w*"),('kalmyk','Kałmucy','altai_kalmyk','medium', r"\bKałmu\w*"),('natives','krajowcy','natives_generic','high', r"\b[Kk]rajowc\w*|\b[Tt]ubylc\w*"),
        ('russian','Moskale/Rosjanie','russian','medium', r"\bMoskal\w*|\bRosjan\w*|\bmużyk\w*"),('cossack','Kozacy','cossack','high', r"\bKoza(?:cy|k\w*|cz\w*)"),
        ('exile','zesłańcy','exiles','medium', r"\b[Zz]esłań\w*|\b[Ww]ygnań\w*|\b[Kk]atorżn\w*|\b[Ww]ięźni\w*|\b[Ww]ięzień\b"),('pole','Polacy','pole','high', r"\bPolac\w*|\bPolak\w*|\brodak\w*"),
        ('jew','Żydzi','jew','high', r"\bŻyd\w*"),('chinese','Chińczycy','chinese','medium', r"\bChińczy\w*|\bChińczyk\w*"),('sibiriak','Sybiracy','sibiriak','medium', r"\bSybira\w*")],
 'cs': [('ostyak','Osťáci','khanty','medium', r"\bOs[tť]ák\w*|\bOsťac\w*"),('samoyed','Samojedi','samoyedic','high', r"\bSamojed\w*"),('tungus','Tungusové','evenki_even','high', r"\bTungus\w*"),
        ('yakut','Jakuti','sakha','high', r"\bJakut\w*"),('buryat','Burjati','buryat','high', r"\bBurjat\w*"),('chukchi','Čukčové','chukchi','high', r"\bČukč\w*"),
        ('kirghiz','Kirgizové','kazakh_kirghiz','medium', r"\bKirgiz(?!sk)\w*"),('tartar','Tataři','siberian_tatar','low', r"\bTatař\w*|\bTatar(?!sk)\w*"),('mongol','Mongolové','mongol','high', r"\bMongol(?:ové|ů|y|a|em)\b"),
        ('natives','domorodci','natives_generic','high', r"\b[Dd]omorod\w*"),('russian','Rusové','russian','medium', r"\bRus(?:ové|ů|y|ka|ky|ek)\b|\bmužik\w*"),('cossack','Kozáci','cossack','high', r"\bKozá[ck]\w*"),
        ('exile','vyhnanci','exiles','medium', r"\b[Vv]yhnan\w*|\b[Kk]atorž\w*|\b[Vv]ězn\w*|\b[Dd]eportovan\w*"),('settlers','přesídlenci','pereselentsy','medium', r"\b[Pp]řesídl\w*|\b[Kk]olonist\w*|\b[Vv]ystěhoval\w*"),
        ('czech','Čechové','czech_slovak','high', r"\bČech(?:ové|ů|y|a|ovi)\b|\blegionář\w*"),('jew','Židé','jew','high', r"\bŽid(?:é|ů|y|a|ovi|ovka)?\b"),('chinese','Číňané','chinese','medium', r"\bČíňan\w*")],
}.items():
    for eid, label, group, conf, pat in rules:
        add(eid, f'{label} ({lang})', group, conf, lang, pat)

# --- v0.4: добор полноты (аудит: формы, не покрытые правилами выше). Только существительные-названия людей;
# прилагательные (Mongolian, ostjakischen, tungusisch…) и топонимы (Yakutsk, Tunguska, Tartary) не входят. Язык — любой.
for eid, label, group, conf, pat in [
  ('buryat', 'Buriat (все формы)', 'buryat', 'high', r"\bB(?:o?u|oo)r[iy]?[aä]tt?(?:e|es|s|i|en|er|erne|y|ów|ové)?\b|\bBratsk[iy]\b(?![- ]?Ostrog)"),
  ('yakut', 'Yakut (все формы)', 'sakha', 'high', r"\b[YJI]a?[ck]?k[ou]u?t(?:i|es|e|s|en|er|erne|y|ów|ové)?\b"),
  ('ostyak', 'Ostiak (все формы)', 'khanty', 'medium', r"\bOst[iyj]a(?:[ck]k?|cc)(?:en|er|erne|ene|enes|es|s|i|o|a|e|he|hi|ów|ové|it|ki)?\b"),
  ('tungus', 'Tungus (все формы)', 'evenki_even', 'high', r"\bT[ou]{1,2}ng(?:ou|u)[sz](?:es|e|en|i|er|erne|y|ów|ové|it)?\b"),
  ('kirghiz', 'Kirghiz (все формы)', 'kazakh_kirghiz', 'medium', r"\bK[hy]?[iy]r?gh?[iy][sz](?:en|e|es|i|a|o|er|erne|eren|y|ów|ové|it)?\b"),
  ('samoyed', 'Samoyed (все формы)', 'samoyedic', 'high', r"\bSamo[iyj][eè]d(?:e|es|s|en|er|erne|ene|enes|i|ì|o|a|y|zi|ów|ové|it)?\b"),
  ('chukchi', 'Chukchi (все формы)', 'chukchi', 'high', r"\bT?[cs]h?[ou]{1,2}kt?[cs]h(?:i|is|es|e|ee|ees|a|as|en)\b|\bTschuktsch(?:en|e|is)\b|\bTUSKI\b"),
  ('cossack', 'Cossack (все формы)', 'cossack', 'high', r"\bCos?saques?\b|\bCOSSACKS?\b|\bKosak(?:ken|kene|ker|kerne|k)\b|\bKozak(?:ów|ami|a|i|om|iem|y)?\b|\bKozá(?:k|ci|ků)\b|\bkasakk\w*"),
  ('mongol', 'Mongol (все формы, без прилагательного)', 'mongol', 'high', r"\bMongol(?:s|e|es|en|i|er|erne|ové|owie|ów)?\b|\bMongolians\b"),
  ('tartar', 'Tatar/Tartar (все формы)', 'siberian_tatar', 'low', r"\bTatar(?:es|e|s|en|i|o|a|y|zy|ów|er|ere|erne|ové)?\b|(?<!cream of )(?<!crème de )\bTartar(?:es|e|s|i|en|o)?\b(?! emetic)"),
  ('yukaghir', 'Yukaghir (все формы)', 'yukaghir', 'high', r"\b[YJI][ou]u?k[ae]gh?ir(?:es|e|s|en|i)?\b"),
  ('yurak', 'Yurak (все формы)', 'nenets', 'high', r"\b[YJ]urak(?:s|en|ene|ens|er|erne|i|it)?\b"),
  ('vogul', 'Vogul (все формы)', 'mansi', 'high', r"\b[VW]ogou?l(?:es|e|s|en|i|ka|ky|it)?\b"),
]:
    add(eid, label, group, conf, 'all', pat, ci=True)

COMPILED = [(d, re.compile(d['pattern'], re.I if d['ci'] else 0)) for d in L]

def write_csv(path):
    with open(path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(L[0].keys())); w.writeheader(); w.writerows(L)

if __name__ == '__main__':
    write_csv(pathlib.Path(__file__).resolve().parents[1]/'data/ethnonyms.csv'); print(len(L), 'patterns')
