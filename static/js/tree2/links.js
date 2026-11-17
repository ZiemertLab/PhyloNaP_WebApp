// Cross-links from annotation values to external databases.
// Same targets and ID clean-up rules as the classic viewer (tree_general.js).

const TARGETS = [
  { column: 'Uniprot_ID', name: 'UniProt', url: 'https://www.uniprot.org/uniprotkb/{id}', description: 'Protein sequence and functional information' },
  { column: 'mibig', name: 'MIBiG', url: 'https://bioregistry.io/mibig:{id}', description: 'Biosynthetic gene cluster information' },
  { column: 'PDB_IDs', name: 'PDB', url: 'https://www.rcsb.org/structure/{id}', description: 'Protein structure data' },
  { column: 'MITE_ID', name: 'MITE', url: 'https://bioregistry.io/mite:{id}', description: 'Metabolic information' },
  { column: 'GCF_ID', name: 'PanBGC', url: 'https://panbgc-db.cs.uni-tuebingen.de/bgc/{id}', description: 'Protein family information' },
  { column: 'KEGG_Reaction', name: 'KEGG', url: 'https://www.kegg.jp/entry/{id}', description: 'KEGG reaction information' },
];

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const NOT_AN_ID = new Set(['', '.', '-', 'none', 'na', 'n/a', 'nan']);

export function targetFor(column) {
  const col = norm(column);
  if (!col) return null;
  return TARGETS.find((t) => {
    const key = norm(t.column);
    const name = norm(t.name);
    return key === col || name === col || col.startsWith(key) || key.startsWith(col) || col.startsWith(name);
  }) || null;
}

function cleanId(raw, target) {
  let id = String(raw).trim();
  if (target.url.includes('bioregistry.io')) id = id.split('.')[0];
  switch (target.name) {
    case 'UniProt':
      return id.replace(/^(UniProt:|UP:)/i, '');
    case 'MIBiG':
      id = id.replace(/^(MIBiG:|BGC-)/i, '').split('.')[0];
      return !id.startsWith('BGC') && /^\d{7}$/.test(id) ? 'BGC' + id : id;
    case 'PDB':
      return id.replace(/^PDB:/i, '').toUpperCase();
    case 'MITE':
      return id.replace(/^MITE:/i, '');
    case 'KEGG':
      return id.replace(/^(KEGG_Reaction:|KEGG_rclass:)/i, '');
    default:
      return id;
  }
}

/**
 * Split a cell into pieces, each either plain text or a link.
 * @returns {{text: string, url?: string, title?: string}[]}
 */
export function linkedParts(column, value) {
  const text = String(value);
  const target = targetFor(column);
  if (target) {
    return text.split(/[;,|]/).map((s) => s.trim()).filter((s) => !NOT_AN_ID.has(s.toLowerCase())).map((raw) => {
      const id = cleanId(raw, target);
      return id
        ? { text: id, url: target.url.replace('{id}', encodeURIComponent(id)), title: target.name + ' — ' + target.description }
        : { text: raw };
    });
  }
  if (/^https?:\/\//.test(text)) return [{ text, url: text }];
  return [{ text }];
}
