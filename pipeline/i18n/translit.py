import re
T=dict(zip('абвгдеёжзийклмнопрстуфхцчшщъыьэюя',['a','b','v','g','d','e','yo','zh','z','i','y','k','l','m','n','o','p','r','s','t','u','f','kh','ts','ch','sh','shch','','y','','e','yu','ya']))
def tw(w):
    out=[];prev=''
    for i,ch in enumerate(w):
        lo=ch.lower()
        if lo in T:
            v=T[lo]
            if lo=='е' and (i==0 or prev in 'аеёиоуыэюяъь'): v='ye'
            if lo=='й' and i==len(w)-1 and prev in 'иы': v='y'
            out.append(v.capitalize() if ch.isupper() and v else v)
        else: out.append(ch)
        prev=lo
    s=''.join(out)
    s=re.sub(r'iy\b','iy',s); s=re.sub(r'yy\b','y',s)
    return s
WELL={'Москва':'Moscow','Санкт-Петербург':'Saint Petersburg','Петербург':'Saint Petersburg','Сибирь':'Siberia','Байкал':'Baikal','оз. Байкал':'Lake Baikal','Урал':'Urals','Уральские горы':'Ural Mountains','Пекин':'Beijing','Париж':'Paris','Лондон':'London','Берлин':'Berlin','Вена':'Vienna','Варшава':'Warsaw','Хельсинки':'Helsinki','Выборг':'Vyborg','Монголия':'Mongolia','Китай':'China','Маньчжурия':'Manchuria','Япония':'Japan','Корея':'Korea','Аляска':'Alaska','США':'USA','Россия':'Russia','Финляндия':'Finland','Кавказ':'Caucasus','Тайга':'Taiga','Камчатка':'Kamchatka','Сахалин':'Sakhalin','Чукотка':'Chukotka','Забайкалье':'Transbaikalia','Приамурье':'Amur region','Приморье':'Primorye','Западная Сибирь':'Western Siberia','Восточная Сибирь':'Eastern Siberia','Дальний Восток':'Russian Far East','Средняя Азия':'Central Asia','Транссибирская магистраль':'Trans-Siberian Railway','Сибирский тракт':'Siberian Highway','пустыня Гоби':'Gobi Desert','Гоби':'Gobi','Великая Китайская стена':'Great Wall of China','Токио':'Tokyo','Шанхай':'Shanghai','Гонконг':'Hong Kong','Нагасаки':'Nagasaki','Хакодате':'Hakodate','Харбин':'Harbin','Урга (Улан-Батор)':'Urga (Ulaanbaatar)','Улан-Батор':'Ulaanbaatar','Тибет':'Tibet','Памир':'Pamir','Тянь-Шань':'Tian Shan','Казахская степь':'Kazakh Steppe','Нижний Новгород':'Nizhny Novgorod','Екатеринбург':'Yekaterinburg','Якутск':'Yakutsk','Владивосток':'Vladivostok','Иркутск':'Irkutsk','Петропавловск-Камчатский':'Petropavlovsk-Kamchatsky','Казань':'Kazan','Пермь':'Perm','Тюмень':'Tyumen','Тобольск':'Tobolsk','Омск':'Omsk','Томск':'Tomsk','Красноярск':'Krasnoyarsk','Кяхта':'Kyakhta','Чита':'Chita','Нерчинск':'Nerchinsk','Хабаровск':'Khabarovsk','Благовещенск':'Blagoveshchensk','Охотск':'Okhotsk','Енисейск':'Yeniseysk','Барнаул':'Barnaul','Семипалатинск':'Semipalatinsk','Самарканд':'Samarkand','Бухара':'Bukhara','Ташкент':'Tashkent','Кульджа':'Kulja (Yining)','Кашгар':'Kashgar','Калган':'Kalgan (Zhangjiakou)','Корея':'Korea','Европа':'Europe','Азия':'Asia','Тбилиси':'Tbilisi','Баку':'Baku','Рига':'Riga','Таллин':'Tallinn','Одесса':'Odessa','Гамбург':'Hamburg','Копенгаген':'Copenhagen','Стокгольм':'Stockholm'}
PRE=[(r'^р\. (.+)$',lambda m:f'{conv(m.group(1))} River'),(r'^оз\. (.+)$',lambda m:f'Lake {conv(m.group(1))}'),(r'^хр\. (.+)$',lambda m:f'{conv(m.group(1))} Range'),(r'^хребет (.+)$',lambda m:f'{conv(m.group(1))} Range'),
     (r'^о\. (.+)$',lambda m:f'{conv(m.group(1))} Island'),(r'^о-ва (.+)$',lambda m:f'{conv(m.group(1))} Islands'),(r'^зал\. (.+)$',lambda m:f'{conv(m.group(1))} Gulf'),(r'^залив (.+)$',lambda m:f'{conv(m.group(1))} Gulf'),(r'^бухта (.+)$',lambda m:f'{conv(m.group(1))} Bay'),
     (r'^перевал (.+)$',lambda m:f'{conv(m.group(1))} Pass'),(r'^ст\. (.+)$',lambda m:f'{conv(m.group(1))} station'),(r'^с\. (.+)$',lambda m:conv(m.group(1))),(r'^д\. (.+)$',lambda m:conv(m.group(1))),(r'^г\. (.+)$',lambda m:conv(m.group(1))),
     (r'^мыс (.+)$',lambda m:f'Cape {conv(m.group(1))}'),(r'^гора (.+)$',lambda m:f'Mount {conv(m.group(1))}'),(r'^долина (.+)$',lambda m:f'{conv(m.group(1))} Valley'),(r'^пустыня (.+)$',lambda m:f'{conv(m.group(1))} Desert'),(r'^ледник (.+)$',lambda m:f'{conv(m.group(1))} Glacier'),
     (r'^устье (.+)$',lambda m:f'mouth of the {conv(m.group(1))}'),(r'^пост (.+)$',lambda m:f'{conv(m.group(1))} post'),(r'^прииск (.+)$',lambda m:f'{conv(m.group(1))} mine'),(r'^монастырь (.+)$',lambda m:f'{conv(m.group(1))} monastery'),(r'^форпост (.+)$',lambda m:f'{conv(m.group(1))} outpost')]
def conv(s):
    s=s.strip()
    if s in WELL: return WELL[s]
    for rx,f in PRE:
        m=re.match(rx,s)
        if m: return f(m)
    m=re.match(r'^(.*?) \((.*)\)$',s)
    if m: return f'{conv(m.group(1))} ({conv(m.group(2))})'
    if ', ' in s: return ', '.join(conv(x) for x in s.split(', '))
    return ' '.join(tw(w) if re.search('[А-Яа-яЁё]',w) else w for w in s.split(' '))
def is_name(s):
    # имя собственное: без строчных русских слов, кроме служебных префиксов
    words=re.sub(r'\(.*?\)','',s).split()
    small=[w for w in words if re.match('^[а-яё]',w) and w.rstrip('.') not in ('р','оз','хр','о','о-ва','зал','бухта','перевал','ст','с','д','г','мыс','гора','долина','пустыня','ледник','залив','хребет','устье','пост','прииск','монастырь','форпост')]
    return not small
