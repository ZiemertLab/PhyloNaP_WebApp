// Page wiring for the PhyloNaP tree viewer (v2): loads the data embedded in the
// page, creates the viewer and connects the toolbar, the node menu and the side panel.

import { parseNewick } from './newick.js';
import { TreeViewer } from './viewer.js';
import { PALETTE, OTHER_COLOR, groupColumns, buildColorScale, prettyName, isEmpty } from './annotations.js';
import { linkedParts, targetFor } from './links.js';
import * as store from './state.js';
import { buildFigure, toPng, printPdf } from './export.js';

const $ = (id) => document.getElementById(id);
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

function h(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    for (const k in props) {
      if (k === 'class') node.className = props[k];
      else if (k === 'dataset') Object.assign(node.dataset, props[k]);
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), props[k]);
      else if (props[k] !== undefined && props[k] !== false) node.setAttribute(k, props[k] === true ? '' : props[k]);
    }
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) node.append(c);
  return node;
}

// ---------- data ----------

/** An uploaded tree is kept by the upload page in this browser only; nothing is on the server. */
function readUpload(payload) {
  let raw = null;
  try { raw = sessionStorage.getItem('phylonap_user_data') || localStorage.getItem('phylonap_user_data'); } catch (e) { /* storage blocked */ }
  if (!raw) throw new Error('no uploaded tree was found in this browser. Please upload your files again.');
  const up = JSON.parse(raw);
  payload.nwk = up.treeContent;
  payload.metadata = up.metadataJson;
  payload.columns = up.metadataColumns;
  payload.info = { name: up.datasetName || null, model: null, rooting: null };
  const title = [up.superfamilyName, up.datasetName].filter(Boolean).join(' \u2013 ');
  if ($('tv-dataset-name')) $('tv-dataset-name').textContent = title || 'Uploaded tree';
  if ($('tv-dataset-desc')) $('tv-dataset-desc').textContent = up.description || '';
}

/** Uploaded tables may name the ID column differently: use the column whose values match the most tips. */
function findIdColumn(metadata, root) {
  if (!metadata.length || metadata.some((row) => row.ID != null && row.ID !== '')) return;
  const tips = new Set();
  (function walk(n) { if (n.children.length) n.children.forEach(walk); else tips.add(n.name); })(root);
  let best = null;
  let bestHits = 0;
  for (const column of Object.keys(metadata[0])) {
    const hits = metadata.reduce((n, row) => n + (tips.has(String(row[column])) ? 1 : 0), 0);
    if (hits > bestHits) { best = column; bestHits = hits; }
  }
  if (best) for (const row of metadata) { row.ID = row[best]; delete row[best]; }
}

const REFERENCE_COLUMN = 'M-CSA reference';
const AMINO_ACID_COLORS = {};
['Cys', 'His', 'Ser', 'Thr', 'Asp', 'Glu', 'Lys', 'Arg', 'Tyr', 'Asn', 'Gln', 'Phe', 'Trp', 'Met', 'Gly', 'Ala', 'Pro', 'Val', 'Leu', 'Ile']
  .forEach((aa, i) => { AMINO_ACID_COLORS[aa] = PALETTE[i]; });
AMINO_ACID_COLORS.gap = OTHER_COLOR;

/**
 * Catalytic sites (M-CSA residues placed on the dataset alignment): one annotation column per
 * position, holding the amino acid each sequence has there. Returns the column names and their explanations.
 */
function addCatalyticColumns(data) {
  const cat = data.catalytic;
  if (!cat || !cat.sites || !cat.sites.length) return null;
  const rowOf = new Map(data.metadata.map((row) => [String(row.ID), row]));
  const taken = new Set();
  for (const row of data.metadata) for (const k in row) taken.add(k);
  const names = cat.sites.map((site) => (taken.has(site.name) ? site.name + ' (catalytic site)' : site.name));
  for (const tip in cat.values) {
    let row = rowOf.get(tip);
    if (!row) { row = { ID: tip }; data.metadata.push(row); rowOf.set(tip, row); }
    cat.values[tip].forEach((value, i) => { if (names[i]) row[names[i]] = value; });
  }
  for (const ref of cat.references) {
    const row = rowOf.get(ref.tip);
    if (row) row[REFERENCE_COLUMN] = ref.uniprot;
  }
  const tips = new Map();
  cat.sites.forEach((site, i) => {
    const lines = site.evidence.map((e) => e.residue + ' of ' + e.uniprot + ': ' + (e.roles || 'catalytic residue')
      + (e.location ? ' (acts through: ' + e.location + ')' : '') + (e.note ? '. ' + e.note.replace(/\.$/, '') : ''));
    tips.set(names[i], 'Amino acid of each sequence at the position aligned to ' + lines.join('. ') + '.');
  });
  tips.set(REFERENCE_COLUMN, 'The sequences of this dataset that M-CSA describes; their catalytic residues define the positions below.');
  const enzyme = new Map(cat.references.map((ref) => [ref.mcsa_id, ref]));
  const sites = new Map(cat.sites.map((site, i) => [names[i], site]));
  // reference proteins in the order (and so the colours) of the "M-CSA reference" colour strip
  const proteins = [...new Set(cat.references.map((ref) => ref.uniprot))].sort((a, b) => a.localeCompare(b));
  const refTips = new Set(cat.references.map((ref) => ref.tip));
  return { columns: [REFERENCE_COLUMN, ...names], tips, sites, enzyme, proteins, refTips };
}

function readPayload() {
  const payload = JSON.parse($('tv-payload').textContent);
  if (payload.clientData) readUpload(payload);
  let metadata = payload.metadata;
  if (typeof metadata === 'string') metadata = metadata ? JSON.parse(metadata) : [];
  let columns = payload.columns;
  if (typeof columns === 'string') {
    try { columns = JSON.parse(columns.replace(/'/g, '"')); } catch (e) { columns = []; }
  }
  return {
    nwk: payload.nwk,
    metadata: Array.isArray(metadata) ? metadata : [],
    columns: Array.isArray(columns) ? columns : [],
    defaultTipLabel: payload.defaultTipLabel || null,
    datasetId: payload.datasetId || null,
    sections: payload.sections || null,
    structureImages: payload.structureImages || { bgc: {}, reaction: {} },
    catalytic: payload.catalytic || null,
    source: payload.source || null,
    info: payload.info || {},
    placement: payload.placement || null,
    bootstrapMapping: payload.bootstrapMapping || null,
  };
}

/** The dataset's annotation columns first, then any other fields present in the table. */
function splitColumns(data) {
  const present = new Set();
  for (const row of data.metadata) for (const k in row) present.add(k);
  present.delete('ID');
  const main = data.columns.filter((c) => present.has(c));
  const other = [...present].filter((c) => !main.includes(c)).sort((a, b) => a.localeCompare(b));
  return { main, other, all: [...main, ...other] };
}

function pickDefaultLabel(data, cols) {
  const find = (name) => cols.all.find((c) => c.toLowerCase() === String(name).toLowerCase());
  return (data.defaultTipLabel && find(data.defaultTipLabel)) || find('Species') || null;
}

function buildTSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const lines = [cols.join('\t')];
  for (const row of rows) lines.push(cols.map((c) => (row[c] === null || row[c] === undefined ? '' : String(row[c]))).join('\t'));
  return lines.join('\n') + '\n';
}

/** Placement trees may lack support values; the server maps them over from the original tree by branch number. */
function applySupportByEdge(root, mapping) {
  let map = mapping;
  if (typeof map === 'string') { try { map = JSON.parse(map); } catch (e) { map = null; } }
  if (!map) return;
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    const value = n.edge != null ? map[String(n.edge)] : undefined;
    if (n.children.length && n.support == null && value !== undefined && value !== null && !Number.isNaN(Number(value))) {
      n.support = Number(value);
      n.supportRaw = String(value);
    }
    for (const c of n.children) stack.push(c);
  }
}

function formatNumber(v) {
  if (Math.abs(v) < 0.001 && v !== 0) return Number(v).toExponential(2);
  return Number(v).toFixed(4).replace(/\.?0+$/, '');
}

/** Dot colour for a placement: strong for a short pendant length (reliable), pale for a long one. */
function placementColor(pendant) {
  const stops = [[123, 27, 56], [154, 89, 104], [189, 165, 171]];
  const t = Math.pow(Math.min(Math.max(pendant, 0), 1), 1.5);
  const [a, b, k] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
  return 'rgb(' + a.map((c, i) => Math.floor(c + (b[i] - c) * k)).join(',') + ')';
}

const LWR_HELP = 'Likelihood weight ratio: the likelihood of this placement relative to all alternative placements in the same tree. Higher means a more probable location. The values for one query add up to 1.';
const PL_HELP = 'Pendant length: the branch length that connects the query to the tree at this point. It reflects evolutionary distance: shorter is more reliable. Shown as the colour of the dot.';

function placementQuality(pendant) {
  if (pendant < 0.1) return { good: true, text: 'Very short evolutionary distance: a close homolog; functional inference is likely reliable.' };
  if (pendant < 0.2) return { good: true, text: 'Short evolutionary distance: likely related, but minor functional differences are possible.' };
  if (pendant < 0.5) return { text: 'Substantial evolutionary distance: use caution when assigning a specific function; the broad functional class may still be informative.' };
  if (pendant <= 1.0) return { warn: true, text: 'Very large evolutionary distance: avoid direct functional extrapolation; use only for broad phylogenetic context.' };
  return { warn: true, text: 'Extremely distant placement: likely too divergent for meaningful functional inference.' };
}

// ---------- page ----------

function sizeLayout() {
  const layout = $('tv-layout');
  layout.style.height = Math.max(320, window.innerHeight - layout.getBoundingClientRect().top) + 'px';
}

function init() {
  sizeLayout();
  const host = $('tv-tree');
  let data;
  let root;
  let jplace = null;
  try {
    data = readPayload();
    if (data.placement) {
      // a placement result: the reference tree with numbered branches, plus where the query fits
      data.jplaceText = data.nwk;
      jplace = JSON.parse(data.nwk);
      data.nwk = jplace.tree;
    }
    root = parseNewick(data.nwk);
    if (data.source === 'user') findIdColumn(data.metadata, root);
    if (data.placement) applySupportByEdge(root, data.bootstrapMapping);
  } catch (err) {
    host.append(h('p', { class: 'tv-error' }, 'The tree could not be read: ' + String(err.message || err)));
    return;
  }

  const catalytic = addCatalyticColumns(data);
  if (catalytic) data.sections = { ...(data.sections || {}), catalytic: catalytic.columns };
  const metaById = new Map(data.metadata.map((row) => [String(row.ID), row]));
  const viewer = new TreeViewer(host, root, metaById);
  window.phylonapViewer = viewer; // handy for debugging in the browser console

  const cols = splitColumns(data);
  const known = new Set(cols.all);
  const defaultLabel = pickDefaultLabel(data, cols);
  const fp = store.fingerprint(data.nwk);
  const storeId = data.datasetId ? data.datasetId + (data.placement ? '/placement' : '') : null;
  let placementInfo = () => [];   // lines for the node menu; filled in on a placement page
  let placementDetails = () => [];  // lines for the exported figure
  const allRows = viewer.srcLeaves.map((leaf) => metaById.get(leaf.name) || null);
  const sections = groupColumns(cols.main, cols.other, data.sections);
  if (catalytic) {
    // positions in sequence order, not by name
    sections.find((s) => s.id === 'catalytic').columns = catalytic.columns.filter((c) => known.has(c));
    const facts = document.querySelector('.tv-facts');
    const dd = h('dd');
    data.catalytic.references.forEach((ref, i) => {
      if (i) dd.append(', ');
      dd.append(h('a', { class: 'tv-link', href: ref.url, target: '_blank', rel: 'noopener',
        title: 'Open M-CSA entry ' + ref.mcsa_id }, (ref.enzyme_name || 'M-CSA entry ' + ref.mcsa_id) + ' \u2013 ' + ref.uniprot));
    });
    // one click from the top of the page: all catalytic positions as colour strips, and the section scrolled into view
    const positions = catalytic.columns.filter((c) => c !== REFERENCE_COLUMN && known.has(c));
    dd.append(h('div', { class: 'tv-button-row' }, h('button', {
      type: 'button', class: 'tv-btn', id: 'tv-catalytic-show',
      title: 'Show the amino acid at every catalytic position as colour strips next to the tree',
      onclick: () => {
        const allOn = positions.every((c) => view.strips.includes(c));
        if (allOn) view.strips = view.strips.filter((c) => !positions.includes(c));
        else for (const c of positions) if (!view.strips.includes(c)) view.strips.push(c);
        rebuildTracks();
        changed();
        const title = [...document.querySelectorAll('.tv-section-title')].find((el) => el.textContent.startsWith('Catalytic site'));
        if (title && !allOn) title.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    }, 'Show ' + positions.length + ' positions on tree')));
    if (facts) facts.append(h('dt', null, 'Catalytic site'), dd);
  }
  const clusterColumn = cols.all.find((c) => norm(c) === 'cluster') || null;
  const gcfColumn = cols.all.find((c) => norm(c) === 'gcfid') || null;
  let view = store.defaultView();
  let scales = {};

  // explanations for coded values (e.g. COG categories), from field_descriptions.js
  const descriptions = typeof FIELD_DESCRIPTIONS !== 'undefined' ? FIELD_DESCRIPTIONS : {}; // eslint-disable-line no-undef
  const describer = (column) => {
    const map = descriptions[column];
    if (!map) return undefined;
    return (value) => String(value).split(/[;,|]/).map((c) => c.trim()).filter((c) => map[c])
      .map((c) => c + ' — ' + map[c]).join('; ') || null;
  };
  document.querySelectorAll('[data-tv-code]').forEach((node) => {
    const about = (descriptions[node.dataset.tvCode] || {})[node.textContent.trim()];
    if (about) { node.dataset.tvTip = about; node.tabIndex = 0; }
  });

  // explanations shown at once when the pointer is over anything that carries data-tv-tip
  const floatTip = h('div', { class: 'tv-floattip', role: 'tooltip' });
  document.body.append(floatTip);
  let tipOwner = null;
  const hideTip = () => { tipOwner = null; floatTip.classList.remove('is-visible'); };
  const showTip = (el) => {
    if (el === tipOwner) return;
    tipOwner = el;
    floatTip.textContent = el.dataset.tvTip;
    floatTip.classList.add('is-visible');
    const r = el.getBoundingClientRect();
    const w = floatTip.offsetWidth;
    const hgt = floatTip.offsetHeight;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8));
    const top = r.top - hgt - 7 >= 4 ? r.top - hgt - 7 : r.bottom + 7;
    floatTip.style.left = left + 'px';
    floatTip.style.top = top + 'px';
  };
  const tipTarget = (e) => (e.target && e.target.closest ? e.target.closest('[data-tv-tip]') : null);
  document.addEventListener('mouseover', (e) => { const el = tipTarget(e); if (el) showTip(el); else hideTip(); });
  document.addEventListener('focusin', (e) => { const el = tipTarget(e); if (el) showTip(el); else hideTip(); });
  document.addEventListener('click', (e) => { const el = tipTarget(e); if (el) { tipOwner = null; showTip(el); } });
  document.addEventListener('scroll', hideTip, true);
  const help = (text) => h('span', { class: 'tv-help', tabindex: '0', role: 'img', 'aria-label': text, dataset: { tvTip: text } }, '?');

  // cross-links: columns whose values are IDs in another database
  const linkColumns = cols.all.filter((c) => targetFor(c));
  const firstLink = (leaf, column) => {
    if (leaf.tips.length !== 1) return null;
    const row = metaById.get(leaf.name);
    if (!row || isEmpty(row[column])) return null;
    const part = linkedParts(column, row[column]).find((x) => x.url);
    return part ? part.url : null;
  };

  // structure images: which tips have one, according to the list sent by the server
  const STRUCTURES = {
    bgc: {
      title: 'BGC product', folder: '/static/images/', linkName: 'MIBiG',
      column: cols.all.find((c) => ['mibig', 'mibigid'].includes(norm(c))) || null,
    },
    reaction: {
      title: 'Reaction', folder: '/static/images_reactions/', linkName: 'MITE',
      column: cols.all.find((c) => ['mite', 'miteid'].includes(norm(c))) || null,
    },
  };
  const structureKinds = Object.keys(STRUCTURES).filter(
    (kind) => STRUCTURES[kind].column && Object.keys(data.structureImages[kind] || {}).length);
  /** @returns {{id, urls}|null} the first ID of this tip that has images */
  function structureFor(leaf, kind) {
    if (leaf.tips.length !== 1) return null;
    const row = metaById.get(leaf.name);
    const def = STRUCTURES[kind];
    if (!row || isEmpty(row[def.column])) return null;
    for (const raw of String(row[def.column]).split(/[;,|]/).map((x) => x.trim())) {
      const files = data.structureImages[kind][raw];
      if (files) return { id: raw, urls: files.map((f) => def.folder + encodeURIComponent(f)) };
    }
    return null;
  }

  /** Drop anything that doesn't exist in this dataset (old links, files from other datasets). */
  function sanitize(v) {
    const validId = (id) => Number.isInteger(id) && id !== 0 && Math.abs(id) < viewer.src.length;
    v.text = (v.text || []).filter((c) => known.has(c));
    v.strips = (v.strips || []).filter((c) => known.has(c));
    v.images = (v.images || []).filter((kind) => structureKinds.includes(kind));
    v.links = !!v.links && linkColumns.length > 0;
    if (typeof v.labelBy === 'string' && !known.has(v.labelBy)) v.labelBy = undefined;
    v.clades = (v.clades || []).filter((c) => validId(c.id) && (c.branch || c.shade));
    v.colors = v.colors || {};
    v.scope = Object.fromEntries(Object.entries(v.scope || {}).filter(([c, id]) => known.has(c) && validId(id)));
    v.reroot = validId(v.reroot) && v.reroot > 0 ? v.reroot : null;
    v.hidden = (v.hidden || []).filter(validId);
    v.collapsed = (v.collapsed || []).filter(validId);
    return v;
  }

  function changed() {
    store.saveLocal(storeId, fp, view);
  }

  function setStatus(text) {
    $('tv-view-status').textContent = text || '';
  }

  const toastEl = h('div', { class: 'tv-toast', role: 'status' });
  host.append(toastEl);
  let toastTimer = null;
  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3500);
  }

  // ----- tracks (colour strips and text columns) -----

  function rebuildTracks() {
    scales = {};
    const tracks = [];
    for (const column of view.strips) {
      const scopeId = view.scope[column];
      const scopeTips = scopeId != null ? new Set(viewer.refTipNames(scopeId)) : null;
      const rows = scopeTips ? [...scopeTips].map((name) => metaById.get(name) || null) : allRows;
      // catalytic positions share one amino-acid colour scheme, so a colour means the same residue in every strip
      const fixed = catalytic && catalytic.tips.has(column) && column !== REFERENCE_COLUMN ? AMINO_ACID_COLORS : null;
      const scale = buildColorScale(column, rows, fixed ? { ...fixed, ...(view.colors[column] || {}) } : view.colors[column]);
      scale.scoped = !!scopeTips;
      scales[column] = scale;
      tracks.push({
        key: 's:' + column,
        title: prettyName(column),
        type: 'strip',
        text: (leaf) => viewer.valueFor(leaf, column),
        color: (leaf) => (scopeTips && !leaf.tips.every((t) => scopeTips.has(t)) ? null : scale.colorOf(viewer.valueFor(leaf, column))),
        describe: describer(column),
        outline: !!(catalytic && catalytic.tips.has(column)),
      });
    }
    const textColumns = [...view.text];
    if (view.links) for (const column of linkColumns) if (!textColumns.includes(column)) textColumns.push(column);
    for (const column of textColumns) {
      tracks.push({
        key: 't:' + column, title: prettyName(column), type: 'text',
        text: (leaf) => viewer.valueFor(leaf, column),
        href: linkColumns.includes(column) ? (leaf) => firstLink(leaf, column) : undefined,
        describe: describer(column),
      });
    }
    for (const kind of view.images) {
      tracks.push({
        key: 'i:' + kind, title: STRUCTURES[kind].title, type: 'image', kind,
        images: (leaf) => { const found = structureFor(leaf, kind); return found ? found.urls : null; },
      });
    }
    // while catalytic positions are on the tree, the M-CSA reference proteins stand out (bold label, framed cells)
    const catalyticShown = catalytic && view.strips.some((c) => catalytic.tips.has(c));
    viewer.setEmphasis(catalyticShown ? catalytic.refTips : null);
    viewer.setTracks(tracks);
    renderLegend();
    updateAnnotationButtons();
    updateStructureButtons();
  }

  function applyClades() {
    viewer.setCladeStyles(new Map(view.clades.map((c) => [c.id, { branch: c.branch, shade: c.shade }])));
    renderLegend();
  }

  function applyStructure() {
    viewer.setStructure({ reroot: view.reroot, hidden: view.hidden, collapsed: view.collapsed });
    closeSelection();
    renderStructureNote();
  }

  /** Small notes in the toolbar that say the tree is not shown as stored, each with a way back. */
  function renderStructureNote() {
    const box = $('tv-structure');
    box.textContent = '';
    const note = (text, action, undo) => box.append(h('span', { class: 'tv-structure-note' }, text + ' ',
      h('button', { type: 'button', class: 'tv-linkbtn', onclick: () => { undo(); applyStructure(); changed(); } }, action)));
    if (view.reroot != null) note('Rerooted', 'Restore root', () => { view.reroot = null; });
    if (view.hidden.length) note(view.hidden.length + ' hidden', 'Show all', () => { view.hidden = []; });
    const collapsedShown = viewer.leaves.filter((leaf) => leaf.collapsed).length;
    if (collapsedShown) note(collapsedShown + ' collapsed', 'Expand all', () => { view.collapsed = []; });
  }

  // ----- annotation panel -----

  function toggle(list, column) {
    const i = list.indexOf(column);
    if (i === -1) list.push(column);
    else list.splice(i, 1);
  }

  function toggleStrip(column) {
    toggle(view.strips, column);
    delete view.scope[column];
    rebuildTracks();
    changed();
  }

  function renderAnnotations() {
    const box = $('tv-annotations');
    box.textContent = '';
    for (const section of sections) {
      if ((section.id === 'other' || section.optional) && !section.columns.length) continue;
      const head = h('div', { class: 'tv-section-head' }, h('span', { class: 'tv-section-title' }, section.title));
      if (section.id === 'catalytic') {
        head.firstChild.append(' ', help('Residues that M-CSA (Mechanism and Catalytic Site Atlas) describes as catalytic in sequences of this dataset, '
          + 'placed on the alignment. Each field is one alignment position, named by the residues reported there (each in the numbering of its own protein), '
          + 'and shows the amino acid every sequence has at that position. '
          + 'While these are shown on the tree, the reference proteins have a bold label and a dark frame around their cells. '
          + 'The same amino acid at an aligned position suggests, but does not prove, the same role.'));
      }
      if (section.columns.length > 1) {
        head.append(h('button', {
          type: 'button', class: 'tv-linkbtn', dataset: { tvSectionColour: section.id },
          title: 'Show a colour strip for every field in this section',
          onclick: () => {
            const allOn = section.columns.every((c) => view.strips.includes(c));
            if (allOn) view.strips = view.strips.filter((c) => !section.columns.includes(c));
            else for (const c of section.columns) if (!view.strips.includes(c)) view.strips.push(c);
            for (const c of section.columns) delete view.scope[c];
            rebuildTracks();
            changed();
          },
        }, 'Colour all'));
      }
      // "Other" holds leftover fields and starts folded, so it doesn't crowd the panel
      let target = box;
      if (section.id === 'other') {
        target = h('details', { class: 'tv-section-fold' }, h('summary', { class: 'tv-section-head' },
          h('span', { class: 'tv-section-title' }, 'Other fields (' + section.columns.length + ')')));
        box.append(target);
      } else {
        box.append(head);
      }
      if (section.id === 'catalytic' && catalytic.proteins.length > 1) {
        // which reference protein each square under a position stands for
        box.append(h('div', { class: 'tv-site-key' }, ...catalytic.proteins.map((uniprot, i) => {
          const ref = data.catalytic.references.find((r) => r.uniprot === uniprot) || {};
          const own = [...catalytic.sites.values()].filter((site) => site.evidence.some((e) => e.uniprot === uniprot));
          const only = own.filter((site) => site.evidence.every((e) => e.uniprot === uniprot)).length;
          return h('div', { class: 'tv-site-key-row' },
            h('span', { class: 'tv-site-dot is-on', style: 'background:' + PALETTE[i] + ';border-color:' + PALETTE[i] }),
            h('a', { class: 'tv-link', href: ref.url, target: '_blank', rel: 'noopener', title: 'Open M-CSA entry ' + ref.mcsa_id }, uniprot),
            h('span', { class: 'tv-site-key-name', title: ref.enzyme_name || '' }, ref.enzyme_name || ''),
            h('span', { class: 'tv-site-key-count', dataset: { tvTip: own.length + ' positions reported for ' + uniprot + ', ' + only + ' of them for no other reference protein' } },
              own.length + (only ? ' (' + only + ' only here)' : '')));
        })));
      }
      if (!section.columns.length) {
        box.append(h('p', { class: 'tv-note tv-section-empty' }, section.placeholder || 'No fields in this dataset.'));
        continue;
      }
      for (const column of section.columns) {
        target.append(h('div', { class: 'tv-ann-row' },
          catalytic && catalytic.sites.has(column) ? h('span', { class: 'tv-ann-name', title: column }, column)
            : catalytic && catalytic.tips.has(column)
            ? h('span', { class: 'tv-ann-name tv-ann-explained', tabindex: '0', dataset: { tvTip: catalytic.tips.get(column) } }, column)
            : h('span', { class: 'tv-ann-name', title: prettyName(column) }, prettyName(column)),
          h('button', {
            type: 'button', class: 'tv-chip', dataset: { tvText: column }, 'aria-pressed': 'false',
            title: 'Show this field as a text column next to the tree',
            onclick: () => { toggle(view.text, column); rebuildTracks(); changed(); },
          }, 'Text'),
          h('button', {
            type: 'button', class: 'tv-chip', dataset: { tvStrip: column }, 'aria-pressed': 'false',
            title: 'Colour the tips by this field',
            onclick: () => toggleStrip(column),
          }, 'Colour')));
        const site = catalytic && catalytic.sites.get(column);
        if (site) target.append(siteDetails(site));
      }
    }
  }

  /** Under a catalytic position: its roles, and per reference protein what M-CSA says, with a link to the entry. */
  function siteDetails(site) {
    const roles = [];
    for (const e of site.evidence) for (const r of (e.roles || '').split(',').map((x) => x.trim())) if (r && !roles.includes(r)) roles.push(r);
    const box = h('details', { class: 'tv-site' },
      h('summary', { title: 'Show what M-CSA says about this position' },
        catalytic.proteins.length > 1 && h('span', { class: 'tv-site-refs' }, ...catalytic.proteins.map((uniprot, i) => {
          const hit = site.evidence.find((e) => e.uniprot === uniprot);
          return h('span', {
            class: 'tv-site-dot' + (hit ? ' is-on' : ''), style: hit ? 'background:' + PALETTE[i] + ';border-color:' + PALETTE[i] : '',
            dataset: { tvTip: hit ? 'Reported for ' + uniprot + ' (' + hit.residue + ')' : 'Not reported for ' + uniprot },
          });
        })),
        h('span', { class: 'tv-site-roles' }, roles.join(', ') || 'catalytic residue')));
    for (const e of site.evidence) {
      const ref = catalytic.enzyme.get(e.mcsa_id) || {};
      const url = ref.url || 'https://www.ebi.ac.uk/thornton-srv/m-csa/entry/' + e.mcsa_id + '/';
      box.append(h('p', { class: 'tv-site-ref' },
        h('strong', null, e.residue), ' in ',
        h('a', { class: 'tv-link', href: 'https://www.uniprot.org/uniprotkb/' + e.uniprot, target: '_blank', rel: 'noopener' }, e.uniprot),
        ref.enzyme_name ? ' (' + ref.enzyme_name + ')' : '', ': ', e.roles || 'catalytic residue',
        e.location ? ' (acts through: ' + e.location + ')' : '', '. ',
        e.note ? e.note.replace(/\.?$/, '. ') : '',
        h('a', { class: 'tv-link', href: url, target: '_blank', rel: 'noopener' }, 'M-CSA entry ' + e.mcsa_id)));
    }
    return box;
  }

  function updateAnnotationButtons() {
    const radial = view.layout === 'radial';
    document.querySelectorAll('[data-tv-text]').forEach((b) => {
      b.setAttribute('aria-pressed', String(view.text.includes(b.dataset.tvText)));
      b.disabled = radial;
      b.title = radial ? 'Text columns are shown in the rectangular layout' : 'Show this field as a text column next to the tree';
    });
    document.querySelectorAll('[data-tv-strip]').forEach((b) => {
      b.setAttribute('aria-pressed', String(view.strips.includes(b.dataset.tvStrip)));
    });
    document.querySelectorAll('[data-tv-section-colour]').forEach((b) => {
      const section = sections.find((s) => s.id === b.dataset.tvSectionColour);
      b.textContent = section.columns.every((c) => view.strips.includes(c)) ? 'Clear colours' : 'Colour all';
    });
  }

  // ----- legend -----

  function renderLegend() {
    const card = $('tv-legend-card');
    const box = $('tv-legend');
    box.textContent = '';
    card.hidden = !view.strips.length && !view.clades.length;

    for (const column of view.strips) {
      const scale = scales[column];
      if (!scale) continue;
      const list = h('div', { class: 'tv-legend-list' });
      if (scale.scoped) {
        list.append(h('p', { class: 'tv-note' }, 'Coloured within one clade only. ',
          h('button', { type: 'button', class: 'tv-linkbtn', onclick: () => { delete view.scope[column]; rebuildTracks(); changed(); } }, 'Colour the whole tree')));
      }
      for (const item of scale.legend) {
        list.append(h('label', { class: 'tv-legend-item', title: item.value },
          h('input', {
            type: 'color', class: 'tv-swatch', value: item.color, 'aria-label': 'Colour for ' + item.value,
            onchange: (e) => {
              (view.colors[column] = view.colors[column] || {})[item.value] = e.target.value;
              rebuildTracks();
              changed();
            },
          }),
          h('span', { class: 'tv-legend-value' }, item.value),
          h('span', { class: 'tv-legend-count' }, String(item.count))));
      }
      if (scale.otherCount) {
        list.append(h('div', { class: 'tv-legend-item' },
          h('span', { class: 'tv-swatch tv-swatch-static', style: 'background:' + OTHER_COLOR }),
          h('span', { class: 'tv-legend-value' }, scale.otherCount + ' less frequent values')));
      }
      if (!scale.legend.length) list.append(h('p', { class: 'tv-note' }, 'Nothing to colour in this field.'));
      if (scale.sharedOnly && scale.uncoloured) {
        list.append(h('p', { class: 'tv-note' }, scale.uncoloured + ' values that occur only once are not coloured.'));
      }
      box.append(h('details', { class: 'tv-legend-block', open: true },
        h('summary', null,
          h('span', { class: 'tv-legend-title' }, prettyName(column),
            view.layout === 'radial' && view.strips.length > 1 ? h('span', { class: 'tv-legend-ring' },
              ' ring ' + (view.strips.indexOf(column) + 1) + (view.strips.indexOf(column) === 0 ? ' (innermost)'
                : view.strips.indexOf(column) === view.strips.length - 1 ? ' (outermost)' : '')) : null),
          h('button', {
            type: 'button', class: 'tv-linkbtn', title: 'Remove this colour strip',
            onclick: (e) => { e.preventDefault(); toggleStrip(column); },
          }, 'Remove')),
        list));
    }

    if (view.clades.length) {
      box.append(h('div', { class: 'tv-legend-clades' },
        h('span', null, view.clades.length + (view.clades.length === 1 ? ' coloured clade' : ' coloured clades')),
        h('button', {
          type: 'button', class: 'tv-linkbtn',
          onclick: () => { view.clades = []; applyClades(); changed(); },
        }, 'Clear')));
    }
  }

  // ----- selection card: leaf annotations and clade summary -----

  const selectionCard = $('tv-selection-card');

  function closeSelection() {
    selectionCard.hidden = true;
    viewer.setSelection(null);
  }
  $('tv-selection-close').addEventListener('click', closeSelection);

  function openSelection(node, title, subtitle, body) {
    $('tv-selection-title').textContent = title;
    $('tv-selection-subtitle').textContent = subtitle || '';
    const box = $('tv-selection-body');
    box.textContent = '';
    box.append(body);
    selectionCard.hidden = false;
    viewer.setSelection(node);
    selectionCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function valueNodes(column, value) {
    const out = [];
    linkedParts(column, value).forEach((part, i) => {
      if (i) out.push(', ');
      out.push(part.url ? h('a', { href: part.url, target: '_blank', rel: 'noopener', title: part.title, class: 'tv-link' }, part.text) : part.text);
    });
    return out;
  }

  function valueCell(column, value) {
    return h('td', null, ...valueNodes(column, value));
  }

  function showLeafAnnotations(node) {
    const row = metaById.get(node.name);
    let body;
    if (!row) {
      body = h('p', { class: 'tv-note' }, 'No annotation data available for this sequence.');
    } else {
      body = h('table', { class: 'tv-ann-table' });
      for (const key in row) {
        if (isEmpty(row[key]) || String(row[key]) === 'N/A') continue;
        body.append(h('tr', null, h('th', null, prettyName(key)), valueCell(key, row[key])));
      }
    }
    openSelection(node, node.name, 'Annotations', body);
  }

  /**
   * Summary for a displayed clade, or for a given list of tips when that clade is not drawn as one.
   * Three parts: what every tip shares, the fields that vary (one proportion bar each, by section),
   * and the fields that are different in every tip.
   */
  function showCladeSummary(node, subtitle, tipList, keepOpen) {
    const names = tipList || viewer.tipNames(node);
    const total = names.length;
    const rows = names.map((name) => metaById.get(name)).filter(Boolean);
    const stats = new Map();
    for (const column of cols.all) {
      const counts = new Map();
      let filled = 0;
      for (const row of rows) {
        if (isEmpty(row[column]) || String(row[column]) === 'N/A') continue;
        const key = String(row[column]);
        counts.set(key, (counts.get(key) || 0) + 1);
        filled++;
      }
      if (filled) stats.set(column, { column, filled, values: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) });
    }

    const shared = [];
    const unique = [];
    const varying = [];   // [{ title, fields }]
    for (const section of sections) {
      const fields = [];
      for (const column of section.columns) {
        const f = stats.get(column);
        if (!f) continue;
        if (f.values.length === 1 && f.filled === total) shared.push(f);
        else if (f.values.length === f.filled && f.filled > 2) unique.push(f);
        else fields.push(f);
      }
      if (fields.length) varying.push({ title: section.title, fields });
    }

    const percent = (n) => {
      const p = (n / total) * 100;
      return p < 1 ? '<1%' : p > 99 && n < total ? '>99%' : Math.round(p) + '%';
    };
    const tips = (n) => n + (n === 1 ? ' tip' : ' tips');
    const again = () => showCladeSummary(node, subtitle, tipList, true);
    const MAX_SEGMENTS = 8;

    let dragged = null;
    function fieldRow(f, withBar) {
      const scale = scales[f.column] && !scales[f.column].scoped ? scales[f.column] : null;
      const colorOf = (value, i) => (scale ? scale.colorOf(value) || OTHER_COLOR : i < MAX_SEGMENTS ? PALETTE[i] : OTHER_COLOR);

      const bar = h('span', { class: 'tv-sum-bar' });
      if (withBar) {
        let rest = f.filled;
        f.values.slice(0, MAX_SEGMENTS).forEach(([value, count], i) => {
          rest -= count;
          bar.append(h('span', {
            style: 'width:' + (count / total) * 100 + '%;background:' + colorOf(value, i),
            dataset: { tvTip: value + ': ' + tips(count) + ' (' + percent(count) + ')' },
          }));
        });
        if (rest > 0) {
          bar.append(h('span', {
            style: 'width:' + (rest / total) * 100 + '%;background:' + OTHER_COLOR,
            dataset: { tvTip: (f.values.length - MAX_SEGMENTS) + ' more values: ' + tips(rest) },
          }));
        }
        if (f.filled < total) {
          bar.append(h('span', { class: 'is-empty', style: 'flex:1', dataset: { tvTip: 'No value: ' + tips(total - f.filled) } }));
        }
      }

      let lead;
      if (!withBar) lead = 'a different value in each of ' + tips(f.filled);
      else if (f.values.length === 1) lead = f.values[0][0] + ' · ' + f.filled + ' of ' + tips(total);
      else {
        lead = f.values.slice(0, 2).map(([value, count]) => value + ' ' + percent(count)).join(' · ');
        if (f.values.length > 2) lead += ' · +' + (f.values.length - 2);
      }

      const list = h('div', { class: 'tv-sum-values' });
      const shown = f.values.slice(0, 60);
      shown.forEach(([value, count], i) => {
        list.append(h('div', { class: 'tv-sum-value' },
          h('span', { class: 'tv-sum-swatch', style: withBar ? 'background:' + colorOf(value, i) : 'visibility:hidden' }),
          h('span', { class: 'tv-sum-text', title: value }, ...valueNodes(f.column, value)),
          h('span', { class: 'tv-sum-count' }, String(count)),
          h('span', { class: 'tv-sum-pct' }, percent(count))));
      });
      if (f.values.length > shown.length) list.append(h('p', { class: 'tv-note' }, (f.values.length - shown.length) + ' more values not shown'));
      if (f.filled < total) list.append(h('p', { class: 'tv-note' }, 'No value for ' + tips(total - f.filled) + '.'));
      const onTree = view.strips.includes(f.column);
      list.append(h('button', {
        type: 'button', class: 'tv-linkbtn',
        onclick: () => { toggleStrip(f.column); again(); },
      }, onTree ? 'Remove this colour strip from the tree' : 'Colour the tree by this field'));

      const block = h('details', { class: 'tv-sum-field' + (withBar ? '' : ' is-plain'), draggable: 'true', dataset: { tvField: f.column } },
        h('summary', null,
          h('span', { class: 'tv-sum-name', title: prettyName(f.column) }, prettyName(f.column)),
          withBar ? bar : null,
          h('span', { class: 'tv-sum-n', dataset: { tvTip: 'Number of different values' } }, String(f.values.length)),
          h('span', { class: 'tv-sum-lead', title: lead }, lead)),
        list);
      block.addEventListener('dragstart', (e) => { dragged = block; e.dataTransfer.effectAllowed = 'move'; });
      block.addEventListener('dragover', (e) => {
        if (!dragged || dragged === block || dragged.parentNode !== block.parentNode) return;
        e.preventDefault();
        const rect = block.getBoundingClientRect();
        block.parentNode.insertBefore(dragged, e.clientY < rect.top + rect.height / 2 ? block : block.nextSibling);
      });
      block.addEventListener('dragend', () => { dragged = null; });
      return block;
    }

    const body = h('div', { class: 'tv-sum' });
    const what = total === 1 ? names[0] : 'clade_' + total + '_tips';
    body.append(h('div', { class: 'tv-sum-top' },
      h('span', { class: 'tv-note' }, [
        shared.length && shared.length + ' shared',
        varying.length && varying.reduce((n, g) => n + g.fields.length, 0) + ' varying',
        unique.length && unique.length + ' unique',
      ].filter(Boolean).join(' · ') || 'No annotation data'),
      h('span', { class: 'tv-sum-actions' },
        h('button', {
          type: 'button', class: 'tv-linkbtn', dataset: { tvTip: 'Download the annotations of these tips (.tsv)' },
          onclick: () => downloadAnnotations(names, 'Clade annotations (' + total + ' entries)', what + '_annotations.tsv'),
        }, 'Annotations'),
        data.datasetId && h('button', {
          type: 'button', class: 'tv-linkbtn', dataset: { tvTip: 'Download the sequences of these tips (.fasta)' },
          onclick: () => downloadSequences(names, 'Clade sequences (' + total + ' entries)', what + '.fasta'),
        }, 'Sequences'))));

    if (shared.length) {
      const group = h('div', { class: 'tv-sum-group' },
        h('div', { class: 'tv-sum-title' }, total === 1 ? 'Annotations' : 'Shared by all ' + total + ' tips'));
      for (const f of shared) {
        group.append(h('div', { class: 'tv-sum-shared' },
          h('span', { class: 'tv-sum-name', title: prettyName(f.column) }, prettyName(f.column)),
          h('span', { class: 'tv-sum-shared-value', title: f.values[0][0] }, ...valueNodes(f.column, f.values[0][0]))));
      }
      body.append(group);
    }
    for (const section of varying) {
      const group = h('div', { class: 'tv-sum-group' }, h('div', { class: 'tv-sum-title' }, section.title));
      for (const f of section.fields) group.append(fieldRow(f, true));
      body.append(group);
    }
    if (unique.length) {
      const group = h('details', { class: 'tv-sum-group tv-sum-fold' },
        h('summary', { class: 'tv-sum-title' }, 'Different in every tip (' + unique.length + ')'));
      for (const f of unique) group.append(fieldRow(f, false));
      body.append(group);
    }
    if (rows.length < total) body.append(h('p', { class: 'tv-note' }, tips(total - rows.length) + ' without annotation data.'));
    if (varying.length) body.append(h('p', { class: 'tv-note tv-sum-foot' }, 'Bars show the share of tips with each value. Click a field for the full list; drag to reorder.'));

    // keep the fields the user had open when the summary is redrawn
    const open = new Set([...document.querySelectorAll('#tv-selection-body details[open][data-tv-field]')].map((d) => d.dataset.tvField));
    const foldOpen = !!document.querySelector('#tv-selection-body .tv-sum-fold[open]');
    openSelection(node, total === 1 ? 'One tip' : 'Clade of ' + total + ' tips', subtitle || 'Summary of the selected clade', body);
    if (keepOpen) {
      body.querySelectorAll('details[data-tv-field]').forEach((d) => { d.open = open.has(d.dataset.tvField); });
      const fold = body.querySelector('.tv-sum-fold');
      if (fold) fold.open = foldOpen;
    }
  }

  // ----- downloads with preview -----

  const dialog = $('tv-download');
  let pending = null;
  function showDownload(title, content, filename) {
    pending = { content, filename };
    $('tv-download-title').textContent = title;
    const limit = 200000;
    $('tv-download-content').textContent = content.length > limit
      ? content.slice(0, limit) + '\n\n… preview shortened; the download and the copy contain everything'
      : content;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }
  $('tv-download-close').addEventListener('click', () => dialog.close());
  $('tv-download-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pending.content);
      toast('Copied to clipboard.');
    } catch (e) {
      toast('Copying is not allowed here. Select the text and copy it by hand.');
    }
  });
  $('tv-download-save').addEventListener('click', () => saveFile(pending.content, pending.filename, 'text/plain'));

  function saveFile(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function downloadAnnotations(names, title, filename) {
    const rows = names.map((name) => metaById.get(name)).filter(Boolean);
    if (!rows.length) { toast('No annotation data available.'); return; }
    showDownload(title, buildTSV(rows), filename);
  }

  async function downloadSequences(names, title, filename) {
    try {
      const base = '/api/sequence' + (names.length === 1 ? '/' : 's/') + encodeURIComponent(data.datasetId);
      const resp = names.length === 1
        ? await fetch(base + '/' + encodeURIComponent(names[0]))
        : await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: names }) });
      if (!resp.ok) {
        const info = await resp.json().catch(() => ({}));
        throw new Error(info.error || 'the server could not provide them');
      }
      showDownload(title, await resp.text(), filename);
    } catch (err) {
      toast('Could not get the sequences: ' + (err.message || err));
    }
  }

  $('tv-dl-tree').addEventListener('click', () => showDownload('Tree (Newick, as stored)', data.nwk.replace(/\{\d+\}/g, ''), (data.datasetId || 'dataset') + '.nwk'));
  $('tv-dl-metadata').addEventListener('click', () => {
    if (!data.metadata.length) { toast('No annotation data available.'); return; }
    showDownload('Annotations (' + data.metadata.length + ' entries)', buildTSV(data.metadata), (data.datasetId || 'dataset') + '_metadata.tsv');
  });

  // ----- structures: thumbnails next to the tree, enlarged in the side panel -----

  let shownStructure = null;   // { urls, index, kind, id }
  function updateStructureButtons() {
    const radial = view.layout === 'radial';
    document.querySelectorAll('[data-tv-structure]').forEach((b) => {
      b.setAttribute('aria-pressed', String(view.images.includes(b.dataset.tvStructure)));
      b.disabled = radial;
      b.title = radial ? 'Structures are shown in the rectangular layout' : 'Show these structures next to the tree';
    });
  }
  function drawStructure() {
    const s = shownStructure;
    $('tv-structure-view').hidden = !s;
    $('tv-structure-hint').hidden = !!s;
    if (!s) return;
    const def = STRUCTURES[s.kind];
    $('tv-structure-img').src = s.urls[s.index];
    $('tv-structure-img').alt = def.title + ' for ' + s.id;
    const caption = $('tv-structure-caption');
    caption.textContent = '';
    const link = linkedParts(def.column, s.id).find((x) => x.url);
    caption.append(link ? h('a', { href: link.url, target: '_blank', rel: 'noopener', class: 'tv-link' }, def.linkName + ': ' + link.text) : s.id);
    if (s.urls.length > 1) caption.append(' · ' + (s.index + 1) + ' / ' + s.urls.length);
    $('tv-structure-prev').hidden = $('tv-structure-next').hidden = s.urls.length < 2;
  }
  const stepStructure = (by) => {
    if (!shownStructure) return;
    shownStructure.index = (shownStructure.index + by + shownStructure.urls.length) % shownStructure.urls.length;
    drawStructure();
  };
  $('tv-structure-prev').addEventListener('click', () => stepStructure(-1));
  $('tv-structure-next').addEventListener('click', () => stepStructure(1));
  const imageDialog = $('tv-image-dialog');
  $('tv-structure-enlarge').addEventListener('click', () => {
    if (!shownStructure) return;
    $('tv-image-dialog-img').src = shownStructure.urls[shownStructure.index];
    $('tv-image-dialog-title').textContent = STRUCTURES[shownStructure.kind].title + ' · ' + shownStructure.id;
    imageDialog.showModal();
  });
  $('tv-image-dialog-close').addEventListener('click', () => imageDialog.close());
  imageDialog.addEventListener('click', (e) => { if (e.target === imageDialog) imageDialog.close(); });

  viewer.on('imageclick', (cell) => {
    const found = structureFor(cell.leaf, cell.track.kind);
    if (!found) return;
    shownStructure = { urls: found.urls, index: 0, kind: cell.track.kind, id: found.id };
    drawStructure();
    viewer.setSelection(cell.leaf);
    $('tv-structures-card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  if (structureKinds.length) {
    $('tv-structures-card').hidden = false;
    for (const kind of structureKinds) {
      $('tv-structure-toggles').append(h('button', {
        type: 'button', class: 'tv-btn', dataset: { tvStructure: kind }, 'aria-pressed': 'false',
        onclick: () => {
          toggle(view.images, kind);
          rebuildTracks();
          if (view.images.length) viewer.fit(false);   // thumbnails need taller rows
          changed();
        },
      }, STRUCTURES[kind].title));
    }
  }

  // ----- cross-links table -----

  function renderLinks() {
    const box = $('tv-links');
    if (box.dataset.done) return;
    box.dataset.done = '1';
    const bySource = new Map();
    for (const row of data.metadata) {
      for (const column of linkColumns) {
        if (isEmpty(row[column])) continue;
        for (const part of linkedParts(column, row[column])) {
          if (!part.url) continue;
          const source = targetFor(column).name;
          if (!bySource.has(source)) bySource.set(source, []);
          bySource.get(source).push({ tip: String(row.ID), part });
        }
      }
    }
    let total = 0;
    for (const source of [...bySource.keys()].sort()) {
      const links = bySource.get(source);
      total += links.length;
      const table = h('table', { class: 'tv-ann-table tv-links-table' });
      for (const link of links.slice(0, 500)) {
        table.append(h('tr', null,
          h('td', null, link.tip),
          h('td', null, h('a', { href: link.part.url, target: '_blank', rel: 'noopener', title: link.part.title, class: 'tv-link' }, link.part.text))));
      }
      box.append(h('details', { class: 'tv-summary-field', open: bySource.size === 1 },
        h('summary', null, h('span', { class: 'tv-summary-name' }, source), h('span', { class: 'tv-summary-badge' }, String(links.length))),
        table,
        links.length > 500 ? h('p', { class: 'tv-note' }, (links.length - 500) + ' more not listed here. Use "Show on tree" or download the annotations.') : null));
    }
    box.append(h('p', { class: 'tv-note' }, total
      ? total + ' links to ' + bySource.size + (bySource.size === 1 ? ' database' : ' databases')
      : 'No cross-links in this dataset.'));
  }
  if (linkColumns.length) {
    $('tv-links-card').hidden = false;
    $('tv-links-fold').addEventListener('toggle', renderLinks);
    $('tv-links-on-tree').addEventListener('click', () => {
      view.links = !view.links;
      $('tv-links-on-tree').setAttribute('aria-pressed', String(view.links));
      rebuildTracks();
      changed();
    });
  }

  // ----- node menu (click a branch, a tip label or a collapsed clade) -----

  const popover = h('div', { class: 'tv-popover', hidden: true });
  host.append(popover);
  const closePopover = () => { popover.hidden = true; };

  function colourWithinClade(node, column, what) {
    const tips = viewer.refTipNames(node.ref);
    const rows = tips.map((name) => metaById.get(name) || null);
    if (!buildColorScale(column, rows, null).legend.length) {
      toast('No tips in this clade share a ' + what + ', so there is nothing to colour.');
      return;
    }
    if (!view.strips.includes(column)) view.strips.push(column);
    view.scope[column] = node.ref;
    rebuildTracks();
    changed();
  }

  function openPopover({ node, x, y }) {
    const isLeaf = !node.children.length && !node.collapsed;
    const stored = node.ref !== 0;         // every node except the root of a rerooted tree can be referred to
    const entry = () => view.clades.find((c) => c.id === node.ref);
    const setColour = (key, color) => {
      let c = entry();
      if (!c) { c = { id: node.ref, branch: null, shade: null }; view.clades.push(c); }
      c[key] = color;
      if (!c.branch && !c.shade) view.clades = view.clades.filter((k) => k !== c);
      applyClades();
      changed();
      draw();
    };
    const swatchRow = (key) => {
      const current = (entry() || {})[key] || null;
      const row = h('div', { class: 'tv-swatch-row' });
      for (const color of PALETTE.slice(0, 8)) {
        row.append(h('button', {
          type: 'button', class: 'tv-swatch-btn' + (current === color ? ' is-current' : ''),
          style: 'background:' + color, 'aria-label': 'Colour ' + color, onclick: () => setColour(key, color),
        }));
      }
      row.append(h('button', { type: 'button', class: 'tv-linkbtn', onclick: () => setColour(key, null) }, 'None'));
      return row;
    };
    const item = (label, action) => h('button', {
      type: 'button', class: 'tv-menu-item', onclick: () => { closePopover(); action(); },
    }, label);
    const structural = (change) => () => { change(); applyStructure(); changed(); };

    const draw = () => {
      popover.textContent = '';
      const names = viewer.tipNames(node);
      const title = isLeaf ? viewer.labelFor(node).text || node.name : (node.collapsed ? 'Collapsed clade of ' : 'Clade of ') + node.tipCount + ' tips';
      popover.append(h('div', { class: 'tv-popover-head' },
        h('strong', null, title),
        h('button', { type: 'button', class: 'tv-popover-close', 'aria-label': 'Close', onclick: closePopover }, '×')));

      const group = (...items) => { const g = h('div', { class: 'tv-menu-group' }, ...items); if (g.children.length) popover.append(g); };
      for (const block of placementInfo(node)) popover.append(block);

      if (isLeaf) {
        group(item('Show annotations', () => showLeafAnnotations(node)));
      } else {
        group(
          item('Summary of this clade', () => showCladeSummary(node)),
          stored && node.parent && !node.collapsed && item('Collapse', structural(() => view.collapsed.push(node.ref))),
          node.collapsed && item('Expand', structural(() => { view.collapsed = view.collapsed.filter((id) => id !== node.ref); })));
      }

      if (stored) {
        popover.append(h('div', { class: 'tv-popover-label' }, 'Branch colour'), swatchRow('branch'));
        if (!node.collapsed) popover.append(h('div', { class: 'tv-popover-label' }, 'Background'), swatchRow('shade'));
        if (!isLeaf) {
          group(
            clusterColumn && item('Colour shared clusters in this clade', () => colourWithinClade(node, clusterColumn, 'cluster')),
            gcfColumn && item('Colour shared GCFs in this clade', () => colourWithinClade(node, gcfColumn, 'GCF')));
        }
      }

      const what = isLeaf ? node.name : 'clade_' + names.length + '_tips';
      group(
        item(isLeaf ? 'Download annotations (.tsv)' : 'Download clade annotations (.tsv)',
          () => downloadAnnotations(names, isLeaf ? 'Annotations: ' + node.name : 'Clade annotations (' + names.length + ' entries)', what + '_annotations.tsv')),
        data.datasetId && item(isLeaf ? 'Download sequence (.fasta)' : 'Download clade sequences (.fasta)',
          () => downloadSequences(names, isLeaf ? 'Sequence: ' + node.name : 'Clade sequences (' + names.length + ' entries)', what + '.fasta')));

      group(
        node.parent && node.edgeId >= 0 && item('Reroot here', structural(() => { view.reroot = node.edgeId; })),
        stored && node.parent && item(isLeaf ? 'Hide this tip' : 'Hide this clade', structural(() => {
          view.hidden.push(node.ref);
          view.collapsed = view.collapsed.filter((id) => id !== node.ref);
        })));
    };
    draw();
    popover.hidden = false;
    popover.style.left = Math.max(8, Math.min(x + 10, viewer.width - popover.offsetWidth - 8)) + 'px';
    popover.style.top = Math.max(8, Math.min(y + 10, viewer.height - popover.offsetHeight - 8)) + 'px';
  }

  viewer.on('nodeclick', openPopover).on('backgroundclick', closePopover);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(); });

  // ----- controls -----

  const select = $('tv-label-by');
  const addOption = (parent, value, text) => parent.append(h('option', { value }, text));
  addOption(select, '', 'Sequence ID');
  for (const c of cols.main) addOption(select, c, prettyName(c));
  if (cols.other.length) {
    const group = h('optgroup', { label: 'Other fields' });
    for (const c of cols.other) addOption(group, c, prettyName(c));
    select.append(group);
  }
  const showHideIds = () => { $('tv-hide-ids-row').hidden = !select.value; };
  select.addEventListener('change', () => {
    view.labelBy = select.value || null;
    viewer.setLabelBy(view.labelBy);
    showHideIds();
    changed();
  });
  $('tv-hide-ids').addEventListener('change', (e) => { view.hideIds = e.target.checked; viewer.setIdFallback(!view.hideIds); changed(); });

  const layoutButtons = document.querySelectorAll('[data-tv-layout]');
  function showLayout() {
    layoutButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tvLayout === view.layout)));
    document.querySelectorAll('[data-tv-rect-only]').forEach((n) => { n.hidden = view.layout === 'radial'; });
  }
  layoutButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      view.layout = btn.dataset.tvLayout;
      showLayout();
      closePopover();
      viewer.setLayout(view.layout);
      renderLegend();
      updateAnnotationButtons();
      updateStructureButtons();
      changed();
    });
  });

  $('tv-align').addEventListener('change', (e) => { view.align = e.target.checked; viewer.setAlign(view.align); changed(); });
  // numbers on the branches
  const valueButtons = [
    { id: 'tv-support', key: 'support', available: viewer.hasSupport, apply: (on) => viewer.setShowSupport(on) },
    { id: 'tv-lengths', key: 'lengths', available: viewer.hasLengths, apply: (on) => viewer.setShowLengths(on) },
  ];
  for (const b of valueButtons) {
    $(b.id).hidden = !b.available;
    $(b.id).addEventListener('click', () => {
      view[b.key] = !view[b.key];
      $(b.id).setAttribute('aria-pressed', String(view[b.key]));
      b.apply(view[b.key]);
      changed();
    });
  }
  $('tv-values-group').hidden = !valueButtons.some((b) => b.available);

  const actions = {
    'zoom-in': () => viewer.zoomBy(1.3),
    'zoom-out': () => viewer.zoomBy(1 / 1.3),
    'fit': () => viewer.fit(true),
    'readable': () => viewer.fit(false),
    'taller': () => viewer.zoomBy(1.25, null, null, 'y'),
    'shorter': () => viewer.zoomBy(1 / 1.25, null, null, 'y'),
    'wider': () => viewer.zoomBy(1.25, null, null, 'x'),
    'narrower': () => viewer.zoomBy(1 / 1.25, null, null, 'x'),
  };
  document.querySelectorAll('[data-tv-action]').forEach((btn) => {
    btn.addEventListener('click', () => { closePopover(); actions[btn.dataset.tvAction](); });
  });

  /** Push the whole view state to the controls and the tree. */
  function applyView() {
    sanitize(view);
    const labelBy = view.labelBy === undefined ? defaultLabel : view.labelBy;
    select.value = labelBy || '';
    $('tv-align').checked = view.align;
    $('tv-hide-ids').checked = !!view.hideIds;
    showHideIds();
    for (const b of valueButtons) $(b.id).setAttribute('aria-pressed', String(!!view[b.key] && b.available));
    $('tv-links-on-tree').setAttribute('aria-pressed', String(view.links));
    showLayout();
    viewer.setLayout(view.layout);
    viewer.state.idFallback = !view.hideIds;
    viewer.setLabelBy(labelBy);
    viewer.setAlign(view.align);
    viewer.setShowSupport(view.support);
    viewer.setShowLengths(view.lengths);
    applyStructure();
    rebuildTracks();
    applyClades();
    closePopover();
  }

  // ----- figure export -----

  const exportDialog = $('tv-export');
  let figure = null;
  let exportTimer = null;

  const CITATION = 'Aleksandra Korenskaia, Martina Adamek, Judit Szenei, Lisa Vader, Kai Blin, Tillmann Weber, Nadine Ziemert, '
    + 'PhyloNaP: a user-friendly database of phylogeny for natural product–producing enzymes, Bioinformatics, Volume 42, Issue 7, '
    + 'July 2026, btag393, https://doi.org/10.1093/bioinformatics/btag393';

  /** What to write in a figure caption or the methods: shown next to the download buttons, not drawn in the figure. */
  function figureDetails() {
    const info = data.info || {};
    const lines = [];
    if (data.datasetId) lines.push(['Dataset', 'PhyloNaP ' + data.datasetId + (info.name && info.name !== data.datasetId ? ' (' + info.name + ')' : '')]);
    const model = info.model ? 'substitution model ' + info.model : '';
    if (data.source === 'curated' || data.source === 'user') { if (model) lines.push(['Tree', model]); }
    else lines.push(['Tree', 'FastTree' + (model ? ', ' + model : '')]);
    if (view.reroot != null) lines.push(['Rooting', 'rerooted in the viewer' + (info.rooting ? ' (dataset rooting: ' + info.rooting + ')' : '')]);
    else if (info.rooting) lines.push(['Rooting', info.rooting]);
    const shownTips = viewer.leaves.reduce((n, leaf) => n + leaf.tips.length, 0);
    const collapsed = viewer.leaves.filter((leaf) => leaf.collapsed).length;
    const total = viewer.srcLeaves.length;
    if (shownTips < total || collapsed) {
      lines.push(['Shown', shownTips + ' of ' + total + ' sequences' + (collapsed ? ', ' + collapsed + (collapsed === 1 ? ' clade' : ' clades') + ' collapsed' : '')]);
    }
    lines.push(...placementDetails());
    return lines;
  }

  function exportOptions() {
    const labels = $('tv-ex-labels').value;
    const customHeight = $('tv-ex-height-mode').value === 'custom';
    return {
      title: $('tv-ex-title').value.trim(),
      widthMm: Math.min(Math.max(parseFloat($('tv-ex-width').value) || 180, 40), 2000),
      heightMm: customHeight ? Math.min(Math.max(parseFloat($('tv-ex-height').value) || 200, 30), 5000) : null,
      labels: labels === '__none' ? false : labels === '' ? null : labels,
      labelPt: Math.min(Math.max(parseFloat($('tv-ex-font').value) || 7, 3), 24),
      strips: $('tv-ex-strips').checked,
      columns: $('tv-ex-columns').checked,
      structures: $('tv-ex-structures').checked,
      legend: $('tv-ex-legend').checked,
      scaleBar: $('tv-ex-scale').checked,
      support: $('tv-ex-support').checked,
      lengths: $('tv-ex-lengths').checked,
      idFallback: !$('tv-ex-hide-ids').checked,
      legends: view.strips.filter((c) => scales[c]).map((c) => ({
        title: prettyName(c), items: scales[c].legend, otherCount: scales[c].otherCount, otherColor: OTHER_COLOR,
      })),
    };
  }

  async function refreshExport() {
    $('tv-ex-height').hidden = $('tv-ex-height-mode').value !== 'custom';
    $('tv-ex-hide-ids').closest('label').hidden = ['', '__none'].includes($('tv-ex-labels').value);
    const preview = $('tv-ex-preview');
    try {
      figure = await buildFigure(viewer, exportOptions());
    } catch (err) {
      figure = null;
      preview.textContent = 'The figure could not be drawn: ' + (err.message || err);
      return;
    }
    // shown as an image, so the preview is exactly what the file will contain
    const url = URL.createObjectURL(new Blob([figure.svg], { type: 'image/svg+xml' }));
    const img = h('img', { alt: 'Figure preview', src: url });
    img.onload = () => URL.revokeObjectURL(url);
    preview.textContent = '';
    preview.append(img);
    $('tv-ex-size').textContent = Math.round(figure.widthMm) + ' × ' + Math.round(figure.heightMm) + ' mm';
    const notes = [...figure.notes];
    if (figure.heightMm > 600) notes.push('This figure is very tall. Collapse clades, turn tip labels off, set a height, or use the circular layout.');
    $('tv-ex-notes').textContent = notes.join(' ');
  }
  const scheduleExport = () => { clearTimeout(exportTimer); exportTimer = setTimeout(refreshExport, 180); };

  $('tv-export-open').addEventListener('click', () => {
    closePopover();
    const radial = view.layout === 'radial';
    const labelSelect = $('tv-ex-labels');
    labelSelect.textContent = '';
    labelSelect.append(h('option', { value: '__none' }, 'None'), h('option', { value: '' }, 'Sequence ID'));
    for (const c of cols.all) labelSelect.append(h('option', { value: c }, prettyName(c)));
    labelSelect.value = select.value;
    const offer = (id, available, on) => {
      $(id).checked = available && on;
      $(id).closest('label').hidden = !available;
    };
    const hasText = viewer.colTracks.some((t) => t.type === 'text');
    offer('tv-ex-strips', view.strips.length > 0, true);
    offer('tv-ex-legend', view.strips.length > 0, true);
    offer('tv-ex-columns', hasText && !radial, true);
    offer('tv-ex-structures', viewer.hasImages && !radial, true);
    offer('tv-ex-support', viewer.hasSupport, view.support);
    offer('tv-ex-lengths', viewer.hasLengths, !!view.lengths);
    offer('tv-ex-scale', viewer.hasLengths, true);
    $('tv-ex-hide-ids').checked = !!view.hideIds;
    const infoBox = $('tv-ex-info-text');
    infoBox.textContent = '';
    for (const [name, text] of [...figureDetails(), ['Please cite', CITATION]]) {
      infoBox.append(h('p', null, h('strong', null, name + ': '), text));
    }
    $('tv-ex-layout').textContent = (radial ? 'Circular' : 'Rectangular') + ' layout, as in the current view';
    exportDialog.showModal();
    refreshExport();
  });
  exportDialog.querySelectorAll('input, select').forEach((control) => control.addEventListener('input', scheduleExport));
  $('tv-export-close').addEventListener('click', () => exportDialog.close());
  $('tv-ex-info-copy').addEventListener('click', async () => {
    const text = [...$('tv-ex-info-text').children].map((p) => p.textContent).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      $('tv-ex-info-copy').textContent = 'Copied';
    } catch (e) {
      $('tv-ex-info-copy').textContent = 'Copy failed';
    }
    setTimeout(() => { $('tv-ex-info-copy').textContent = 'Copy'; }, 1800);
  });

  const figureName = (ext) => 'phylonap_' + (data.datasetId || 'tree') + '.' + ext;
  $('tv-ex-svg').addEventListener('click', () => {
    if (figure) saveFile('<?xml version="1.0" encoding="UTF-8"?>\n' + figure.svg, figureName('svg'), 'image/svg+xml');
  });
  $('tv-ex-png').addEventListener('click', async () => {
    if (!figure) return;
    try {
      const blob = await toPng(figure, parseInt($('tv-ex-dpi').value, 10));
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: figureName('png') });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      $('tv-ex-notes').textContent = 'PNG not created: ' + (err.message || err);
    }
  });
  $('tv-ex-pdf').addEventListener('click', () => { if (figure) printPdf(figure); });

  // ----- sharing and saving -----

  // an uploaded tree lives only in this browser session, so a link to it would not work for anyone else
  if (data.source === 'user') $('tv-copy-link').hidden = true;
  $('tv-copy-link').addEventListener('click', async () => {
    const code = await store.encodeLink(view, fp);
    const url = location.origin + location.pathname + location.search + '#v=' + code;
    if (url.length > store.MAX_LINK_LENGTH) {
      setStatus('This view is too detailed for a link. Use "Save settings file" instead.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('Link copied.');
    } catch (e) {
      window.prompt('Copy this link:', url);
    }
  });

  $('tv-save-file').addEventListener('click', () => {
    saveFile(JSON.stringify(store.toFile(view, data.datasetId, viewer), null, 2),
      'phylonap_view_' + (data.datasetId || 'tree') + '.json', 'application/json');
    setStatus('Settings file saved.');
  });

  $('tv-load-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const result = store.fromFile(JSON.parse(await file.text()), viewer);
      view = result.view;
      applyView();
      changed();
      setStatus(result.skipped
        ? 'Settings loaded. ' + result.skipped + ' clade(s) were skipped because their tips are not in this tree.'
        : 'Settings loaded.');
    } catch (err) {
      setStatus('Could not load the file: ' + (err.message || err));
    }
  });

  $('tv-reset').addEventListener('click', () => {
    view = store.defaultView();
    store.clearLocal(storeId);
    applyView();
    viewer.fit(false);
    setStatus('View reset.');
  });

  // ----- placement of a query sequence -----

  let startPlacement = null;
  if (jplace) {
    const fields = jplace.fields || ['edge_num', 'likelihood', 'like_weight_ratio', 'distal_length', 'pendant_length'];
    const at = (name) => fields.indexOf(name);
    const edgeToId = new Map();
    for (const n of viewer.src) if (n.edge != null) edgeToId.set(n.edge, n.id);
    const all = (((jplace.placements || [])[0] || {}).p || []).map((p) => ({
      edgeNum: p[at('edge_num')], lwr: p[at('like_weight_ratio')], likelihood: at('likelihood') >= 0 ? p[at('likelihood')] : null, distal: p[at('distal_length')] || 0, pendant: p[at('pendant_length')] || 0,
    })).filter((p) => edgeToId.has(p.edgeNum)).sort((a, b) => b.lwr - a.lwr);
    const THRESHOLD = 0.5;
    const confident = all.filter((p) => p.lwr > THRESHOLD);
    let showAll = confident.length === 0;
    let active = null;
    const shown = () => (showAll ? all : confident);
    const key = (p) => 'p' + p.edgeNum;

    const markerOf = (p) => ({ key: key(p), edge: edgeToId.get(p.edgeNum), distal: p.distal });
    /** Details of the placements drawn on this node's branch, for the node menu. */
    placementInfo = (node) => shown().filter((p) => (viewer.locateMarker(markerOf(p)) || {}).node === node).map((p) => {
      const quality = placementQuality(p.pendant);
      const row = (name, value, tip) => h('div', { class: 'tv-popover-kv' },
        h('span', null, name, tip ? ' ' : null, tip ? help(tip) : null), h('strong', null, value));
      return h('div', { class: 'tv-popover-info' + (p === active ? ' is-active' : '') },
        h('div', { class: 'tv-popover-info-title' },
          h('span', { class: 'tv-placement-dot', style: 'background:' + placementColor(p.pendant) }),
          ' Placement of ' + data.placement.query + (all.length > 1 ? ' (' + (all.indexOf(p) + 1) + ' of ' + all.length + ')' : '')),
        row('Likelihood weight ratio', formatNumber(p.lwr), LWR_HELP),
        row('Pendant length', formatNumber(p.pendant), PL_HELP),
        row('Distal length', formatNumber(p.distal), 'Distal length: how far along this branch the query attaches, measured from the end of the branch that is further from the root.'),
        p.likelihood != null && row('Log-likelihood', formatNumber(p.likelihood), 'Log-likelihood of the tree with the query placed here.'),
        h('div', { class: 'tv-popover-quality' + (quality.good ? ' is-good' : quality.warn ? ' is-warn' : '') }, quality.text));
    });

    placementDetails = () => {
      const list = shown();
      if (!list.length) return [];
      return [['Placement', 'query ' + data.placement.query + ' placed with EPA-ng; '
        + (list.length === all.length ? '' : list.length + ' of ' + all.length + ' placements shown; ')
        + list.map((p, i) => (list.length > 1 ? '#' + (i + 1) + ' ' : '') + 'LWR ' + formatNumber(p.lwr) + ', pendant length ' + formatNumber(p.pendant)).join('; ')
        + '. Dot size shows the likelihood weight ratio (LWR), dot colour the pendant length (darker is shorter).']];
    };

    /** The smallest clade that contains every shown placement. */
    function placementClade() {
      const names = new Set();
      for (const p of shown()) for (const name of viewer.refTipNames(edgeToId.get(p.edgeNum))) names.add(name);
      const clade = names.size ? viewer.cladeOfTips([...names]) : null;
      if (!clade) return null;
      if (clade.id === 0) return { names: viewer.srcLeaves.map((l) => l.name), node: view.reroot == null ? viewer.displayRoot : null };
      return { names: viewer.refTipNames(clade.id), node: viewer.displayNode(clade.id) };
    }
    function showPlacementSummary() {
      const clade = placementClade();
      if (clade) showCladeSummary(clade.node, 'Summary of the placement clade', clade.names);
    }

    function drawPlacements() {
      viewer.setMarkers(shown().map((p) => ({
        key: key(p), edge: edgeToId.get(p.edgeNum), distal: p.distal, radius: 4 + 5 * Math.sqrt(p.lwr),
        color: placementColor(p.pendant), active: p === active,
        title: 'Placement of ' + data.placement.query + '\nLikelihood weight ratio: ' + formatNumber(p.lwr) + '\nPendant length: ' + formatNumber(p.pendant),
      })));

      const box = $('tv-placement');
      box.textContent = '';
      if (!all.length) { box.append(h('p', { class: 'tv-note' }, 'This result contains no placements on this tree.')); return; }
      const list = shown();
      let status;
      if (all.length === 1) status = 'One placement.';
      else if (showAll && confident.length) status = 'Showing all ' + all.length + ' placements.';
      else if (showAll) status = 'Showing all ' + all.length + ' placements (none with LWR above ' + THRESHOLD + ').';
      else status = 'Showing ' + confident.length + ' high-confidence placement' + (confident.length === 1 ? '' : 's') + ' (LWR above ' + THRESHOLD + ') of ' + all.length + '.';
      box.append(h('p', { class: 'tv-note' }, status));
      if (confident.length && confident.length < all.length) {
        box.append(h('button', {
          type: 'button', class: 'tv-btn tv-placement-toggle',
          onclick: () => { showAll = !showAll; active = null; drawPlacements(); showPlacementSummary(); },
        }, showAll ? 'Show only high-confidence (' + confident.length + ')' : 'Show all placements (' + all.length + ')'));
      }

      const table = h('table', { class: 'tv-ann-table tv-placement-table' },
        h('tr', null, h('th', null, ''),
          h('th', null, 'LWR ', help(LWR_HELP)),
          h('th', null, 'Pendant length ', help(PL_HELP)),
          h('th', null, '')));
      list.forEach((p, i) => {
        table.append(h('tr', { class: p === active ? 'is-active' : '' },
          h('td', null, h('span', { class: 'tv-placement-dot', style: 'background:' + placementColor(p.pendant) }), ' ' + (i + 1)),
          h('td', null, formatNumber(p.lwr)),
          h('td', null, formatNumber(p.pendant)),
          h('td', null, h('button', {
            type: 'button', class: 'tv-linkbtn', title: 'Move the tree to this placement',
            onclick: () => {
              active = p;
              if (!viewer.focusMarker(key(p))) toast('This placement is on a hidden part of the tree.');
              drawPlacements();
            },
          }, 'Show on tree'))));
      });
      box.append(table);

      const quality = placementQuality(list[0].pendant);
      box.append(h('p', { class: 'tv-placement-quality' + (quality.good ? ' is-good' : quality.warn ? ' is-warn' : '') },
        (list.length > 1 ? 'Best placement: ' : '') + quality.text));
      if (all.length === 1) box.append(h('p', { class: 'tv-note' }, 'With a single placement the LWR is always 1; use the pendant length to judge quality.'));
      if (list.length > 1) {
        box.append(h('p', { class: 'tv-note' },
          'Several placements: the size of each dot shows its likelihood weight ratio (bigger is more probable), the colour its evolutionary distance.'));
      }
      box.append(h('div', { class: 'tv-button-row' },
        h('button', { type: 'button', class: 'tv-btn', onclick: showPlacementSummary }, 'Summary of the placement clade'),
        h('a', { class: 'tv-link tv-placement-help', href: '/help#interpreting-results' }, 'How to interpret')));
    }

    // a click on a dot opens the menu of its branch, with the placement details on top
    viewer.on('markerclick', ({ marker, x, y }) => {
      active = shown().find((p) => key(p) === marker.key) || null;
      drawPlacements();
      const at = viewer.locateMarker(marker);
      if (at) openPopover({ node: at.node, x, y });
    });

    host.append(h('div', { class: 'tv-colorbar', dataset: { tvTip: 'Colour of the placement dots: pendant length (evolutionary distance). ' + PL_HELP } },
      h('span', null, '0 reliable'), h('span', { class: 'tv-colorbar-ramp' }), h('span', null, 'unreliable 1+')));

    $('tv-dl-jplace').addEventListener('click', () => saveFile(data.jplaceText,
      data.placement.query + '_' + data.placement.treeId + '.jplace', 'application/json'));

    startPlacement = () => {
      drawPlacements();
      showPlacementSummary();
      if (all.length) setTimeout(() => viewer.focusMarker(key(shown()[0])), 60);
    };
  }

  // ----- start -----

  $('tv-count').textContent = viewer.srcLeaves.length.toLocaleString() + ' sequences';
  renderAnnotations();

  const saved = store.loadLocal(storeId, fp);
  if (saved) view = Object.assign(store.defaultView(), saved);
  applyView();
  if (startPlacement) startPlacement();

  const hash = location.hash.match(/^#v=(.+)$/);
  if (hash) {
    store.decodeLink(hash[1]).then((linked) => {
      history.replaceState(null, '', location.pathname + location.search);
      if (!linked) { setStatus('The link could not be read, so the default view is shown.'); return; }
      view = linked.view;
      if (linked.fp !== fp) {
        store.dropNodeRefs(view);
        setStatus('This dataset has been updated since the link was made, so clade colours, rerooting and hidden or collapsed clades were not applied.');
      }
      applyView();
      changed();
    });
  }

  // side panel divider
  const divider = $('tv-divider');
  const panel = $('tv-panel');
  let start = null;
  divider.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, width: panel.getBoundingClientRect().width };
    divider.setPointerCapture(e.pointerId);
    document.body.classList.add('tv-resizing');
  });
  divider.addEventListener('pointermove', (e) => {
    if (!start) return;
    panel.style.width = Math.min(Math.max(start.width + (start.x - e.clientX), 240), window.innerWidth - 240) + 'px';
    viewer.resize();
  });
  const stop = () => { start = null; document.body.classList.remove('tv-resizing'); };
  divider.addEventListener('pointerup', stop);
  divider.addEventListener('pointercancel', stop);

  new ResizeObserver(() => viewer.resize()).observe(host);
  window.addEventListener('resize', sizeLayout);
}

init();
