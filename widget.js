'use strict';
/* Widget Grist « Pilotage des téléservices » — 100 % configurable via mapping de colonnes + engrenage ⚙ */
const DEF = {title:'Pilotage des téléservices', itemLabel:'téléservices', groupLabel:'Direction générale',
  subLabel:'Direction', theme:'auto', sort:'statut', closedStatus:'Fermé', colors:{}};
const ORDER = ['En service','En développement','Demande en cours','Fermé','Annulé'];
const BASE = {'En service':'#2fb35a','En développement':'#f5b83d','Demande en cours':'#4b8df8','Fermé':'#ec5f67','Annulé':'#8b94a3'};
const PAL = ['#a77bd6','#3ec1c1','#e58a4b','#d46aa8','#7aa63c','#c9a227'];
const NA = 'Non assignée';
let S = {...DEF}, M = null, ALL = [], CUR = null, SET = false, MODAL = null;
const F = {g:'', s:null, d:null, q:'', sort:null, asc:true, lim:48};
try { F.g = localStorage.getItem('tsg') || ''; } catch (e) {}

const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rank = s => { const i = ORDER.indexOf(s); return i < 0 ? 99 : i; };
const hash = s => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
const color = s => S.colors[s] || BASE[s] || PAL[hash(s) % PAL.length];
const lc = s => (s || '').charAt(0).toLowerCase() + (s || '').slice(1);
const ts = v => typeof v === 'number' ? v : (Date.parse(v) / 1000 || 0);
const fd = v => { if (v == null || v === '') return ''; const n = typeof v === 'number' ? v * 1000 : Date.parse(v);
  return isNaN(n) ? String(v) : new Date(n).toLocaleDateString('fr-FR'); };

// Normalise toute valeur Grist (texte, choix, référence, liste, booléen…) en texte lisible
function txt(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return v.filter(x => x !== 'L').map(txt).filter(Boolean).join(', ');
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'object') return txt(v.display ?? v.Libellé ?? Object.values(v).find(x => typeof x === 'string') ?? '');
  return String(v);
}
const label = id => id.replace(/_/g, ' ');

function build(recs, m) {
  ALL = recs.map(r => {
    const g = k => m[k] ? r[m[k]] : undefined;
    const meta = {};
    [].concat(m.meta || []).forEach(c => {
      const v = r[c];
      meta[c] = (/date/i.test(c) && typeof v === 'number') ? fd(v) : txt(v);
    });
    const o = {id: r.id, titre: txt(g('titre')), statut: txt(g('statut')) || '—', groupe: txt(g('groupe')) || NA,
      sub: txt(g('sub')), date: g('date'), dateFin: g('dateFin'), raw: r, desc: txt(g('desc')), url: txt(g('url')), m: meta};
    o.hay = [o.titre, o.statut, o.groupe, o.sub, o.desc, ...Object.entries(r).filter(([k]) => k !== 'id').map(([, v]) => txt(v))].join(' ').toLowerCase();
    return o;
  });
}

const sortKeys = () => [{k:'statut', l:'Statut'}, {k:'titre', l:'Titre'},
  ...(M.sub ? [{k:'sub', l:S.subLabel}] : []), ...(M.date ? [{k:'date', l:'Date'}] : []),
  ...[].concat(M.meta || []).map(c => ({k:'m:' + c, l:label(c)}))];

function cmp(a, b, k) {
  if (k === 'statut') return rank(a.statut) - rank(b.statut) || a.statut.localeCompare(b.statut, 'fr') || a.titre.localeCompare(b.titre, 'fr');
  if (k === 'date') return ts(a.date) - ts(b.date);
  const g = r => k.startsWith('m:') ? (r.m[k.slice(2)] || '') : (r[k] || '');
  return g(a).localeCompare(g(b), 'fr', {numeric: true});
}

const inGroup = () => ALL.filter(r => !F.g || r.groupe === F.g);
const subOf = r => r.sub || NA;
function visible() {
  const q = F.q.toLowerCase(), k = F.sort || S.sort;
  const a = inGroup().filter(r => (!F.s || r.statut === F.s) && (!F.d || subOf(r) === F.d) && (!q || r.hay.includes(q)));
  return a.sort((x, y) => (cmp(x, y, k) || x.titre.localeCompare(y.titre, 'fr')) * (F.asc ? 1 : -1));
}
function stats(rows) {
  const m = new Map(); rows.forEach(r => m.set(r.statut, (m.get(r.statut) || 0) + 1));
  return [...m].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'fr'));
}

function donut(rows) {
  const R = 70, C = 2 * Math.PI * R, tot = rows.length, st = stats(rows);
  let acc = 0;
  const segs = tot ? st.map(([s, n]) => {
    const len = n / tot * C, gap = st.length > 1 ? Math.min(2.5, len / 2) : 0;
    const o = `<circle class="seg${F.s && F.s !== s ? ' dim' : ''}" data-a="s" data-v="${esc(s)}" cx="100" cy="100" r="${R}" stroke="${color(s)}" stroke-dasharray="${len - gap} ${C - len + gap}" stroke-dashoffset="${-acc}"><title>${esc(s)} : ${n} (${Math.round(n / tot * 100)} %)</title></circle>`;
    acc += len; return o;
  }).join('') : `<circle class="seg" cx="100" cy="100" r="${R}" stroke="var(--bd)"/>`;
  const n = F.s ? (st.find(x => x[0] === F.s) || [0, 0])[1] : tot;
  return `<svg viewBox="0 0 200 200" role="img" aria-label="Répartition par statut"><g transform="rotate(-90 100 100)">${segs}</g>
    <text class="dn" x="100" y="104">${n}</text><text class="dl" x="100" y="122">${esc(F.s || S.itemLabel)}</text></svg>`;
}

function bars(rows) {
  const byG = !F.g, m = new Map();
  rows.forEach(r => { const k = byG ? r.groupe : subOf(r); const o = m.get(k) || {n: 0, s: {}};
    o.n++; o.s[r.statut] = (o.s[r.statut] || 0) + 1; m.set(k, o); });
  const L = [...m].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0], 'fr')), mx = L.length ? L[0][1].n : 1;
  return L.map(([k, o]) => `<div class="br${F.d === k ? ' on' : ''}" data-a="${byG ? 'g' : 'd'}" data-v="${esc(k)}" title="${esc(k)}">
    <span class="bl">${esc(k)}</span><div class="bt">${Object.entries(o.s).sort((a, b) => rank(a[0]) - rank(b[0])).map(([s, n]) =>
      `<i style="width:${n / mx * 100}%;background:${color(s)}" title="${esc(s)} : ${n}"></i>`).join('')}</div><b>${o.n}</b></div>`).join('')
    || '<div class="empty">Aucune donnée</div>';
}

function dateLine(r) {
  if (r.statut.toLowerCase() === S.closedStatus.toLowerCase()) return r.dateFin ? 'Fermé le ' + fd(r.dateFin) : '';
  if (!r.date) return '';
  return (ts(r.date) * 1000 > Date.now() ? 'Ouverture prévue le ' : 'Ouvert le ') + fd(r.date);
}

function card(r) {
  const c = color(r.statut);
  const chips = Object.entries(r.m).filter(([, v]) => v).slice(0, 6).map(([k, v]) => `<span><em>${esc(label(k))}</em>${esc(v)}</span>`).join('');
  return `<article class="card${r.id === CUR ? ' cur' : ''}" style="--c:${c}" data-a="card" data-v="${r.id}">
    <div class="ch"><span class="bg">${esc(r.statut)}</span><span>${esc(F.g ? subOf(r) : r.groupe)}</span></div>
    <h3>${esc(r.titre || '(sans titre)')}</h3>${r.desc ? `<p class="ds">${esc(r.desc)}</p>` : ''}
    ${chips ? `<div class="chips">${chips}</div>` : ''}
    <div class="cf"><span>${esc(dateLine(r))}</span>${/^https?:/i.test(r.url) ? `<a href="${esc(r.url)}" target="_blank" rel="noopener">Voir en ligne</a>` : ''}</div></article>`;
}

// Valeur lisible d'un champ brut (dates Grist = secondes epoch)
const fv = (k, v) => (typeof v === 'number' && /date|modifi/i.test(k))
  ? (/modifi/i.test(k) ? new Date(v * 1000).toLocaleString('fr-FR') : fd(v)) : txt(v);

function renderModal() {
  const m = $('#md'), r = ALL.find(x => x.id === MODAL);
  if (!r) { m.hidden = true; m.innerHTML = ''; return; }
  const rows = Object.entries(r.raw).filter(([k]) => k !== 'id' && !/^(gristHelper_|manualSort)/.test(k))
    .map(([k, v]) => [label(k), fv(k, v)]).filter(([, v]) => v);
  const val = v => /^https?:\/\/\S+$/i.test(v) ? `<a href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a>` : esc(v);
  const had = !m.hidden;
  m.hidden = false;
  m.innerHTML = `<div class="mp" role="dialog" aria-modal="true" aria-label="${esc(r.titre)}" style="--c:${color(r.statut)}">
    <div class="mh"><div><span class="bg">${esc(r.statut)}</span><h2>${esc(r.titre)}</h2>
    <p class="mu">${esc(r.groupe)} / ${esc(subOf(r))}</p></div><button class="ib" data-a="close" aria-label="Fermer">✕</button></div>
    <dl class="mb">${rows.map(([k, v]) => `<div class="mf${v.length > 90 ? ' w' : ''}"><dt>${esc(k)}</dt><dd>${val(v)}</dd></div>`).join('')}</dl></div>`;
  if (!had) m.querySelector('button').focus();
}

function render() {
  const app = $('#app');
  if (!M || !M.titre || !M.statut || !M.groupe) {
    app.innerHTML = '<div class="pn empty"><h2>Configuration requise</h2>Associez les colonnes « Titre », « Statut » et « Groupe principal » dans le panneau de droite de Grist.</div>';
    return;
  }
  if (!$('#kp')) shell();
  document.documentElement.dataset.theme = S.theme;
  const groups = [...new Set(ALL.map(r => r.groupe))].sort((a, b) => a.localeCompare(b, 'fr'));
  if (F.g && !groups.includes(F.g)) F.g = '';
  $('#ttl').textContent = S.title;
  $('#gl').textContent = S.groupLabel;
  $('#g').innerHTML = `<option value="">Toutes (${ALL.length})</option>` + groups.map(g =>
    `<option value="${esc(g)}"${g === F.g ? ' selected' : ''}>${esc(g)} (${ALL.filter(r => r.groupe === g).length})</option>`).join('');
  const gr = inGroup(), forDonut = gr.filter(r => !F.d || subOf(r) === F.d), forBars = gr.filter(r => !F.s || r.statut === F.s);
  $('#sub').textContent = `${F.g || 'Vue d’ensemble'} — ${gr.length} ${S.itemLabel}`;
  const st = stats(forDonut), tot = forDonut.length;
  $('#kp').innerHTML = `<button class="kt" data-a="s" data-v="" style="--c:var(--ac)"><b>${tot}</b><span>Total ${esc(S.itemLabel)}</span></button>` +
    st.map(([s, n]) => `<button class="kt${F.s === s ? ' on' : ''}" data-a="s" data-v="${esc(s)}" style="--c:${color(s)}"><b>${n}</b><span>${esc(s)} · ${Math.round(n / tot * 100)} %</span></button>`).join('');
  $('#donut').innerHTML = donut(forDonut);
  $('#bt').textContent = 'Répartition par ' + lc(F.g ? S.subLabel : S.groupLabel);
  $('#bars').innerHTML = bars(forBars);
  const keys = sortKeys(), sk = F.sort || (keys.some(x => x.k === S.sort) ? S.sort : 'statut');
  $('#so').innerHTML = keys.map(x => `<option value="${esc(x.k)}"${x.k === sk ? ' selected' : ''}>Trier par : ${esc(x.l)}</option>`).join('');
  $('#dir').textContent = F.asc ? '↑' : '↓';
  $('#fc').innerHTML = [F.s && ['s', F.s], F.d && ['d', F.d]].filter(Boolean).map(([a, v]) =>
    `<button class="fch" data-a="${a}" data-v="${esc(v)}">${esc(v)} ✕</button>`).join('');
  const rows = visible();
  $('#cnt').textContent = `${rows.length} ${S.itemLabel}`;
  $('#cards').innerHTML = rows.slice(0, F.lim).map(card).join('') || '<div class="empty">Aucun résultat pour ces filtres.</div>';
  $('#more').hidden = rows.length <= F.lim;
  if (MODAL !== null) renderModal();
}

function shell() {
  $('#app').innerHTML = `<header class="hd"><div><h1 id="ttl"></h1><p class="mu" id="sub"></p></div>
    <label class="sel"><span id="gl"></span><select id="g"></select></label>
    <button class="ib" data-a="gear" title="Paramètres du widget" aria-label="Paramètres">⚙</button></header>
    <section class="kp" id="kp"></section>
    <section class="row"><div class="pn"><h2>Répartition par statut</h2><div class="donut" id="donut"></div></div>
    <div class="pn"><h2 id="bt"></h2><div class="bars" id="bars"></div></div></section>
    <section class="pn"><div class="tb"><input id="q" type="search" placeholder="Rechercher un service, un référent…">
    <select id="so"></select><button class="ib" id="dir" data-a="dir" title="Inverser le tri"></button>
    <div class="fc" id="fc"></div><span class="cnt" id="cnt"></span></div>
    <div class="cards" id="cards"></div><button id="more" data-a="more">Afficher plus</button></section>
    <aside id="set" hidden></aside><div class="ov" id="md" data-a="close" hidden></div>`;
  $('#g').onchange = e => { F.g = e.target.value; F.s = F.d = null; F.lim = 48; try { localStorage.setItem('tsg', F.g); } catch (_) {} render(); };
  $('#q').oninput = e => { F.q = e.target.value; F.lim = 48; render(); };
  $('#so').onchange = e => { F.sort = e.target.value; render(); };
}

function openSet() {
  const a = $('#set'); a.hidden = !SET; if (!SET) return;
  const sts = [...new Set([...ORDER, ...ALL.map(r => r.statut)])];
  const keys = sortKeys();
  const f = (k, l) => `<label>${l}<input type="text" data-k="${k}" value="${esc(S[k])}"></label>`;
  a.innerHTML = `<div class="hd"><h2 style="flex:1;margin:0">Paramètres</h2><button class="ib" data-a="gear">✕</button></div>
    ${f('title', 'Titre du tableau de bord')}${f('itemLabel', 'Nom des éléments (ex. téléservices)')}${f('groupLabel', 'Libellé du filtre principal')}${f('subLabel', 'Libellé du niveau secondaire')}${f('closedStatus', 'Statut considéré comme « fermé »')}
    <label>Thème<select data-k="theme">${[['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']].map(([v, l]) => `<option value="${v}"${S.theme === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
    <label>Tri par défaut<select data-k="sort">${keys.map(x => `<option value="${esc(x.k)}"${S.sort === x.k ? ' selected' : ''}>${esc(x.l)}</option>`).join('')}</select></label>
    <h2>Couleurs des statuts</h2><div class="cg">${sts.map(s => `<label>${esc(s)}<input type="color" data-c="${esc(s)}" value="${color(s)}"></label>`).join('')}</div>
    <button class="fch" data-a="reset">Réinitialiser les réglages</button>`;
}

function persist() { try { grist.setOptions({...S}); } catch (e) {} }
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.k) { S[t.dataset.k] = t.value; if (t.dataset.k === 'sort') F.sort = null; }
  else if (t.dataset.c) S.colors = {...S.colors, [t.dataset.c]: t.value};
  else return;
  persist(); render();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && MODAL !== null) { MODAL = null; renderModal(); } });
document.addEventListener('click', e => {
  const t = e.target.closest('[data-a]'); if (!t) return;
  const a = t.dataset.a, v = t.dataset.v;
  if (a === 'close') { if (e.target !== t && !e.target.closest('button')) return; MODAL = null; renderModal(); return; }
  if (a === 's') F.s = (F.s === v || !v) ? null : v;
  else if (a === 'd') F.d = F.d === v ? null : v;
  else if (a === 'g') { F.g = v; F.d = null; F.lim = 48; try { localStorage.setItem('tsg', v); } catch (_) {} }
  else if (a === 'dir') F.asc = !F.asc;
  else if (a === 'more') F.lim += 48;
  else if (a === 'gear') { SET = !SET; openSet(); return; }
  else if (a === 'reset') { S = {...DEF}; persist(); render(); openSet(); return; }
  else if (a === 'card') { if (e.target.closest('a')) return; CUR = MODAL = +v; try { grist.setCursorPos({rowId: CUR}); } catch (_) {} renderModal(); }
  render();
});

grist.ready({requiredAccess: 'read table', columns: [
  {name: 'titre', title: 'Titre (carte)', type: 'Any', description: 'Nom affiché en titre de chaque carte'},
  {name: 'statut', title: 'Statut (camembert)', type: 'Any', description: 'Colonne qui découpe le camembert'},
  {name: 'groupe', title: 'Groupe principal (liste déroulante)', type: 'Any', description: 'Ex. DG propriétaire'},
  {name: 'sub', title: 'Sous-groupe (histogramme)', type: 'Any', optional: true, description: 'Ex. Direction propriétaire'},
  {name: 'desc', title: 'Description', type: 'Any', optional: true},
  {name: 'date', title: 'Date d’ouverture', type: 'Any', optional: true},
  {name: 'dateFin', title: 'Date de fermeture (Date d’arrêt)', type: 'Any', optional: true},
  {name: 'url', title: 'Lien (URL)', type: 'Any', optional: true},
  {name: 'meta', title: 'Infos complémentaires (pastilles)', type: 'Any', optional: true, allowMultiple: true, description: 'Colonnes affichées en pastilles et triables'}
]});
grist.onOptions(o => { S = {...DEF, ...(o || {})}; if (M) render(); });
grist.onRecords((recs, m) => { M = m; if (m && m.titre && m.statut && m.groupe) build(recs, m); render(); }, {includeColumns: 'normal'});
grist.onRecord(r => { CUR = r ? r.id : null; });
