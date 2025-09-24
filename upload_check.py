"""
File validation functions for PhyloNaP upload feature
Validates tree files, metadata tables, alignments, and other upload data
"""

import os
import re
import pandas as pd
from Bio import SeqIO, Phylo
from io import StringIO
import logging

# Setup logging
logger = logging.getLogger(__name__)

class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass
def validate_tree_file(tree_file_path):
    """
    Validate phylogenetic tree file
    
    Args:
        tree_file_path (str): Path to the tree file
        
    Returns:
        dict: {'valid': bool, 'message': str, 'is_rooted': bool, 'leaf_names': list}
    """
    result = {
        'valid': False,
        'message': '',
        'is_rooted': False,
        'leaf_names': [],
        'leaf_count': 0
    }
    
    try:
        if not os.path.exists(tree_file_path):
            result['message'] = 'Tree file does not exist'
            return result
        
        # Try to read the tree file
        with open(tree_file_path, 'r') as f:
            tree_content = f.read().strip()
        
        if not tree_content:
            result['message'] = 'Tree file is empty'
            return result
        
        # Try to parse with Biopython
        try:
            tree = Phylo.read(tree_file_path, 'newick')
        except Exception as e:
            result['message'] = f'Invalid Newick format: {str(e)}'
            return result
        
        # Get leaf names
        leaf_names = []
        for clade in tree.get_terminals():
            if clade.name:
                leaf_names.append(clade.name.strip())
        
        if not leaf_names:
            result['message'] = 'No leaf names found in tree'
            return result
        
        # Check for duplicate leaf names
        if len(leaf_names) != len(set(leaf_names)):
            duplicates = set([name for name in leaf_names if leaf_names.count(name) > 1])
            result['message'] = f'Duplicate leaf names found: {", ".join(duplicates)}'
            return result
        
        # Check if tree is rooted
        is_rooted = tree.is_monophyletic(tree.get_terminals())
        if hasattr(tree.root, 'clades') and len(tree.root.clades) == 2:
            is_rooted = True
        elif hasattr(tree.root, 'clades') and len(tree.root.clades) > 2:
            is_rooted = False
        
        result.update({
            'valid': True,
            'message': f'Valid tree file with {len(leaf_names)} leaves',
            'is_rooted': is_rooted,
            'leaf_names': leaf_names,
            'leaf_count': len(leaf_names)
        })
        
        return result
        
    except Exception as e:
        result['message'] = f'Error reading tree file: {str(e)}'
        return result

def validate_metadata_file(metadata_file_path, tree_leaf_names=None):
    """
    Validate metadata TSV/CSV file
    
    Args:
        metadata_file_path (str): Path to the metadata file
        tree_leaf_names (list): List of leaf names from tree for comparison
        
    Returns:
        dict: {'valid': bool, 'message': str, 'id_column': str, 'ids': list, 'columns': list}
    """
    result = {
        'valid': False,
        'message': '',
        'id_column': None,
        'ids': [],
        'columns': [],
        'row_count': 0
    }
    
    try:
        if not os.path.exists(metadata_file_path):
            result['message'] = 'Metadata file does not exist'
            return result
        
        # Try to read as TSV first, then CSV
        try:
            df = pd.read_csv(metadata_file_path, sep='\t')
        except:
            try:
                df = pd.read_csv(metadata_file_path, sep=',')
            except Exception as e:
                result['message'] = f'Cannot read metadata file as TSV or CSV: {str(e)}'
                return result
        
        if df.empty:
            result['message'] = 'Metadata file is empty'
            return result
        
        # Get column names
        columns = df.columns.tolist()
        
        # Look for ID column (case insensitive)
        id_column = None
        for col in columns:
            if col.lower() in ['id', 'ids', 'identifier', 'name', 'sequence_id', 'seq_id']:
                id_column = col
                break
        
        if not id_column:
            result['message'] = 'No ID column found. Expected columns: id, ids, identifier, name, sequence_id, seq_id'
            return result
        
        # Get IDs from the ID column
        ids = df[id_column].astype(str).str.strip().tolist()
        
        # Remove empty/null IDs
        ids = [id_val for id_val in ids if id_val and id_val.lower() not in ['nan', 'none', '']]
        
        if not ids:
            result['message'] = f'No valid IDs found in column "{id_column}"'
            return result
        
        # Check for duplicates
        if len(ids) != len(set(ids)):
            duplicates = set([id_val for id_val in ids if ids.count(id_val) > 1])
            result['message'] = f'Duplicate IDs found in metadata: {", ".join(list(duplicates)[:5])}'
            return result
        
        # Compare with tree leaf names if provided
        if tree_leaf_names:
            tree_set = set(tree_leaf_names)
            metadata_set = set(ids)
            
            missing_in_metadata = tree_set - metadata_set
            missing_in_tree = metadata_set - tree_set
            
            if missing_in_metadata:
                result['message'] = f'Tree leaves missing from metadata: {", ".join(list(missing_in_metadata)[:5])}'
                return result
            
            if missing_in_tree:
                result['message'] = f'Metadata IDs missing from tree: {", ".join(list(missing_in_tree)[:5])}'
                return result
        
        result.update({
            'valid': True,
            'message': f'Valid metadata file with {len(ids)} entries',
            'id_column': id_column,
            'ids': ids,
            'columns': columns,
            'row_count': len(df)
        })
        
        return result
        
    except Exception as e:
        result['message'] = f'Error reading metadata file: {str(e)}'
        return result

def validate_alignment_file(alignment_file_path, tree_leaf_names=None):
    """
    Validate alignment file (FASTA format)
    
    Args:
        alignment_file_path (str): Path to the alignment file
        tree_leaf_names (list): List of leaf names from tree for comparison
        
    Returns:
        dict: {'valid': bool, 'message': str, 'sequence_ids': list, 'sequence_count': int, 'alignment_length': int}
    """
    result = {
        'valid': False,
        'message': '',
        'sequence_ids': [],
        'sequence_count': 0,
        'alignment_length': 0
    }
    
    try:
        if not os.path.exists(alignment_file_path):
            result['message'] = 'Alignment file does not exist'
            return result
        
        # Read FASTA file
        sequences = []
        sequence_ids = []
        
        try:
            for record in SeqIO.parse(alignment_file_path, 'fasta'):
                sequences.append(str(record.seq))
                sequence_ids.append(record.id.strip())
        except Exception as e:
            result['message'] = f'Invalid FASTA format: {str(e)}'
            return result
        
        if not sequences:
            result['message'] = 'No sequences found in alignment file'
            return result
        
        # Check for duplicate sequence IDs
        if len(sequence_ids) != len(set(sequence_ids)):
            duplicates = set([seq_id for seq_id in sequence_ids if sequence_ids.count(seq_id) > 1])
            result['message'] = f'Duplicate sequence IDs found: {", ".join(list(duplicates)[:5])}'
            return result
        
        # Check alignment length consistency
        seq_lengths = [len(seq) for seq in sequences]
        if len(set(seq_lengths)) > 1:
            result['message'] = f'Sequences have different lengths: {min(seq_lengths)} to {max(seq_lengths)}. This should be an alignment.'
            return result
        
        alignment_length = seq_lengths[0] if seq_lengths else 0
        
        # Check for empty sequences
        if alignment_length == 0:
            result['message'] = 'All sequences are empty'
            return result
        
        # Compare with tree leaf names if provided
        if tree_leaf_names:
            tree_set = set(tree_leaf_names)
            alignment_set = set(sequence_ids)
            
            missing_in_alignment = tree_set - alignment_set
            missing_in_tree = alignment_set - tree_set
            
            if missing_in_alignment:
                result['message'] = f'Tree leaves missing from alignment: {", ".join(list(missing_in_alignment)[:5])}'
                return result
            
            if missing_in_tree:
                result['message'] = f'Alignment sequences missing from tree: {", ".join(list(missing_in_tree)[:5])}'
                return result
        
        # Check for valid protein/DNA sequences
        valid_protein_chars = set('ACDEFGHIKLMNPQRSTVWY*-X')
        valid_dna_chars = set('ACGTN-')
        
        all_chars = set(''.join(sequences).upper())
        
        is_protein = all_chars.issubset(valid_protein_chars)
        is_dna = all_chars.issubset(valid_dna_chars)
        
        if not is_protein and not is_dna:
            invalid_chars = all_chars - valid_protein_chars
            result['message'] = f'Invalid characters found in sequences: {", ".join(list(invalid_chars)[:10])}'
            return result
        
        seq_type = 'protein' if is_protein else 'DNA'
        
        result.update({
            'valid': True,
            'message': f'Valid {seq_type} alignment with {len(sequences)} sequences of length {alignment_length}',
            'sequence_ids': sequence_ids,
            'sequence_count': len(sequences),
            'alignment_length': alignment_length,
            'sequence_type': seq_type
        })
        
        return result
        
    except Exception as e:
        result['message'] = f'Error reading alignment file: {str(e)}'
        return result

def validate_all_files(tree_path, metadata_path, alignment_path, email, additional_files=None):
    """
    Validate all uploaded files together
    
    Args:
        tree_path (str): Path to tree file
        metadata_path (str): Path to metadata file
        alignment_path (str): Path to alignment file
        email (str): Email address
        additional_files (dict): Optional additional files to validate
        
    Returns:
        dict: Complete validation results
    """
    results = {
        'overall_valid': False,
        'email': {},
        'tree': {},
        'metadata': {},
        'alignment': {},
        'consistency_checks': {},
        'summary': ''
    }
    
    try:

        # Validate tree
        results['tree'] = validate_tree_file(tree_path)
        
        # Validate metadata (with tree leaf names if tree is valid)
        tree_leaves = results['tree'].get('leaf_names', []) if results['tree']['valid'] else None
        results['metadata'] = validate_metadata_file(metadata_path, tree_leaves)
        
        # Validate alignment (with tree leaf names if tree is valid)
        results['alignment'] = validate_alignment_file(alignment_path, tree_leaves)
        
        # Cross-validation checks
        consistency_issues = []
        
        if results['tree']['valid'] and results['metadata']['valid'] and results['alignment']['valid']:
            tree_leaves = set(results['tree']['leaf_names'])
            metadata_ids = set(results['metadata']['ids'])
            alignment_ids = set(results['alignment']['sequence_ids'])
            
            # Check if all three match
            if tree_leaves != metadata_ids:
                consistency_issues.append('Tree leaves and metadata IDs do not match completely')
            
            if tree_leaves != alignment_ids:
                consistency_issues.append('Tree leaves and alignment sequence IDs do not match completely')
            
            if metadata_ids != alignment_ids:
                consistency_issues.append('Metadata IDs and alignment sequence IDs do not match completely')
        
        results['consistency_checks'] = {
            'valid': len(consistency_issues) == 0,
            'issues': consistency_issues
        }
        
        # Overall validation
        all_valid = (
            results['email']['valid'] and
            results['tree']['valid'] and
            results['metadata']['valid'] and
            results['alignment']['valid'] and
            results['consistency_checks']['valid']
        )
        
        results['overall_valid'] = all_valid
        
        # Create summary message
        if all_valid:
            results['summary'] = f"All files validated successfully! Tree: {results['tree']['leaf_count']} leaves, Alignment: {results['alignment']['sequence_count']} sequences, Metadata: {results['metadata']['row_count']} entries"
        else:
            errors = []
            if not results['email']['valid']:
                errors.append(f"Email: {results['email']['message']}")
            if not results['tree']['valid']:
                errors.append(f"Tree: {results['tree']['message']}")
            if not results['metadata']['valid']:
                errors.append(f"Metadata: {results['metadata']['message']}")
            if not results['alignment']['valid']:
                errors.append(f"Alignment: {results['alignment']['message']}")
            if not results['consistency_checks']['valid']:
                errors.extend([f"Consistency: {issue}" for issue in consistency_issues])
            
            results['summary'] = "Validation failed: " + "; ".join(errors)
        
        return results
        
    except Exception as e:
        results['summary'] = f'Validation error: {str(e)}'
        logger.error(f"Validation error: {str(e)}", exc_info=True)
        return results

def validate_iqtree_file(iqtree_path):
    """
    Validate IQ-TREE output file and extract evolutionary model
    
    Args:
        iqtree_path (str): Path to .iqtree file
        
    Returns:
        dict: {'valid': bool, 'message': str, 'model': str}
    """
    result = {
        'valid': False,
        'message': '',
        'model': ''
    }
    
    try:
        if not os.path.exists(iqtree_path):
            result['message'] = 'IQ-TREE file does not exist'
            return result
        
        with open(iqtree_path, 'r') as f:
            content = f.read()
        
        # Look for best-fit model
        model_found = False
        for line in content.split('\n'):
            if 'Best-fit model according to BIC:' in line:
                model = line.split('Best-fit model according to BIC:')[1].strip()
                result['model'] = model
                model_found = True
                break
            elif 'Best-fit model according to AIC:' in line and not model_found:
                model = line.split('Best-fit model according to AIC:')[1].strip()
                result['model'] = model
                model_found = True
        
        if not model_found:
            result['message'] = 'No best-fit model found in IQ-TREE file'
            return result
        
        result.update({
            'valid': True,
            'message': f'Valid IQ-TREE file, extracted model: {result["model"]}'
        })
        
        return result
        
    except Exception as e:
        result['message'] = f'Error reading IQ-TREE file: {str(e)}'
        return result

# Example usage
if __name__ == "__main__":
    # Test functions
    print("Upload validation functions loaded successfully!")



