"""Этап 6: наборы данных для страницы отчёта (dash_data/*.json, формат {rows, meta})."""
import json, pathlib
import pandas as pd

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT/'dash_data'; OUT.mkdir(exist_ok=True)
CODE = pathlib.Path(__file__).read_text(encoding='utf-8')
OBS = {'europe_west': 'Западная Европа', 'europe_finland': 'Финляндия', 'europe_poland': 'Польша', 'america': 'США (контроль)'}
POL = {'negative': 'отрицательная', 'positive': 'положительная', 'ambivalent': 'амбивалентная', 'neutral': 'нейтральная'}
OBT = {'personal': 'личное наблюдение', 'generalization': 'обобщение', 'bookish': 'книжное знание', 'reported': 'пересказ', 'unmarked': 'не определено'}

def save(name, rows, inputs):
    meta = [{'label': '06_dashboard_data.py', 'value': CODE, 'type': 'code', 'lang': 'python'},
            {'label': 'Input', 'value': inputs},
            {'label': 'Pipeline', 'value': 'run_all.sh: 01_clean → 02_segment → lexicon/gazetteer → 03_extract → 04_annotate → 05_analyze; ручная экспертная разметка: data/expert_annotations.csv'}]
    json.dump({'rows': rows, 'meta': meta}, open(OUT/f'{name}.json', 'w', encoding='utf-8'), ensure_ascii=False)

W = pd.read_csv(ROOT/'data/works.csv').set_index('work_id')
lab = {w: f"{r.author.split(' (')[0].split()[-1]} {int(r.edition_year)}" for w, r in W.iterrows()}
lab.update({w: f"de Windt {int(r.edition_year)}" for w, r in W.iterrows() if w.startswith('dewindt')})
lab['dewindt1889'] = 'de Windt 1889'; lab['dewindt1903'] = 'de Windt 1903'; lab['leroybeaulieu1900'] = 'Leroy-Beaulieu 1900'; lab['vanderlip1903'] = 'Vanderlip 1903'

C = json.load(open(ROOT/'site_data/corpus.json'))
works = [dict(work_id=c['work_id'], author=lab[c['work_id']], observer=OBS[c['observer_group']], language=c['language'],
              translation='да' if c['translation'] else 'нет', words_total=c['words_total'], words_siberia=c['words_siberia'],
              mentions_siberia=c['mentions_siberia'], groups_described=c['groups_described'], per10k=c['mentions_per_10k']) for c in C]
save('works', sorted(works, key=lambda r: -r['per10k']), 'site_data/corpus.json')

S = json.load(open(ROOT/'site_data/summary.json'))
save('kpi', [dict(works=S['works'], words_total=S['words_total'], words_siberia=S['words_siberia'], mentions_siberia=S['mentions_siberia'],
                  groups=S['groups_found'], indigenous_groups=S['indigenous_groups'], places=S['places'], typed_relations=S['typed_relations'])],
     'site_data/summary.json')

V = pd.read_csv(ROOT/'analysis/results/visibility_per10k.csv', index_col=0); Vc = pd.read_csv(ROOT/'analysis/results/visibility_counts.csv', index_col=0)
G = pd.read_csv(ROOT/'data/groups.csv').set_index('group_id')
top = Vc.sum().sort_values(ascending=False)
top = [g for g in top.index if G.loc[g, 'category'] in ('indigenous', 'generic')][:14]
vis = []
for w in V.index:
    for g in top:
        vis.append(dict(work_id=w, author=lab[w], observer=OBS[W.loc[w, 'observer_group']], group=G.loc[g, 'name_ru'], group_id=g,
                        mentions=int(Vc.loc[w, g]), per10k=float(round(V.loc[w, g], 1))))
save('visibility', vis, 'analysis/results/visibility_per10k.csv, visibility_counts.csv (только коренные народы и обобщённые «туземцы», 14 самых упоминаемых)')

E = json.load(open(ROOT/'site_data/expert_stats.json'))
def polrows(lst, keymap=None):
    out = []
    for r in lst:
        k = keymap.get(r['key'], r['key']) if keymap else r['key']
        pc = lambda x: round(100*x, 1)
        out.append(dict(key=k, n=r['n'], negative_pct=pc(r['negative']), neg_lo_pct=pc(r['negative_ci'][0]), neg_hi_pct=pc(r['negative_ci'][1]),
                        positive_pct=pc(r['positive']), pos_lo_pct=pc(r['positive_ci'][0]), pos_hi_pct=pc(r['positive_ci'][1]),
                        ambivalent_pct=pc(r['ambivalent']), evaluative_pct=pc(r['evaluative_share'])))
    return out
save('polarity_observer', polrows(E['polarity_by_observer_indigenous'], OBS), 'site_data/expert_stats.json — экспертная выборка, описания коренных народов из европейских книг')
Pd = json.load(open(ROOT/'site_data/periods.json'))
save('polarity_period', polrows(Pd['expert_polarity_indigenous'], {'1: до 1880': 'до 1880', '2: 1880–1904': '1880–1904', '3: 1905–1920': '1905–1920'}),
     'site_data/periods.json — экспертная выборка, описания коренных народов, по году начала поездки')
obs = []
for o, d in E['obs_type_by_observer'].items():
    for t, v in d.items(): obs.append(dict(observer=OBS[o], obs_type=OBT[t], share_pct=round(100*v, 1)))
save('obs_type', obs, 'site_data/expert_stats.json — экспертная выборка, все описания из европейских книг')

Q = json.load(open(ROOT/'validation/quality_summary.json'))
quality = [dict(check='Упоминание действительно указывает на группу (до исправлений)', metric='точность', n=150, value=Q['mention_precision_round1']['precision'], lo=None, hi=None, verdict='исправлено'),
           dict(check='Упоминание действительно указывает на группу (итог)', metric='точность', n=100, value=Q['mention_precision_round2']['precision'], lo=0.915, hi=0.99, verdict='пригодно'),
           dict(check='Упоминание указывает на группу: тексты на it, da, no, pl, cs', metric='точность', n=40, value=0.95, lo=0.835, hi=0.986, verdict='пригодно (прилагательные исключены)'),
           dict(check='Добранные формы этнонимов (Buriats, cosaques, Ostiaken…) — название людей', metric='точность', n=40, value=0.88, lo=0.74, hi=0.95, verdict='пригодно'),
           dict(check='Единица экспертной выборки действительно описывает группу в Сибири', metric='доля валидных', n=250, value=0.92, lo=0.88, hi=0.948, verdict='пригодно; ошибки — топонимы и перенос региона'),
           dict(check='Регион «Сибирь» у абзацев без своих топонимов (OCR-книги)', metric='точность', n=30, value=0.77, lo=0.59, hi=0.88, verdict='осторожно: ~20% шума'),
           dict(check='Тип отношения по правилам против ручного', metric='точность', n=75, value=0.45, lo=0.35, hi=0.57, verdict='непригодно — профиль по ручной выборке'),
           dict(check='Детекторы дискурсов (после исправлений; 6 дискурсов по 10 абзацев)', metric='точность', n=60, value=0.75, lo=0.63, hi=0.84, verdict='нижняя оценка распространённости'),
           dict(check='Автомаршруты против ручных (14 книг)', metric='полнота остановок (медиана)', n=14, value=0.84, lo=None, hi=None, verdict='тау Кендалла 0,80; требуют проверки'),
           dict(check='Абзац верно отнесён к Сибири', metric='точность', n=80, value=Q['region_in_siberia_accuracy']['accuracy'], lo=0.815, hi=0.948, verdict='пригодно'),
           dict(check='Автоматическая оценочность против ручной', metric='каппа Коэна', n=84, value=0.25, lo=None, hi=None, verdict='непригодно — заменено ручной разметкой'),
           dict(check='Автоматический тип знания против ручного', metric='каппа Коэна', n=84, value=0.24, lo=None, hi=None, verdict='непригодно — заменено ручной разметкой'),
           dict(check='Автоматические темы против ручных', metric='микро-F1', n=84, value=0.51, lo=None, hi=None, verdict='только как ориентир')]
save('quality', quality, 'validation/*.csv (ручная проверка выборок)')

ST = json.load(open(ROOT/'site_data/stereotypes.json'))
keep = [s for s in ST if s['polarity'] in ('negative', 'positive', 'ambivalent')]
st = [dict(author=lab[s['work_id']], group=s['group_name'], polarity=POL[s['polarity']], stereotype=s['stereotype_ru'],
           knowledge=OBT[s['obs_type']], quote=(s['ctx'][:280] + ('…' if len(s['ctx']) > 280 else '')), pid=s['pid']) for s in keep]
save('stereotypes', st, 'data/expert_annotations.csv — описания с оценкой и сформулированным стереотипом')

RP = pd.read_csv(ROOT/'analysis/results/text_reuse_passages.csv')
P = {}
for l in open(ROOT/'corpus/paragraphs.jsonl', encoding='utf-8'):
    r = json.loads(l); P[r['pid']] = (r['text'], r['region'])
reuse = []
for r in RP.itertuples():
    bp = r.pid_a if r.borrower == r.work_a else r.pid_b; sp = r.pid_b if bp == r.pid_a else r.pid_a
    reuse.append(dict(borrower=lab[r.borrower], source=lab[r.source], kind='цитата с указанием автора' if r.acknowledged_in_paragraph else 'общая цитата' if r.kind == 'shared_quotation' else 'кандидат в заимствование',
                      shared_8grams=int(r.shared_8grams), region=P[bp][1], borrower_pid=bp, source_pid=sp, borrower_text=P[bp][0][:220] + '…'))
save('reuse', sorted(reuse, key=lambda x: -x['shared_8grams']), 'analysis/results/text_reuse_passages.csv')

NM = pd.read_csv(ROOT/'analysis/results/group_network_metrics.csv').head(12)
save('network', [dict(group=r.name, betweenness=float(r.betweenness), degree=int(r.degree), community=int(r.community)) for r in NM.itertuples()],
     'analysis/results/group_network_metrics.csv')

CI = json.load(open(ROOT/'site_data/summary.json'))['citations_top']
save('citations', [dict(cited=k, mentions=int(v)) for k, v in CI.items()], 'analysis/results/citations.csv')
print(sorted(p.name for p in OUT.iterdir()), len(st), len(reuse))

# ---------- v0.4: оценки из новой экспертной выборки (по всему корпусу, веса страт), если она размечена ----------
V4 = ROOT/'analysis/results/research/expert_v04_estimates.csv'
if V4.exists():
    T4 = pd.read_csv(V4)
    def prow(r):
        pc = lambda x: round(100*x, 1)
        return dict(key=r.key, n=int(r.n), negative_pct=pc(r.neg), neg_lo_pct=pc(r.neg_lo), neg_hi_pct=pc(r.neg_hi), positive_pct=pc(r.pos),
                    pos_lo_pct=pc(r.pos_lo), pos_hi_pct=pc(r.pos_hi), ambivalent_pct=pc(r.amb), evaluative_pct=pc(r.neg + r.pos + r.amb))
    note = 'data/expert_annotations_v04.csv — 230 валидных описаний коренных народов из 61 книги; веса страт; 95% ДИ — кластерный бутстреп по книгам'
    save('polarity_observer', [prow(r) for r in T4[T4.dimension.isin(['all', 'observer'])].itertuples()], note)
    save('polarity_period', [prow(r) for r in T4[T4.dimension == 'period'].itertuples()], note)
    EA = pd.read_csv(ROOT/'data/expert_annotations_v04.csv'); EA = EA[EA.pol != 'invalid']
    OB4 = {'british': 'Великобритания', 'french': 'Франция/Бельгия', 'german': 'Германия/Австрия', 'nordic': 'Скандинавия и Финляндия', 'polish': 'Польша',
           'south_central': 'Италия, Венгрия, Нидерланды'}
    OT4 = {'personal': 'личное наблюдение', 'generalization': 'обобщение', 'bookish': 'книжное знание', 'reported': 'пересказ'}
    obs = []
    for o, d in EA.groupby('obs'):
        tot = d.weight.sum()
        for t, lab_ in OT4.items(): obs.append(dict(observer=OB4[o], obs_type=lab_, share_pct=round(100*d[d.obs_m == t].weight.sum()/tot, 1)))
    obs.append({}) if False else None
    for t in ('не определено',): pass
    save('obs_type', obs, note)
    POL4 = {'neg': 'отрицательная', 'pos': 'положительная', 'amb': 'амбивалентная'}
    FR4 = {'ethno': 'этнография', 'contact': 'контакт', 'econ': 'хозяйство', 'decline': 'упадок', 'civ': 'иерархия цивилизованности', 'relig': 'религия',
           'conflict': 'конфликт', 'admin': 'власть', 'other': 'прочее'}
    st = [dict(author=r.work, group=r.group, polarity=POL4[r.pol], stereotype=r.stereotype, knowledge=OT4.get(r.obs_m, r.obs_m),
               quote=str(r.context)[:280] + ('…' if len(str(r.context)) > 280 else ''), pid=r.pid)
          for r in EA[EA.pol.isin(POL4) & EA.stereotype.notna() & (EA.stereotype.astype(str).str.len() > 0)].itertuples()]
    save('stereotypes', st, 'data/expert_annotations_v04.csv — описания с оценкой и сформулированным стереотипом')
    print('v04 expert datasets', len(st))
