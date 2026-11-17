// Newick parser for the PhyloNaP tree viewer (v2).
// Returns a plain node tree: { name, length, support, supportRaw, children, parent }.
// Handles quoted labels, [comments], missing branch lengths and support values
// written as internal node labels (e.g. "95", "0.95", "87.2/100").
// Trees from placement files carry an edge number after each branch length,
// e.g. "A:0.12{7}"; it is kept as node.edge.

export function parseNewick(text) {
  const s = String(text || '').trim();
  let i = 0;

  function skip() {
    for (;;) {
      const c = s[i];
      if (c === ' ' || c === '\n' || c === '\r' || c === '\t') { i++; continue; }
      if (c === '[') {
        const end = s.indexOf(']', i);
        i = end === -1 ? s.length : end + 1;
        continue;
      }
      break;
    }
  }

  function readLabel() {
    skip();
    if (s[i] === "'" || s[i] === '"') {
      const q = s[i++];
      let out = '';
      while (i < s.length) {
        if (s[i] === q) {
          if (s[i + 1] === q) { out += q; i += 2; continue; }
          i++;
          break;
        }
        out += s[i++];
      }
      return out;
    }
    const start = i;
    while (i < s.length && !'(),:;[{'.includes(s[i])) i++;
    return s.slice(start, i).trim();
  }

  let lastEdge = null;
  function readLength() {
    skip();
    lastEdge = null;
    let length = null;
    if (s[i] === ':') {
      i++;
      skip();
      const start = i;
      while (i < s.length && !'(),;[{'.includes(s[i])) i++;
      const v = parseFloat(s.slice(start, i));
      length = Number.isFinite(v) ? v : null;
    }
    if (s[i] === '{') {
      const end = s.indexOf('}', i);
      const edge = parseInt(s.slice(i + 1, end === -1 ? s.length : end), 10);
      if (Number.isFinite(edge)) lastEdge = edge;
      i = end === -1 ? s.length : end + 1;
    }
    return length;
  }

  function readNode(parent) {
    const node = { name: '', length: null, support: null, supportRaw: null, edge: null, children: [], parent };
    skip();
    if (s[i] === '(') {
      i++;
      for (;;) {
        node.children.push(readNode(node));
        skip();
        if (s[i] === ',') { i++; continue; }
        if (s[i] === ')') { i++; break; }
        if (i >= s.length) break; // tolerate a truncated file
        throw new Error('Unexpected character "' + s[i] + '" at position ' + i + ' in the tree file');
      }
    }
    const label = readLabel();
    node.length = readLength();
    node.edge = lastEdge;
    if (node.children.length && label !== '') {
      const first = parseFloat(label.split('/').pop());
      if (/^[0-9.eE+\-/]+$/.test(label) && Number.isFinite(first)) {
        node.support = first;
        node.supportRaw = label;
      } else {
        node.name = label;
      }
    } else {
      node.name = label;
    }
    return node;
  }

  if (!s) throw new Error('The tree file is empty');
  const root = readNode(null);
  return root;
}
