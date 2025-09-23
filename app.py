# app.py
import sys
import uuid
import subprocess
import queue
import threading
from datetime import datetime
import time

from flask import Flask, render_template, request, redirect, url_for, Response, session, jsonify
from flask import send_from_directory
from werkzeug.utils import secure_filename
import os
import json
import pandas as pd
import ast
from flask_socketio import SocketIO, emit
import logging
import string
import random
import re
from Bio import SeqIO
from io import StringIO
import logging

cache = {}

from logging.handlers import RotatingFileHandler

# Setup logging configuration
def setup_app_logging():
    # Create logs directory if it doesn't exist
    script_dir = os.path.dirname(os.path.abspath(__file__))
    log_dir = os.path.join(script_dir, '..', 'logs')
    log_dir = os.path.abspath(log_dir)  # Normalize the path
    os.makedirs(log_dir, exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    
    # Only configure if not already configured
    if not root_logger.handlers:
        # Set global log level
        root_logger.setLevel(logging.INFO)
        
        # Create rotating file handler for app logs
        file_handler = RotatingFileHandler(
            os.path.join(log_dir, 'app.log'),
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        
        # Log format
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        file_handler.setFormatter(formatter)
        
        # Add handler to root logger
        root_logger.addHandler(file_handler)
        
        # Also add console handler for development
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
        
        # Setup specific loggers
        db_logger = logging.getLogger('phylonap.db')
        db_logger.setLevel(logging.DEBUG)
        
        # Add specific file for database operations
        db_file_handler = RotatingFileHandler(
            os.path.join(log_dir, 'database.log'),
            maxBytes=5*1024*1024,  # 5MB
            backupCount=3
        )
        db_file_handler.setFormatter(formatter)
        db_logger.addHandler(db_file_handler)
    
    return root_logger

def create_app():
    """Application factory function"""
    flask_app = Flask(__name__)
    print("FLASK APP STARTED")
    
    # Setup logging first
    setup_app_logging()
    logger = logging.getLogger('phylonap')
    logger.info("PhyloNaP application starting")
    
    try:
        # Load configuration - KEEP YOUR ORIGINAL METHOD
        flask_app.config.from_pyfile("config_update.py")

        
        # Validate required directories
        database_dir = flask_app.config['DB_DIR']
        if not os.path.exists(database_dir):
            raise Exception(f"Database directory does not exist: {database_dir}")
        
        tmp_directory = flask_app.config["TMP_DIRECTORY"]
        if not os.path.exists(tmp_directory):
            raise Exception(f"Temporary directory does not exist: {tmp_directory}")
        
        print(f"\n\n\nresults dir = {tmp_directory}\n\n\n")
        
        # Store directories in app config for access in routes
        flask_app.config['DATABASE_DIR'] = database_dir
        flask_app.config['TMP_DIR'] = tmp_directory
        
        # Initialize SocketIO
        socketio = SocketIO(flask_app)
        flask_app.socketio = socketio
        
        # Job queue variables
        flask_app.job_queue = queue.Queue()
        flask_app.active_jobs = {}
        flask_app.queued_jobs = []
        flask_app.max_concurrent_jobs = 1
        flask_app.queue_lock = threading.Lock()
        flask_app.cache = {}
        

        
        # Global cache for the db_structure
        flask_app.DB_STRUCTURE = None
        
        # Import and register database functions AFTER app creation
        try:
            from .db import (
                init_app, get_db_structure, refresh_db_structure, 
                filter_datasets, get_filter_options, get_dataset_by_id, get_db_structure
            )
            init_app(flask_app)
            logger.info("Database functions imported and initialized successfully")
            
            # Test database connection immediately
            with flask_app.app_context():
                try:
                    from .db import query_db
                    test_result = query_db("SELECT COUNT(*) as count FROM datasets", one=True)
                    dataset_count = test_result['count'] if test_result else 0
                    logger.info(f"Database connection successful: {dataset_count:,} datasets found")
                except Exception as e:
                    logger.warning(f"Database test failed: {e}, but continuing...")
            
        except ImportError as e:
            logger.error(f"Failed to import database functions: {e}")
            # Provide fallback functions
            def get_db_structure(): 
                return {'superfamilies': []}
            def filter_datasets(**kwargs): 
                return {'datasets': [], 'total_count': 0, 'filters_applied': {}}
            def get_filter_options(): 
                return {
                    'superfamilies': [],
                    'sources': [],
                    'data_types': [],
                    'reviewed_options': ['yes', 'no'],
                    'dataset_names': [],
                    'hmm_names': []
                }
            def get_dataset_by_id(dataset_id):
                return None
        
        # Register routes
        register_routes(flask_app)
        register_socketio_events(flask_app.socketio, flask_app)
        
        # Initialize database structure in app context
        with flask_app.app_context():
            try:
                flask_app.DB_STRUCTURE = get_db_structure()
                logger.info(f"Database loaded with {len(flask_app.DB_STRUCTURE.get('superfamilies', []))} superfamilies")
            except Exception as e:
                logger.error(f"Error loading database structure: {e}")
                flask_app.DB_STRUCTURE = {'superfamilies': []}
        
        # Start job processing
        start_job_processing(flask_app)
        
        return flask_app
        
    except Exception as e:
        logger.error(f"Error creating Flask app: {e}", exc_info=True)
        raise

def register_routes(app):
    """Register all Flask routes"""
    
    @app.route('/')
    def home():
        return render_template('home.html')
    @app.route('/download')
    def download():
        try:
            download_path = app.config.get('DOWNLOAD_FILE')
            if download_path and os.path.exists(download_path):
                # Get file size in a readable format
                file_size = os.path.getsize(download_path)
                if file_size > 1024**3:  # GB
                    file_size_str = f"{file_size / (1024**3):.1f} GB"
                elif file_size > 1024**2:  # MB
                    file_size_str = f"{file_size / (1024**2):.1f} MB"
                else:  # KB
                    file_size_str = f"{file_size / 1024:.1f} KB"
            else:
                file_size_str = None
        except Exception as e:
            app.logger.error(f"Error getting download path: {e}", exc_info=True)
            download_path = None
            file_size_str = None

        return render_template('download.html', 
                        download_path=download_path,
                        file_size=file_size_str)

    @app.route('/download_file')
    def download_file():
        """Actual file download endpoint"""
        try:
            download_path = app.config.get('DOWNLOAD_FILE')
            if download_path and os.path.exists(download_path):
                directory = os.path.dirname(download_path)
                filename = os.path.basename(download_path)
                return send_from_directory(directory, filename, as_attachment=True)
            else:
                return "File not found", 404
        except Exception as e:
            app.logger.error(f"Error downloading file: {e}", exc_info=True)
            return "Download error", 500

    @app.route('/analyse')
    def analyse():
        return render_template('analyse.html')

    @app.route('/help')
    def help_page():
        return render_template('help.html')

    @app.route('/api/datasets')
    def api_datasets():
        """API endpoint to get paginated dataset data"""
        try:
            from .db import filter_datasets
            
            # Get pagination parameters
            page = request.args.get('page', 1, type=int)
            per_page = min(request.args.get('per_page', 25, type=int), 100)
            offset = (page - 1) * per_page
            
            # Get filter parameters - FIXED: Pass individual parameters, not a dict
            hmm_name = request.args.get('hmm_name', '').strip()
            source = request.args.get('source', '').strip()
            data_type = request.args.get('data_type', '').strip()
            reviewed = request.args.get('reviewed', '').strip()
            dataset_name = request.args.get('dataset_name', '').strip()
            superfamily = request.args.get('superfamily', '').strip()
            
            # Numeric filters
            min_proteins = request.args.get('min_proteins', 0, type=int)
            max_proteins = request.args.get('max_proteins', type=int)
            min_characterized = request.args.get('min_characterized', 0, type=int)
            max_characterized = request.args.get('max_characterized', type=int)
            min_np_val = request.args.get('min_np_val', 0, type=int)
            max_np_val = request.args.get('max_np_val', type=int)
            min_np_pred = request.args.get('min_np_pred', 0, type=int)
            max_np_pred = request.args.get('max_np_pred', type=int)
            
            # Get sort parameters
            sort_by = request.args.get('sort_by', 'superfamily_name')
            sort_order = request.args.get('sort_order', 'asc')
            
            # Call filter_datasets with individual parameters (matching the function signature)
            result = filter_datasets(
                superfamily=superfamily if superfamily else None,
                source=source if source else None,
                min_proteins=min_proteins,
                max_proteins=max_proteins,
                hmm_name=hmm_name if hmm_name else None,  # This maps to the hmm_name parameter
                dataset_name=dataset_name if dataset_name else None,
                reviewed=reviewed if reviewed else None,
                data_type=data_type if data_type else None,
                min_characterized=min_characterized,
                max_characterized=max_characterized,
                min_np_val=min_np_val,
                max_np_val=max_np_val,
                min_np_pred=min_np_pred,
                max_np_pred=max_np_pred,
                sort_by=sort_by,
                sort_order=sort_order,
                limit=per_page,
                offset=offset
            )
            
            # Calculate pagination info
            total_count = result['total_count']
            total_pages = (total_count + per_page - 1) // per_page
            
            pagination = {
                'page': page,
                'per_page': per_page,
                'total_count': total_count,
                'total_pages': total_pages,
                'has_prev': page > 1,
                'has_next': page < total_pages,
                'showing_from': offset + 1 if total_count > 0 else 0,
                'showing_to': min(offset + per_page, total_count)
            }
            
            return jsonify({
                'datasets': result['datasets'],
                'pagination': pagination,
                'filters_applied': result.get('filters_applied', {})
            })
            
        except Exception as e:
            app.logger.error(f"Error in api_datasets: {e}", exc_info=True)
            return jsonify({'error': str(e)}), 500

    @app.route('/api/filter_options')
    
    def get_filter_options_api():
        from .db import get_filter_options
        try:
            # Get all possible filter parameters from request
            hmm_name = request.args.get('hmm_name')
            source = request.args.get('source')
            dataset_name = request.args.get('dataset_name')
            data_type = request.args.get('data_type')
            reviewed = request.args.get('reviewed')
            
            # Get numeric parameters
            min_proteins = request.args.get('min_proteins', type=int)
            max_proteins = request.args.get('max_proteins', type=int)
            min_characterized = request.args.get('min_characterized', type=int)
            max_characterized = request.args.get('max_characterized', type=int)
            min_np_val = request.args.get('min_np_val', type=int)
            max_np_val = request.args.get('max_np_val', type=int)
            min_np_pred = request.args.get('min_np_pred', type=int)
            max_np_pred = request.args.get('max_np_pred', type=int)
            
            # Call the updated function with all parameters
            options = get_filter_options(
                hmm_name=hmm_name,
                source=source,
                dataset_name=dataset_name,
                data_type=data_type,
                reviewed=reviewed,
                min_proteins=min_proteins,
                max_proteins=max_proteins,
                min_characterized=min_characterized,
                max_characterized=max_characterized,
                min_np_val=min_np_val,
                max_np_val=max_np_val,
                min_np_pred=min_np_pred,
                max_np_pred=max_np_pred
            )
            
            return jsonify(options)
            
        except Exception as e:
            logging.error(f"Error in filter options API: {e}", exc_info=True)
            return jsonify({'error': str(e)}), 500

    @app.route('/database')
    def database_page():
        """Database page - loads data via AJAX"""
        try:
            from .db import get_filter_options
            
            # Get filter options for initial page load
            filter_options = get_filter_options()
            
            # Get current filter/sort parameters for pre-populating form
            current_filters = {
                'hmm_names': request.args.get('hmm_names', ''),  # CHANGED: removed 'superfamily'
                'source': request.args.get('source', ''),
                'data_type': request.args.get('data_type', ''),
                'reviewed': request.args.get('reviewed', ''),
                'dataset_name': request.args.get('dataset_name', ''),
                'min_proteins': request.args.get('min_proteins', 0, type=int),
                'max_proteins': request.args.get('max_proteins', type=int),
                'min_characterized': request.args.get('min_characterized', 0, type=int),
                'max_characterized': request.args.get('max_characterized', type=int),
                'min_np_val': request.args.get('min_np_val', 0, type=int),
                'max_np_val': request.args.get('max_np_val', type=int),
                'min_np_pred': request.args.get('min_np_pred', 0, type=int),
                'max_np_pred': request.args.get('max_np_pred', type=int),
            }
            
            current_sort = {
                'sort_by': request.args.get('sort_by', 'superfamily_name'),
                'sort_order': request.args.get('sort_order', 'asc')
            }
            
            return render_template(
                'database.html',
                filter_options=filter_options,
                current_filters=current_filters,
                current_sort=current_sort,
                datasets=[],
                pagination=None
            )
            
        except Exception as e:
            app.logger.error(f"Error in database_page: {e}", exc_info=True)
            return render_template('database.html', 
                             filter_options={
                                 'superfamilies': [],
                                 'sources': [],
                                 'data_types': [],
                                 'reviewed_options': ['yes', 'no'],
                                 'dataset_names': [],
                                 'hmm_names': []
                             }, 
                             current_filters={}, 
                             current_sort={},
                             datasets=[], 
                             pagination=None)

    @app.route('/phylotree_render', methods=['POST','GET'])
    def tree_renderer():
        dataset_id = request.args.get('dataset_id')
        superfamilyName = request.args.get('superfamily')
        datasetName = request.args.get('dataset')
        
        app.logger.info(f"Tree render request - ID: '{dataset_id}', Superfamily: '{superfamilyName}', Dataset: '{datasetName}'")
        
        try:
            # Import database functions - ADD THIS LINE
            from .db import query_db,get_dataset_by_id
            
            dataset = None
            
            # Try ID-based lookup first (more reliable)
            if dataset_id:
                dataset = get_dataset_by_id(dataset_id)
                app.logger.debug(f"ID-based lookup for dataset_id={dataset_id}: {'Found' if dataset else 'Not found'}")
    
            # Fallback to name-based lookup
            if not dataset and superfamilyName and datasetName:
                dataset = query_db("""
                    SELECT * FROM datasets 
                    WHERE superfamily_name = ? AND name = ?
                """, (superfamilyName, datasetName), one=True)
                
                if dataset:
                    # Convert to the same format as get_dataset_by_id
                    dataset = get_dataset_by_id(dataset['dataset_id'])
                
                app.logger.debug(f"Name-based lookup for '{superfamilyName}'/'{datasetName}': {'Found' if dataset else 'Not found'}")
        
            # Validate we found a dataset
            if not dataset:
                if dataset_id:
                    error_msg = f"Dataset with ID '{dataset_id}' not found"
                elif superfamilyName and datasetName:
                    error_msg = f"Dataset '{datasetName}' not found in superfamily '{superfamilyName}'"
                else:
                    error_msg = "Missing dataset identification parameters"
                
                app.logger.error(error_msg)
                return render_template('error.html', error_message=error_msg), 404
            
            # Get file paths from the dataset record
            database_dir = app.config['DATABASE_DIR']
            tree_link = dataset['tree_file']
            metadata_link = dataset['metadata_file']
            metadata_columns = dataset['metadata_columns']
            datasetDescr = dataset['description']
            source = dataset['source']
            cite = dataset.get('cite', None)
            
            app.logger.debug(f"Found dataset: {dataset['dataset_name']} (ID: {dataset['id']})")
            app.logger.debug(f"Tree file: {tree_link}")
            app.logger.debug(f"Metadata file: {metadata_link}")
            
            if not tree_link:
                app.logger.error("No tree file path found in dataset")
                return render_template('error.html', 
                                 error_message="Dataset has no tree file information"), 404
            
            if not metadata_link:
                app.logger.error("No metadata file path found in dataset")
                return render_template('error.html', 
                                 error_message="Dataset has no metadata file information"), 404
            
            # Validate file paths
            tree_path = os.path.join(database_dir, tree_link)
            metadata_path = os.path.join(database_dir, metadata_link)
            
            if not os.path.exists(tree_path):
                app.logger.error(f"Tree file not found: {tree_path}")
                return render_template('error.html', 
                                 error_message=f"Tree file not found: {tree_link}"), 404
            
            if not os.path.exists(metadata_path):
                app.logger.error(f"Metadata file not found: {metadata_path}")
                return render_template('error.html', 
                                 error_message=f"Metadata file not found: {metadata_link}"), 404

            # Read tree content
            app.logger.info(f"Reading tree file: {tree_path}")
            with open(tree_path, 'r') as f:
                tree_content = f.read()
                
            app.logger.info(f"Tree content length: {len(tree_content)}")
            
            # Read metadata
            app.logger.info(f"Reading metadata file: {metadata_path}")
            df = pd.read_csv(metadata_path, sep='\t')
            metadata_json = df.to_json(orient='records')
            
            app.logger.info(f"Metadata loaded: {len(df)} rows, {len(df.columns)} columns")
            app.logger.debug(f"Metadata columns: {metadata_columns}")

            return render_template('phylotree_render.html', 
                             nwk_data=tree_content, 
                             metadata=metadata_json, 
                             metadata_list=metadata_columns, 
                             datasetDescr=datasetDescr,
                             superfamily_name=dataset['superfamily_name'],
                             dataset_name=dataset['dataset_name'],
                             source=source,
                             cite=cite)

        except Exception as e:
            app.logger.error(f"Error in tree_renderer: {e}", exc_info=True)
            return render_template('error.html', 
                             error_message=f"Error loading tree data: {str(e)}"), 500
    @app.route('/download/alignment/<dataset_id>')
    def download_alignment(dataset_id):
        try:
            from .db import get_dataset_by_id
            
            dataset = get_dataset_by_id(dataset_id)
            if not dataset:
                return "Dataset not found", 404
            
            alignment_file = dataset.get('alignment', '')
            if not alignment_file:
                return "No alignment file available for this dataset", 404
            
            database_dir = app.config['DATABASE_DIR']
            alignment_path = os.path.join(database_dir, alignment_file)
            
            if not os.path.exists(alignment_path):
                return "Alignment file not found", 404
            
            return send_from_directory(
                os.path.dirname(alignment_path),
                os.path.basename(alignment_path),
                as_attachment=True,
                download_name=f"{dataset_id}_alignment.fasta"
            )
            
        except Exception as e:
            app.logger.error(f"Error downloading alignment for {dataset_id}: {e}")
            return "Download error", 500
    @app.route('/download/sequences/<dataset_id>')
    def download_sequences(dataset_id):
        try:
            from .db import get_dataset_by_id
            
            dataset = get_dataset_by_id(dataset_id)
            if not dataset:
                return "Dataset not found", 404
            
            sequences_file = dataset.get('sequences', '')
            if not sequences_file:
                return "No sequences file available for this dataset", 404
            
            database_dir = app.config['DATABASE_DIR']
            sequences_path = os.path.join(database_dir, sequences_file)
            
            if not os.path.exists(sequences_path):
                return "Sequences file not found", 404
            
            return send_from_directory(
                os.path.dirname(sequences_path),
                os.path.basename(sequences_path),
                as_attachment=True,
                download_name=f"{dataset_id}_sequences.fasta"
            )
            
        except Exception as e:
            app.logger.error(f"Error downloading sequences for {dataset_id}: {e}")
            return "Download error", 500


    # Add other routes here...
    @app.route('/submit', methods=['POST'])
    def submit():
        # Check if a file was uploaded
        sequence = request.form['sequence']
        file = request.files.get('file')
        email = request.form.get('email', '').strip()

        if sequence == '' and (file is None or file.filename == ''):
            return 'No fasta sequence was uploaded', 400

        # Validate email format if provided (but don't require it)
        if email and not re.match(r"[^@]+@[^@]+\.[^@]+", email):
            return 'Invalid email address format', 400

        # Generate a unique job ID
        job_id = str(uuid.uuid4())
        print('Job ID:', job_id, flush=True)
        tmp_directory = app.config['TMP_DIR']
        os.makedirs(os.path.join(tmp_directory, job_id))
        
        # Create status file showing job is queued
        status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
        with open(status_file, 'w') as f:
            f.write('queued')
        
        # Process file or sequence
        if file and file.filename != '':
            filename = secure_filename(file.filename)
            file_path = os.path.join(tmp_directory, job_id, filename)
            file.save(file_path)
            print('File uploaded:', filename, flush=True)
            with open(file_path, 'r') as f:
                content = f.read()
            if not is_fasta(content):
                return 'Uploaded file is not a valid FASTA protein file', 400
        elif sequence != '':
            filename = 'sequence.fasta'
            if not is_fasta(sequence):
                return 'Pasted sequence is not a valid FASTA protein sequence', 400
            with open(os.path.join(tmp_directory, job_id, filename), 'w') as f:
                f.write(sequence)
        
        # Save metadata including email if provided
        metadata = {
            'filename': filename,
            'submission_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'email': email if email else None
        }
        
        metadata_file = os.path.join(tmp_directory, job_id, 'metadata.json')
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f)
        
        # Add job to queue and track it
        with app.queue_lock:
            app.queued_jobs.append((job_id, filename, datetime.now()))
            queue_position = len(app.queued_jobs)
            
            # Create log file with queue information
            log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
            with open(log_file, 'w') as f:
                f.write(f"Job {job_id} added to queue at position {queue_position} on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Current active jobs: {len(app.active_jobs)}/{app.max_concurrent_jobs}\n")
                f.write(f"Total jobs in queue: {len(app.queued_jobs)}\n")
                
                if queue_position > 1:
                    estimated_wait_minutes = (queue_position - 1) * 15
                    f.write(f"Estimated wait time: ~{estimated_wait_minutes} minutes\n")
                else:
                    f.write("Your job will start as soon as a processing slot is available.\n")
                
                if email:
                    f.write(f"Email notification will be sent to {email} when the job is completed.\n")

        return redirect(url_for('results', job_id=job_id))

    # Add other routes...
    @app.route('/results/<job_id>', methods=['GET'])
    def results(job_id):
        tmp_directory = app.config['TMP_DIR']
        status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
        log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
        summary_file = os.path.join(tmp_directory, job_id, 'summary.json')
        
        # Default values
        status = 'pending'
        log_content = []
        summary_data = None
        
        # Get current status
        if os.path.exists(status_file):
            with open(status_file, 'r') as f:
                status = f.read().strip()
        
        # Get log content
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                log_content = f.readlines()
                log_content = [line.strip() for line in log_content]
        
        # Get summary data if job is finished
        if status == 'finished' and os.path.exists(summary_file):
            try:
                with open(summary_file, 'r') as f:
                    summary_data = json.load(f)
            except json.JSONDecodeError:
                summary_data = None
        
        return render_template(
            'results.html', 
            job_id=job_id,
            status=status,
            log_content=log_content,
            summary=summary_data
        )

    @app.route('/job_status/<job_id>', methods=['GET'])
    def job_status(job_id):
        """Return the current job status and progress without using sockets"""
        tmp_directory = app.config['TMP_DIR']
        status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
        log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
        summary_file = os.path.join(tmp_directory, job_id, 'summary.json')
        
        # Default response
        response = {
            'status': 'pending',
            'progress': 0,
            'log_lines': [],
            'summary': None,
            'queue_position': None,
            'estimated_start': None,
            'active_since': None,
            'total_queue': None
        }
        
        # Check status
        if os.path.exists(status_file):
            with open(status_file, 'r') as f:
                status = f.read().strip()
                response['status'] = status
                
                if status == 'queued':
                    response['progress'] = 0
                    
                    # Get queue information
                    with app.queue_lock:
                        for i, (queued_job_id, _, enqueue_time) in enumerate(app.queued_jobs):
                            if queued_job_id == job_id:
                                response['queue_position'] = i + 1
                                wait_minutes = i * 15
                                est_start = datetime.now().timestamp() + (wait_minutes * 60)
                                response['estimated_start'] = est_start
                                break
                        
                        response['total_queue'] = len(app.queued_jobs)
                    
                elif status == 'running':
                    response['progress'] = 50
                    with app.queue_lock:
                        if job_id in app.active_jobs:
                            response['active_since'] = app.active_jobs[job_id].timestamp()
                    
                elif status == 'finished':
                    response['progress'] = 100
        
        # Get log lines
        if os.path.exists(log_file):
            with open(log_file, 'r') as f:
                log_lines = f.readlines()
                response['log_lines'] = log_lines[-10:]
        
        # Get summary data if finished
        if response['status'] == 'finished' and os.path.exists(summary_file):
            try:
                with open(summary_file, 'r') as f:
                    response['summary'] = json.load(f)
            except json.JSONDecodeError:
                response['summary'] = None
        
        return jsonify(response)
    @app.route('/jplace_render.html')
    def jplace_render():
        jobId = request.args.get('jobId')
        query = request.args.get('query')
        treeId = request.args.get('treeId')
        
        try:
            # Import database functions
            from .db import get_dataset_by_id
            
            # Get dataset information using the treeId
            dataset = get_dataset_by_id(treeId)
            
            if not dataset:
                app.logger.error(f"Dataset with ID '{treeId}' not found")
                return render_template('error.html', error_message=f"Dataset with ID '{treeId}' not found"), 404
            
            # Get file paths from the dataset record
            database_dir = app.config['DATABASE_DIR']
            tmp_directory = app.config['TMP_DIR']
            
            # Construct the jplace file path
            file_path = os.path.join(tmp_directory, jobId, query, treeId, 'epa_result.jplace')
            
            # Check if jplace file exists
            if not os.path.exists(file_path):
                app.logger.error(f"Jplace file not found: {file_path}")
                return render_template('error.html', error_message=f"Jplace file not found"), 404
            
            # Read the jplace file content
            with open(file_path, 'r') as file:
                jplace_content = file.read()
            
            app.logger.info(f"Reading jplace file: {file_path}")
            app.logger.info(f"Jplace content length: {len(jplace_content)}")
            
            # Get metadata file path from dataset
            metadata_link = dataset['metadata_file']
            metadata_columns = dataset['metadata_columns']
            datasetDescr = dataset['description']
            source = dataset['source']
            cite = dataset.get('cite', None)
            
            if not metadata_link:
                app.logger.error("No metadata file path found in dataset")
                return render_template('error.html', error_message="Dataset has no metadata file information"), 404
            
            # Read metadata
            metadata_path = os.path.join(database_dir, metadata_link)
            
            if not os.path.exists(metadata_path):
                app.logger.error(f"Metadata file not found: {metadata_path}")
                return render_template('error.html', error_message=f"Metadata file not found: {metadata_link}"), 404
            
            app.logger.info(f"Reading metadata file: {metadata_path}")
            df = pd.read_csv(metadata_path, sep='\t')
            metadata_json = df.to_json(orient='records')
            
            app.logger.info(f"Metadata loaded: {len(df)} rows, {len(df.columns)} columns")
            
            return render_template('jplace_render.html', 
                             nwk_data=jplace_content, 
                             metadata=metadata_json, 
                             metadata_list=metadata_columns, 
                             datasetDescr=datasetDescr,
                             superfamily_name=dataset['superfamily_name'],
                             dataset_name=dataset['dataset_name'],
                             source=source,
                             cite=cite)
        
        except Exception as e:
            app.logger.error(f"Error in jplace_render: {e}", exc_info=True)
            return render_template('error.html', error_message=f"Error loading jplace data: {str(e)}"), 500

    @app.route('/healthcheck')
    def healthcheck():
        return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})

    # Add other routes...
    @app.route('/tutorial',methods=['POST','GET'])
    def tutorial():
        return render_template('tutorial.html')

    @app.route('/upload',methods=['POST','GET'])
    def upload_dataset():
        if request.method == 'POST':
            try:
                print(f"POST request received for upload!")
                print(f"Request form data: {dict(request.form)}")
                print(f"Request files: {dict(request.files)}")
                
                # Get upload folder from config
                upload_folder = app.config.get('UPLOAD_FOLDER')
                if not upload_folder:
                    print("UPLOAD_FOLDER not set in config, using TMP_DIR/uploads")
                    upload_folder = os.path.join(app.config['TMP_DIR'], 'uploads')
                
                print(f"Upload folder: {upload_folder}")
                
                # Create upload directory if it doesn't exist
                os.makedirs(upload_folder, exist_ok=True)
                print(f"Upload directory created/exists: {os.path.exists(upload_folder)}")
                
                # Generate unique dataset ID first (needed for file renaming)
                dataset_id = f"T{datetime.now().strftime('%y%m%d%H%M%S')}"
                
                # Process uploaded files - rename with submission ID
                uploaded_files = {}
                file_mappings = {
                    'tree_file': ('tree', '.nwk'),
                    'metadata_file': ('metadata', '.tsv'), 
                    'alignment_file': ('alignment', '.fasta'),
                    'hmm_file': ('hmm', '.hmm'),
                    'iqtree_file': ('iqtree', '.iqtree')
                }
                
                for form_field, (file_type, extension) in file_mappings.items():
                    files = request.files.getlist(form_field)
                    for file in files:
                        if file and file.filename:
                            # Create new filename with submission ID
                            new_filename = f"{dataset_id}_{file_type}{extension}"
                            filepath = os.path.join(upload_folder, new_filename)
                            file.save(filepath)
                            uploaded_files[file_type] = new_filename
                            print(f"Uploaded {file_type} file saved as: {filepath}")
                            app.logger.info(f"Uploaded {file_type} file saved as: {filepath}")
                
                # Get form data
                form_data = request.form.to_dict()
                app.logger.info(f"Form data received: {form_data}")
                
                # Parse evolutionary model
                evolutionary_model = ""
                model_input_type = form_data.get('model_input_type', 'text')
                
                if model_input_type == 'text':
                    evolutionary_model = form_data.get('evolutionary_model_text', '').strip()
                elif model_input_type == 'file' and 'iqtree' in uploaded_files:
                    # Parse evolutionary model from IQ-TREE file
                    iqtree_path = os.path.join(upload_folder, uploaded_files['iqtree'])
                    try:
                        with open(iqtree_path, 'r') as f:
                            for line in f:
                                if "Best-fit model according to BIC:" in line:
                                    # Extract model after "BIC: "
                                    model_part = line.split("Best-fit model according to BIC:")[1].strip()
                                    evolutionary_model = model_part
                                    print(f"Extracted evolutionary model from IQ-TREE: {evolutionary_model}")
                                    break
                                elif "Best-fit model according to AIC:" in line and not evolutionary_model:
                                    # Fallback to AIC if BIC not found
                                    model_part = line.split("Best-fit model according to AIC:")[1].strip()
                                    evolutionary_model = model_part
                                    print(f"Extracted evolutionary model from IQ-TREE (AIC): {evolutionary_model}")
                    except Exception as e:
                        print(f"Error parsing IQ-TREE file: {e}")
                        evolutionary_model = "Could not parse IQ-TREE file"
                
                print(f"Final evolutionary model: {evolutionary_model}")
                
                # Parse metadata columns if provided
                metadata_columns = []
                if 'metadata_columns' in form_data and form_data['metadata_columns']:
                    metadata_columns = [col.strip() for col in form_data['metadata_columns'].split(',') if col.strip()]
                
                # Parse HMM names if provided
                hmm_names = []
                if 'hmm_name' in form_data and form_data['hmm_name']:
                    hmm_names = [hmm.strip() for hmm in form_data['hmm_name'].split(',') if hmm.strip()]
                
                # Create structured JSON according to your schema
                dataset_entry = {
                    "name": form_data.get('dataset_name', ''),
                    "id": dataset_id,
                    "description": form_data.get('dataset_description', ''),  # Fixed field name
                    "tree": uploaded_files.get('tree', ''),
                    "metadata": uploaded_files.get('metadata', ''),
                    "sequences": uploaded_files.get('sequences', ''),
                    "metadata_columns": metadata_columns,
                    "N_proteins": int(form_data.get('n_proteins', 0)) if form_data.get('n_proteins', '').isdigit() else 0,
                    "N_characterized": int(form_data.get('n_characterized', 0)) if form_data.get('n_characterized', '').isdigit() else 0,
                    "N_np_val": int(form_data.get('n_np_val', 0)) if form_data.get('n_np_val', '').isdigit() else 0,
                    "N_np_pred": int(form_data.get('n_np_pred', 0)) if form_data.get('n_np_pred', '').isdigit() else 0,
                    "alignment": uploaded_files.get('alignment', ''),
                    "evolutionary_model": evolutionary_model,  # New field
                    "source": form_data.get('source', 'user_submitted'),
                    "cite": {
                        "name": form_data.get('authors', ''),  # Fixed field name
                        "doi": form_data.get('paper_link', '')  # Fixed field name
                    },
                    "data_type": form_data.get('data_type', 'protein'),
                    "reviewed": form_data.get('reviewed', 'no')
                }
                
                superfamily_name = form_data.get('superfamily', 'other')
                
                # Create the full structure
                submission_data = {
                    "superfamilies": [
                        {
                            "name": superfamily_name,
                            "hmm_name": hmm_names,
                            "datasets": [dataset_entry]
                        }
                    ],
                    "submission_metadata": {
                        "submission_time": datetime.now().isoformat(),
                        "submitter_email": form_data.get('email', ''),  # Fixed field name
                        "submitter_name": form_data.get('authors', ''),  # Fixed field name
                        "upload_folder": upload_folder
                    }
                }
                
                # Save individual submission JSON file (no locking needed)
                individual_submission_file = os.path.join(upload_folder, f'submission_{dataset_id}.json')
                
                # Create complete submission data for individual file
                individual_submission = {
                    "submission_id": dataset_id,
                    "submission_time": datetime.now().isoformat(),
                    "superfamily": {
                        "name": superfamily_name,
                        "hmm_name": hmm_names,
                        "dataset": dataset_entry
                    },
                    "submitter": {
                        "email": form_data.get('email', ''),
                        "name": form_data.get('authors', ''),
                        "paper_link": form_data.get('paper_link', '')
                    },
                    "files": {
                        "upload_folder": upload_folder,
                        "uploaded_files": uploaded_files
                    }
                }
                
                # Save individual submission file
                with open(individual_submission_file, 'w') as f:
                    json.dump(individual_submission, f, indent=2)
                
                print(f"Successfully saved individual submission to: {individual_submission_file}")
                print(f"File exists after save: {os.path.exists(individual_submission_file)}")
                app.logger.info(f"Individual submission saved: {individual_submission_file}")
                app.logger.info(f"Dataset submission saved with ID: {dataset_id}")
                
                return render_template('upload.html', 
                                     message=f"Successfully submitted dataset '{dataset_entry['name']}' with ID: {dataset_id}",
                                     uploaded_files=list(uploaded_files.values()),
                                     dataset_id=dataset_id,
                                     superfamilies=app.DB_STRUCTURE['superfamilies'] if app.DB_STRUCTURE else [])
                
            except Exception as e:
                app.logger.error(f"Error processing upload: {e}", exc_info=True)
                return render_template('upload.html', 
                                     error=f"Upload failed: {str(e)}",
                                     superfamilies=app.DB_STRUCTURE['superfamilies'] if app.DB_STRUCTURE else [])
        
        # GET request - show upload form
        if app.DB_STRUCTURE is None:
            from .db import get_db_structure
            app.DB_STRUCTURE = get_db_structure()
        superfamilies = app.DB_STRUCTURE['superfamilies']
        superfamilies.append({'name': 'other'})
        return render_template('upload.html', superfamilies=superfamilies)

    @app.route('/get_file',methods=['POST','GET'])
    def get_file():
        the_file = request.args.get('filename')
        return send_from_directory('database', the_file)

    @app.route('/admin/submissions')
    def list_submissions():
        """Admin route to list all submissions"""
        try:
            upload_folder = app.config.get('UPLOAD_FOLDER')
            if not upload_folder:
                upload_folder = os.path.join(app.config['TMP_DIR'], 'uploads')
            
            submissions = []
            if os.path.exists(upload_folder):
                # Find all submission JSON files
                for filename in os.listdir(upload_folder):
                    if filename.startswith('submission_') and filename.endswith('.json'):
                        filepath = os.path.join(upload_folder, filename)
                        try:
                            with open(filepath, 'r') as f:
                                submission_data = json.load(f)
                                submissions.append({
                                    'filename': filename,
                                    'id': submission_data.get('submission_id', 'Unknown'),
                                    'time': submission_data.get('submission_time', 'Unknown'),
                                    'dataset_name': submission_data.get('superfamily', {}).get('dataset', {}).get('name', 'Unknown'),
                                    'superfamily': submission_data.get('superfamily', {}).get('name', 'Unknown'),
                                    'submitter': submission_data.get('submitter', {}).get('name', 'Unknown'),
                                    'email': submission_data.get('submitter', {}).get('email', 'Unknown')
                                })
                        except (json.JSONDecodeError, FileNotFoundError) as e:
                            app.logger.error(f"Error reading submission file {filename}: {e}")
            
            # Sort by submission time (newest first)
            submissions.sort(key=lambda x: x['time'], reverse=True)
            
            return jsonify({
                'status': 'success',
                'submissions': submissions,
                'total_count': len(submissions)
            })
            
        except Exception as e:
            app.logger.error(f"Error listing submissions: {e}", exc_info=True)
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    # Add more routes as needed...
    @app.route('/debug_hmm')
    def debug_hmm():
        """Temporary debug endpoint to check HMM names in database"""
        try:
            from .db import query_db
            
            # Check what's actually in the superfamily_hmm_names column
            raw_results = query_db("""
                SELECT superfamily_hmm_names, COUNT(*) as count 
                FROM datasets 
                WHERE superfamily_hmm_names IS NOT NULL 
                AND superfamily_hmm_names != '[]'
                AND superfamily_hmm_names != ''
                GROUP BY superfamily_hmm_names
                LIMIT 10
            """)
            
            # Also check if the column exists and what values it has
            sample_data = query_db("""
                SELECT superfamily_hmm_names 
                FROM datasets 
                WHERE superfamily_hmm_names IS NOT NULL 
                LIMIT 5
            """)
            
            return jsonify({
                'status': 'success',
                'grouped_hmm_data': [dict(row) for row in raw_results],
                'sample_hmm_data': [dict(row) for row in sample_data],
                'total_records': len(raw_results)
            })
            
        except Exception as e:
            return jsonify({
                'status': 'error',
                'error': str(e)
            }), 500
    @app.route('/admin/clear_all_jobs')
    def clear_all_jobs():
        """Manually clear all active and queued jobs"""
        try:
            with app.queue_lock:
                active_count = len(app.active_jobs)
                queued_count = len(app.queued_jobs)
                
                # Clear all jobs
                app.active_jobs.clear()
                app.queued_jobs.clear()
                
                return jsonify({
                    'status': 'success',
                    'message': f'Cleared {active_count} active jobs and {queued_count} queued jobs',
                    'active_jobs_cleared': active_count,
                    'queued_jobs_cleared': queued_count,
                    'current_active': len(app.active_jobs),
                    'current_queued': len(app.queued_jobs)
                })
                
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error clearing jobs: {str(e)}'
            }), 500

    @app.route('/admin/job_status')
    def admin_job_status():
        """Check current job status"""
        with app.queue_lock:
            return jsonify({
                'active_jobs': len(app.active_jobs),
                'active_job_ids': list(app.active_jobs.keys()),
                'queued_jobs': len(app.queued_jobs),
                'queued_job_ids': [job[0] for job in app.queued_jobs],
                'max_concurrent': app.max_concurrent_jobs
            })
    @app.route('/admin/fix_stuck_jobs')
    def fix_stuck_jobs():
        """Mark all active jobs as failed and clear the queue"""
        try:
            tmp_directory = app.config['TMP_DIR']
            fixed_jobs = []
            
            with app.queue_lock:
                # Fix active jobs
                for job_id in list(app.active_jobs.keys()):
                    # Update status file
                    status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
                    log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
                    
                    if os.path.exists(os.path.dirname(status_file)):
                        with open(status_file, 'w') as f:
                            f.write('failed')
                        
                        with open(log_file, 'a') as f:
                            f.write(f"ERROR: Job manually marked as failed due to stuck container at {datetime.now()}\n")
                        
                        fixed_jobs.append(job_id)
                
                # Clear all jobs from memory
                active_count = len(app.active_jobs)
                queued_count = len(app.queued_jobs)
                app.active_jobs.clear()
                app.queued_jobs.clear()
                
                return jsonify({
                    'status': 'success',
                    'message': f'Fixed {len(fixed_jobs)} stuck jobs, cleared {active_count} active and {queued_count} queued jobs',
                    'fixed_job_ids': fixed_jobs,
                    'active_jobs_cleared': active_count,
                    'queued_jobs_cleared': queued_count
                })
                
        except Exception as e:
            return jsonify({
                'status': 'error',
                'message': f'Error fixing jobs: {str(e)}'
            }), 500

def register_socketio_events(socketio, app):
    """Register SocketIO events"""
    
    @socketio.on('connect')
    def handle_connect():
        emit('status_update', {'status': 'Connected'})

    @socketio.on('request_status')
    def handle_request_status(data):
        job_id = data['job_id']
        read_updates(job_id, app)

def read_updates(job_id, app):
    """Read updates for a job"""
    tmp_directory = app.config['TMP_DIR']
    log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
    status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
    last_position = 0
    json_data_emitted = False

    while True:
        status = read_status(status_file)

        if not os.path.exists(log_file):
            time.sleep(1)
            continue

        with open(log_file, 'r') as f:
            for _ in range(last_position):
                next(f)
            
            for line in f:
                app.socketio.emit('status_update', {'status': status, 'updates': line.strip()})
                print("emitting update:", line.strip())
                last_position += 1

        time.sleep(1)
        if status == 'finished' and not json_data_emitted:
            with open(log_file, 'r') as f:
                new_data = f.read()
                if new_data:
                    lines = new_data.splitlines()
                    for line in lines[last_position:]:
                        app.socketio.emit('status_update', {'status': status, 'updates': line.strip()})
                        
            json_file_path = os.path.join(tmp_directory, job_id, 'summary.json')
            if os.path.exists(json_file_path):
                with open(json_file_path, 'r') as f:
                    row_data_json = f.read()
                    app.socketio.emit('json_data', {'row_data_json': row_data_json}) 
                    json_data_emitted = True
            break

def read_status(status_file):
    if not os.path.exists(status_file):
        time.sleep(10)
    with open(status_file, 'r') as f:
        return f.read().strip()

def is_fasta(content):
    """Check if the content is in FASTA format using Biopython."""
    try:
        fasta_io = StringIO(content)
        records = list(SeqIO.parse(fasta_io, "fasta"))
        return len(records) > 0
    except Exception:
        return False

def job_processor(app):
    """Process jobs from the queue when slots are available."""
    
    while True:
        # Check if we can process more jobs
        with app.queue_lock:
            can_process = len(app.active_jobs) < app.max_concurrent_jobs and app.queued_jobs
            
            if can_process:
                # Get the next job from the queue
                job_id, filename, _ = app.queued_jobs.pop(0)
                
                # Mark job as active
                app.active_jobs[job_id] = datetime.now()
                
                # Update status file to show job is running
                tmp_directory = app.config['TMP_DIR']
                status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
                with open(status_file, 'w') as f:
                    f.write('running')
                
                # Log the start of processing
                log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
                with open(log_file, 'a') as f:
                    f.write(f"Job moved from queue to processing at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                    
                # Start a thread for this job
                thread = threading.Thread(
                    target=process_job,
                    args=(job_id, filename, app)
                )
                thread.daemon = True
                thread.start()
                
                print(f"Started job {job_id}. Active jobs: {len(app.active_jobs)}", flush=True)
        
        # Wait a bit before checking again
        time.sleep(1)

def process_job(job_id, filename, app):
    """Process a job and mark it as complete when done."""
    
    try:
        tmp_directory = app.config['TMP_DIR']
        database_dir = app.config['DATABASE_DIR']
        
        # Run the original background thread logic
        print('Running job ', job_id, flush=True)
        print("Before subprocess.Popen", flush=True)
        
        process = subprocess.Popen(
            ['docker', 'run', '--rm', '--user', f"{os.getuid()}:{os.getgid()}",
            # '--memory','8g', '--cpus','4', \
            '--name', job_id, '-v', f'{os.path.abspath(database_dir)}:/app/data', 
            '-v', f"{os.path.abspath(os.path.join(tmp_directory, job_id))}:/app/results",
            'phylonap-backend', 'python', '/app/place_enz.py', job_id, filename],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        # Save logs to file
        log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
        with open(log_file, 'a') as log:
            for line in process.stdout:
                print("process_log ====================", line.strip(), flush=True)
                log.write(line)
                log.flush()

        process.stdout.close()
        return_code = process.wait()

        # Update status based on return code
        status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
        with open(status_file, 'w') as f:
            if return_code == 0:
                f.write('finished')
                
                # Handle email notification...
                try:
                    metadata_file = os.path.join(tmp_directory, job_id, 'metadata.json')
                    if os.path.exists(metadata_file):
                        with open(metadata_file, 'r') as meta_f:
                            metadata = json.load(meta_f)
                            email = metadata.get('email')
                            
                            if email:
                                email_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../send_email.sh')
                                
                                if os.path.exists(email_script) and os.path.isfile(email_script):
                                    try:
                                        subprocess.run(['/bin/bash', email_script, email, job_id], check=False)
                                        
                                        with open(log_file, 'a') as log:
                                            log.write(f"Email notification sent to {email}\n")
                                            log.flush()
                                        
                                        print(f"Email notification sent to {email} for job {job_id}", flush=True)
                                    except Exception as e:
                                        print(f"Failed to send email: {str(e)}", flush=True)
                                        with open(log_file, 'a') as log:
                                            log.write(f"ERROR sending email: {str(e)}\n")
                                            log.flush()
                                else:
                                    print(f"Email script not found or not executable: {email_script}", flush=True)
                                    with open(log_file, 'a') as log:
                                        log.write(f"ERROR: Email script not found or not executable: {email_script}\n")
                                        log.flush()
                except Exception as e:
                    print(f"Failed to send email notification: {str(e)}", flush=True)
            else:
                f.write('failed')
                print(f"BACKEND SCRIPT ERROR: Process returned non-zero exit code {return_code}", flush=True)
                
    except Exception as e:
        print(f"Error processing job {job_id}: {e}", flush=True)
        tmp_directory = app.config['TMP_DIR']
        status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
        with open(status_file, 'w') as f:
            f.write('failed')
        
        log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
        with open(log_file, 'a') as f:
            f.write(f"ERROR: {str(e)}\n")
    
    finally:
        # Always remove from active jobs when complete
        with app.queue_lock:
            if job_id in app.active_jobs:
                del app.active_jobs[job_id]
                print(f"Completed job {job_id}. Active jobs: {len(app.active_jobs)}", flush=True)

def start_job_processing(app):
    """Start the job processor thread."""
    processor_thread = threading.Thread(target=job_processor, args=(app,))
    processor_thread.daemon = True
    processor_thread.start()
    print("Job processor started", flush=True)
    app.logger.info("Job processor started")

# Create the Flask app using the factory function
app = create_app()

# Initialize database and start job processing only after app creation
# @app.before_first_request
# def initialize_app():
#     """Initialize app components that require app context"""
#     try:
#         # Load database structure
#         app.DB_STRUCTURE = get_db_structure()
#         print(f"Database loaded with {len(app.DB_STRUCTURE['superfamilies'])} superfamilies")
        
#         # Start job processing
#         start_job_processing(app)
        
#     except Exception as e:
#         app.logger.error(f"Error during app initialization: {e}", exc_info=True)
#         # Provide fallback
#         app.DB_STRUCTURE = {'superfamilies': []}

if __name__ == '__main__':
    print("app.config['HOST']", app.config['HOST'])
    print("app.config['PORT']", app.config['PORT'])



