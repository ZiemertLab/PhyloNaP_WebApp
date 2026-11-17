// Annotation sections and colour scales for the PhyloNaP tree viewer (v2).

// Okabe-Ito colours first (distinguishable with common colour-vision deficiencies),
// then further distinct hues for columns with many values.
export const PALETTE = [
  '#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#7B1B38',
  '#332288', '#44AA99', '#999933', '#AA4499', '#117733', '#DDCC77', '#88CCEE', '#CC6677',
  '#661100', '#6699CC', '#B5A642', '#5D3A9B',
];
export const OTHER_COLOR = '#c9ccd2';
const MAX_COLORS = PALETTE.length;

// Sections of the annotation panel. Until the database assigns columns to sections,
// columns are sorted by name; anything unknown goes to "Other".
export const SECTIONS = [
  {
    id: 'taxonomy',
    title: 'Taxonomy',
    columns: ['superkingdom', 'kingdom', 'domain', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'organism', 'strain', 'taxonomy'],
  },
  {
    id: 'function',
    title: 'Functional annotation',
    columns: ['enzymefunction', 'functioncategory', 'function', 'gene', 'entryname', 'proteinname', 'proteinnames', 'ec', 'ecnumber',
      'rhea', 'keggreaction', 'miteid', 'mite', 'cogcategory', 'cog', 'substrate', 'reaction'],
  },
  {
    id: 'context',
    title: 'Genomic context',
    columns: ['cluster', 'gcfid', 'gcf', 'mibig', 'mibigid', 'biosynclass', 'product', 'bgc', 'bgcproduct', 'genomeid', 'genome'],
  },
  { id: 'catalytic', title: 'Catalytic site (M-CSA)', columns: [], optional: true },
  { id: 'domains', title: 'Domains', columns: [], placeholder: 'Domain annotations are not available yet.' },
  { id: 'other', title: 'Other', columns: [] },
];

// For these columns only values shared by two or more tips are coloured,
// because the question is "which proteins come from the same cluster / family".
const SHARED_ONLY = new Set(['cluster', 'gcfid', 'gcf']);

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

export function prettyName(column) {
  return column.replace(/_/g, ' ');
}

export function isEmpty(v) {
  return v === null || v === undefined || String(v).trim() === '' || String(v) === 'nan' || String(v) === 'NaN';
}

/**
 * Sort columns into sections.
 * @param {string[]} columns        the dataset's annotation columns
 * @param {string[]} otherColumns   further fields present in the table
 * @param {object|null} assigned    optional { sectionId: [column, ...] } from the server or the user
 * @returns {{id, title, placeholder?, columns: string[]}[]}
 */
export function groupColumns(columns, otherColumns, assigned) {
  const bySection = new Map(SECTIONS.map((s) => [s.id, []]));
  const explicit = new Map();
  if (assigned) {
    for (const id in assigned) for (const col of assigned[id] || []) explicit.set(col, id);
  }
  const place = (col, fallback) => {
    let id = explicit.get(col);
    if (!bySection.has(id)) {
      const key = norm(col);
      const hit = SECTIONS.find((s) => s.columns.includes(key));
      id = hit ? hit.id : fallback;
    }
    bySection.get(id).push(col);
  };
  for (const col of columns) place(col, 'other');
  for (const col of otherColumns) bySection.get(explicit.has(col) && bySection.has(explicit.get(col)) ? explicit.get(col) : 'other').push(col);

  // taxonomy reads best from broad to narrow
  const rank = (c) => {
    const i = SECTIONS[0].columns.indexOf(norm(c));
    return i === -1 ? 99 : i;
  };
  bySection.get('taxonomy').sort((a, b) => rank(a) - rank(b));

  return SECTIONS.map((s) => ({ id: s.id, title: s.title, placeholder: s.placeholder, optional: s.optional, columns: bySection.get(s.id) }));
}

/**
 * Build the colours for one column.
 * @param {string} column
 * @param {object[]} rows       annotation rows of the tips, in tree order (null where a tip has none)
 * @param {object} overrides    { value: colour } chosen by the user
 * @returns {{ colorOf(value): string|null, legend: {value, count, color}[], otherCount: number, uncoloured: number, sharedOnly: boolean }}
 */
export function buildColorScale(column, rows, overrides) {
  const sharedOnly = SHARED_ONLY.has(norm(column));
  const counts = new Map();
  for (const row of rows) {
    const v = row ? row[column] : null;
    if (isEmpty(v)) continue;
    const key = String(v);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  let uncoloured = 0;
  if (sharedOnly) {
    uncoloured = entries.filter((e) => e[1] < 2).length;
    entries = entries.filter((e) => e[1] >= 2);
  }
  const shown = entries.slice(0, MAX_COLORS);
  const rest = entries.slice(MAX_COLORS);
  const colors = new Map();
  const legend = shown.map(([value, count], i) => {
    const color = (overrides && overrides[value]) || PALETTE[i];
    colors.set(value, color);
    return { value, count, color };
  });
  for (const [value] of rest) colors.set(value, OTHER_COLOR);
  return {
    colorOf: (v) => (isEmpty(v) ? null : colors.get(String(v)) || null),
    legend,
    otherCount: rest.length,
    uncoloured,
    sharedOnly,
  };
}
