# Tree viewer redesign plan

Status (2026-11-15): phase 1 built as a preview at `/phylotree_v2?dataset_id=…`
(`templates/tree_v2.html`, `static/js/tree2/`, `static/css/tree2.css`). The current
pages are unchanged. Phase 0 was confirmed on the database page only; the placement
and uploaded-tree pages still need a click-through.

Phase 2 (annotations and colour) is also in the preview: sectioned annotation panel,
text columns, colour strips with an editable legend, Cluster/GCF "shared only" colouring,
clade branch and background colours (click a branch), view saved in the browser,
settings file, and "Copy link". Code: `static/js/tree2/annotations.js`, `state.js`.

Phase 3 (node and leaf actions) is also in the preview. Clicking a branch, a tip label or
a collapsed clade opens a menu: clade summary, leaf annotations with cross-links and
highlight, collapse/expand, hide, reroot, Cluster/GCF colouring within a clade, and
annotation/sequence downloads with a preview dialog. Rerooting, hiding and collapsing are
part of the saved view, the link and the settings file. Code: `static/js/tree2/links.js`,
display-tree logic in `viewer.js`.

How it works: the viewer keeps the tree as stored and draws a separate display tree built
from it. Saved colours refer to stored branches, so they survive rerooting.

Phase 4 (cross-links, structures, dataset downloads) is also in the preview:

- Structures: "BGC product" and "Reaction" thumbnails next to the tree; click one to enlarge it in the side panel (with MIBiG/MITE link and arrows for several images), click again for a full-size dialog. The server now sends the list of available images with the page (`find_structure_images` in `app.py`), so the page no longer probes file names with HEAD requests. The image folders are listed once per server start: restart after adding images.
- Cross-links: folded table grouped by database, and "Show on tree" (link columns; a cell opens its link on click).
- Download dataset: tree and annotations with preview; alignment and sequences from the existing server routes.
- Explanations for coded values (COG) in tooltips and in the header card.

Phase 4 leftovers:

- Structures and link/text columns show only in the rectangular layout.
- The classic viewer asks for a file name before each dataset download; the new one uses a default name.
- Downloads for uploaded trees (`/download/user/…`) wait until the uploaded-tree page uses the new view.
- COG tooltip in the header card is untested (no test dataset had COG codes in its header); the same lookup was tested on a colour strip.

Phase 5 (figure export) is also in the preview: "Export figure" in the toolbar opens a
dialog with a live preview. Options: title, tip label field (or none), label size, width,
height (as needed or set), colour strips, legend, text columns, structures, scale bar,
support values. Output: SVG, PNG (150/300/600 dpi), PDF through the browser's print dialog
with the page set to the figure's size. The figure is drawn from the data (all tips, plain
coordinates, no CSS), in the layout of the current view. Code: `static/js/tree2/export.js`.

Phase 5 leftovers:

- PDF goes through "Print → Save as PDF" rather than a direct download (avoids adding a PDF library). Not tested by script, since it opens the system print dialog.
- A figure with readable labels is as tall as the tips need (505 tips at 7 pt is about 1.4 m; 3,555 tips about 11 m). The dialog says so and suggests collapsing clades, turning labels off, setting a height, or the circular layout.
- PNG size is limited by the browser's canvas (about 32,000 px per side); the dialog reports when a figure is too large.
- Coloured clades are not listed in the legend (they have no names).
- Text columns and structures are exported only in the rectangular layout.

Phase 6 (placement page) is in the preview at
`/jplace_v2?jobId=…&query=…&treeId=…` (same template, `placement` set). It has: placement
dots on the branches (size from LWR, colour from pendant length, colour bar), the
high-confidence / all toggle (LWR above 0.5), the placement list with "Show on tree",
quality note by pendant length, placement info in the node menu and tooltip, the tree
moved to the best placement on load, the summary of the placement clade (shown on load and
on request), support values mapped from the original tree, and everything from phases 1–5.
Dots are included in exported figures.

Phase 6 notes and leftovers:

- The classic page draws each dot at the node below the branch. The new one places it along the branch using `distal_length`, read as the distance from the node at the far-from-root end (the jplace definition). Worth a check against a known case.
- "Aligned Query (.fa)" and "Placement (.jplace)" in the classic page pointed at routes that did not exist (404). `app.py` now has `/download/aligned_query/…` and `/download/placement/…`, so they work in both pages.
- The classic `/jplace_render.html` route builds a file path from `jobId`, `query` and `treeId` without checking them. The new download routes reject path separators and `..`; the page route itself is unchanged.
- The view of a placement page is saved separately from the plain tree page of the same dataset.
- Tested by script on two real results (one and four placements, with and without high-confidence ones), including reroot, collapse and export. Not tried by hand.

Phase 3 leftovers:

- All node actions work on every clade after rerooting. A clade is saved as a signed stored-node number: `n` = the tips below node n, `-n` = all the other tips (which is what the clade becomes when the root moves below n). The settings file still names clades by their tips. Branch colours and hiding give the same result under any root. A background shade or a collapse is only drawn while its group of tips is a clade under the current root; it returns when the root does.
- Clade summary: drag-to-reorder is not remembered between summaries.
- The menu opens on click (the classic viewer also opens on click); there is no right-click menu.
- Tested by script on T000002 and PT024190 (collapse and reroot take under 0.1 s on 3,555 tips). Not yet tried by hand.

Phase 2 leftovers:

- Collapse a clade to a triangle: done in phase 3.
- Moving columns between sections on the uploaded-tree page: waits until that page uses the new view (phase 7 or earlier).
- Text columns are shown only in the rectangular layout.
- Clade label taken from a shared annotation (e.g. common Genus): not built.
- Cluster/GCF colouring per clade (from the node menu): phase 3.
- `annotation_sections` is read from the page data if the server provides it; the server does not send it yet.
- Link and settings-file round trips were tested by script; strips tested on 505 and 3,555 tips (about 10 ms per frame with five strips).

Phase 1 leftovers:

- `default_tip_label` is read from the dataset record, but the `datasets` table has no such column yet, so every dataset currently falls back to Species, then ID.
- COG tooltips in the header card are not carried over yet.
- Tested with scripted zoom/pan on T000002 (505 tips) and PT024190 (3,555 tips, the largest; about 7 ms per frame). Not yet tried by hand with mouse wheel and trackpad.

Goal: a tree viewer that looks modern, fits the screen, lets users colour clades and
annotations (from the database and locally), and exports publication-ready figures,
without losing any feature the current viewer has.

Priority: PhyloNaP is first a ready-to-use database, not a general tree-drawing tool.
Browsing a dataset with its annotations must stay fast and simple; visual extras are
added only where they don't slow down or clutter that.

Decisions already made:

- Build a new view directly on D3 (ISC licence, compatible with the project's MIT licence). No Phylocanvas.
- Plain SVG rendering. The largest datasets have about 2,500 leaves, which SVG handles.
- Rectangular and circular layouts.
- Default tip label is set per dataset; fallback is `Species`, then the ID.
- The new view is built on a separate page first; the current pages stay untouched until the new one covers everything in section 1.

---


**Phase 7 — switched over (2026-11-16)**
- The new viewer is the default on `/phylotree_render`, `/jplace_render.html` and the uploaded-tree page `/view_client_working` (also `/view_render/<id>`).
- Previous pages, to be removed after one release: `/phylotree_render_legacy`, `/jplace_render_legacy`, `/view_client_legacy`, `/view_render_legacy/<id>`. Each new page links to its previous one in the last card of the side panel.
- `/phylotree_v2` and `/jplace_v2` (the preview addresses) still open the new viewer, so links copied during testing keep working.
- Uploaded trees: the page reads the tree and table the upload page put in `sessionStorage` (`phylonap_user_data`); nothing goes to the server. The ID column is the one whose values match the most tips. "Copy link" is hidden there (use the settings file); tree details show no method.
- Still to do: remove the old templates and scripts (`phylotree_render.html`, `jplace_render.html`, `view_client*.html`, `tree_general.js` …) after the release; moving columns between sections on the uploaded-tree page; `default_tip_label` column; server-provided sections; domains.

**Catalytic sites from M-CSA — prototype on PT038484 (2026-11-17)**
- `scripts/build_catalytic_sites.py --db-dir <PhyloNaP_database> <dataset ids>` asks the M-CSA API for the dataset's UniProt IDs, checks each curated residue against the full sequence (`<id>.fasta`), places it on the trimmed alignment and writes `<id>_catalytic.json` next to the dataset files. Residues of different reference proteins on the same alignment column are one position; positions are numbered as in the reference with the most residues.
- The tree route passes the file as `catalytic_sites`; the viewer adds the section "Catalytic site (M-CSA)": one field per position (amino acid of every sequence there) plus "M-CSA reference". Field names carry the M-CSA roles and notes as a tooltip; strips of these fields share one amino-acid colour scheme. The header card links the M-CSA entries.
- Only PT038484 has a file so far. Before running on all 523 datasets: confirm M-CSA reuse terms and citation; decide whether to use the one-file download instead of per-dataset API calls; placement pages (`/jplace_render.html`) do not load the file yet.

**After phase 6 (feedback round, 2026-11-16)**
- A click on a placement dot opens the node menu of its branch with the placement details on top (LWR, pendant and distal length, log-likelihood, quality note).
- "Show on tree" marks the chosen dot with a pulsing ring and draws it on top.
- Explanations (the `?` marks, COG code, colour bar, summary bars) use an own instant tooltip: any element with `data-tv-tip`.
- Toolbar group "On branches": Support and Lengths buttons (view state `support`, `lengths`; link key `e`; settings file `branch_lengths`; also in figure export). Values are drawn when rows are at least 11 px apart, otherwise a "Zoom in" hint shows.
- Display card: "Hide IDs where the field is empty" (view state `hideIds`, link key `m`); the same choice in figure export.
- The export dialog shows tree details and the citation as copyable text above the download buttons, not in the image (dataset ID, FastTree + `tree_model` for non-curated datasets, rooting, shown/collapsed counts, placement query and numbers) and the PhyloNaP citation. Curated datasets have no tree method stored, so only their model is written when present.
- Circular figures and the on-screen legend say which ring each colour strip is (ring 1 = innermost).
- Clade summary redesigned: counts line with download links, "Shared by all tips", varying fields by section with one proportion bar each (tree colours when the field is coloured), "Different in every tip" folded; click a field for the value list and "Colour the tree by this field".

## 1. Feature inventory: what exists today and must not be lost

This list comes from reading the code. Before porting each group, click through it on
the live page once to confirm the behaviour (phase 0).

Files: `templates/phylotree_render.html`, `templates/jplace_render.html`,
`static/js/tree_general.js` (shared), `static/js/tree_database.js`,
`static/js/tree_placement.js`, customised `static/js/phylotree.js`.

Three pages use the viewer, and all three must keep working:

| Page | Route | Notes |
|---|---|---|
| Database tree | `/phylotree_render?dataset_id=…` | `app.py:736` |
| User-uploaded tree | `/view` → `/view_render/<session_id>` | same template, `source='user'`, `app.py:500` |
| Placement result | `/jplace_render.html?jobId=…&query=…&treeId=…` | `app.py:1301` |

### 1.1 Tree display and controls

- [ ] Rectangular tree with scale bar
- [ ] Expand / compress vertical spacing; expand / compress horizontal spacing (toolbar)
- [ ] Align tip labels left / right (toolbar)
- [ ] Bootstrap values on internal nodes, with a "BS" toggle that only appears when the tree has them (`tree_general.js:813-885`)
- [ ] Branch length shown on hover (`phylotree.js:2208`)
- [ ] Draggable divider between tree and side panel (Split.js, 75/25)
- [ ] Save image as SVG with styles baked in so it opens in Illustrator/Inkscape (`tree_general.js:4129`)

### 1.2 Right-click menu on an internal node (`phylotree.js:2536-2752`)

- [ ] Collapse subtree
- [ ] Get the summary of the clade
- [ ] Color cluster in clade
- [ ] Color GCF in clade
- [ ] Download clade annotations (.tsv)
- [ ] Download clade sequences (.fasta)
- [ ] Reroot on this node
- [ ] Hide this subtree / Show all descendant nodes

### 1.3 Right-click menu on a leaf (`tree_general.js:3918-4073`)

- [ ] Download sequence (calls `/api/sequence/<dataset_id>/<leaf_id>`, shown in the preview dialog)
- [ ] Download annotations (.tsv) for that leaf
- [ ] Show annotations: side-panel card with every non-empty field, IDs turned into links, the leaf highlighted with a ring on the tree; closing the card clears the highlight
- [ ] Hide this node, reroot

### 1.4 Annotation columns next to the tree (`tree_general.js:3255-3425`, `3647-3673`)

- [ ] One toggle per metadata column (list comes from the dataset's `metadata_columns`)
- [ ] Several columns at once, each with a header; number limited by available width, with a warning when full
- [ ] Long values cut at 30 characters; click to expand
- [ ] ID columns are links: double-click opens; several IDs in one cell are handled
- [ ] Tooltips that explain codes (e.g. COG categories, from `field_descriptions.js`)

### 1.5 Colouring (`tree_general.js:2240-2495`)

- [ ] "Proteins from the same cluster": tips sharing a `Cluster` value get the same colour (groups of 2+, up to 20 groups)
- [ ] "Proteins from the same GCF": same, using `GCF_ID`
- [ ] Both also available for a single clade (from the node menu)
- [ ] Buttons hidden when the dataset lacks the column; message when nothing can be coloured or there are too many groups

### 1.6 Cross-links to other databases (`tree_general.js:17-50`, `1002-1300`, `3426-3620`)

- [ ] Link targets: UniProt, MIBiG, PDB, MITE, PanBGC (GCF), KEGG Reaction
- [ ] Collapsible "External Links" table in the side panel, grouped by source
- [ ] Option to show the links as columns on the tree
- [ ] ID clean-up before building URLs (`cleanIdentifier`)

### 1.7 Structure images on the tree (`tree_general.js:2567-3250`, `1599-1825`)

- [ ] "BGC product": product structure image next to each tip that has a MIBiG ID (`static/images/BGC…_1.png`)
- [ ] "Reaction": reaction image per MITE ID (`static/images_reactions/…_reaction_N.png`), with arrows to step through several images
- [ ] Buttons appear only if the dataset has matching images
- [ ] Click an image: enlarged in the side panel with a link to MIBiG/MITE; click again: full-screen overlay (Esc closes)

### 1.8 Clade summary (`tree_general.js:4460-4915`)

- [ ] "Metadata Summary" card for the chosen clade: per field, each value with its count and a proportional bar
- [ ] Number of distinct values per field; fields collapsible; "expand all"; drag fields to reorder
- [ ] Subtitle says whether it is for the highlighted clade or the placement clade

### 1.9 Downloads

- [ ] Tree (.nwk), Metadata (.tsv), Alignment (.faa), Sequences (.fasta) for the dataset
- [ ] Preview dialog before download, with "Copy to clipboard" and "Download"
- [ ] For user uploads: the `/download/user/…` routes
- [ ] On the placement page: aligned query and placement (.jplace) files

### 1.10 Dataset header card

- [ ] Name, description, rooting method, EC numbers, Pfam, COG (with tooltips), citation with DOI link

### 1.11 Placement page (`tree_placement.js`)

- [ ] Reads the jplace file: tree plus placements
- [ ] Bubble on each placement edge: size from likelihood weight ratio (LWR), colour from pendant length, with a colour bar legend
- [ ] Shows placements with LWR above 0.5 by default; toggle to show all; toggle best vs all
- [ ] Placement list in the side panel with LWR and pendant length, and a button to scroll the tree to each placement
- [ ] Click a bubble for its details; LWR and pendant length also shown in the node menu
- [ ] Tree scrolls to the best placement on load
- [ ] Summary of the clade around the placements (MRCA), with a button to bring it back after viewing another clade
- [ ] Bootstrap values carried over from the original tree (`build_bootstrap_mapping`, `app.py:142`)
- [ ] Note explaining multiple placements
- [ ] Everything in 1.1–1.10 also works here

### 1.12 Known problems to fix on the way (from `todo.md` and the review)

- Rerooting breaks the annotation columns
- On the placement page the tree can end up collapsed to the side
- Resizing the window clips the tree until reload
- Annotation buttons change size when active, so the others jump
- Image export takes the first SVG on the page, shows internal IDs, has no legend

---

## 2. Target design

### 2.1 Tree

- Thin dark branches, no circles on internal nodes (shown on hover), small tip dots
- Rectangular and circular layouts; fit to screen by default; zoom and pan; reset view
- Redraws when the window or the divider moves
- Labels hide when too small to read and return on zoom
- "Label tips by" dropdown: any column or the ID; species in italics
- Support values optional (text or shaded dot)

### 2.2 Side panel sections

1. **Dataset** — header card as now
2. **Display** — layout, label tips by, support values, spacing
3. **Annotations**, grouped into sections:
   - Taxonomy
   - Functional annotation
   - Genomic context
   - Domains (placeholder, empty for now)
   - Other
4. **Selection** — leaf annotations, clade summary, placement details
5. **Structures** — BGC product, reaction
6. **Cross-links**
7. **Download** — data files and figure export

Each annotation row has two independent switches: *show as column* and *colour by*.
A whole section can also be coloured (see 2.3).

Until the database assigns columns to sections, the viewer uses a built-in mapping
by column name, and anything unknown goes to "Other":

| Section | Columns today |
|---|---|
| Taxonomy | Superkingdom, Phylum, Class, Order, Family, Genus, Species |
| Functional annotation | Enzyme_function, Function_category, Gene, Entry_Name, EC, Rhea, KEGG_Reaction, MITE_ID, COG_category |
| Genomic context | Cluster, GCF_ID, mibig, biosyn_class, product |
| Domains | (none yet) |
| Other | Source, Uniprot_ID, PDB_IDs, anything unmapped |

Later the dataset record can carry this itself, e.g.
`annotation_sections: {"taxonomy": [...], "function": [...], "context": [...], "domains": [...]}`.
The viewer reads it if present and falls back to the table above.

### 2.3 Colour

One model for everything:

- **Colour by a column**: a coloured strip beside the tips (several strips can sit side by side), colour-blind-safe palette, legend with click to change a colour or hide a value. Columns with too many values colour the most frequent ones and group the rest as "other".
- **Colour by a section**: one strip per column of that section, e.g. all taxonomy ranks side by side.
- **Cluster / GCF** become ordinary "colour by" entries in Genomic context, keeping today's rule of colouring only values shared by 2+ tips, and still available per clade.
- **Local clade colouring**: right-click a node to colour branches, shade the clade background, or collapse to a triangle.
- No free-text clade labels. All labels come from the annotation table. A clade can show a label taken from an annotation its leaves share (e.g. the common Genus), which costs nothing in the link. Custom text labels are a possible later extra, kept in the settings file only.
- Local choices are saved in the browser per dataset and can be exported/imported as a JSON file.

### 2.3a Sharing a view by link

The whole display state is one small "view state" object: layout, tip label column,
shown columns, colour-by choices and custom colours, clade colours/labels/collapses,
rooting, zoom. The same object is used for browser saving, the JSON file and the link.

- **Database trees and placement results**: "Copy link to this view" puts the view state,
  compressed, into the part of the URL after `#`. Opening the link restores the view.
  No server storage and no accounts are needed, and the state never reaches the server.
- No server-stored short links (decided 2026-11-15: temporary links would cause
  problems). The link is kept short by what it stores:
  - Colouring driven by an annotation is stored as the rule ("colour by Species,
    palette X") plus only the colours the user changed, never per leaf.
  - A coloured or collapsed clade is stored as one node number (position in the stored
    tree), not as its leaves. Single leaves are stored as numbers, not names.
  - Colours are stored as palette positions; only custom colours as hex.
  - Rerooting is stored as "rerooted at node N"; all node numbers refer to the tree as
    stored in the database.
  - The whole state is compressed before going into the link.
- The link carries a short fingerprint of the tree. If the dataset's tree has changed
  since the link was made, the page says so instead of colouring the wrong clades.
- The settings file is the complete, durable version: it names clades by leaf names, so
  it survives dataset updates, and it suits archiving alongside a paper. If a view is
  ever too large for a link, the page says so and offers the file.
- **Uploaded trees** live only in the user's session, so a link cannot reopen them for
  someone else. For these the JSON file is the way to share, together with the tree
  files. Making uploads shareable by link would mean storing users' trees on the server;
  that is a separate decision (storage, retention, privacy).
- In the browser's saved state and in the settings file, clades are identified by leaf
  names, so they survive dataset updates that keep those leaves.

### 2.3b Sections for uploaded trees

On the uploaded-tree page, columns are first sorted by the built-in name mapping. The
user can then move any column to another section (drag, or a small menu on the column).
The assignment is part of the view state, so it is saved and exported with it.

### 2.4 Domains (future)

Not decided yet what the database will provide. Two likely kinds, and the design
allows for both:

- **HMM-based domain matches** (most datasets): either presence/absence per sequence,
  shown as a strip or small coloured squares per domain, or, if start/end positions are
  stored, a per-tip domain track (protein drawn as a line with coloured domain blocks).
- **Exact catalytic sites** (some datasets): the residue at each site per sequence,
  shown as a small coloured letter column per site, so changes along the tree are visible.

Space is reserved to the right of the strips. Nothing is built until the data exists.
Worth storing start/end positions for HMM matches even if only presence is shown at
first, since they cannot be recovered later without re-running the search.

### 2.5 Figure export

Dialog with live preview: SVG, PNG (300/600 dpi), PDF; width in mm; tip label column;
which strips, legend, title, scale bar and support values to include. Structure images
are embedded so the file is self-contained.

---

## 3. Code structure

New files, leaving the old ones in place until the switch:

- `static/js/tree2/` — small modules: data loading, layout (rectangular/circular), rendering, annotations, colour, node menu, selection panel, structures, links, downloads, export, placement
- `static/css/tree2.css` — one set of colour and type variables
- `templates/tree_v2.html` — new page; `templates/jplace_v2.html` later
- `app.py` — new route `/phylotree_v2` reusing the data loading of `/phylotree_render`; passes `default_tip_label` and, when present, `annotation_sections`

Reused as is: the server routes for sequences and downloads, `field_descriptions.js`,
the link targets in `HYPERLINK_CONFIG`, the image folders, the jplace bootstrap mapping.

---

## 4. Phases

Each phase ends with a comparison against the current page on T000002 and on the
largest dataset (about 2,500 leaves).

**Phase 0 — Confirm the inventory.** Click through section 1 on all three pages; correct the list.

**Phase 1 — Core tree.** New page with rectangular and circular layouts, fit to screen,
zoom/pan, resize handling, label-by with per-dataset default, support values, scale bar,
branch length on hover, spacing controls. Covers 1.1 except export.

**Phase 2 — Annotations and colour.** Sectioned annotation panel with placeholders,
columns on the tree, colour strips and legend, Cluster/GCF colouring, local clade
colouring with save/export/import, "Copy link to this view", and moving columns between
sections on the uploaded-tree page. Covers 1.4, 1.5.

**Phase 3 — Node and leaf actions.** Menus, leaf annotation card with highlight, clade
summary, collapse/hide/reroot (annotations must survive rerooting). Covers 1.2, 1.3, 1.8.

**Phase 4 — Links, structures, downloads.** Cross-link table and on-tree links, BGC
product and reaction images with enlarge/overlay, data downloads with preview.
Covers 1.6, 1.7, 1.9, 1.10.

**Phase 5 — Figure export.** Export dialog as in 2.5.

**Phase 6 — Placement page.** Port everything in 1.11 onto the new view.

**Phase 7 — Switch over.** Point the three routes at the new view, keep the old pages
reachable under a `_legacy` URL for one release, then remove old code.

---

## 5. Open questions

Answered 2026-11-15:

- Sharing by link: yes (see 2.3a).
- Uploaded-tree users can assign columns to sections: yes (see 2.3b).
- Domain data: undecided; probably HMM-based matches, catalytic sites for some datasets (see 2.4).

- Uploaded (not submitted) trees are not kept on the server, so they are not shareable by link; the JSON settings file is the way to share them. Decided.
- Domains: design for both HMM matches and catalytic sites. Decided.
