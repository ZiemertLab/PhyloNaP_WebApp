#!/usr/bin/env python3
"""Catalytic sites from M-CSA for PhyloNaP datasets.

For every sequence of a dataset whose UniProt ID is described in M-CSA
(Mechanism and Catalytic Site Atlas, https://www.ebi.ac.uk/thornton-srv/m-csa/),
the curated catalytic residues are placed on the dataset alignment. The result is
written next to the dataset files as <dataset_id>_catalytic.json and holds, for each
catalytic position, the amino acid every sequence of the dataset has there.

Usage:
    python scripts/build_catalytic_sites.py --db-dir /path/to/PhyloNaP_database PT038484 [more ids]

Only the Python standard library is needed. The M-CSA API is asked for the UniProt
IDs of the given datasets only.
"""

import argparse
import csv
import datetime
import difflib
import json
import os
import sqlite3
import sys
import urllib.parse
import urllib.request

API = 'https://www.ebi.ac.uk/thornton-srv/m-csa/api/'
THREE_TO_ONE = {
    'Ala': 'A', 'Arg': 'R', 'Asn': 'N', 'Asp': 'D', 'Cys': 'C', 'Gln': 'Q', 'Glu': 'E', 'Gly': 'G',
    'His': 'H', 'Ile': 'I', 'Leu': 'L', 'Lys': 'K', 'Met': 'M', 'Phe': 'F', 'Pro': 'P', 'Ser': 'S',
    'Thr': 'T', 'Trp': 'W', 'Tyr': 'Y', 'Val': 'V', 'Sec': 'U', 'Pyl': 'O',
}
ONE_TO_THREE = {v: k for k, v in THREE_TO_ONE.items()}
EMPTY = {'', 'nan', 'none', '-'}


def read_fasta(path):
    seqs, name = {}, None
    with open(path) as handle:
        for line in handle:
            line = line.strip()
            if line.startswith('>'):
                name = line[1:].split()[0]
                seqs[name] = []
            elif name is not None:
                seqs[name].append(line)
    return {k: ''.join(v) for k, v in seqs.items()}


def api_get(view, uniprot_ids):
    query = urllib.parse.urlencode({'format': 'json', 'entries.proteins.sequences.uniprot_ids': ','.join(uniprot_ids)})
    request = urllib.request.Request(API + view + '/?' + query, headers={'User-Agent': 'phylonap-build'})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = json.load(response)
    results = data['results'] if isinstance(data, dict) else data
    while isinstance(data, dict) and data.get('next'):
        with urllib.request.urlopen(urllib.request.Request(data['next'], headers={'User-Agent': 'phylonap-build'}), timeout=120) as response:
            data = json.load(response)
        results.extend(data['results'])
    return results


def position_to_column(full, row):
    """Alignment column (0-based) of every residue (1-based) of the full sequence.

    The stored alignments are trimmed, so a row is the full sequence with some residues
    removed. The two are matched first; residues that were trimmed away get no column.
    """
    columns = [i for i, ch in enumerate(row) if ch not in '-.']
    ungapped = ''.join(row[i] for i in columns).upper()
    matcher = difflib.SequenceMatcher(None, full.upper(), ungapped, autojunk=False)
    mapping = {}
    for a, b, size in matcher.get_matching_blocks():
        for k in range(size):
            mapping[a + k + 1] = columns[b + k]
    return mapping


def build(dataset, db_dir):
    """Returns the catalytic-site record of one dataset, or None when M-CSA has nothing for it."""
    folder = os.path.join(db_dir, os.path.dirname(dataset['alignment']))
    with open(os.path.join(db_dir, dataset['metadata']), newline='') as handle:
        rows = list(csv.DictReader(handle, delimiter='\t'))
    tip_of = {}
    for row in rows:
        uniprot = (row.get('Uniprot_ID') or '').strip()
        if uniprot.lower() not in EMPTY:
            tip_of.setdefault(uniprot, row['ID'])
    if not tip_of:
        return None

    residues = api_get('residues', sorted(tip_of))
    if not residues:
        return None
    alignment = read_fasta(os.path.join(db_dir, dataset['alignment']))
    full = read_fasta(os.path.join(db_dir, dataset['sequences']))

    # every curated residue of a protein of this dataset, placed on the alignment
    placed, skipped, maps = [], [], {}
    for residue in residues:
        for seq in residue.get('residue_sequences') or []:
            uniprot, tip = seq.get('uniprot_id'), tip_of.get(seq.get('uniprot_id'))
            if not tip or seq.get('resid') is None or tip not in alignment or tip not in full:
                continue
            name = '%s%d' % (seq['code'], seq['resid'])
            item = {
                'uniprot': uniprot, 'tip': tip, 'residue': name, 'mcsa_id': residue['mcsa_id'],
                'roles': residue.get('roles_summary') or '', 'note': residue.get('main_annotation') or '',
                'location': residue.get('function_location_abv') or '',
            }
            sequence = full[tip]
            letter = THREE_TO_ONE.get(seq['code'])
            if seq['resid'] > len(sequence) or (letter and sequence[seq['resid'] - 1].upper() != letter):
                skipped.append(dict(item, reason='the stored sequence has a different residue at this position'))
                continue
            if tip not in maps:
                maps[tip] = position_to_column(sequence, alignment[tip])
            column = maps[tip].get(seq['resid'])
            if column is None:
                skipped.append(dict(item, reason='this position was trimmed from the alignment'))
                continue
            placed.append(dict(item, column=column, code=seq['code']))
    if not placed:
        return None

    # reference proteins, the one with the most placed residues first
    count = {}
    for item in placed:
        count[item['uniprot']] = count.get(item['uniprot'], 0) + 1
    order = sorted(count, key=lambda u: (-count[u], u))

    # residues of different reference proteins that fall on the same alignment column are one site
    by_column = {}
    for item in placed:
        by_column.setdefault(item['column'], []).append(item)
    sites, used = [], set()
    for column in sorted(by_column):
        evidence = sorted(by_column[column], key=lambda e: order.index(e['uniprot']))
        # a position is named by the residues M-CSA reports there, each in its own protein's numbering
        reported = []
        for e in evidence:
            if e['residue'] not in reported:
                reported.append(e['residue'])
        name = '/'.join(reported)
        if name in used:
            name += ' (%s)' % evidence[0]['uniprot']
        used.add(name)
        sites.append({
            'name': name, 'column': column,
            'catalytic': sorted({e['code'] for e in evidence}),
            'evidence': [{k: e[k] for k in ('uniprot', 'tip', 'residue', 'mcsa_id', 'roles', 'note', 'location')} for e in evidence],
        })

    values = {}
    for tip, row in alignment.items():
        cells = []
        for site in sites:
            letter = row[site['column']].upper()
            cells.append('gap' if letter in '-.' else ONE_TO_THREE.get(letter, letter))
        values[tip] = cells

    entries = {e['mcsa_id']: e for e in api_get('entries', order)}
    references = []
    for uniprot in order:
        ids = sorted({item['mcsa_id'] for item in placed if item['uniprot'] == uniprot})
        for mcsa_id in ids:
            entry = entries.get(mcsa_id, {})
            references.append({
                'uniprot': uniprot, 'tip': tip_of[uniprot], 'mcsa_id': mcsa_id,
                'enzyme_name': entry.get('enzyme_name') or '', 'ec': entry.get('all_ecs') or [],
                'url': 'https://www.ebi.ac.uk/thornton-srv/m-csa/entry/%d/' % mcsa_id,
            })
    return {
        'source': 'M-CSA', 'source_url': 'https://www.ebi.ac.uk/thornton-srv/m-csa/',
        'retrieved': datetime.date.today().isoformat(),
        'references': references,
        'sites': sites,
        'not_placed': skipped,
        'values': values,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--db-dir', required=True, help='the PhyloNaP_database folder (holds phylonap.db)')
    parser.add_argument('datasets', nargs='+', help='dataset IDs, e.g. PT038484')
    args = parser.parse_args()

    connection = sqlite3.connect(os.path.join(args.db_dir, 'phylonap.db'))
    connection.row_factory = sqlite3.Row
    for dataset_id in args.datasets:
        dataset = connection.execute('select * from datasets where dataset_id = ?', (dataset_id,)).fetchone()
        if not dataset:
            print(dataset_id + ': not in the database', file=sys.stderr)
            continue
        record = build(dataset, args.db_dir)
        if not record:
            print(dataset_id + ': no M-CSA protein in this dataset')
            continue
        target = os.path.join(args.db_dir, os.path.dirname(dataset['alignment']), dataset_id + '_catalytic.json')
        with open(target, 'w') as handle:
            json.dump(record, handle, separators=(',', ':'))
        print('%s: %d positions from %d reference proteins (%d residues not placed) -> %s' % (
            dataset_id, len(record['sites']), len({r['uniprot'] for r in record['references']}), len(record['not_placed']), target))


if __name__ == '__main__':
    main()
