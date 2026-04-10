/**
 * field_descriptions.js  –  Human-readable descriptions for coded metadata values.
 *
 * Structure:
 *   FIELD_DESCRIPTIONS[columnName][codeValue] = "description string"
 *
 * Currently covers:
 *   • COG_category  –  Clusters of Orthologous Groups functional categories
 *
 * To add descriptions for another column, just add a new key:
 *   FIELD_DESCRIPTIONS['My_Column'] = { 'val1': 'Meaning of val1', ... };
 */
const FIELD_DESCRIPTIONS = {

  /* ── COG functional categories ──────────────────────────────────────── */
  'COG_category': {
    // INFORMATION STORAGE AND PROCESSING
    'J': 'Translation, ribosomal structure and biogenesis',
    'A': 'RNA processing and modification',
    'K': 'Transcription',
    'L': 'Replication, recombination and repair',
    'B': 'Chromatin structure and dynamics',

    // CELLULAR PROCESSES AND SIGNALING
    'D': 'Cell cycle control, cell division, chromosome partitioning',
    'Y': 'Nuclear structure',
    'V': 'Defense mechanisms',
    'T': 'Signal transduction mechanisms',
    'M': 'Cell wall/membrane/envelope biogenesis',
    'N': 'Cell motility',
    'Z': 'Cytoskeleton',
    'W': 'Extracellular structures',
    'U': 'Intracellular trafficking, secretion, and vesicular transport',
    'O': 'Posttranslational modification, protein turnover, chaperones',

    // METABOLISM
    'C': 'Energy production and conversion',
    'G': 'Carbohydrate transport and metabolism',
    'E': 'Amino acid transport and metabolism',
    'F': 'Nucleotide transport and metabolism',
    'H': 'Coenzyme transport and metabolism',
    'I': 'Lipid transport and metabolism',
    'P': 'Inorganic ion transport and metabolism',
    'Q': 'Secondary metabolites biosynthesis, transport and catabolism',

    // POORLY CHARACTERIZED
    'R': 'General function prediction only',
    'S': 'Function unknown',
  },

  /* ── Add more columns below as needed ─────────────────────────────── */
  // 'EC_Number': { ... },
};
