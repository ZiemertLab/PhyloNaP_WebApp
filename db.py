import sqlite3
import os
import json
import logging
from flask import g, current_app
from functools import lru_cache
from datetime import datetime

# Setup logging - add this section at the top of your file
def setup_logger():
    """Configure the logger to write to a file"""
    log_dir = '/home/phylonapadm/PhyloNaP/logs'
    os.makedirs(log_dir, exist_ok=True)
    
    logger = logging.getLogger("phylonap.db")
    
    # Check if handlers are already configured to avoid duplicates
    if not logger.handlers:
        # File handler for the database log
        file_handler = logging.FileHandler(os.path.join(log_dir, 'database.log'))
        file_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(file_format)
        
        # Set logging level
        logger.setLevel(logging.DEBUG)
        file_handler.setLevel(logging.DEBUG)
        
        # Add handler to logger
        logger.addHandler(file_handler)
        
        # Make sure log propagates to root logger too
        logger.propagate = True
    
    return logger

# Initialize the logger
logger = setup_logger()

def get_db():
    """Get database connection"""
    db = getattr(g, '_database', None)
    if db is None:
        db_path = current_app.config.get('SQLITE_DB')
        logger.debug(f"Opening database connection to: {db_path}")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        db = g._database = sqlite3.connect(db_path)
        db.row_factory = sqlite3.Row  # Enable column access by name
        
        # Check if database is initialized
        if not is_db_initialized(db):
            logger.warning("Database not initialized. Creating schema and loading from JSON.")
            initialize_db_from_json(db)
            
    return db

def is_db_initialized(db):
    """Check if the database has the necessary tables"""
    try:
        cursor = db.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='superfamilies'")
        return cursor.fetchone() is not None
    except sqlite3.Error as e:
        logger.error(f"Error checking database initialization: {e}")
        return False

def initialize_db_from_json(db):
    """Initialize database schema and load data from JSON file"""
    try:
        # Create schema
        create_database_schema(db)
        
        # Load data from JSON file
        json_path = os.path.join(current_app.config.get('DB_DIR'), 'db_structure.json')
        if os.path.exists(json_path):
            migrate_data_from_json(db, json_path)
            logger.info(f"Database initialized successfully from {json_path}")
        else:
            # Create empty structure if JSON doesn't exist
            cursor = db.cursor()
            cursor.execute('INSERT INTO superfamilies (name, description) VALUES (?, ?)', 
                          ('Default', 'Auto-created default superfamily'))
            db.commit()
            logger.warning(f"JSON file not found at {json_path}. Created empty database structure.")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        # Rollback any partial changes
        db.rollback()
        raise

def create_database_schema(db):
    """Create database tables"""
    cursor = db.cursor()
    
    # Create superfamilies table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS superfamilies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT
    )
    ''')
    
    # Create superfamily_hmms table for the hmm_name arrays
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS superfamily_hmms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        superfamily_id INTEGER NOT NULL,
        hmm_name TEXT NOT NULL,
        FOREIGN KEY (superfamily_id) REFERENCES superfamilies(id)
    )
    ''')
    
    # Create datasets table with all observed fields
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS datasets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id TEXT UNIQUE,  -- The "id" field from JSON like "T010004"
        superfamily_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        tree TEXT,               -- Path to tree file
        tree_model TEXT,         -- Model used for tree construction
        metadata TEXT,           -- Path to metadata file
        alignment TEXT,          -- Path to alignment file
        sequences TEXT,          -- Path to sequences file
        source TEXT,             -- "curated" or "automatic"
        data_type TEXT,          -- "protein" etc.
        reviewed TEXT,           -- "yes" or "no" 
        N_proteins INTEGER,      -- Number of proteins
        N_characterized INTEGER, -- Number of characterized proteins
        N_np_val INTEGER,        -- Number of NP validated
        N_np_pred INTEGER,       -- Number of NP predicted
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (superfamily_id) REFERENCES superfamilies(id)
    )
    ''')
    
    # Create metadata_columns table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS metadata_columns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id INTEGER NOT NULL,
        column_name TEXT NOT NULL,
        display_order INTEGER,
        FOREIGN KEY (dataset_id) REFERENCES datasets(id)
    )
    ''')
    
    # Create citation table for dataset citations
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS citations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataset_id INTEGER NOT NULL,
        author_name TEXT,
        doi TEXT,
        FOREIGN KEY (dataset_id) REFERENCES datasets(id)
    )
    ''')
    
    db.commit()

def migrate_data_from_json(db, json_file_path):
    """Migrate data from JSON to SQLite"""
    cursor = db.cursor()
    
    # Load JSON data
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    
    # Process superfamilies
    for superfamily in data.get('superfamilies', []):
        # Insert superfamily
        cursor.execute(
            'INSERT INTO superfamilies (name, description) VALUES (?, ?)',
            (superfamily['name'], superfamily.get('description', ''))
        )
        superfamily_id = cursor.lastrowid
        
        # Insert HMM names for this superfamily
        for hmm_name in superfamily.get('hmm_name', []):
            cursor.execute(
                'INSERT INTO superfamily_hmms (superfamily_id, hmm_name) VALUES (?, ?)',
                (superfamily_id, hmm_name)
            )
        
        # Process datasets
        for dataset in superfamily.get('datasets', []):
            # Insert dataset with all possible fields
            cursor.execute('''
            INSERT INTO datasets (
                dataset_id, superfamily_id, name, description, tree, tree_model, 
                metadata, alignment, sequences, source, data_type, reviewed,
                N_proteins, N_characterized, N_np_val, N_np_pred
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                dataset.get('id', ''),
                superfamily_id, 
                dataset.get('name', ''),
                dataset.get('description', ''),
                dataset.get('tree', ''),
                dataset.get('tree_model', ''),
                dataset.get('metadata', ''),
                dataset.get('alignment', ''),
                dataset.get('sequences', ''),
                dataset.get('source', ''),
                dataset.get('data_type', ''),
                dataset.get('reviewed', ''),
                dataset.get('N_proteins', 0),
                dataset.get('N_characterized', 0),
                dataset.get('N_np_val', 0),
                dataset.get('N_np_pred', 0)
            ))
            dataset_id = cursor.lastrowid
            
            # Process metadata columns
            for i, column in enumerate(dataset.get('metadata_columns', [])):
                cursor.execute('''
                INSERT INTO metadata_columns (dataset_id, column_name, display_order)
                VALUES (?, ?, ?)
                ''', (dataset_id, column, i))
            
            # Process citations
            cite = dataset.get('cite', {})
            if cite:
                # Handle both string and list of names
                names = cite.get('name', '')
                if isinstance(names, list):
                    for name in names:
                        cursor.execute('''
                        INSERT INTO citations (dataset_id, author_name, doi)
                        VALUES (?, ?, ?)
                        ''', (dataset_id, name, cite.get('doi', '')))
                else:
                    cursor.execute('''
                    INSERT INTO citations (dataset_id, author_name, doi)
                    VALUES (?, ?, ?)
                    ''', (dataset_id, names, cite.get('doi', '')))
    
    db.commit()

def close_db(exception=None):
    """Close database connection when the request ends"""
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_app(app):
    """Initialize database with Flask app"""
    app.teardown_appcontext(close_db)
    
    # Log database path
    logger.info(f"Database configured at: {app.config['SQLITE_DB']}")
    
    # Check if directory exists
    db_dir = os.path.dirname(app.config['SQLITE_DB'])
    if not os.path.exists(db_dir):
        logger.warning(f"Database directory does not exist: {db_dir}")
        os.makedirs(db_dir, exist_ok=True)
        logger.info(f"Created database directory: {db_dir}")

def query_db(query, args=(), one=False):
    """Execute a query and fetch results"""
    try:
        conn = get_db()
        cur = conn.execute(query, args)
        rv = cur.fetchall()
        cur.close()
        return (rv[0] if rv else None) if one else rv
    except sqlite3.Error as e:
        logger.error(f"Database query error: {e}")
        # Return empty result instead of crashing
        return None if one else []

def get_db_structure():
    """Main function used by the web app - now uses simplified schema"""
    # First check if we have the new single-table schema
    try:
        tables = query_db("SELECT name FROM sqlite_master WHERE type='table' AND name='datasets'")
        if tables:
            # Check if it has the new structure (citation_authors column)
            columns = query_db("PRAGMA table_info(datasets)")
            column_names = [col['name'] for col in columns]
            
            if 'citation_authors' in column_names and 'superfamily_name' in column_names:
                # New single-table schema
                logger.info("Using new single-table schema")
                return get_db_structure_simple()
            else:
                # Old multi-table schema
                logger.info("Using old multi-table schema")
                return _get_db_structure_from_sqlite()
        else:
            # No datasets table - fallback to JSON
            logger.warning("No datasets table found, falling back to JSON")
            return _get_db_structure_from_json()
    except Exception as e:
        logger.error(f"Error detecting schema type: {e}")
        return _get_db_structure_from_json()

def get_db_structure_simple():
    """
    Get database structure from the simplified single-table schema
    Returns the same format as before for compatibility
    """
    try:
        datasets = query_db("SELECT * FROM datasets ORDER BY superfamily_name, name")
        
        if not datasets:
            logger.warning("No datasets found in database")
            return {"superfamilies": []}
        
        # Group datasets by superfamily
        superfamilies_dict = {}
        
        for dataset in datasets:
            sf_name = dataset['superfamily_name']
            
            if sf_name not in superfamilies_dict:
                # Parse HMM names from JSON
                try:
                    hmm_names = json.loads(dataset['superfamily_hmm_names'] or '[]')
                except:
                    hmm_names = []
                
                superfamilies_dict[sf_name] = {
                    'name': sf_name,
                    'hmm_name': hmm_names,
                    'datasets': []
                }
            
            # Parse metadata columns from JSON
            try:
                metadata_columns = json.loads(dataset['metadata_columns'] or '[]')
            except:
                metadata_columns = []
            
            # Parse citation authors from JSON
            try:
                citation_authors = json.loads(dataset['citation_authors'] or '[]')
            except:
                citation_authors = []
            
            # Build dataset info
            dataset_info = {
                'id': dataset['dataset_id'],
                'name': dataset['name'],
                'description': dataset['description'] or '',
                'tree': dataset['tree'] or '',
                'tree_model': dataset['tree_model'] or '',
                'metadata': dataset['metadata'] or '',
                'metadata_columns': metadata_columns,
                'alignment': dataset['alignment'] or '',
                'sequences': dataset['sequences'] or '',
                'source': dataset['source'] or '',
                'data_type': dataset['data_type'] or '',
                'reviewed': dataset['reviewed'] or '',
                'N_proteins': dataset['N_proteins'] or 0,
                'N_characterized': dataset['N_characterized'] or 0,
                'N_np_val': dataset['N_np_val'] or 0,
                'N_np_pred': dataset['N_np_pred'] or 0
            }
            
            # Add citation if available
            if citation_authors or dataset['citation_doi']:
                cite = {}
                if citation_authors:
                    # If only one author, store as string; if multiple, store as list
                    cite['name'] = citation_authors[0] if len(citation_authors) == 1 else citation_authors
                if dataset['citation_doi']:
                    cite['doi'] = dataset['citation_doi']
                dataset_info['cite'] = cite
            
            superfamilies_dict[sf_name]['datasets'].append(dataset_info)
        
        # Convert to list format
        superfamilies = list(superfamilies_dict.values())
        
        logger.info(f"Found {len(superfamilies)} superfamilies with {len(datasets)} total datasets")
        return {"superfamilies": superfamilies}
        
    except Exception as e:
        logger.error(f"Error getting database structure: {e}", exc_info=True)
        return {"superfamilies": []}

def refresh_db_structure():
    """Clear the cache to force refresh of the DB structure"""
    _get_db_structure_from_sqlite.cache_clear()

def print_database_structure():
    """Print the complete database structure in a readable format"""
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            
            # Get tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            
            for table in tables:
                table_name = table['name']
                print(f"\n=== TABLE: {table_name} ===")
                
                # Get schema
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()
                print(f"Columns ({len(columns)}):")
                for col in columns:
                    print(f"  - {col['name']} ({col['type']})")
                
                # Get row count
                cursor.execute(f"SELECT COUNT(*) as count FROM {table_name}")
                count = cursor.fetchone()['count']
                print(f"Row count: {count}")
                
                # Show sample data (up to 5 rows)
                if count > 0:
                    print(f"Sample data (up to 5 rows):")
                    cursor.execute(f"SELECT * FROM {table_name} LIMIT 5")
                    rows = cursor.fetchall()
                    
                    # Get max width for each column for pretty printing
                    max_widths = {}
                    for col in columns:
                        max_widths[col['name']] = len(col['name'])
                    
                    for row in rows:
                        for col in columns:
                            col_name = col['name']
                            val = str(row[col_name]) if row[col_name] is not None else "NULL"
                            max_widths[col_name] = max(max_widths[col_name], len(val))
                    
                    # Print header
                    header = " | ".join([col['name'].ljust(max_widths[col['name']]) for col in columns])
                    print("  " + header)
                    print("  " + "-" * len(header))
                    
                    # Print rows
                    for row in rows:
                        row_str = " | ".join([
                            str(row[col['name']]).ljust(max_widths[col['name']]) 
                            if row[col['name']] is not None else "NULL".ljust(max_widths[col['name']])
                            for col in columns
                        ])
                        print("  " + row_str)
            
            return True
    except Exception as e:
        logger.error(f"Error printing database structure: {e}", exc_info=True)
        print(f"Error: {e}")
        return False

def search_superfamilies(search_term, exact=False):
    """
    Search for superfamilies by name or description
    
    Args:
        search_term (str): Term to search for
        exact (bool): If True, search for exact match; otherwise use LIKE
        
    Returns:
        list: Matching superfamilies
    """
    try:
        search = search_term
        
        if not exact:
            search = f"%{search_term}%"
            query = """
                SELECT id, name, description
                FROM superfamilies 
                WHERE name LIKE ? OR description LIKE ?
            """
            params = [search, search]
        else:
            query = """
                SELECT id, name, description
                FROM superfamilies 
                WHERE name = ? OR description = ?
            """
            params = [search_term, search_term]
            
        superfamilies = query_db(query, params)
        
        if not superfamilies:
            logger.info(f"No superfamilies found matching '{search_term}'")
            return []
            
        logger.info(f"Found {len(superfamilies)} superfamilies matching '{search_term}'")
        return superfamilies
    
    except Exception as e:
        logger.error(f"Error searching superfamilies: {e}", exc_info=True)
        return []

def get_datasets_for_superfamily(superfamily_id_or_name):
    """
    Get all datasets for a given superfamily
    
    Args:
        superfamily_id_or_name: Either superfamily ID (int) or name (str)
        
    Returns:
        list: Datasets for the superfamily
    """
    try:
        # Check if we got an ID or a name
        if isinstance(superfamily_id_or_name, int) or (
            isinstance(superfamily_id_or_name, str) and superfamily_id_or_name.isdigit()
        ):
            # It's an ID
            query = """
                SELECT d.*, s.name as superfamily_name
                FROM datasets d
                JOIN superfamilies s ON d.superfamily_id = s.id
                WHERE s.id = ?
            """
            params = [superfamily_id_or_name]
        else:
            # It's a name
            query = """
                SELECT d.*, s.name as superfamily_name
                FROM datasets d
                JOIN superfamilies s ON d.superfamily_id = s.id
                WHERE s.name LIKE ?
            """
            params = [f"%{superfamily_id_or_name}%"]
        
        datasets = query_db(query, params)
        
        if not datasets:
            logger.info(f"No datasets found for superfamily '{superfamily_id_or_name}'")
            return []
            
        # For each dataset, get metadata columns
        for dataset in datasets:
            columns_query = """
                SELECT column_name 
                FROM metadata_columns 
                WHERE dataset_id = ? 
                ORDER BY display_order
            """
            columns = query_db(columns_query, [dataset['id']])
            dataset['metadata_columns'] = [col['column_name'] for col in columns]
            
            # Get citations
            citations_query = """
                SELECT author_name, doi
                FROM citations
                WHERE dataset_id = ?
            """
            citations = query_db(citations_query, [dataset['id']])
            if citations:
                dataset['citations'] = citations
        
        logger.info(f"Found {len(datasets)} datasets for superfamily '{superfamily_id_or_name}'")
        return datasets
    
    except Exception as e:
        logger.error(f"Error getting datasets for superfamily: {e}", exc_info=True)
        return []

def find_dataset_by_name(dataset_name, exact=False):
    """
    Find datasets by name
    
    Args:
        dataset_name (str): Dataset name to search for
        exact (bool): If True, search for exact match; otherwise use LIKE
        
    Returns:
        list: Matching datasets
    """
    try:
        if not exact:
            query = """
                SELECT d.*, s.name as superfamily_name
                FROM datasets d
                JOIN superfamilies s ON d.superfamily_id = s.id
                WHERE d.name LIKE ?
            """
            params = [f"%{dataset_name}%"]
        else:
            query = """
                SELECT d.*, s.name as superfamily_name
                FROM datasets d
                JOIN superfamilies s ON d.superfamily_id = s.id
                WHERE d.name = ?
            """
            params = [dataset_name]
        
        datasets = query_db(query, params)
        
        if not datasets:
            logger.info(f"No datasets found matching '{dataset_name}'")
            return []
            
        # For each dataset, get metadata columns
        for dataset in datasets:
            columns_query = """
                SELECT column_name 
                FROM metadata_columns 
                WHERE dataset_id = ? 
                ORDER BY display_order
            """
            columns = query_db(columns_query, [dataset['id']])
            dataset['metadata_columns'] = [col['column_name'] for col in columns]
            
            # Get citations
            citations_query = """
                SELECT author_name, doi
                FROM citations
                WHERE dataset_id = ?
            """
            citations = query_db(citations_query, [dataset['id']])
            if citations:
                dataset['citations'] = citations
        
        logger.info(f"Found {len(datasets)} datasets matching '{dataset_name}'")
        return datasets
    
    except Exception as e:
        logger.error(f"Error finding datasets: {e}", exc_info=True)
        return []

def export_database_as_json(output_file=None):
    """
    Export the entire database as a JSON file using the old format
    
    Args:
        output_file (str): Path to output JSON file. If None, a default path is used.
        
    Returns:
        str: Path to the output file
    """
    try:
        if output_file is None:
            output_file = os.path.join('/home/phylonapadm/PhyloNaP/logs', f"db_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        
        # Get the structure in the old format
        db_structure = get_db_structure()
        
        # Write it to a file
        with open(output_file, 'w') as f:
            json.dump(db_structure, f, indent=2)
            
        logger.info(f"Exported database to {output_file}")
        return output_file
    
    except Exception as e:
        logger.error(f"Error exporting database: {e}", exc_info=True)
        return None

def populate_test_data():
    """
    Populate the database with some test data - useful for development
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if database already has data
        cursor.execute("SELECT COUNT(*) as count FROM superfamilies")
        if cursor.fetchone()['count'] > 0:
            logger.warning("Database already contains data. Not adding test data.")
            return False
        
        # Add a few superfamilies
        superfamilies = [
            ("Flavin-dependent oxidoreductase", "Family of enzymes that use flavin as a cofactor"),
            ("Glycoside Hydrolase", "Family of enzymes that catalyze the hydrolysis of glycosidic bonds"),
            ("Glycosyltransferase", "Family of enzymes that catalyze the transfer of sugar moieties"),
        ]
        
        for name, description in superfamilies:
            cursor.execute(
                "INSERT INTO superfamilies (name, description) VALUES (?, ?)",
                (name, description)
            )
            sf_id = cursor.lastrowid
            
            # Add HMM names
            hmm_names = [f"{name.replace(' ', '_')}_HMM1", f"{name.replace(' ', '_')}_HMM2"]
            for hmm_name in hmm_names:
                cursor.execute(
                    "INSERT INTO superfamily_hmms (superfamily_id, hmm_name) VALUES (?, ?)",
                    (sf_id, hmm_name)
                )
            
            # Add datasets
            for i in range(1, 4):
                dataset_id = f"{name.replace(' ', '_')}_{i:03d}"
                dataset_name = f"{name} Dataset {i}"
                description = f"Test dataset {i} for {name}"
                
                # Alternate sources and types for diversity
                source = "curated" if i % 2 == 0 else "automatic"
                data_type = "protein" if i % 2 == 0 else "nucleotide"
                reviewed = "yes" if i % 3 == 0 else "no"
                
                cursor.execute("""
                INSERT INTO datasets (
                    dataset_id, superfamily_id, name, description, 
                    tree, metadata, alignment, sequences, source, data_type, reviewed,
                    N_proteins, N_characterized, N_np_val, N_np_pred
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    dataset_id, sf_id, dataset_name, description,
                    f"trees/{dataset_id}_tree.nwk",
                    f"metadata/{dataset_id}_metadata.tsv",
                    f"alignments/{dataset_id}_alignment.fasta",
                    f"sequences/{dataset_id}_sequences.fasta",
                    source, data_type, reviewed,
                    100 + i * 10, 50 + i * 5, 20 + i * 2, 10 + i
                ))
                
                dataset_db_id = cursor.lastrowid
                
                # Add metadata columns
                metadata_columns = ["protein_id", "sequence", "function", "source", "taxonomic_group"]
                for idx, column in enumerate(metadata_columns):
                    cursor.execute("""
                    INSERT INTO metadata_columns (dataset_id, column_name, display_order)
                    VALUES (?, ?, ?)
                    """, (dataset_db_id, column, idx))
                
                # Add citation
                cursor.execute("""
                INSERT INTO citations (dataset_id, author_name, doi)
                VALUES (?, ?, ?)
                """, (dataset_db_id, f"Author et al., 202{i}", f"10.1234/{name.lower().replace(' ', '')}.{i}"))
        
        conn.commit()
        logger.info("Added test data to database")
        return True
        
    except Exception as e:
        logger.error(f"Error adding test data: {e}", exc_info=True)
        if 'conn' in locals() and conn:
            conn.rollback()
        return False

# Update the main get_db_structure function to use the new implementation
def get_db_structure():
    """Main function used by the web app - now uses simplified schema"""
    # First check if we have the new single-table schema
    try:
        tables = query_db("SELECT name FROM sqlite_master WHERE type='table' AND name='datasets'")
        if tables:
            # Check if it has the new structure (citation_authors column)
            columns = query_db("PRAGMA table_info(datasets)")
            column_names = [col['name'] for col in columns]
            
            if 'citation_authors' in column_names and 'superfamily_name' in column_names:
                # New single-table schema
                logger.info("Using new single-table schema")
                return get_db_structure_simple()
            else:
                # Old multi-table schema
                logger.info("Using old multi-table schema")
                return _get_db_structure_from_sqlite()
        else:
            # No datasets table - fallback to JSON
            logger.warning("No datasets table found, falling back to JSON")
            return _get_db_structure_from_json()
    except Exception as e:
        logger.error(f"Error detecting schema type: {e}")
        return _get_db_structure_from_json()

def export_database_as_json(output_file=None):
    """
    Export the entire database as a JSON file using the old format
    
    Args:
        output_file (str): Path to output JSON file. If None, a default path is used.
        
    Returns:
        str: Path to the output file
    """
    try:
        if output_file is None:
            output_file = os.path.join('/home/phylonapadm/PhyloNaP/logs', f"db_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        
        # Get the structure in the old format
        db_structure = get_db_structure()
        
        # Write it to a file
        with open(output_file, 'w') as f:
            json.dump(db_structure, f, indent=2)
            
        logger.info(f"Exported database to {output_file}")
        return output_file
    
    except Exception as e:
        logger.error(f"Error exporting database: {e}", exc_info=True)
        return None

# Add a function to migrate from old schema to new schema
def migrate_to_single_table():
    """Migrate from old multi-table schema to new single-table schema"""
    try:
        # Check if we already have the new schema
        tables = query_db("SELECT name FROM sqlite_master WHERE type='table'")
        table_names = [t['name'] for t in tables]
        
        if 'datasets' in table_names:
            columns = query_db("PRAGMA table_info(datasets)")
            column_names = [col['name'] for col in columns]
            
            if 'citation_authors' in column_names and 'superfamily_name' in column_names:
                logger.info("Database already uses new single-table schema")
                return True
        
        # We need to migrate - export current data to JSON first
        logger.info("Migrating to single-table schema...")
        
        # Export current structure
        current_structure = _get_db_structure_from_sqlite()
        
        # Backup current database
        backup_file = f"{current_app.config['SQLITE_DB']}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        import shutil
        shutil.copy2(current_app.config['SQLITE_DB'], backup_file)
        logger.info(f"Created backup at {backup_file}")
        
        # Create new schema
        conn = get_db()
        cursor = conn.cursor()
        
        # Drop old tables
        cursor.execute("DROP TABLE IF EXISTS citations")
        cursor.execute("DROP TABLE IF EXISTS metadata_columns")
        cursor.execute("DROP TABLE IF EXISTS datasets")
        cursor.execute("DROP TABLE IF EXISTS superfamily_hmms")
        cursor.execute("DROP TABLE IF EXISTS superfamilies")
        
        # Create new single table
        cursor.execute('''
        CREATE TABLE datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id TEXT UNIQUE NOT NULL,
            superfamily_name TEXT NOT NULL,
            superfamily_hmm_names TEXT,
            name TEXT NOT NULL,
            description TEXT,
            tree TEXT,
            tree_model TEXT,
            metadata TEXT,
            metadata_columns TEXT,
            alignment TEXT,
            sequences TEXT,
            source TEXT,
            data_type TEXT,
            reviewed TEXT,
            N_proteins INTEGER DEFAULT 0,
            N_characterized INTEGER DEFAULT 0,
            N_np_val INTEGER DEFAULT 0,
            N_np_pred INTEGER DEFAULT 0,
            citation_authors TEXT,
            citation_doi TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        # Create indexes
        cursor.execute("CREATE INDEX idx_superfamily_name ON datasets (superfamily_name)")
        cursor.execute("CREATE INDEX idx_source ON datasets (source)")
        cursor.execute("CREATE INDEX idx_dataset_id ON datasets (dataset_id)")
        
        # Migrate data
        for superfamily in current_structure.get('superfamilies', []):
            sf_name = superfamily['name']
            hmm_names = json.dumps(superfamily.get('hmm_name', []))
            
            for dataset in superfamily.get('datasets', []):
                # Extract citation info
                cite = dataset.get('cite', {})
                if cite:
                    citation_name = cite.get('name', '')
                    if isinstance(citation_name, str):
                        citation_authors = json.dumps([citation_name]) if citation_name else json.dumps([])
                    elif isinstance(citation_name, list):
                        citation_authors = json.dumps(citation_name)
                    else:
                        citation_authors = json.dumps([])
                    citation_doi = cite.get('doi', '')
                else:
                    citation_authors = json.dumps([])
                    citation_doi = ''
                
                # Insert dataset
                cursor.execute('''
                INSERT INTO datasets (
                    dataset_id, superfamily_name, superfamily_hmm_names, name, 
                    description, tree, tree_model, metadata, metadata_columns,
                    alignment, sequences, source, data_type, reviewed,
                    N_proteins, N_characterized, N_np_val, N_np_pred,
                    citation_authors, citation_doi
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    dataset.get('id', ''),
                    sf_name,
                    hmm_names,
                    dataset.get('name', ''),
                    dataset.get('description', ''),
                    dataset.get('tree', ''),
                    dataset.get('tree_model', ''),
                    dataset.get('metadata', ''),
                    json.dumps(dataset.get('metadata_columns', [])),
                    dataset.get('alignment', ''),
                    dataset.get('sequences', ''),
                    dataset.get('source', ''),
                    dataset.get('data_type', ''),
                    dataset.get('reviewed', ''),
                    dataset.get('N_proteins', 0),
                    dataset.get('N_characterized', 0),
                    dataset.get('N_np_val', 0),
                    dataset.get('N_np_pred', 0),
                    citation_authors,
                    citation_doi
                ))
        
        conn.commit()
        
        # Clear cache
        refresh_db_structure()
        
        logger.info("Successfully migrated to single-table schema")
        return True
        
    except Exception as e:
        logger.error(f"Error migrating to single-table schema: {e}", exc_info=True)
        return False

def filter_datasets(superfamily=None, source=None, min_proteins=0, max_proteins=None, 
                   hmm_name=None, dataset_name=None, reviewed=None, data_type=None,
                   min_characterized=0, max_characterized=None,
                   min_np_val=0, max_np_val=None,
                   min_np_pred=0, max_np_pred=None,
                   sort_by=None, sort_order=None,
                   limit=50000, offset=0):
    """
    Filter and sort datasets based on various criteria with multi-parameter sorting
    
    Args:
        superfamily (str): Filter by superfamily name (partial match)
        source (str): Filter by source ("curated", "automatic")
        min_proteins (int): Minimum number of proteins
        max_proteins (int): Maximum number of proteins
        hmm_name (str): Filter by HMM name (searches in JSON array)
        dataset_name (str): Filter by dataset name (partial match)
        reviewed (str): Filter by reviewed status ("yes", "no")
        data_type (str): Filter by data type ("protein", "nucleotide")
        min_characterized (int): Minimum number of characterized proteins
        max_characterized (int): Maximum number of characterized proteins
        min_np_val (int): Minimum number of NP validated proteins
        max_np_val (int): Maximum number of NP validated proteins
        min_np_pred (int): Minimum number of NP predicted proteins
        max_np_pred (int): Maximum number of NP predicted proteins
        sort_by (str or list): Field(s) to sort by. Can be:
            - Single field: "superfamily_name"
            - Multiple fields: ["superfamily_name", "N_proteins", "name"]
        sort_order (str or list): Sort order(s). Can be:
            - Single order: "asc" or "desc"
            - Multiple orders: ["asc", "desc", "asc"] (must match sort_by length)
            - If single order provided for multiple fields, applies to all
        limit (int): Maximum number of results to return
        offset (int): Number of results to skip (for pagination)
    
    Returns:
        dict: {'datasets': [...], 'total_count': int, 'filters_applied': {...}}
    """
    try:
        # Normalize sort parameters
        if sort_by is None:
            sort_by = ['superfamily_name', 'name']  # Default sorting
            sort_order = ['asc', 'asc']
        elif isinstance(sort_by, str):
            sort_by = [sort_by]
            if sort_order is None:
                sort_order = ['asc']
            elif isinstance(sort_order, str):
                sort_order = [sort_order]
        
        # If sort_order is shorter than sort_by, extend with the last value
        if len(sort_order) < len(sort_by):
            last_order = sort_order[-1] if sort_order else 'asc'
            sort_order.extend([last_order] * (len(sort_by) - len(sort_order)))
        
        # Build WHERE clause (filtering logic - unchanged)
        where_conditions = []
        params = []
        
        if superfamily:
            where_conditions.append("superfamily_name LIKE ?")
            params.append(f"%{superfamily}%")
        
        if source:
            where_conditions.append("source = ?")
            params.append(source)
        
        if min_proteins > 0:
            where_conditions.append("N_proteins >= ?")
            params.append(min_proteins)
        
        if max_proteins is not None:
            where_conditions.append("N_proteins <= ?")
            params.append(max_proteins)
        
        if min_characterized > 0:
            where_conditions.append("N_characterized >= ?")
            params.append(min_characterized)
        
        if max_characterized is not None:
            where_conditions.append("N_characterized <= ?")
            params.append(max_characterized)
        
        if min_np_val > 0:
            where_conditions.append("N_np_val >= ?")
            params.append(min_np_val)
        
        if max_np_val is not None:
            where_conditions.append("N_np_val <= ?")
            params.append(max_np_val)
        
        if min_np_pred > 0:
            where_conditions.append("N_np_pred >= ?")
            params.append(min_np_pred)
        
        if max_np_pred is not None:
            where_conditions.append("N_np_pred <= ?")
            params.append(max_np_pred)
        
        if hmm_name:
            where_conditions.append("superfamily_hmm_names LIKE ?")
            params.append(f"%{hmm_name}%")
        
        if dataset_name:
            where_conditions.append("name LIKE ?")
            params.append(f"%{dataset_name}%")
        
        if reviewed:
            where_conditions.append("reviewed = ?")
            params.append(reviewed)
        
        if data_type:
            where_conditions.append("data_type = ?")
            params.append(data_type)
        
        # Build query
        where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
        
        # Build multi-parameter ORDER BY clause
        sql_sort_fields = {
            'superfamily_name': 'superfamily_name',
            'dataset_name': 'name',
            'name': 'name',
            'N_proteins': 'N_proteins',
            'N_characterized': 'N_characterized',
            'N_np_val': 'N_np_val',
            'N_np_pred': 'N_np_pred',
            'created_at': 'created_at',
            'source': 'source',
            'reviewed': 'reviewed',
            'data_type': 'data_type'
        }
        
        order_clauses = []
        python_sort_needed = False
        
        for i, field in enumerate(sort_by):
            direction = "DESC" if sort_order[i].lower() == 'desc' else "ASC"
            
            if field in sql_sort_fields:
                # Can be sorted at SQL level
                order_clauses.append(f"{sql_sort_fields[field]} {direction}")
            elif field == 'hmm_names':
                # Needs Python-level sorting
                python_sort_needed = True
            else:
                logger.warning(f"Unknown sort field: {field}")
        
        # Build ORDER BY clause
        if order_clauses:
            order_clause = "ORDER BY " + ", ".join(order_clauses)
        else:
            order_clause = "ORDER BY superfamily_name, name"  # Fallback
        
        # Get total count
        count_query = f"SELECT COUNT(*) as total FROM datasets WHERE {where_clause}"
        total_result = query_db(count_query, params, one=True)
        total_count = total_result['total'] if total_result else 0
        
        # Get filtered datasets
        main_query = f"""
            SELECT * FROM datasets 
            WHERE {where_clause}
            {order_clause}
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        
        datasets = query_db(main_query, params)
        
        # Convert datasets to the expected format
        result_datasets = []
        for dataset in datasets:
            # Parse JSON fields
            try:
                hmm_names = json.loads(dataset['superfamily_hmm_names'] or '[]')
                metadata_columns = json.loads(dataset['metadata_columns'] or '[]')
                citation_authors = json.loads(dataset['citation_authors'] or '[]')
            except:
                hmm_names = []
                metadata_columns = []
                citation_authors = []
            
            dataset_dict = {
                'id': dataset['dataset_id'],
                'name': dataset['name'],
                'description': dataset['description'] or '',
                'superfamily_name': dataset['superfamily_name'],
                'superfamily_hmm_names': hmm_names,
                'tree': dataset['tree'] or '',
                'tree_model': dataset['tree_model'] or '',
                'metadata': dataset['metadata'] or '',
                'metadata_columns': metadata_columns,
                'alignment': dataset['alignment'] or '',
                'sequences': dataset['sequences'] or '',
                'source': dataset['source'] or '',
                'data_type': dataset['data_type'] or '',
                'reviewed': dataset['reviewed'] or '',
                'N_proteins': dataset['N_proteins'] or 0,
                'N_characterized': dataset['N_characterized'] or 0,
                'N_np_val': dataset['N_np_val'] or 0,
                'N_np_pred': dataset['N_np_pred'] or 0
            }
            
            # Add citation if available
            if citation_authors or dataset['citation_doi']:
                cite = {}
                if citation_authors:
                    cite['name'] = citation_authors[0] if len(citation_authors) == 1 else citation_authors
                if dataset['citation_doi']:
                    cite['doi'] = dataset['citation_doi']
                dataset_dict['cite'] = cite
            
            result_datasets.append(dataset_dict)
        
        # Apply Python-level multi-parameter sorting if needed
        if python_sort_needed and 'hmm_names' in sort_by:
            result_datasets = multi_sort_datasets(result_datasets, sort_by, sort_order)
        
        return {
            'datasets': result_datasets,
            'total_count': total_count,
            'filters_applied': {
                'superfamily': superfamily,
                'source': source,
                'min_proteins': min_proteins,
                'max_proteins': max_proteins,
                'min_characterized': min_characterized,
                'max_characterized': max_characterized,
                'min_np_val': min_np_val,
                'max_np_val': max_np_val,
                'min_np_pred': min_np_pred,
                'max_np_pred': max_np_pred,
                'hmm_name': hmm_name,
                'dataset_name': dataset_name,
                'reviewed': reviewed,
                'data_type': data_type,
                'sort_by': sort_by,
                'sort_order': sort_order
            },
            'pagination': {
                'limit': limit,
                'offset': offset,
                'has_more': offset + len(result_datasets) < total_count
            }
        }
        
    except Exception as e:
        logger.error(f"Error filtering datasets: {e}", exc_info=True)
        return {'datasets': [], 'total_count': 0, 'filters_applied': {}, 'pagination': {}}

def multi_sort_datasets(datasets, sort_by, sort_order):
    """
    Sort datasets by multiple criteria using Python
    
    Args:
        datasets (list): List of dataset dictionaries
        sort_by (list): List of field names to sort by
        sort_order (list): List of sort orders ('asc' or 'desc')
    
    Returns:
        list: Sorted datasets
    """
    try:
        if not datasets or not sort_by:
            return datasets
        
        def multi_key_function(dataset):
            """Generate a tuple of sort keys for the dataset"""
            keys = []
            
            for i, field in enumerate(sort_by):
                reverse = sort_order[i].lower() == 'desc'
                
                if field == 'superfamily_name':
                    key = (dataset.get('superfamily_name', '') or '').lower()
                elif field in ['dataset_name', 'name']:
                    key = (dataset.get('name', '') or '').lower()
                elif field == 'hmm_names':
                    hmm_names = dataset.get('superfamily_hmm_names', [])
                    if hmm_names and isinstance(hmm_names, list):
                        key = hmm_names[0].lower()
                    else:
                        key = ''
                elif field in ['N_proteins', 'N_characterized', 'N_np_val', 'N_np_pred']:
                    key = dataset.get(field, 0) or 0
                elif field in ['source', 'reviewed', 'data_type']:
                    key = (dataset.get(field, '') or '').lower()
                elif field == 'created_at':
                    key = dataset.get('created_at', '') or ''
                else:
                    key = ''
                
                # For descending order, negate numeric values or reverse strings
                if reverse:
                    if isinstance(key, (int, float)):
                        key = -key
                    elif isinstance(key, str):
                        # For strings, we'll handle reversal in the final sort
                        pass
                
                keys.append((key, reverse))
            
            return keys
        
        # Custom comparison function for mixed types with reverse handling
        def compare_keys(item):
            keys = multi_key_function(item)
            result = []
            for key, reverse in keys:
                if isinstance(key, str) and reverse:
                    # For reversed string sorting, we need to transform the string
                    result.append(''.join(chr(255 - ord(c)) for c in key))
                else:
                    result.append(key)
            return tuple(result)
        
        return sorted(datasets, key=compare_keys)
        
    except Exception as e:
        logger.error(f"Error in multi-sort: {e}", exc_info=True)
        return datasets
def sqlite3_row_factory(cursor, row):
    """Custom row factory to handle JSON parsing for specific columns"""
    try:
        # Get column names
        column_names = [description[0] for description in cursor.description]
        
        # Convert row to dictionary
        row_dict = dict(zip(column_names, row))
        
        # Parse JSON columns
        json_columns = ['superfamily_hmm_names', 'metadata_columns', 'citation_authors']
        for json_col in json_columns:
            if json_col in row_dict and row_dict[json_col] is not None:
                try:
                    # Try parsing JSON
                    row_dict[json_col] = json.loads(row_dict[json_col])
                except:
                    # If parsing fails, keep original string
                    pass
        
        return row_dict
    except Exception as e:
        logger.error(f"Error in row factory: {e}", exc_info=True)
        return row

# Update the database initialization to use the custom row factory
def get_db():
    """Get database connection"""
    db = getattr(g, '_database', None)
    if db is None:
        db_path = current_app.config.get('SQLITE_DB')
        logger.debug(f"Opening database connection to: {db_path}")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        db = g._database = sqlite3.connect(db_path)
        db.row_factory = sqlite3_row_factory  # Use custom row factory
        
        # Check if database is initialized
        if not is_db_initialized(db):
            logger.warning("Database not initialized. Creating schema and loading from JSON.")
            initialize_db_from_json(db)
            
    return db