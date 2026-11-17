// View state for the PhyloNaP tree viewer (v2): what the user chose to display.
// The same object is saved in the browser, written to a settings file and packed
// into a shareable link. Nothing here is sent to the server.

export const MAX_LINK_LENGTH = 1900;

export function defaultView() {
  return {
    layout: 'rect',
    labelBy: undefined,   // undefined = use the dataset default
    align: false,
    hideIds: false,       // leave the label empty where the chosen field has no value
    support: false,
    lengths: false,       // branch length written on each branch
    text: [],             // columns shown as text
    strips: [],           // columns shown as colour strips
    images: [],           // structure images next to the tree: 'bgc', 'reaction'
    links: false,         // cross-link columns next to the tree
    colors: {},           // { column: { value: colour } } changed by the user
    // Clades are referred to by a signed node number of the stored tree:
    // n = the tips below node n, -n = all the other tips (see viewer.js).
    clades: [],           // [{ id, branch, shade }]
    scope: {},            // { column: clade }  colour this column only within one clade
    reroot: null,         // node number: the tree is rerooted on the branch above this node
    hidden: [],           // hidden clades or tips
    collapsed: [],        // clades drawn as a triangle
  };
}

/** Short fingerprint of the tree, to notice when a link was made for a different version. */
export function fingerprint(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Remove everything that points at tree nodes by number. */
export function dropNodeRefs(view) {
  view.clades = [];
  view.scope = {};
  view.reroot = null;
  view.hidden = [];
  view.collapsed = [];
  return view;
}

// ---------- browser storage ----------

const storageKey = (datasetId) => 'phylonap.view.' + datasetId;

export function saveLocal(datasetId, fp, view) {
  if (!datasetId) return;
  try {
    localStorage.setItem(storageKey(datasetId), JSON.stringify({ fp, view }));
  } catch (e) { /* storage unavailable or full: the view simply isn't remembered */ }
}

export function loadLocal(datasetId, fp) {
  if (!datasetId) return null;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(datasetId)) || 'null');
    if (!saved || !saved.view) return null;
    if (saved.fp !== fp) dropNodeRefs(saved.view); // node numbers belong to another tree version
    return saved.view;
  } catch (e) {
    return null;
  }
}

export function clearLocal(datasetId) {
  try { localStorage.removeItem(storageKey(datasetId)); } catch (e) { /* ignore */ }
}

// ---------- link ----------

function toBase64Url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Compact form for the link: short keys, clades as [node, branch, shade]. */
function pack(view, fp) {
  const p = { f: fp };
  if (view.layout !== 'rect') p.l = 1;
  if (view.labelBy !== undefined) p.b = view.labelBy || '';
  if (view.align) p.a = 1;
  if (view.hideIds) p.m = 1;
  if (view.support) p.s = 1;
  if (view.lengths) p.e = 1;
  if (view.text.length) p.t = view.text;
  if (view.strips.length) p.c = view.strips;
  if (view.images.length) p.i = view.images;
  if (view.links) p.k = 1;
  if (Object.keys(view.colors).length) p.o = view.colors;
  if (view.clades.length) p.n = view.clades.map((c) => [c.id, c.branch || 0, c.shade || 0]);
  if (Object.keys(view.scope).length) p.g = view.scope;
  if (view.reroot != null) p.r = view.reroot;
  if (view.hidden.length) p.h = view.hidden;
  if (view.collapsed.length) p.x = view.collapsed;
  return p;
}

function unpack(p) {
  const view = defaultView();
  if (p.l) view.layout = 'radial';
  if (p.b !== undefined) view.labelBy = p.b || null;
  view.align = !!p.a;
  view.hideIds = !!p.m;
  view.support = !!p.s;
  view.lengths = !!p.e;
  view.text = p.t || [];
  view.strips = p.c || [];
  view.images = p.i || [];
  view.links = !!p.k;
  view.colors = p.o || {};
  view.clades = (p.n || []).map(([id, branch, shade]) => ({ id, branch: branch || null, shade: shade || null }));
  view.scope = p.g || {};
  view.reroot = p.r === undefined ? null : p.r;
  view.hidden = p.h || [];
  view.collapsed = p.x || [];
  return { view, fp: p.f };
}

export async function encodeLink(view, fp) {
  const json = new TextEncoder().encode(JSON.stringify(pack(view, fp)));
  if (typeof CompressionStream === 'function') {
    return 'z' + toBase64Url(await pipe(json, new CompressionStream('deflate-raw')));
  }
  return 'j' + toBase64Url(json);
}

/** @returns {Promise<{view, fp}|null>} */
export async function decodeLink(text) {
  try {
    let bytes = fromBase64Url(text.slice(1));
    if (text[0] === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    else if (text[0] !== 'j') return null;
    return unpack(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) {
    return null;
  }
}

// ---------- settings file ----------

/** The file names clades by their tips, so it still works after a dataset's tree is rebuilt. */
export function toFile(view, datasetId, viewer) {
  return {
    phylonap_view: 1,
    dataset: datasetId || null,
    saved: new Date().toISOString(),
    layout: view.layout,
    label_tips_by: view.labelBy === undefined ? undefined : view.labelBy || 'ID',
    align_labels: view.align,
    hide_ids_where_label_is_empty: !!view.hideIds,
    support_values: view.support,
    branch_lengths: !!view.lengths,
    text_columns: view.text,
    colour_strips: view.strips,
    structures: view.images,
    cross_links_on_tree: view.links,
    colours: view.colors,
    clades: view.clades.map((c) => ({ tips: viewer.refTipNames(c.id), branch: c.branch || undefined, shade: c.shade || undefined })),
    colour_within_clade: Object.entries(view.scope).map(([column, id]) => ({ column, tips: viewer.refTipNames(id) })),
    rerooted_at: view.reroot == null ? undefined : { tips: viewer.refTipNames(view.reroot) },
    hidden: view.hidden.map((id) => ({ tips: viewer.refTipNames(id) })),
    collapsed: view.collapsed.map((id) => ({ tips: viewer.refTipNames(id) })),
  };
}

/** @returns {{ view, skipped: number }} skipped = clades whose tips are not in this tree */
export function fromFile(file, viewer) {
  if (!file || file.phylonap_view !== 1) throw new Error('This is not a PhyloNaP view settings file.');
  const view = defaultView();
  view.layout = file.layout === 'radial' ? 'radial' : 'rect';
  if (file.label_tips_by !== undefined) view.labelBy = file.label_tips_by === 'ID' ? null : file.label_tips_by;
  view.align = !!file.align_labels;
  view.hideIds = !!file.hide_ids_where_label_is_empty;
  view.support = !!file.support_values;
  view.lengths = !!file.branch_lengths;
  view.text = Array.isArray(file.text_columns) ? file.text_columns : [];
  view.strips = Array.isArray(file.colour_strips) ? file.colour_strips : [];
  view.images = Array.isArray(file.structures) ? file.structures : [];
  view.links = !!file.cross_links_on_tree;
  view.colors = file.colours && typeof file.colours === 'object' ? file.colours : {};
  let skipped = 0;
  // a clade is found again by its tips; it is skipped if this tree has no clade with exactly those tips
  const find = (entry) => {
    const tips = entry && Array.isArray(entry.tips) ? entry.tips : [];
    const ref = tips.length ? viewer.refOfTips(tips) : null;
    if (ref == null) skipped++;
    return ref;
  };
  const list = (v) => (Array.isArray(v) ? v : []);
  for (const c of list(file.clades)) {
    const id = find(c);
    if (id != null) view.clades.push({ id, branch: c.branch || null, shade: c.shade || null });
  }
  for (const c of list(file.colour_within_clade)) {
    const id = find(c);
    if (id != null && typeof c.column === 'string') view.scope[c.column] = id;
  }
  if (file.rerooted_at) {
    const ref = find(file.rerooted_at);
    view.reroot = ref == null ? null : Math.abs(ref);
  }
  for (const c of list(file.hidden)) { const id = find(c); if (id != null) view.hidden.push(id); }
  for (const c of list(file.collapsed)) { const id = find(c); if (id != null) view.collapsed.push(id); }
  return { view, skipped };
}
