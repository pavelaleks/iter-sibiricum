"""Данные для вкладки «Связи» (assets/links.js): две сети с доказательствами.

1. data/net/groups.json — «кого видят вместе»: группы, названные в одном предложении абзаца о Сибири.
   Рёбра хранятся по книгам ({книга: число предложений}), поэтому сайт сам пересчитывает сеть для любого
   периода, страны наблюдателя или одной книги. Узлы — группы с числом упоминаний по книгам.
   Каждое предложение сверено с текстом книги (texts/<книга>.json): если его нет в указанном абзаце,
   оно не попадает на сайт.
2. data/net/groups_ev.json — сами предложения: [книга, абзац, текст]; рёбра ссылаются на них по номеру.
   Грузится, только когда пользователь открывает связь.
3. data/net/intertext.json — «на кого опираются»: книги корпуса и авторитеты вне корпуса;
   ссылки (только подтверждённые verify_all.py, с абзацами, где названа фамилия) и текстовые заимствования
   (пары абзацев с общими 8-граммами из data/reuse.json; заимствованный отрывок сверен с текстом книги).

Типы отношений («торговля», «конфликт»…) не выгружаются: их размечают правила, и до экспертной проверки
они на сайте не показываются (решение руководителя 28.11.2026).

Запуск из корня сайта после verify_all.py: python3 pipeline/tools/network_data.py
"""
import collections, json, pathlib, re, csv

SITE = pathlib.Path(__file__).resolve().parents[2]
OUT = SITE / 'data/net'
J = lambda p: json.load(open(SITE / p, encoding='utf-8'))
ws = lambda s: re.sub(r'\s+', ' ', s or '').strip()


def main():
    OUT.mkdir(exist_ok=True)
    works = {w['id']: w for w in J('data/works.json')}
    groups = J('data/groups.json')
    texts = {}

    def para(w, pid):
        if w not in texts:
            f = SITE / f'texts/{w}.json'
            texts[w] = {p[0]: ws(p[4]) for p in J(f'texts/{w}.json')['p']} if f.exists() else {}
        return texts[w].get(pid, '')

    # ---------- 1. сеть групп ----------
    rows = list(csv.DictReader(open(SITE / 'pipeline/data/relations.csv', encoding='utf-8')))
    sent_id, sents, edges, dropped = {}, [], collections.defaultdict(lambda: {'w': collections.Counter(), 's': []}), 0
    for r in rows:
        if r['in_siberia'] != 'True' or r['group_a'] == r['group_b'] or r['work_id'] not in works:
            continue
        w, pid = r['work_id'], r['pid'].split('_p')[-1]
        s = ws(r['sentence'])
        if not s or s not in para(w, pid):
            dropped += 1
            continue
        k = (w, pid, s)
        if k not in sent_id:
            sent_id[k] = len(sents)
            sents.append([w, pid, s])
        a, b = sorted((r['group_a'], r['group_b']))
        e = edges[(a, b)]
        e['w'][w] += 1
        e['s'].append(sent_id[k])
    gids = {g['id'] for g in groups}
    nodes = []
    for g in groups:
        bw = g.get('by_work') or []
        if isinstance(bw, str):
            bw = json.loads(bw.replace("'", '"'))
        nodes.append({'id': g['id'], 'name': g['name'], 'name_en': g.get('name_en') or g['name'], 'cat': g.get('category'),
                      'w': {w: n for w, n in bw if w in works}})
    E = [{'a': a, 'b': b, 'w': dict(e['w']), 's': sorted(set(e['s']))} for (a, b), e in sorted(edges.items()) if a in gids and b in gids]
    WK = {w: {'label': m['label'], 'author': m['author'], 'year': m['year'], 'j0': m.get('j0'), 'period': m['period'], 'nat': m['nat'],
              'nat_ru': m.get('nat_ru'), 'nationality': m.get('nationality'), 'stay_ru': m.get('stay_ru')} for w, m in works.items()}
    json.dump({'works': WK, 'nodes': nodes, 'edges': E, 'n_sentences': len(sents), 'dropped': dropped},
              open(OUT / 'groups.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(sents, open(OUT / 'groups_ev.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))

    # ---------- 2. интертекстуальная сеть ----------
    V = J('data/verification.json')
    ok = set(V.get('cite_edges', []))
    cev = V.get('cite_ev', {})
    IN = J('data/networks.json')['intertext']
    inodes = {n['id']: n for n in IN['nodes']}
    links = []
    for l in IN['links']:
        if l['type'] != 'cites':
            continue
        k = f"{l['source']}>{l['target']}"
        if k in ok:
            links.append({'s': l['source'], 't': l['target'], 'type': 'cites', 'n': l['weight'], 'p': cev.get(k, [])})
    reuse = collections.defaultdict(list)
    r_drop = 0
    for x in J('data/reuse.json'):
        b, s = x['b'], x['s']
        if b not in works or s not in works:
            continue
        bp, sp = x['bp'].split('_p')[-1], x['sp'].split('_p')[-1]
        # отрывок должен быть в абзаце книги (OCR-копия сверяется по первым 60 знакам без пробелов и пунктуации)
        norm = lambda t: re.sub(r'\W+', '', t.lower())
        if norm(x.get('bt', ''))[:60] not in norm(para(b, bp)) or norm(x.get('st', ''))[:60] not in norm(para(s, sp)):
            r_drop += 1
            continue
        reuse[(b, s)].append({'kind': x.get('kind', ''), 'n': x.get('n'), 'bp': bp, 'sp': sp, 'bt': x.get('bt', ''), 'st': x.get('st', '')})
    for (b, s), L in reuse.items():
        links.append({'s': b, 't': s, 'type': 'reuse', 'n': len(L), 'x': L})
    used = {l['s'] for l in links} | {l['t'] for l in links}
    AF = {}
    m = re.search(r"AUTH_FROM = (\{.*?\})", (SITE / 'pipeline/validation/verify_all.py').read_text(encoding='utf-8'), re.S)
    if m:
        AF = eval(re.sub(r'#.*', '', m.group(1)))   # словарь литералов из того же скрипта: годы начала деятельности
    in_nodes = []
    for w, meta in works.items():
        in_nodes.append({'id': w, 'kind': 'work', 'label': meta['label'], 'year': meta['year'], 'nat': meta['nat'], 'period': meta['period']})
    for nid, n in inodes.items():
        if n['kind'] == 'authority' and nid in used:
            name = n.get('label') or nid.split(':', 1)[1]
            in_nodes.append({'id': nid, 'kind': 'authority', 'label': name, 'year': AF.get(name)})
    json.dump({'nodes': in_nodes, 'links': links, 'reuse_dropped': r_drop},
              open(OUT / 'intertext.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(f'группы: {len(nodes)} узлов, {len(E)} рёбер, {len(sents)} предложений (не найдено в тексте: {dropped}); '
          f'интертекст: {len(in_nodes)} узлов, {sum(l["type"] == "cites" for l in links)} ссылок, {len(reuse)} пар заимствований '
          f'({sum(len(v) for v in reuse.values())} отрывков; не сверено: {r_drop})')


if __name__ == '__main__':
    main()
