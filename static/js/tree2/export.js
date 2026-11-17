// Publication figure export for the PhyloNaP tree viewer (v2).
//
// The figure is drawn from the tree data, not copied from the screen: every tip is
// included (the screen only draws what is visible), coordinates are plain numbers
// and all styling is written as attributes, so the SVG opens the same way in
// Illustrator, Inkscape, Affinity or a browser.

import { RADIAL_SPAN, RADIAL_START, formatLength } from './viewer.js';

const FONT = 'Helvetica, Arial, sans-serif';
const PX_PER_MM = 96 / 25.4;
const PX_PER_PT = 96 / 72;
const INK = '#1a1a1a';
const MUTED = '#666666';
const ITALIC_COLUMNS = new Set(['species', 'genus', 'organism']);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const f = (n) => (Math.round(n * 100) / 100).toString();
const shorten = (text, max) => (text.length > max ? text.slice(0, max - 1) + '…' : text);

function niceLength(target) {
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  const k = target / pow;
  return (k >= 5 ? 5 : k >= 2 ? 2 : 1) * pow;
}

const measureCtx = document.createElement('canvas').getContext('2d');
function textWidth(text, px, style) {
  measureCtx.font = `${style || ''} ${px}px ${FONT}`;
  return measureCtx.measureText(text).width;
}

const imageCache = new Map();
/** Images are embedded in the file, so the figure does not depend on the website. */
async function dataUrl(url) {
  if (!imageCache.has(url)) {
    imageCache.set(url, fetch(url).then((r) => (r.ok ? r.blob() : null)).then((blob) => blob && new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    })).catch(() => null));
  }
  return imageCache.get(url);
}

/**
 * @param {TreeViewer} viewer
 * @param {object} o
 *   title        string
 *   widthMm      number
 *   heightMm     number | null (null = as tall as the tips need)
 *   labels       false (none) | null (sequence ID) | column name
 *   labelPt      number
 *   strips, columns, structures, legend, scaleBar, support, lengths   booleans
 *   legends      [{ title, items: [{ value, color }], otherColor, otherCount }]
 *   idFallback   boolean: tips without a value in the label column show their sequence ID
 * @returns {Promise<{svg: string, width: number, height: number, widthMm: number, heightMm: number, notes: string[]}>}
 */
export async function buildFigure(viewer, o) {
  const radial = viewer.state.layout === 'radial';
  const leaves = viewer.leaves;
  const n = leaves.length;
  const fontPx = o.labelPt * PX_PER_PT;
  const line = fontPx * 1.3;
  const margin = 12;
  const notes = [];
  const out = [];
  let W = o.widthMm * PX_PER_MM;

  const stripTracks = o.strips ? viewer.stripTracks : [];
  const textTracks = o.columns && !radial ? viewer.colTracks.filter((t) => t.type === 'text') : [];
  const imageTracks = o.structures && !radial ? viewer.colTracks.filter((t) => t.type === 'image') : [];
  const stripW = Math.max(6, fontPx * 0.9);
  const stripStep = stripW + 2;
  const stripsW = stripTracks.length ? stripTracks.length * stripStep + 3 : 0;

  const italic = typeof o.labels === 'string' && ITALIC_COLUMNS.has(o.labels.toLowerCase());
  const labelOf = (leaf) => {
    if (leaf.collapsed) {
      const shared = typeof o.labels === 'string' ? viewer.valueFor(leaf, o.labels) : '';
      return { text: leaf.tipCount + ' tips' + (shared ? ' · ' + shared : ''), italic: false, weak: true };
    }
    if (typeof o.labels === 'string') {
      const v = viewer.valueFor(leaf, o.labels);
      if (v) return { text: shorten(v, 60), italic, weak: false, bold: viewer.isEmphasised(leaf) };
      if (o.idFallback === false) return { text: '', italic: false, weak: true };
    }
    return { text: leaf.name, italic: false, weak: typeof o.labels === 'string', bold: viewer.isEmphasised(leaf) };
  };
  const labelAttrs = (label) => `font-size="${f(fontPx)}"${label.italic ? ' font-style="italic"' : ''}${label.bold ? ' font-weight="bold"' : ''} fill="${label.weak && !label.bold ? MUTED : INK}"`;
  const branchColor = (node) => (node.el && node.el.style.stroke) || INK;

  // ---- legend (laid out first: its height is part of the figure) ----
  const legends = o.legend ? o.legends.filter((l) => stripTracks.some((t) => t.title === l.title)) : [];
  function drawLegend(top, width) {
    let y = top;
    for (const legend of legends) {
      y += line * 1.2;
      // in the circular layout the strips are rings; say which one this is
      const ring = stripTracks.findIndex((t) => t.title === legend.title);
      const rings = stripTracks.length;
      const where = radial && rings > 1
        ? ` (ring ${ring + 1} of ${rings}${ring === 0 ? ', innermost' : ring === rings - 1 ? ', outermost' : ''})` : '';
      out.push(`<text x="${f(margin)}" y="${f(y)}" font-size="${f(fontPx)}" fill="${INK}"><tspan font-weight="bold">${esc(legend.title)}</tspan>${where ? `<tspan fill="${MUTED}">${esc(where)}</tspan>` : ''}</text>`);
      y += line * 1.15;
      let x = margin;
      const items = legend.items.map((i) => ({ text: shorten(i.value, 50), color: i.color }));
      if (legend.otherCount) items.push({ text: 'other', color: legend.otherColor });
      for (const item of items) {
        const w = fontPx + 3 + textWidth(item.text, fontPx) + fontPx * 1.2;
        if (x + w > width - margin && x > margin) { x = margin; y += line * 1.15; }
        out.push(`<rect x="${f(x)}" y="${f(y - fontPx * 0.82)}" width="${f(fontPx * 0.9)}" height="${f(fontPx * 0.9)}" fill="${item.color}"/>`,
          `<text x="${f(x + fontPx + 3)}" y="${f(y)}" font-size="${f(fontPx)}" fill="${INK}">${esc(item.text)}</text>`);
        x += w;
      }
      y += line * 0.4;
    }
    return y - top;
  }
  function legendHeight(width) {
    const mark = out.length;
    const h = drawLegend(0, width);
    out.length = mark;
    return h;
  }

  const titleH = o.title ? fontPx * 1.5 * 1.3 + 6 : 0;
  const scaleH = o.scaleBar && viewer.hasLengths ? fontPx + 14 : 0;
  let H;

  if (!radial) {
    // ================= rectangular =================
    const hasImages = imageTracks.length > 0;
    const colHeaders = stripTracks.length || textTracks.length || imageTracks.length;
    const headerH = stripTracks.length ? Math.min(60, fontPx * 6) : colHeaders ? line + 4 : 0;
    const top = margin + titleH + headerH;
    const legendH = legendHeight(W);
    const bottom = scaleH + legendH + margin;

    let rowH;
    if (o.heightMm) rowH = Math.max(0.2, (o.heightMm * PX_PER_MM - top - bottom) / n);
    else if (o.labels === false) rowH = hasImages ? 44 : Math.max(1.5, Math.min(line, 600 / n));
    else rowH = Math.max(line, hasImages ? 44 : 0);
    let showLabels = o.labels !== false;
    if (showLabels && rowH < fontPx * 0.75) {
      showLabels = false;
      notes.push('Tip labels are left out because the rows are too close together at this height.');
    }
    const showCols = rowH >= fontPx * 0.75;
    if (!showCols && (textTracks.length || imageTracks.length)) notes.push('Text columns and structures are left out at this height.');

    const labels = showLabels ? leaves.map(labelOf) : [];
    const labelW = showLabels ? Math.max(...labels.map((l) => textWidth(l.text, fontPx, l.italic ? 'italic' : ''))) + 6 : 0;
    const textW = showCols ? textTracks.map((t) => Math.min(200, Math.max(textWidth(t.title, fontPx, 'bold'),
      ...leaves.map((leaf) => textWidth(shorten(t.text(leaf), 40), fontPx)))) + 10) : [];
    const imgSize = Math.min(90, rowH * 1.9);
    const imgW = showCols ? imageTracks.map(() => imgSize + 8) : [];
    const right = labelW + stripsW + textW.reduce((a, b) => a + b, 0) + imgW.reduce((a, b) => a + b, 0);
    const aligned = viewer._aligned() || stripsW > 0 || textW.length > 0 || imgW.length > 0;
    let treeW = W - 2 * margin - right - (aligned ? 4 : 0);
    if (treeW < W * 0.3) {
      treeW = W * 0.3;
      W = treeW + right + 2 * margin + 4;
      notes.push('The figure is wider than asked for, to fit the labels and columns.');
    }
    H = top + n * rowH + bottom;

    const X = (dist) => margin + (dist / viewer.maxDist) * treeW;
    const Y = (y) => top + (y + 0.5) * rowH;
    const xEdge = X(viewer.maxDist);
    const stroke = Math.max(0.5, Math.min(1, rowH / 6));

    for (const [ref, style] of viewer.cladeStyles) {
      const node = viewer.byRef.get(ref);
      if (!node || !style.shade) continue;
      const x0 = node.parent ? X((node.parent.dist + node.dist) / 2) : margin;
      out.push(`<rect x="${f(x0)}" y="${f(Y(node.y0) - rowH / 2)}" width="${f(xEdge - x0)}" height="${f((node.y1 - node.y0 + 1) * rowH)}" fill="${style.shade}" fill-opacity="0.16"/>`);
    }
    if (aligned) {
      let d = '';
      for (const leaf of leaves) if (leaf.tipDist < viewer.maxDist) d += `M${f(X(leaf.tipDist))},${f(Y(leaf.y))}H${f(xEdge)}`;
      if (d) out.push(`<path d="${d}" fill="none" stroke="#bbbbbb" stroke-width="0.4" stroke-dasharray="0.6 2"/>`);
    }
    for (const node of viewer.nodes) {
      const color = branchColor(node);
      if (node.parent) {
        out.push(`<path d="M${f(X(node.parent.dist))},${f(Y(node.parent.y))}V${f(Y(node.y))}H${f(X(node.dist))}" fill="none" stroke="${color}" stroke-width="${f(stroke)}" stroke-linejoin="round"/>`);
      }
      if (node.collapsed) {
        const half = Math.min(rowH * 0.42, 8);
        out.push(`<path d="M${f(X(node.dist))},${f(Y(node.y))}L${f(X(node.tipDist))},${f(Y(node.y) - half)}V${f(Y(node.y) + half)}Z" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="${f(stroke)}" stroke-linejoin="round"/>`);
      }
    }
    if (o.support && viewer.hasSupport && rowH >= fontPx * 0.6) {
      const size = fontPx * 0.72;
      for (const node of viewer.internals) {
        if (node.support == null || !node.parent) continue;
        const text = node.supportRaw && node.supportRaw.includes('/') ? node.supportRaw
          : String(node.support >= 0 && node.support <= 1 ? Math.round(node.support * 100) : Math.round(node.support));
        out.push(`<text x="${f(X(node.dist) - 1.5)}" y="${f(Y(node.y) - 1.5)}" font-size="${f(size)}" text-anchor="end" fill="${MUTED}">${esc(text)}</text>`);
      }
    }

    if (o.lengths && viewer.hasLengths && rowH >= fontPx * 0.6) {
      const size = fontPx * 0.72;
      for (const node of viewer.nodes) {
        if (!node.parent || node.length == null) continue;
        const text = formatLength(node.length);
        const span = X(node.dist) - X(node.dist - node.length);
        if (span < text.length * size * 0.56 + 1) continue;
        out.push(`<text x="${f(X(node.dist - node.length / 2))}" y="${f(Y(node.y) + size * 0.95)}" font-size="${f(size)}" text-anchor="middle" fill="${MUTED}">${esc(text)}</text>`);
      }
    }

    for (const marker of viewer.markers) {
      const at = viewer.locateMarker(marker);
      if (at) out.push(`<circle cx="${f(X(at.dist))}" cy="${f(Y(at.node.y))}" r="${f(Math.max(2, marker.radius * 0.6))}" fill="${marker.color}" stroke="#ffffff" stroke-width="0.8"/>`);
    }

    let x = (aligned ? xEdge + 4 : 0);
    stripTracks.forEach((track, j) => {
      const sx = x + j * stripStep;
      let start = 0;
      while (start < n) {
        const color = track.color(leaves[start]);
        const value = track.text(leaves[start]);
        let end = start;
        while (end + 1 < n && track.text(leaves[end + 1]) === value && track.color(leaves[end + 1]) === color) end++;
        if (color) out.push(`<rect x="${f(sx)}" y="${f(top + start * rowH)}" width="${f(stripW)}" height="${f((end - start + 1) * rowH)}" fill="${color}"/>`);
        start = end + 1;
      }
      if (track.outline) {
        leaves.forEach((leaf, i) => {
          if (viewer.isEmphasised(leaf)) out.push(`<rect x="${f(sx)}" y="${f(top + i * rowH)}" width="${f(stripW)}" height="${f(rowH)}" fill="none" stroke="${INK}" stroke-width="0.8"/>`);
        });
      }
      out.push(`<text transform="translate(${f(sx + stripW / 2)},${f(top - 4)}) rotate(-50)" font-size="${f(fontPx)}" font-weight="bold" fill="${INK}">${esc(shorten(track.title, 18))}</text>`);
    });
    x += stripsW;
    if (showLabels) {
      leaves.forEach((leaf, i) => {
        const lx = aligned ? x + 2 : X(leaf.tipDist) + 3;
        if (labels[i].text) out.push(`<text x="${f(lx)}" y="${f(Y(i) + fontPx * 0.34)}" ${labelAttrs(labels[i])}>${esc(labels[i].text)}</text>`);
      });
    }
    x += labelW;
    if (showCols) {
      textTracks.forEach((track, j) => {
        out.push(`<text x="${f(x + 4)}" y="${f(top - 5)}" font-size="${f(fontPx)}" font-weight="bold" fill="${INK}">${esc(track.title)}</text>`);
        leaves.forEach((leaf, i) => {
          const value = track.text(leaf);
          if (value) out.push(`<text x="${f(x + 4)}" y="${f(Y(i) + fontPx * 0.34)}" font-size="${f(fontPx)}" fill="${INK}">${esc(shorten(value, 40))}</text>`);
        });
        x += textW[j];
      });
      for (let j = 0; j < imageTracks.length; j++) {
        const track = imageTracks[j];
        out.push(`<text x="${f(x + 4)}" y="${f(top - 5)}" font-size="${f(fontPx)}" font-weight="bold" fill="${INK}">${esc(track.title)}</text>`);
        for (let i = 0; i < n; i++) {
          const urls = track.images(leaves[i]);
          if (!urls || !urls.length) continue;
          const data = await dataUrl(urls[0]);
          if (data) out.push(`<image x="${f(x + 4)}" y="${f(Y(i) - imgSize / 2)}" width="${f(imgSize)}" height="${f(imgSize)}" preserveAspectRatio="xMinYMid meet" href="${data}"/>`);
        }
        x += imgW[j];
      }
    }

    let y = top + n * rowH;
    if (scaleH) {
      const len = niceLength(viewer.maxDist * 0.2);
      const px = (len / viewer.maxDist) * treeW;
      out.push(`<path d="M${f(margin)},${f(y + 8)}H${f(margin + px)}" stroke="${INK}" stroke-width="0.8" fill="none"/>`,
        `<text x="${f(margin + px + 4)}" y="${f(y + 8 + fontPx * 0.34)}" font-size="${f(fontPx)}" fill="${INK}">${esc(String(parseFloat(len.toPrecision(3))))}</text>`);
      y += scaleH;
    }
    drawLegend(y, W);
  } else {
    // ================= circular =================
    let showLabels = o.labels !== false;
    const labels = showLabels ? leaves.map(labelOf) : [];
    let labelW = showLabels ? Math.max(...labels.map((l) => textWidth(l.text, fontPx, l.italic ? 'italic' : ''))) + 6 : 0;
    let R = W / 2 - margin - stripsW - labelW - (stripsW ? 4 : 0);
    if (showLabels && (RADIAL_SPAN * Math.max(R, 1)) / n < fontPx * 0.75) {
      showLabels = false;
      labelW = 0;
      R = W / 2 - margin - stripsW - (stripsW ? 4 : 0);
      notes.push('Tip labels are left out because the tips are too close together at this size. Use a larger width or collapse clades.');
    }
    if (R < W * 0.15) {
      R = W * 0.15;
      W = 2 * (R + stripsW + labelW + margin + 4);
      notes.push('The figure is wider than asked for, to fit the labels.');
    }
    const cx = W / 2;
    const cy = margin + titleH + W / 2 - margin;
    const treeBottom = margin + titleH + (W - 2 * margin);
    H = treeBottom + scaleH + legendHeight(W) + margin;

    const aligned = viewer._aligned() || stripsW > 0;
    const angle = (y) => RADIAL_START + ((y + 0.5) / n) * RADIAL_SPAN;
    const rad = (dist) => (dist / viewer.maxDist) * R;
    const P = (r, a) => `${f(cx + r * Math.cos(a))},${f(cy + r * Math.sin(a))}`;
    const stroke = 0.7;

    for (const [ref, style] of viewer.cladeStyles) {
      const node = viewer.byRef.get(ref);
      if (!node || !style.shade) continue;
      const r0 = node.parent ? rad((node.parent.dist + node.dist) / 2) : 0;
      const a0 = angle(node.y0 - 0.5);
      const a1 = angle(node.y1 + 0.5);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      out.push(`<path d="M${P(r0, a0)}L${P(R, a0)}A${f(R)},${f(R)} 0 ${large} 1 ${P(R, a1)}L${P(r0, a1)}A${f(r0)},${f(r0)} 0 ${large} 0 ${P(r0, a0)}Z" fill="${style.shade}" fill-opacity="0.16"/>`);
    }
    if (aligned) {
      let d = '';
      for (const leaf of leaves) if (leaf.tipDist < viewer.maxDist) d += `M${P(rad(leaf.tipDist), angle(leaf.y))}L${P(R, angle(leaf.y))}`;
      if (d) out.push(`<path d="${d}" fill="none" stroke="#bbbbbb" stroke-width="0.4" stroke-dasharray="0.6 2"/>`);
    }
    for (const node of viewer.nodes) {
      const color = branchColor(node);
      const tc = angle(node.y);
      if (node.parent) {
        const tp = angle(node.parent.y);
        const rp = rad(node.parent.dist);
        let d;
        if (rp > 0 && tp !== tc) {
          d = `M${P(rp, tp)}A${f(rp)},${f(rp)} 0 ${Math.abs(tc - tp) > Math.PI ? 1 : 0} ${tc > tp ? 1 : 0} ${P(rp, tc)}L${P(rad(node.dist), tc)}`;
        } else {
          d = `M${P(rp, tc)}L${P(rad(node.dist), tc)}`;
        }
        out.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round"/>`);
      }
      if (node.collapsed) {
        out.push(`<path d="M${P(rad(node.dist), tc)}L${P(rad(node.tipDist), angle(node.y - 0.42))}L${P(rad(node.tipDist), angle(node.y + 0.42))}Z" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="${stroke}" stroke-linejoin="round"/>`);
      }
    }
    if (o.support && viewer.hasSupport && (RADIAL_SPAN * R) / n >= fontPx * 0.6) {
      for (const node of viewer.internals) {
        if (node.support == null || !node.parent) continue;
        const text = node.supportRaw && node.supportRaw.includes('/') ? node.supportRaw
          : String(node.support >= 0 && node.support <= 1 ? Math.round(node.support * 100) : Math.round(node.support));
        const r = rad(node.dist);
        const a = angle(node.y);
        out.push(`<text x="${f(cx + r * Math.cos(a) - 1.5)}" y="${f(cy + r * Math.sin(a) - 1.5)}" font-size="${f(fontPx * 0.72)}" text-anchor="end" fill="${MUTED}">${esc(text)}</text>`);
      }
    }
    if (o.lengths && viewer.hasLengths && (RADIAL_SPAN * R) / n >= fontPx * 0.6) {
      const size = fontPx * 0.72;
      for (const node of viewer.nodes) {
        if (!node.parent || node.length == null) continue;
        const text = formatLength(node.length);
        if (rad(node.dist) - rad(node.dist - node.length) < text.length * size * 0.56 + 1) continue;
        const r = rad(node.dist - node.length / 2);
        const a = angle(node.y);
        out.push(`<text x="${f(cx + r * Math.cos(a))}" y="${f(cy + r * Math.sin(a) + size * 0.95)}" font-size="${f(size)}" text-anchor="middle" fill="${MUTED}">${esc(text)}</text>`);
      }
    }
    for (const marker of viewer.markers) {
      const at = viewer.locateMarker(marker);
      if (!at) continue;
      const r = rad(at.dist);
      const a = angle(at.node.y);
      out.push(`<circle cx="${f(cx + r * Math.cos(a))}" cy="${f(cy + r * Math.sin(a))}" r="${f(Math.max(2, marker.radius * 0.6))}" fill="${marker.color}" stroke="#ffffff" stroke-width="0.8"/>`);
    }
    stripTracks.forEach((track, j) => {
      const r = R + 4 + j * stripStep + stripW / 2;
      if (track.outline) {
        // a slightly wider dark arc under the coloured cell shows as a frame
        leaves.forEach((leaf, i) => {
          if (viewer.isEmphasised(leaf)) out.push(`<path d="M${P(r, angle(i - 0.6))}A${f(r)},${f(r)} 0 0 1 ${P(r, angle(i + 0.6))}" fill="none" stroke="${INK}" stroke-width="${f(stripW + 1.6)}"/>`);
        });
      }
      let start = 0;
      while (start < n) {
        const color = track.color(leaves[start]);
        const value = track.text(leaves[start]);
        let end = start;
        while (end + 1 < n && track.text(leaves[end + 1]) === value && track.color(leaves[end + 1]) === color) end++;
        if (color) {
          const a0 = angle(start - 0.5);
          const a1 = angle(end + 0.5);
          out.push(`<path d="M${P(r, a0)}A${f(r)},${f(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${P(r, a1)}" fill="none" stroke="${color}" stroke-width="${f(stripW)}"/>`);
        }
        start = end + 1;
      }
    });
    if (showLabels) {
      leaves.forEach((leaf, i) => {
        const a = angle(leaf.y);
        const r = (aligned ? R : rad(leaf.tipDist)) + 3 + (stripsW ? stripsW + 2 : 0);
        const deg = (a * 180) / Math.PI;
        const flip = Math.cos(a) < 0;
        if (labels[i].text) out.push(`<text transform="translate(${P(r, a)}) rotate(${f(flip ? deg + 180 : deg)})" dy="${f(fontPx * 0.34)}" text-anchor="${flip ? 'end' : 'start'}" ${labelAttrs(labels[i])}>${esc(labels[i].text)}</text>`);
      });
    }
    let y = treeBottom;
    if (scaleH) {
      const len = niceLength(viewer.maxDist * 0.25);
      const px = rad(len);
      out.push(`<path d="M${f(margin)},${f(y + 8)}H${f(margin + px)}" stroke="${INK}" stroke-width="0.8" fill="none"/>`,
        `<text x="${f(margin + px + 4)}" y="${f(y + 8 + fontPx * 0.34)}" font-size="${f(fontPx)}" fill="${INK}">${esc(String(parseFloat(len.toPrecision(3))))}</text>`);
      y += scaleH;
    }
    drawLegend(y, W);
  }

  if (o.title) {
    out.unshift(`<text x="${f(margin)}" y="${f(margin + fontPx * 1.5)}" font-size="${f(fontPx * 1.5)}" font-weight="bold" fill="${INK}">${esc(o.title)}</text>`);
  }
  const widthMm = W / PX_PER_MM;
  const heightMm = H / PX_PER_MM;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${f(widthMm)}mm" height="${f(heightMm)}mm" viewBox="0 0 ${f(W)} ${f(H)}" font-family="${FONT}">\n`
    + `<rect width="${f(W)}" height="${f(H)}" fill="#ffffff"/>\n${out.join('\n')}\n</svg>`;
  return { svg, width: W, height: H, widthMm, heightMm, notes };
}

/** Draw the SVG on a canvas at the given resolution and return a PNG blob. */
export function toPng(figure, dpi) {
  const scale = dpi / 96;
  const w = Math.round(figure.width * scale);
  const h = Math.round(figure.height * scale);
  // browsers cap canvas size; the exact limit differs, so stay under the common one and report a failure otherwise
  if (w > 32000 || h > 32000 || w * h > 250e6) {
    return Promise.reject(new Error(`a ${w} × ${h} pixel image is more than browsers can make. Use a lower resolution, a smaller size or the SVG.`));
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([figure.svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('the image could not be created'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('the figure could not be drawn')); };
    img.src = url;
  });
}

/** Open the browser's print dialog with a page of exactly the figure's size; "Save as PDF" gives a vector PDF. */
export function printPdf(figure) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><title>PhyloNaP tree</title><style>
    @page { size: ${f(figure.widthMm)}mm ${f(figure.heightMm)}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    svg { display: block; }
  </style></head><body>${figure.svg}</body></html>`);
  doc.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  }, 150);
}
