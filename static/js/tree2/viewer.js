// PhyloNaP tree viewer (v2): rendering, layouts and navigation.
//
// Branches, clade shading and colour strips live in SVG groups that are moved and
// scaled as a whole, so panning and zooming never rewrite the thousands of shapes.
// Tip labels, text columns and support values are drawn only for what is on screen.

/* global d3 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const RADIAL_R = 1000;                 // radius of the circular layout in drawing units
export const RADIAL_SPAN = Math.PI * 2 * 0.97; // leave a small gap so first and last tip don't touch
export const RADIAL_START = -Math.PI / 2 + (Math.PI * 2 - RADIAL_SPAN) / 2;
const LABEL_FONT = 12;
const MIN_LABEL_PX = 6.5;              // below this spacing labels are hidden
const READABLE_ROW = 15;               // default row height in the rectangular layout
const LABEL_MAX_CHARS = 48;
const STRIP_W = 11;                    // colour strip width in px
const STRIP_STEP = 14;                 // strip width plus gap
const TEXT_COL_W = 170;                // text column width in px
const TEXT_COL_CHARS = 26;
const IMAGE_COL_W = 124;               // image column width in px
const IMAGE_MAX = 112;                 // largest thumbnail size in px
const IMAGE_ROW = 56;                  // row height used when thumbnails are shown
const ITALIC_COLUMNS = new Set(['species', 'genus', 'organism']);

function el(name, attrs) {
  const node = document.createElementNS(SVG_NS, name);
  if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
  return node;
}

function niceLength(target) {
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const f = target / pow;
  const step = f >= 5 ? 5 : f >= 2 ? 2 : 1;
  return step * pow;
}

function shorten(text, max) {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

export class TreeViewer {
  /**
   * @param {HTMLElement} host   element that will contain the tree
   * @param {object} root        parsed tree (see newick.js)
   * @param {Map<string, object>} metaById  annotation rows keyed by tip ID
   */
  constructor(host, root, metaById) {
    this.host = host;
    this.root = root;
    this.metaById = metaById;
    this.state = {
      layout: 'rect',
      labelBy: null,       // annotation column, or null for the ID
      align: false,
      showSupport: false,
      showLengths: false,
      idFallback: true,    // show the sequence ID where the label field is empty
      autoFit: true,       // stays true until the user pans or zooms
      // rectangular view
      sx: 1, sy: READABLE_ROW, tx: 0, ty: 0,
      // circular view
      k: 0.3, cx: 0, cy: 0,
    };
    this.tracks = [];              // colour strips and text columns next to the tips
    this.emphasis = new Set();     // tip names drawn in bold, outlined in strips that ask for it (track.outline)
    this.stripTracks = [];
    this.colTracks = [];
    this.cladeStyles = new Map();  // stored-tree node id -> { branch, shade }
    this.structure = { reroot: null, hidden: new Set(), collapsed: new Set() };
    this.selection = null;
    this.markers = [];             // dots on branches (query placements)
    this.listeners = {};
    this._indexSource();
    this._buildDom();
    this._bindEvents();
    this._rebuild();
    this.resize();
  }

  on(name, fn) { this.listeners[name] = fn; return this; }
  _emit(name, detail) { if (this.listeners[name]) this.listeners[name](detail); }

  // ---------- the stored tree ----------
  //
  // "Source" nodes are the tree exactly as stored in the database. Their ids
  // (position in the file) are what saved views and links refer to. What is drawn
  // is a separate "display" tree built from it, which may be rerooted, have hidden
  // clades, or have clades collapsed into triangles.

  _indexSource() {
    const src = [];
    const srcLeaves = [];
    let hasLengths = false;
    let supportCount = 0;
    const stack = [this.root]; // iterative preorder: deep trees can't overflow the call stack
    while (stack.length) {
      const n = stack.pop();
      n.id = src.length;
      src.push(n);
      if (n.length != null && n.parent) hasLengths = true;
      if (n.support != null) supportCount++;
      if (!n.children.length) { n.t0 = n.t1 = srcLeaves.length; srcLeaves.push(n); }
      for (let c = n.children.length - 1; c >= 0; c--) stack.push(n.children[c]);
    }
    this.hasLengths = hasLengths;
    this.hasSupport = supportCount >= 3;
    for (let i = src.length - 1; i >= 0; i--) {
      const n = src[i];
      n.depthBelow = 0;
      if (n.children.length) {
        n.t0 = n.children[0].t0;
        n.t1 = n.children[n.children.length - 1].t1;
        for (const c of n.children) n.depthBelow = Math.max(n.depthBelow, this._len(c) + c.depthBelow);
      }
    }
    this.src = src;
    this.srcLeaves = srcLeaves;
  }

  _len(n) {
    return this.hasLengths ? Math.max(0, n.length || 0) : 1;
  }

  // A clade is referred to by a signed number ("ref"), which stays valid however
  // the tree is rooted: every branch of the stored tree splits the tips in two groups.
  //   ref =  n : the tips below stored node n
  //   ref = -n : all the other tips (this group becomes a clade once the tree is
  //              rerooted somewhere below node n)

  /** Names of the tips of a clade reference. */
  refTipNames(ref) {
    const n = this.src[Math.abs(ref)];
    if (!n) return [];
    const names = [];
    for (let i = 0; i < this.srcLeaves.length; i++) {
      const inside = i >= n.t0 && i <= n.t1;
      if (inside === ref > 0) names.push(this.srcLeaves[i].name);
    }
    return names;
  }

  /** The clade reference whose tips are exactly the given names, or null if the tree has none. */
  refOfTips(names) {
    const below = this.cladeOfTips(names);
    if (!below) return null;
    if (below.t1 - below.t0 + 1 === names.length) return below.id || null;
    const given = new Set(names);
    const rest = this.srcLeaves.filter((l) => !given.has(l.name)).map((l) => l.name);
    if (!rest.length) return null;
    const other = this.cladeOfTips(rest);
    return other && other.id && other.t1 - other.t0 + 1 === rest.length ? -other.id : null;
  }

  /** Smallest stored-tree clade containing all the named tips, or null if a name is unknown. */
  cladeOfTips(names) {
    if (!this._srcLeafByName) this._srcLeafByName = new Map(this.srcLeaves.map((l) => [l.name, l]));
    let lo = Infinity;
    let hi = -Infinity;
    for (const name of names) {
      const leaf = this._srcLeafByName.get(name);
      if (!leaf) return null;
      lo = Math.min(lo, leaf.t0);
      hi = Math.max(hi, leaf.t0);
    }
    if (lo === Infinity) return null;
    let n = this.srcLeaves[lo];
    while (n.parent && !(n.t0 <= lo && n.t1 >= hi)) n = n.parent;
    return n;
  }

  // ---------- the displayed tree ----------

  /**
   * Change the shape of the displayed tree.
   * @param {{reroot: number|null, hidden: number[], collapsed: number[]}} structure
   *        reroot is a stored node id (the branch above it); hidden and collapsed are clade refs
   */
  setStructure(structure) {
    this.structure = {
      reroot: structure.reroot == null ? null : structure.reroot,
      hidden: new Set(structure.hidden || []),
      collapsed: new Set(structure.collapsed || []),
    };
    this.selection = null;
    this._rebuild();
    if (this.width === undefined) return;
    if (this.state.autoFit) this.fit(this._fitWasWhole);
    else { this._clamp(); this.render(); }
  }

  /**
   * Each display node remembers which stored branch it is drawn from (edgeId) and
   * its clade reference (ref). After rerooting, nodes on the path between the old
   * and the new root are "flipped": they hang the other way round, and their clade
   * is the other group of tips of their branch (ref = -edgeId).
   */
  _buildDisplay() {
    const { reroot, hidden, collapsed } = this.structure;

    // Hiding is worked out per tip, so it gives the same result however the tree is
    // rooted: a branch is left out when every tip behind it is hidden.
    const total = this.srcLeaves.length;
    const hiddenBefore = new Int32Array(total + 1);   // hiddenBefore[i] = hidden tips among the first i
    if (hidden.size) {
      const isHidden = new Uint8Array(total);
      for (const ref of hidden) {
        const E = this.src[Math.abs(ref)];
        if (!E) continue;
        for (let i = 0; i < total; i++) if ((i >= E.t0 && i <= E.t1) === ref > 0) isHidden[i] = 1;
      }
      for (let i = 0; i < total; i++) hiddenBefore[i + 1] = hiddenBefore[i] + isHidden[i];
    }
    const hiddenBelow = (X) => hiddenBefore[X.t1 + 1] - hiddenBefore[X.t0];
    const allBelowHidden = (X) => hiddenBelow(X) === X.t1 - X.t0 + 1;
    const allElseHidden = (X) => hiddenBefore[total] - hiddenBelow(X) === total - (X.t1 - X.t0 + 1);

    const make = (X, from, edgeNode, flipped, length) => {
      const d = {
        src: X, ref: flipped ? -edgeNode.id : X.id, edgeId: edgeNode ? edgeNode.id : -1, flipped, length,
        support: edgeNode ? edgeNode.support : null, supportRaw: edgeNode ? edgeNode.supportRaw : null,
        name: X.name, children: [], parent: null, collapsed: false, depth: 0,
      };
      if (!X.children.length) {
        d.tips = [X.name];
        d.tipCount = 1;
        return d;
      }
      if (!flipped && collapsed.has(X.id)) {
        d.collapsed = true;
        d.tips = this.refTipNames(X.id);
        d.tipCount = d.tips.length;
        d.depth = X.depthBelow;
        d.name = '';
        return d;
      }
      for (const C of X.children) {
        if (C === from || allBelowHidden(C)) continue;
        const c = make(C, X, C, false, this._len(C));
        if (c) d.children.push(c);
      }
      if (X.parent && X.parent !== from && !allElseHidden(X)) {
        const c = make(X.parent, X, X, true, this._len(X));
        if (c) d.children.push(c);
      }
      if (!d.children.length) return null;            // everything below is hidden
      if (d.children.length === 1) {                   // a node with one branch left is not drawn
        const only = d.children[0];
        // remember the stored branch that is now part of this longer one (markers may sit on it)
        if (d.edgeId >= 0) (only.merged = only.merged || []).push({ edgeId: d.edgeId, flipped: d.flipped, length: d.length, d0: d.d0 || 0 });
        only.length += d.length;
        return only;
      }
      d.tipCount = d.children.reduce((sum, c) => sum + c.tipCount, 0);
      if (flipped && collapsed.has(d.ref)) {           // a collapsed clade among the flipped nodes
        d.tips = [];
        const walk = [[d, 0]];
        while (walk.length) {
          const [n, far] = walk.pop();
          if (!n.children.length) {
            for (const name of n.tips) d.tips.push(name);
            d.depth = Math.max(d.depth, far + n.depth);
          }
          for (const c of n.children) walk.push([c, far + c.length]);
        }
        d.collapsed = true;
        d.children = [];
        d.name = '';
      }
      return d;
    };

    const N = reroot != null ? this.src[reroot] : null;
    let root = null;
    if (N && N.parent) {
      const half = this._len(N) / 2;
      const a = allBelowHidden(N) ? null : make(N, N.parent, N, false, half);
      const b = allElseHidden(N) ? null : make(N.parent, N, N, true, half);
      if (b) { b.support = null; b.supportRaw = null; b.d0 = half; }  // b is the far half of the split branch
      const kids = [a, b].filter(Boolean);
      if (kids.length === 2) {
        root = { src: null, ref: 0, edgeId: -1, flipped: true, length: 0, support: null, supportRaw: null,
          name: '', children: kids, parent: null, collapsed: false, depth: 0, tipCount: a.tipCount + b.tipCount };
      } else {
        root = kids[0] || null;
      }
    } else {
      root = make(this.root, null, null, false, 0);
    }
    return root;
  }

  _rebuild() {
    let root = this._buildDisplay();
    if (!root) {                                       // never show an empty tree
      this.structure.hidden = new Set();
      root = this._buildDisplay();
    }
    root.length = 0;

    const nodes = [];
    const leaves = [];
    const stack = [root];
    let maxDist = 0;
    while (stack.length) {
      const n = stack.pop();
      n.did = nodes.length;
      nodes.push(n);
      n.dist = n.parent ? n.parent.dist + n.length : 0;
      if (!n.children.length) {
        n.y = n.y0 = n.y1 = leaves.length;
        n.tipDist = n.dist + n.depth;
        if (n.tipDist > maxDist) maxDist = n.tipDist;
        leaves.push(n);
      }
      for (let c = n.children.length - 1; c >= 0; c--) {
        n.children[c].parent = n;
        stack.push(n.children[c]);
      }
    }
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!n.children.length) continue;
      const first = n.children[0];
      const last = n.children[n.children.length - 1];
      n.y = (first.y + last.y) / 2;
      n.y0 = first.y0;
      n.y1 = last.y1;
    }

    this.displayRoot = root;
    this.nodes = nodes;
    this.leaves = leaves;
    this.internals = nodes.filter((n) => n.children.length);
    this.maxDist = maxDist || 1;
    this.byRef = new Map();
    for (const n of nodes) if (n.ref) this.byRef.set(n.ref, n);

    // where each stored branch is drawn: edge id -> pieces along displayed branches.
    // d0 is how far from the stored child end the piece begins (non-zero only for a split root branch).
    this.edgePieces = new Map();
    const piece = (edgeId, node, start, end, flipped, d0) => {
      if (!this.edgePieces.has(edgeId)) this.edgePieces.set(edgeId, []);
      this.edgePieces.get(edgeId).push({ node, start, end, flipped, d0 });
    };
    for (const n of nodes) {
      if (!n.parent || n.edgeId < 0) continue;
      let cursor = n.dist;
      const own = n.length - (n.merged || []).reduce((sum, m) => sum + m.length, 0);
      piece(n.edgeId, n, cursor - own, cursor, n.flipped, n.d0 || 0);
      cursor -= own;
      for (const m of n.merged || []) {
        piece(m.edgeId, n, cursor - m.length, cursor, m.flipped, m.d0);
        cursor -= m.length;
      }
    }

    this._buildPaths();
    this._labelW = this._maxLabelWidth();
    this._buildStrips();
    this._applyCladeStyles();
  }

  // ---------- markers on branches ----------

  /**
   * @param {{key, edge: number, distal: number, radius: number, color: string, title: string}[]} markers
   *        edge is a stored node id (the branch above it); distal is the distance from that node along the branch
   */
  setMarkers(markers) {
    this.markers = markers || [];
    this.render();
  }

  /** Where a marker is drawn in the current tree: { node, dist } or null if its branch is hidden. */
  locateMarker(marker) {
    const pieces = this.edgePieces.get(marker.edge);
    if (pieces && pieces.length) {
      let best = pieces[0];
      for (const p of pieces) if (marker.distal >= p.d0 && marker.distal <= p.d0 + (p.end - p.start)) best = p;
      const along = Math.min(Math.max(marker.distal - best.d0, 0), best.end - best.start);
      return { node: best.node, dist: best.flipped ? best.start + along : best.end - along };
    }
    const E = this.src[marker.edge];
    if (!E) return null;
    for (const leaf of this.leaves) {              // inside a collapsed clade: show it at the triangle
      if (!leaf.collapsed) continue;
      const C = this.src[Math.abs(leaf.ref)];
      const inside = C.t0 <= E.t0 && E.t1 <= C.t1;
      if (leaf.ref > 0 ? inside : !inside) return { node: leaf, dist: leaf.dist };
    }
    return null;
  }

  _markerPoint(marker) {
    const at = this.locateMarker(marker);
    if (!at) return null;
    const st = this.state;
    if (st.layout === 'radial') {
      const r = (at.dist / this.maxDist) * RADIAL_R * st.k;
      const theta = this._theta(at.node);
      return { x: st.cx + r * Math.cos(theta), y: st.cy + r * Math.sin(theta) };
    }
    return { x: at.dist * st.sx + st.tx, y: at.node.y * st.sy + st.ty };
  }

  _drawMarkers() {
    const data = [];
    for (const marker of this.markers) {
      const point = this._markerPoint(marker);
      if (point) data.push({ marker, ...point });
    }
    data.sort((a, b) => (a.marker.active ? 1 : 0) - (b.marker.active ? 1 : 0)); // the chosen one on top
    d3.select(this.gMarkers)
      .selectAll('circle.tv-marker-ring')
      .data(data.filter((d) => d.marker.active), (d) => d.marker.key)
      .join('circle')
      .attr('class', 'tv-marker-ring')
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', (d) => d.marker.radius + 6);
    d3.select(this.gMarkers)
      .selectAll('circle.tv-marker')
      .data(data, (d) => d.marker.key)
      .join('circle')
      .attr('class', (d) => 'tv-marker' + (d.marker.active ? ' is-active' : ''))
      .attr('cx', (d) => d.x)
      .attr('cy', (d) => d.y)
      .attr('r', (d) => d.marker.radius)
      .attr('fill', (d) => d.marker.color)
      .order();
  }

  /** Move the view so a marker is in the middle. */
  focusMarker(key) {
    const marker = this.markers.find((m) => m.key === key);
    const point = marker && this._markerPoint(marker);
    if (!point) return false;
    const st = this.state;
    const dx = this.width * 0.45 - point.x;
    const dy = this.height / 2 - point.y;
    if (st.layout === 'radial') { st.cx += dx; st.cy += dy; }
    else {
      st.ty += dy;
      if (point.x < 40 || point.x > this.width * 0.8) st.tx += dx;
    }
    st.autoFit = false;
    this._clamp();
    this.render();
    return true;
  }

  /** The displayed node for a clade reference, if that clade exists with the current root. */
  displayNode(ref) {
    return this.byRef.get(ref) || null;
  }

  /** Names of all tips below a displayed node, including those inside collapsed clades. */
  tipNames(node) {
    const out = [];
    for (let i = node.y0; i <= node.y1; i++) for (const name of this.leaves[i].tips) out.push(name);
    return out;
  }

  /** Value of an annotation field for a displayed tip. A collapsed clade has a value only if all its tips share it. */
  valueFor(leaf, column) {
    let shared = null;
    for (const name of leaf.tips) {
      const row = this.metaById.get(name);
      const v = row ? row[column] : null;
      const text = v === null || v === undefined || String(v).trim() === '' || String(v) === 'nan' ? '' : String(v);
      if (shared === null) shared = text;
      else if (shared !== text) return '';
      if (shared === '') return '';
    }
    return shared || '';
  }

  /** Angle of a tip position (may be fractional) in the circular layout. */
  _angle(y) {
    return RADIAL_START + ((y + 0.5) / this.leaves.length) * RADIAL_SPAN;
  }

  _theta(n) { return this._angle(n.y); }

  _radius(n) {
    return (n.dist / this.maxDist) * RADIAL_R;
  }

  _tipRadius(leaf) {
    return (leaf.tipDist / this.maxDist) * RADIAL_R;
  }

  // ---------- DOM ----------

  _buildDom() {
    this.host.classList.add('tv-canvas');
    this.svg = el('svg', { class: 'tv-svg' });
    this.gScene = el('g', { class: 'tv-scene' });
    this.gShades = el('g', { class: 'tv-shades' });
    this.gLeaders = el('path', { class: 'tv-leaders' });
    this.gBranches = el('g', { class: 'tv-branches' });
    this.gTriangles = el('g', { class: 'tv-triangles' });
    this.gHits = el('g', { class: 'tv-hits' });
    this.gScene.append(this.gShades, this.gLeaders, this.gBranches, this.gTriangles, this.gHits);
    this.gStrips = el('g', { class: 'tv-strips' });
    this.gSupport = el('g', { class: 'tv-support' });
    this.gLengths = el('g', { class: 'tv-lengths' });
    this.gMarkers = el('g', { class: 'tv-markers' });
    this.gLabels = el('g', { class: 'tv-labels' });
    this.gCols = el('g', { class: 'tv-cols' });
    this.gHeaders = el('g', { class: 'tv-headers' });
    this.svg.append(this.gScene, this.gStrips, this.gSupport, this.gLengths, this.gLabels, this.gCols, this.gHeaders, this.gMarkers);
    this.host.append(this.svg);

    this.scaleBar = document.createElement('div');
    this.scaleBar.className = 'tv-scalebar';
    this.scaleBar.innerHTML = '<span class="tv-scalebar-line"></span><span class="tv-scalebar-text"></span>';
    this.host.append(this.scaleBar);

    this.hint = document.createElement('div');
    this.hint.className = 'tv-hint';
    this.hint.textContent = 'Zoom in to see tip labels';
    this.host.append(this.hint);

    this.valueHint = document.createElement('div');
    this.valueHint.className = 'tv-hint tv-hint-values';
    this.host.append(this.valueHint);

    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tv-tooltip';
    this.host.append(this.tooltip);

    this._measureCtx = document.createElement('canvas').getContext('2d');
  }

  _buildPaths() {
    this.gBranches.textContent = '';
    this.gHits.textContent = '';
    this.gTriangles.textContent = '';
    const fragB = document.createDocumentFragment();
    const fragH = document.createDocumentFragment();
    for (const n of this.nodes) {
      if (n.collapsed) {
        n.tri = el('path', { class: 'tv-collapsed' });
        n.tri.__node = n;
        this.gTriangles.append(n.tri);
      }
      if (!n.parent) continue;
      n.el = el('path', { class: 'tv-branch' });
      n.hit = el('path', { class: 'tv-hit' });
      n.hit.__node = n;
      fragB.append(n.el);
      fragH.append(n.hit);
    }
    this.gBranches.append(fragB);
    this.gHits.append(fragH);
    this._updatePaths();
  }

  /** Tips are lined up at the right edge when asked for, or whenever strips or columns are shown. */
  _aligned() {
    return this.state.align || this.tracks.length > 0;
  }

  /** Rewrite branch geometry. Needed only when the layout or alignment changes. */
  _updatePaths() {
    const radial = this.state.layout === 'radial';
    const aligned = this._aligned();
    let leaders = '';
    for (const n of this.nodes) {
      if (!n.parent) continue;
      let d;
      if (radial) {
        const tp = this._theta(n.parent);
        const tc = this._theta(n);
        const rp = this._radius(n.parent);
        const rc = this._radius(n);
        const cos = Math.cos(tc);
        const sin = Math.sin(tc);
        if (rp > 0 && tp !== tc) {
          const large = Math.abs(tc - tp) > Math.PI ? 1 : 0;
          const sweep = tc > tp ? 1 : 0;
          d = `M${rp * Math.cos(tp)},${rp * Math.sin(tp)}A${rp},${rp} 0 ${large} ${sweep} ${rp * cos},${rp * sin}L${rc * cos},${rc * sin}`;
        } else {
          d = `M${rp * cos},${rp * sin}L${rc * cos},${rc * sin}`;
        }
        if (!n.children.length) {
          const rt = this._tipRadius(n);
          if (aligned && rt < RADIAL_R) leaders += `M${rt * cos},${rt * sin}L${RADIAL_R * cos},${RADIAL_R * sin}`;
          if (n.tri) {
            const a0 = this._angle(n.y - 0.42);
            const a1 = this._angle(n.y + 0.42);
            n.tri.setAttribute('d', `M${rc * cos},${rc * sin}L${rt * Math.cos(a0)},${rt * Math.sin(a0)}L${rt * Math.cos(a1)},${rt * Math.sin(a1)}Z`);
          }
        }
      } else {
        d = `M${n.parent.dist},${n.parent.y}V${n.y}H${n.dist}`;
        if (!n.children.length) {
          if (aligned && n.tipDist < this.maxDist) leaders += `M${n.tipDist},${n.y}H${this.maxDist}`;
          if (n.tri) n.tri.setAttribute('d', `M${n.dist},${n.y}L${n.tipDist},${n.y - 0.42}V${n.y + 0.42}Z`);
        }
      }
      n.el.setAttribute('d', d);
      n.hit.setAttribute('d', d);
    }
    this.gLeaders.setAttribute('d', leaders);
  }

  // ---------- labels ----------

  labelFor(leaf) {
    const col = this.state.labelBy;
    if (leaf.collapsed) {
      const shared = col ? this.valueFor(leaf, col) : '';
      return { text: leaf.tipCount + ' tips' + (shared ? ' · ' + shared : ''), fromId: false, collapsed: true };
    }
    if (col) {
      const v = this.valueFor(leaf, col);
      if (v) return { text: v, fromId: false };
      if (!this.state.idFallback) return { text: '', fromId: true };
    }
    return { text: leaf.name, fromId: !!col };
  }

  _maxLabelWidth() {
    const ctx = this._measureCtx;
    ctx.font = `${LABEL_FONT}px ${getComputedStyle(this.host).fontFamily}`;
    let max = 0;
    for (const leaf of this.leaves) {
      const w = ctx.measureText(shorten(this.labelFor(leaf).text, LABEL_MAX_CHARS)).width;
      if (w > max) max = w;
    }
    return Math.min(max, 320);
  }

  // ---------- strips, columns and clade styles ----------

  /**
   * Set what is shown next to the tips.
   * Each track: { key, title, type: 'strip' | 'text' | 'image' } plus
   *   strip: color(leaf) -> css colour or null, text(leaf) -> string
   *   text:  text(leaf) -> string, optional href(leaf) -> url (the cell becomes a link)
   *   image: images(leaf) -> array of urls (the first is shown as a thumbnail)
   *   any:   optional describe(value) -> explanation shown in the tooltip
   */
  /** Tips to stand out (e.g. the reference proteins of catalytic sites). Takes effect with the next setTracks. */
  setEmphasis(names) {
    this.emphasis = new Set(names || []);
  }

  isEmphasised(leaf) {
    return this.emphasis.size > 0 && leaf.tips.some((t) => this.emphasis.has(t));
  }

  setTracks(tracks) {
    const wasAligned = this._aligned();
    this.tracks = tracks || [];
    this.stripTracks = this.tracks.filter((t) => t.type === 'strip');
    this.colTracks = this.tracks.filter((t) => t.type === 'text' || t.type === 'image');
    this.hasImages = this.colTracks.some((t) => t.type === 'image');
    if (wasAligned !== this._aligned()) this._updatePaths();
    this._buildStrips();
    this._buildShades();
    if (this.state.autoFit) this.fit(this._fitWasWhole);
    else this.render();
  }

  _stripsWidth() {
    const n = this.stripTracks ? this.stripTracks.length : 0;
    return n ? n * STRIP_STEP + 4 : 0;
  }

  /** Draw every strip once; afterwards only the group transform changes. */
  _buildStrips() {
    this.gStrips.textContent = '';
    const radial = this.state.layout === 'radial';
    for (const track of this.stripTracks || []) {
      const g = el('g', { class: 'tv-strip' });
      let start = 0;
      while (start < this.leaves.length) {
        const color = track.color(this.leaves[start]);
        const value = track.text(this.leaves[start]);
        let end = start;
        while (end + 1 < this.leaves.length && track.text(this.leaves[end + 1]) === value
          && track.color(this.leaves[end + 1]) === color) end++;
        if (color) {
          let shape;
          if (radial) {
            const a0 = this._angle(start - 0.5);
            const a1 = this._angle(end + 0.5);
            shape = el('path', {
              d: `M${RADIAL_R * Math.cos(a0)},${RADIAL_R * Math.sin(a0)}A${RADIAL_R},${RADIAL_R} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${RADIAL_R * Math.cos(a1)},${RADIAL_R * Math.sin(a1)}`,
              class: 'tv-strip-arc',
              stroke: color,
            });
          } else {
            shape = el('rect', { x: 0, y: start - 0.5, width: STRIP_W, height: end - start + 1, fill: color });
          }
          shape.__strip = { track, title: track.title, value, count: end - start + 1 };
          g.append(shape);
        }
        start = end + 1;
      }
      // emphasised tips get a dark frame around their cell
      if (track.outline && this.emphasis.size) {
        this.leaves.forEach((leaf, i) => {
          if (!this.isEmphasised(leaf)) return;
          if (radial) {
            const a0 = this._angle(i - 0.6);
            const a1 = this._angle(i + 0.6);
            // a slightly wider dark arc under the coloured one shows as a frame
            g.prepend(el('path', {
              d: `M${RADIAL_R * Math.cos(a0)},${RADIAL_R * Math.sin(a0)}A${RADIAL_R},${RADIAL_R} 0 0 1 ${RADIAL_R * Math.cos(a1)},${RADIAL_R * Math.sin(a1)}`,
              class: 'tv-strip-ref-arc',
            }));
          } else {
            g.append(el('rect', { x: -0.5, y: i - 0.5, width: STRIP_W + 1, height: 1, class: 'tv-strip-ref' }));
          }
        });
      }
      this.gStrips.append(g);
    }
  }

  /** @param {Map<number, {branch?: string, shade?: string}>} styles keyed by clade ref */
  setCladeStyles(styles) {
    this.cladeStyles = styles || new Map();
    this._applyCladeStyles();
    this.render();
  }

  _applyCladeStyles() {
    // Colours are worked out per stored branch, so they don't depend on where the
    // root is. A branch takes the colour of the smallest coloured clade it is in.
    const total = this.srcLeaves.length;
    const styled = [];
    for (const [ref, style] of this.cladeStyles) {
      const E = this.src[Math.abs(ref)];
      if (!E || !style.branch) continue;
      const below = E.t1 - E.t0 + 1;
      styled.push({ E, far: ref < 0, size: ref < 0 ? total - below : below, color: style.branch });
    }
    styled.sort((x, y) => x.size - y.size);
    const colorOf = (e) => {
      for (const c of styled) {
        const inside = c.E.t0 <= e.t0 && e.t1 <= c.E.t1;
        if (c.far ? e === c.E || !inside : inside) return c.color;
      }
      return null;
    };
    for (const n of this.nodes) {
      const c = styled.length && n.edgeId >= 0 ? colorOf(this.src[n.edgeId]) : null;
      if (n.el) n.el.style.stroke = c || '';
      if (n.tri) { n.tri.style.fill = c || ''; n.tri.style.stroke = c || ''; }
    }
    this._buildShades();
  }

  /** Highlight a displayed node (a tip or a clade), or pass null to clear. */
  setSelection(node) {
    this.selection = node || null;
    this._buildShades();
    this.render();
  }

  _shadeShape(n) {
    const startDist = n.parent ? (n.parent.dist + n.dist) / 2 : 0;
    if (this.state.layout === 'radial') {
      const r0 = (startDist / this.maxDist) * RADIAL_R;
      const a0 = this._angle(n.y0 - 0.5);
      const a1 = this._angle(n.y1 + 0.5);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (r, a) => `${r * Math.cos(a)},${r * Math.sin(a)}`;
      return el('path', {
        d: `M${p(r0, a0)}L${p(RADIAL_R, a0)}A${RADIAL_R},${RADIAL_R} 0 ${large} 1 ${p(RADIAL_R, a1)}L${p(r0, a1)}A${r0},${r0} 0 ${large} 0 ${p(r0, a0)}Z`,
      });
    }
    return el('rect', { x: startDist, y: n.y0 - 0.5, width: this.maxDist - startDist, height: n.y1 - n.y0 + 1 });
  }

  _buildShades() {
    this.gShades.textContent = '';
    for (const [id, style] of this.cladeStyles) {
      const n = this.byRef.get(id);   // drawn when this clade exists with the current root
      if (!n || !style.shade) continue;
      const shape = this._shadeShape(n);
      shape.setAttribute('class', 'tv-shade');
      shape.setAttribute('fill', style.shade);
      this.gShades.append(shape);
    }
    if (this.selection && this.nodes[this.selection.did] === this.selection) {
      const shape = this._shadeShape(this.selection);
      shape.setAttribute('class', 'tv-selection');
      this.gShades.append(shape);
    }
  }

  // ---------- public controls ----------

  setLayout(layout) {
    if (layout === this.state.layout) return;
    this.state.layout = layout;
    this._updatePaths();
    this._buildStrips();
    this._buildShades();
    this.fit(layout === 'radial');
  }

  setLabelBy(column) {
    this.state.labelBy = column || null;
    this._labelW = this._maxLabelWidth();
    if (this.state.autoFit) this.fit(this._fitWasWhole);
    else this.render();
  }

  /** Whether tips without a value in the label field show their sequence ID instead. */
  setIdFallback(on) {
    this.state.idFallback = !!on;
    this.setLabelBy(this.state.labelBy);
  }

  setAlign(on) {
    const was = this._aligned();
    this.state.align = !!on;
    if (was !== this._aligned()) this._updatePaths();
    this.render();
  }

  setShowSupport(on) {
    this.state.showSupport = !!on;
    this.render();
  }

  setShowLengths(on) {
    this.state.showLengths = !!on;
    this.render();
  }

  _top() {
    return this.tracks.length && this.state.layout !== 'radial' ? 92 : 44;
  }

  /**
   * Place the tree in the view.
   * whole = true shows the entire tree, even if labels become too small to read.
   * whole = false keeps rows readable and lets a tall tree scroll (rectangular only).
   */
  fit(whole) {
    const st = this.state;
    const W = this.width;
    const H = this.height;
    const labelW = this._labelW;
    const stripsW = this._stripsWidth();
    this._fitWasWhole = !!whole;
    if (st.layout === 'radial') {
      const arcAtFit = (r) => (RADIAL_SPAN * r) / this.leaves.length;
      let radius = Math.min(W, H) / 2 - 24 - stripsW;
      // leave room for labels only if they would actually be readable at this size
      if (arcAtFit(radius - labelW) >= MIN_LABEL_PX) radius -= labelW + 8;
      st.k = Math.max(radius, 40) / RADIAL_R;
      st.cx = W / 2;
      st.cy = H / 2;
    } else {
      const top = this._top();
      const bottom = 20;
      const n = this.leaves.length;
      const natural = (H - top - bottom) / n;
      // thumbnails need taller rows than text does
      const readable = this.hasImages ? IMAGE_ROW : READABLE_ROW;
      const tallest = this.hasImages ? IMAGE_MAX : 30;
      st.sy = whole ? Math.min(natural, tallest) : Math.min(Math.max(natural, readable), tallest);
      const labelsVisible = st.sy >= MIN_LABEL_PX;
      const textW = labelsVisible ? this._colsWidth() : 0;
      const room = (labelsVisible ? labelW + 14 : 8) + stripsW + textW;
      // the tree keeps at least a third of the width; extra columns can be reached by panning
      st.sx = Math.max(W - 28 - room, W * 0.34) / this.maxDist;
      st.tx = 20;
      const treeH = (n - 1) * st.sy;
      st.ty = treeH < H - top - bottom ? top + (H - top - bottom - treeH) / 2 : top;
    }
    st.autoFit = true;
    this.render();
  }

  /** Zoom by a factor around a point (defaults to the centre of the view). */
  zoomBy(factor, px, py, axis) {
    const st = this.state;
    const x = px == null ? this.width / 2 : px;
    const y = py == null ? this.height / 2 : py;
    if (st.layout === 'radial') {
      const k = Math.min(Math.max(st.k * factor, 0.02), 60);
      const f = k / st.k;
      st.cx = x - (x - st.cx) * f;
      st.cy = y - (y - st.cy) * f;
      st.k = k;
    } else {
      if (axis !== 'y') {
        const minSx = 10 / this.maxDist;
        const sx = Math.min(Math.max(st.sx * factor, minSx), 1e7 / this.maxDist);
        st.tx = x - (x - st.tx) * (sx / st.sx);
        st.sx = sx;
      }
      if (axis !== 'x') {
        const minSy = Math.min(0.5, (this.height / this.leaves.length) * 0.5);
        const sy = Math.min(Math.max(st.sy * factor, minSy), 80);
        st.ty = y - (y - st.ty) * (sy / st.sy);
        st.sy = sy;
      }
    }
    st.autoFit = false;
    this._clamp();
    this.render();
  }

  panBy(dx, dy) {
    const st = this.state;
    if (st.layout === 'radial') { st.cx += dx; st.cy += dy; }
    else { st.tx += dx; st.ty += dy; }
    st.autoFit = false;
    this._clamp();
    this.render();
  }

  /** Keep at least part of the tree on screen. */
  _clamp() {
    const st = this.state;
    const W = this.width;
    const H = this.height;
    if (st.layout === 'radial') {
      const r = RADIAL_R * st.k;
      st.cx = Math.min(Math.max(st.cx, -r + 60), W + r - 60);
      st.cy = Math.min(Math.max(st.cy, -r + 60), H + r - 60);
    } else {
      const treeW = this.maxDist * st.sx + this._stripsWidth() + this._labelW + this._colsWidth();
      const treeH = (this.leaves.length - 1) * st.sy;
      st.tx = Math.min(Math.max(st.tx, 80 - treeW), W - 80);
      st.ty = Math.min(Math.max(st.ty, 80 - treeH), H - 80);
    }
  }

  resize() {
    const rect = this.host.getBoundingClientRect();
    const first = this.width === undefined;
    this.width = Math.max(rect.width, 50);
    this.height = Math.max(rect.height, 50);
    this.svg.setAttribute('width', this.width);
    this.svg.setAttribute('height', this.height);
    if (first || this.state.autoFit) this.fit(first ? false : this._fitWasWhole);
    else this.render();
  }

  // ---------- rendering ----------

  render() {
    if (this._frame) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this._draw();
    });
  }

  _draw() {
    const st = this.state;
    const radial = st.layout === 'radial';
    this.svg.classList.toggle('is-radial', radial);
    this.gScene.setAttribute(
      'transform',
      radial ? `translate(${st.cx},${st.cy}) scale(${st.k})` : `translate(${st.tx},${st.ty}) scale(${st.sx},${st.sy})`
    );
    // dotted guide lines turn into a grey haze when rows are only a pixel or two apart
    const tipSpacing = radial ? (RADIAL_SPAN * RADIAL_R * st.k) / this.leaves.length : st.sy;
    this.gLeaders.style.display = tipSpacing < 3 ? 'none' : '';
    this._placeStrips();
    const labelsShown = radial ? this._drawRadialLabels() : this._drawRectLabels();
    this._drawColumns(labelsShown && !radial);
    this._drawHeaders();
    this._drawSupport();
    this._drawMarkers();
    this._drawScaleBar();
    this.hint.classList.toggle('is-visible', !labelsShown);
  }

  /** Left edge (px) of the aligned area in the rectangular layout. */
  _alignedX() {
    return this.maxDist * this.state.sx + this.state.tx;
  }

  _placeStrips() {
    const st = this.state;
    const groups = this.gStrips.children;
    for (let j = 0; j < groups.length; j++) {
      if (st.layout === 'radial') {
        const radiusPx = RADIAL_R * st.k + 8 + j * STRIP_STEP + STRIP_W / 2;
        groups[j].setAttribute('transform', `translate(${st.cx},${st.cy}) scale(${radiusPx / RADIAL_R})`);
      } else {
        groups[j].setAttribute('transform', `translate(${this._alignedX() + 8 + j * STRIP_STEP},${st.ty}) scale(1,${st.sy})`);
      }
    }
  }

  _labelJoin(data) {
    const italic = ITALIC_COLUMNS.has(String(this.state.labelBy || '').toLowerCase());
    return d3.select(this.gLabels)
      .selectAll('text')
      .data(data, (d) => d.leaf.did)
      .join('text')
      .attr('class', (d) => 'tv-label' + (d.label.collapsed ? ' is-collapsed' : d.label.fromId ? ' is-fallback' : italic ? ' is-italic' : '')
        + (this.selection === d.leaf ? ' is-selected' : '') + (this.isEmphasised(d.leaf) ? ' is-reference' : ''))
      .text((d) => shorten(d.label.text, LABEL_MAX_CHARS));
  }

  _visibleRows() {
    const st = this.state;
    const first = Math.max(0, Math.floor((-st.ty - 20) / st.sy));
    const last = Math.min(this.leaves.length - 1, Math.ceil((this.height - st.ty + 20) / st.sy));
    return [first, last];
  }

  _rectLabelX() {
    return this._alignedX() + (this.stripTracks.length ? 8 + this._stripsWidth() : 6);
  }

  _drawRectLabels() {
    const st = this.state;
    if (st.sy < MIN_LABEL_PX) {
      this._labelJoin([]);
      return false;
    }
    const aligned = this._aligned();
    const alignedX = this._rectLabelX();
    const [first, last] = this._visibleRows();
    const data = [];
    for (let i = first; i <= last; i++) {
      const leaf = this.leaves[i];
      const x = aligned ? alignedX : leaf.tipDist * st.sx + st.tx + 6;
      if (x > this.width) continue;
      data.push({ leaf, label: this.labelFor(leaf), x, y: i * st.sy + st.ty });
    }
    this._labelJoin(data)
      .attr('font-size', Math.min(LABEL_FONT, Math.max(7, st.sy * 0.82)))
      .attr('text-anchor', 'start')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .attr('dy', '0.32em');
    return true;
  }

  _drawRadialLabels() {
    const st = this.state;
    const n = this.leaves.length;
    const arc = (RADIAL_SPAN * RADIAL_R * st.k) / n;
    if (arc < MIN_LABEL_PX) {
      this._labelJoin([]);
      return false;
    }
    const aligned = this._aligned();
    const extra = 6 + (this.stripTracks.length ? 6 + this._stripsWidth() : 0);
    const data = [];
    const pad = 340;
    for (const leaf of this.leaves) {
      const theta = this._theta(leaf);
      const r = (aligned ? RADIAL_R : this._tipRadius(leaf)) * st.k + extra;
      const x = st.cx + r * Math.cos(theta);
      const y = st.cy + r * Math.sin(theta);
      if (x < -pad || x > this.width + pad || y < -pad || y > this.height + pad) continue;
      data.push({ leaf, label: this.labelFor(leaf), x, y, theta });
    }
    this._labelJoin(data)
      .attr('font-size', Math.min(LABEL_FONT, Math.max(7, arc * 0.82)))
      .attr('dy', '0.32em')
      .attr('text-anchor', (d) => (Math.cos(d.theta) < 0 ? 'end' : 'start'))
      .attr('transform', (d) => {
        const deg = (d.theta * 180) / Math.PI;
        return `translate(${d.x},${d.y}) rotate(${Math.cos(d.theta) < 0 ? deg + 180 : deg})`;
      });
    return true;
  }

  _colWidth(track) {
    return track.type === 'image' ? IMAGE_COL_W : TEXT_COL_W;
  }

  _colsWidth() {
    return this.colTracks.reduce((sum, t) => sum + this._colWidth(t), 0);
  }

  _colX(j) {
    let x = this._rectLabelX() + this._labelW + 18;
    for (let i = 0; i < j; i++) x += this._colWidth(this.colTracks[i]);
    return x;
  }

  /** Text and image columns are shown in the rectangular layout, for the rows on screen. */
  _drawColumns(show) {
    const st = this.state;
    const texts = [];
    const images = [];
    if (show && this.colTracks.length) {
      const [first, last] = this._visibleRows();
      // like the classic viewer, a thumbnail may be taller than its row, so structures stay legible
      const size = Math.min(IMAGE_MAX, Math.max(st.sy * 1.9, 10));
      this.colTracks.forEach((track, j) => {
        const x = this._colX(j);
        if (x > this.width) return;
        for (let i = first; i <= last; i++) {
          const leaf = this.leaves[i];
          const y = i * st.sy + st.ty;
          if (track.type === 'image') {
            const urls = track.images(leaf);
            if (urls && urls.length) images.push({ key: track.key + ':' + leaf.did, track, leaf, urls, x, y: y - size / 2, size });
          } else {
            const value = track.text(leaf);
            if (value) texts.push({ key: track.key + ':' + leaf.did, track, leaf, value, href: track.href ? track.href(leaf) : null, x, y });
          }
        }
      });
    }
    d3.select(this.gCols)
      .selectAll('text')
      .data(texts, (d) => d.key)
      .join('text')
      .attr('class', (d) => 'tv-coltext' + (d.href ? ' is-link' : ''))
      .attr('font-size', Math.min(LABEL_FONT, Math.max(7, st.sy * 0.82)))
      .attr('dy', '0.32em')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .text((d) => shorten(d.value, TEXT_COL_CHARS));
    d3.select(this.gCols)
      .selectAll('image')
      .data(images, (d) => d.key)
      .join('image')
      .attr('class', 'tv-img')
      .attr('href', (d) => d.urls[0])
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('width', (d) => d.size)
      .attr('height', (d) => d.size)
      .attr('preserveAspectRatio', 'xMinYMid meet');
  }

  /** Column titles stay at the top of the view while the tree scrolls under them. */
  _drawHeaders() {
    const g = this.gHeaders;
    g.textContent = '';
    if (this.state.layout === 'radial' || !this.tracks.length) return;
    const left = this._alignedX() + 2;
    const top = this._top();
    g.append(el('rect', { class: 'tv-header-band', x: left, y: 0, width: Math.max(this.width - left, 0), height: top - 10 }));
    this.stripTracks.forEach((track, j) => {
      const x = this._alignedX() + 8 + j * STRIP_STEP + STRIP_W / 2;
      const t = el('text', { class: 'tv-header', transform: `translate(${x},${top - 16}) rotate(-50)` });
      t.textContent = shorten(track.title, 16);
      g.append(t);
    });
    if (this.state.sy >= MIN_LABEL_PX) {
      this.colTracks.forEach((track, j) => {
        const t = el('text', { class: 'tv-header', x: this._colX(j), y: top - 16 });
        t.textContent = shorten(track.title, TEXT_COL_CHARS);
        g.append(t);
      });
    }
  }

  /** Numbers on the branches: support at the nodes, lengths under the middle of each branch. */
  _drawSupport() {
    const st = this.state;
    const radial = st.layout === 'radial';
    const support = [];
    const lengths = [];
    const spacing = radial ? (RADIAL_SPAN * RADIAL_R * st.k) / this.leaves.length : st.sy;
    const wantSupport = st.showSupport && this.hasSupport;
    const wantLengths = st.showLengths && this.hasLengths;
    const room = spacing >= 11;
    const onScreen = (x, y) => x >= -20 && x <= this.width + 20 && y >= -20 && y <= this.height + 20;
    const point = (n, dist) => {
      if (radial) {
        const theta = this._theta(n);
        const r = (dist / this.maxDist) * RADIAL_R * st.k;
        return [st.cx + r * Math.cos(theta), st.cy + r * Math.sin(theta)];
      }
      return [dist * st.sx + st.tx, n.y * st.sy + st.ty];
    };
    if (wantSupport && room) {
      for (const n of this.internals) {
        if (n.support == null || !n.parent) continue;
        const [x, y] = point(n, n.dist);
        if (onScreen(x, y)) support.push({ n, x, y });
      }
    }
    if (wantLengths && room) {
      const pxPerUnit = radial ? (RADIAL_R * st.k) / this.maxDist : st.sx;
      for (const n of this.nodes) {
        if (!n.parent || n.length == null) continue;
        const text = formatLength(n.length);
        // only where the number fits on its branch
        if (n.length * pxPerUnit < text.length * 5.2 + 4) continue;
        const [x, y] = point(n, n.dist - n.length / 2);
        if (onScreen(x, y)) lengths.push({ n, x, y, text });
      }
    }
    d3.select(this.gSupport)
      .selectAll('text')
      .data(support, (d) => d.n.did)
      .join('text')
      .attr('class', 'tv-support-label')
      .attr('text-anchor', 'end')
      .attr('x', (d) => d.x - 3)
      .attr('y', (d) => d.y - 3)
      .text((d) => formatSupport(d.n));
    d3.select(this.gLengths)
      .selectAll('text')
      .data(lengths, (d) => d.n.did)
      .join('text')
      .attr('class', 'tv-length-label')
      .attr('text-anchor', 'middle')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y + 9)
      .text((d) => d.text);

    const waiting = [wantSupport && 'support values', wantLengths && 'branch lengths'].filter(Boolean);
    const show = waiting.length > 0 && !room;
    if (show) this.valueHint.textContent = 'Zoom in to see ' + waiting.join(' and ');
    this.valueHint.classList.toggle('is-visible', show);
  }

  _drawScaleBar() {
    if (!this.hasLengths) { this.scaleBar.style.display = 'none'; return; }
    const st = this.state;
    const pxPerUnit = st.layout === 'radial' ? (st.k * RADIAL_R) / this.maxDist : st.sx;
    const len = niceLength(110 / pxPerUnit);
    this.scaleBar.style.display = '';
    this.scaleBar.querySelector('.tv-scalebar-line').style.width = len * pxPerUnit + 'px';
    this.scaleBar.querySelector('.tv-scalebar-text').textContent = String(parseFloat(len.toPrecision(3)));
  }

  // ---------- interaction ----------

  /** The tree node under an event target: a branch, or the label of a tip. */
  _nodeOf(target) {
    if (!target) return null;
    if (target.__node) return target.__node;
    if (target.classList && target.classList.contains('tv-label')) return d3.select(target).datum().leaf;
    return null;
  }

  _bindEvents() {
    const svg = this.svg;

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const radial = this.state.layout === 'radial';
      if (radial || e.ctrlKey || e.metaKey) {
        this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), x, y);
      } else {
        this.panBy(-e.deltaX, -e.deltaY);
      }
    }, { passive: false });

    let drag = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, moved: false, target: e.target };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        drag.moved = true;
        drag.x = e.clientX;
        drag.y = e.clientY;
        svg.classList.add('is-dragging');
        this._hideTooltip();
        this.panBy(dx, dy);
        return;
      }
      this._hover(e);
    });
    svg.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved) {
        const node = this._nodeOf(drag.target);
        const rect = this.host.getBoundingClientRect();
        const cls = drag.target.classList;
        const cell = cls && (cls.contains('tv-coltext') || cls.contains('tv-img')) ? d3.select(drag.target).datum() : null;
        if (cls && cls.contains('tv-marker')) this._emit('markerclick', { marker: d3.select(drag.target).datum().marker, x: e.clientX - rect.left, y: e.clientY - rect.top });
        else if (node) this._emit('nodeclick', { node, x: e.clientX - rect.left, y: e.clientY - rect.top });
        else if (cell && cell.urls) this._emit('imageclick', cell);
        else if (cell && cell.href) window.open(cell.href, '_blank', 'noopener');
        else this._emit('backgroundclick');
      }
      drag = null;
      svg.classList.remove('is-dragging');
    });
    svg.addEventListener('pointercancel', () => { drag = null; svg.classList.remove('is-dragging'); });
    svg.addEventListener('pointerleave', () => this._hideTooltip());
    svg.addEventListener('dblclick', (e) => {
      if (this._nodeOf(e.target)) return;
      const rect = svg.getBoundingClientRect();
      this.zoomBy(e.shiftKey ? 1 / 1.6 : 1.6, e.clientX - rect.left, e.clientY - rect.top);
    });
  }

  _hover(e) {
    const target = e.target;
    const node = this._nodeOf(target);
    if (this._hovered && this._hovered !== node) {
      if (this._hovered.el) this._hovered.el.classList.remove('is-hover');
      this._hovered = null;
    }

    const lines = [];
    if (node) {
      if (node.el) { node.el.classList.add('is-hover'); this._hovered = node; }
      if (node.collapsed) {
        lines.push(`<strong>Collapsed clade of ${node.tipCount} tips</strong>`, 'Click to expand or see options');
      } else if (!node.children.length) {
        const label = this.labelFor(node);
        lines.push(`<strong>${escapeHtml(label.text || node.name)}</strong>`);
        if (label.text && !label.fromId && this.state.labelBy) lines.push(`<span class="tv-tip-muted">${escapeHtml(node.name)}</span>`);
      } else {
        lines.push(`<strong>Clade of ${node.tipCount} tips</strong>`);
        if (node.support != null) lines.push(`Support: ${escapeHtml(node.supportRaw)}`);
      }
      if (this.hasLengths && node.parent) lines.push(`Branch length: ${parseFloat(node.length.toPrecision(4))}`);
    } else if (target && target.classList && target.classList.contains('tv-marker')) {
      lines.push(...String(d3.select(target).datum().marker.title).split('\n').map(escapeHtml), '<span class="tv-tip-muted">Click for details and options</span>');
    } else if (target && target.__strip) {
      const s = target.__strip;
      lines.push(`<span class="tv-tip-muted">${escapeHtml(s.title)}</span>`, `<strong>${escapeHtml(s.value)}</strong>`);
      const about = s.track.describe && s.track.describe(s.value);
      if (about) lines.push(escapeHtml(about));
      if (s.count > 1) lines.push(`${s.count} neighbouring tips`);
    } else if (target && target.classList && target.classList.contains('tv-coltext')) {
      const d = d3.select(target).datum();
      lines.push(`<span class="tv-tip-muted">${escapeHtml(d.track.title)}</span>`, escapeHtml(d.value));
      const about = d.track.describe && d.track.describe(d.value);
      if (about) lines.push(escapeHtml(about));
      if (d.href) lines.push('<span class="tv-tip-muted">Click to open</span>');
    } else if (target && target.classList && target.classList.contains('tv-img')) {
      const d = d3.select(target).datum();
      lines.push(`<span class="tv-tip-muted">${escapeHtml(d.track.title)}</span>`,
        d.urls.length > 1 ? `${d.urls.length} images · click to enlarge` : 'Click to enlarge');
    }
    if (!lines.length) { this._hideTooltip(); return; }

    this.tooltip.innerHTML = lines.join('<br>');
    const rect = this.host.getBoundingClientRect();
    const x = e.clientX - rect.left + 14;
    const y = e.clientY - rect.top + 14;
    this.tooltip.style.left = Math.min(x, this.width - this.tooltip.offsetWidth - 8) + 'px';
    this.tooltip.style.top = Math.min(y, this.height - this.tooltip.offsetHeight - 8) + 'px';
    this.tooltip.classList.add('is-visible');
  }

  _hideTooltip() {
    this.tooltip.classList.remove('is-visible');
    if (this._hovered) { if (this._hovered.el) this._hovered.el.classList.remove('is-hover'); this._hovered = null; }
  }
}

export function formatLength(v) {
  if (v === 0) return '0';
  return Math.abs(v) < 0.001 ? v.toExponential(1) : String(parseFloat(v.toPrecision(3)));
}

function formatSupport(n) {
  if (n.supportRaw && n.supportRaw.includes('/')) return n.supportRaw;
  const v = n.support;
  return String(v >= 0 && v <= 1 ? Math.round(v * 100) : Math.round(v));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
