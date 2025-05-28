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
# from docker import DockerClient
# #from ete3 import TreeStyle

# #ts = TreeStyle()

# docker_client = DockerClient(base_url='unix://var/run/docker.sock')
# # Start a new Docker container
# container = docker_client.containers.run('phylo-place', detach=True)

cache={}


flask_app = Flask(__name__)
#flask_app.secret_key = 'MySecretKeyPhyloNaPsTest'
app=flask_app
print("FLASK APP STARTED")
app.config.from_pyfile("config_update.py")
flask_app.secret_key = app.config['SECRET_KEY']

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# tree_placement_dir = app.config['TREE_PLACEMENT_DIR']
#tmp_directory = app.config['TMP_DIRECTORY']
database_dir = app.config['DB_DIR']
if not os.path.exists(database_dir):
    raise Exception(f"Database directory does not exist: {database_dir}")
#tree_placement_dir=os.getenv('BACKEND_URL', 'http://localhost:8080')
#backend_container_name = os.getenv('BACKEND_CONTAINER_NAME', 'backend')

#database_dir = os.getenv("DATA_PATH", "./data")

tmp_directory = app.config["TMP_DIRECTORY"]
if not os.path.exists(tmp_directory):
    raise Exception(f"Temporary directory does not exist: {tmp_directory}")
#tmp_directory="/app/results"
#print("\n\n\nresutls dir = ",tmp_directory,'\n\n\n')

#tmp_directory = os.getenv("RESULTS_DIR", "./results")
#tmp_directory="/Users/sasha/Desktop/tubingen/thePhyloNaP/PhyloNaP/tmp"
print("\n\n\nresutls dir = ",tmp_directory,'\n\n\n')
#tmp_directory='/app/results'



socketio = SocketIO(app)
# Create a job queue and tracking variables
job_queue = queue.Queue()
active_jobs = {}  # Dictionary to track running jobs: {job_id: start_time}
queued_jobs = []  # List to track queued jobs in order: [(job_id, filename, enqueue_time)]
max_concurrent_jobs = 2  # Maximum number of jobs that can run simultaneously
queue_lock = threading.Lock()  # Lock for thread-safe operations

# Replace your current background_thread function with this job processor system
def job_processor():
    """Process jobs from the queue when slots are available."""
    global active_jobs, queued_jobs
    
    while True:
        # Check if we can process more jobs
        with queue_lock:
            can_process = len(active_jobs) < max_concurrent_jobs and queued_jobs
            
            if can_process:
                # Get the next job from the queue
                job_id, filename, _ = queued_jobs.pop(0)
                
                # Mark job as active
                active_jobs[job_id] = datetime.now()
                
                # Update status file to show job is running
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
                    args=(job_id, filename)
                )
                thread.daemon = True
                thread.start()
                
                print(f"Started job {job_id}. Active jobs: {len(active_jobs)}", flush=True)
        
        # Wait a bit before checking again
        time.sleep(1)

def process_job(job_id, filename):
    """Process a job and mark it as complete when done."""
    global active_jobs
    
    try:
        # Run the original background thread logic
        print('Running job ', job_id, flush=True)
        print("Before subprocess.Popen", flush=True)
        
        process = subprocess.Popen(
            ['docker', 'run', '--rm', '--user', f"{os.getuid()}:{os.getgid()}",  # Run as current user
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
                log.flush()  # Ensure logs are written immediately

        process.stdout.close()
        return_code = process.wait()

        # Update status based on return code
        status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
        with open(status_file, 'w') as f:
            if return_code == 0:
                f.write('finished')
                
                # Check for email in metadata and send notification if available
                try:
                    metadata_file = os.path.join(tmp_directory, job_id, 'metadata.json')
                    if os.path.exists(metadata_file):
                        with open(metadata_file, 'r') as meta_f:
                            metadata = json.load(meta_f)
                            email = metadata.get('email')
                            
                            # Only send email if one was provided
                            if email:
                                # Send email notification using the script
                                email_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../send_email.sh')
                                
                                # Check if the email script exists before attempting to run it
                                if os.path.exists(email_script) and os.path.isfile(email_script):
                                    try:
                                        subprocess.run(['/bin/bash', email_script, email, job_id], 
                                                      check=False)  # Don't raise exception if email fails
                                        
                                        # Log the email notification
                                        with open(log_file, 'a') as log:
                                            log.write(f"Email notification sent to {email}\n")
                                            log.flush()
                                        
                                        print(f"Email notification sent to {email} for job {job_id}", flush=True)
                                    except Exception as e:
                                        print(f"Failed to send email: {str(e)}", flush=True)
                                        # Log the error but don't fail the job processing
                                        with open(log_file, 'a') as log:
                                            log.write(f"ERROR sending email: {str(e)}\n")
                                            log.flush()
                                else:
                                    # Log that the email script wasn't found
                                    app_logger = logging.getLogger("phylonap")
                                    app_logger.error(f"Email script not found at {email_script}. Email notification for job {job_id} not sent.")
                                    
                                    # Also log to file without stopping job processing
                                    with open(log_file, 'a') as log:
                                        log.write(f"NOTE: Email notification not sent - email script not found\n")
                                        log.flush()
                                    
                                    print(f"Email script not found at {email_script}. Email notification not sent.", flush=True)
                except Exception as e:
                    print(f"Failed to send email notification: {str(e)}", flush=True)
                    # Log the error but don't fail the job processing
                    with open(log_file, 'a') as log:
                        log.write(f"ERROR sending email notification: {str(e)}\n")
                        log.flush()
            else:
                f.write('failed')
                print(f"BACKEND SCRIPT ERROR: Process returned non-zero exit code {return_code}", flush=True)
                
    except Exception as e:
        print(f"Error processing job {job_id}: {e}", flush=True)
        # Update status to failed
        status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
        with open(status_file, 'w') as f:
            f.write('failed')
        
        # Log the error
        log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
        with open(log_file, 'a') as f:
            f.write(f"ERROR: {str(e)}\n")
    
    finally:
        # Always remove from active jobs when complete
        with queue_lock:
            if job_id in active_jobs:
                del active_jobs[job_id]
                print(f"Completed job {job_id}. Active jobs: {len(active_jobs)}", flush=True)

# Update your submit route to use the queue
@app.route('/submit', methods=['POST'])
def submit():
    # Check if a file was uploaded
    sequence = request.form['sequence']
    file = request.files.get('file')
    email = request.form.get('email', '').strip()  # Get email from form (optional)

    if sequence == '' and (file is None or file.filename == ''):
        return 'No fasta sequence was uploaded', 400

    # Validate email format if provided (but don't require it)
    if email and not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return 'Invalid email address format', 400

    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    print('Job ID:', job_id, flush=True)
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
        'email': email if email else None  # Store email if provided
    }
    
    metadata_file = os.path.join(tmp_directory, job_id, 'metadata.json')
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f)
    
    # Add job to queue and track it
    with queue_lock:
        queued_jobs.append((job_id, filename, datetime.now()))
        queue_position = len(queued_jobs)
        
        # Create log file with queue information
        log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
        with open(log_file, 'w') as f:
            f.write(f"Job {job_id} added to queue at position {queue_position} on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Current active jobs: {len(active_jobs)}/{max_concurrent_jobs}\n")
            f.write(f"Total jobs in queue: {len(queued_jobs)}\n")
            
            # Estimate wait time (rough estimate: 15 minutes per job ahead in queue)
            if queue_position > 1:
                estimated_wait_minutes = (queue_position - 1) * 15
                f.write(f"Estimated wait time: ~{estimated_wait_minutes} minutes\n")
            else:
                f.write("Your job will start as soon as a processing slot is available.\n")
            
            # Acknowledge email notification if provided
            if email:
                f.write(f"Email notification will be sent to {email} when the job is completed.\n")

    return redirect(url_for('results', job_id=job_id))

# Update job_status endpoint to include queue information
@app.route('/job_status/<job_id>', methods=['GET'])
def job_status(job_id):
    """Return the current job status and progress without using sockets"""
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
            
            # Set progress based on status
            if status == 'queued':
                response['progress'] = 0
                
                # Get queue information
                with queue_lock:
                    # Find position in queue
                    for i, (queued_job_id, _, enqueue_time) in enumerate(queued_jobs):
                        if queued_job_id == job_id:
                            response['queue_position'] = i + 1
                            # Estimate start time (15 min per job ahead)
                            wait_minutes = i * 15
                            est_start = datetime.now().timestamp() + (wait_minutes * 60)
                            response['estimated_start'] = est_start
                            break
                    
                    # Total jobs in queue
                    response['total_queue'] = len(queued_jobs)
                
            elif status == 'running':
                response['progress'] = 50
                # If job is currently running, get the start time
                with queue_lock:
                    if job_id in active_jobs:
                        response['active_since'] = active_jobs[job_id].timestamp()
                
            elif status == 'finished':
                response['progress'] = 100
    
    # Get log lines
    if os.path.exists(log_file):
        with open(log_file, 'r') as f:
            log_lines = f.readlines()
            response['log_lines'] = log_lines[-10:]  # Get last 10 lines
    
    # Get summary data if finished
    if response['status'] == 'finished' and os.path.exists(summary_file):
        try:
            with open(summary_file, 'r') as f:
                response['summary'] = json.load(f)
        except json.JSONDecodeError:
            response['summary'] = None
    
    return jsonify(response)

# Start worker threads when application starts
def start_job_processing():
    """Start the job processor thread."""
    processor_thread = threading.Thread(target=job_processor)
    processor_thread.daemon = True
    processor_thread.start()
    print("Job processor started", flush=True)
    app_logger = logging.getLogger("phylonap")
    
    # Replace print statements with logging
    app_logger.info("Job processor started")
# Call this function at application startup
start_job_processing()

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/analyse')
def analyse():
    return render_template('home.html')

@app.route('/help')
def help_page():
    return render_template('help.html')

############ All about trees are here ############
# Create a TreeStyle instance to specify how the tree should be rendered

#ts.show_leaf_name = True




# def change_color(node):
#     # This function changes the color of a node
#     nstyle = NodeStyle()
#     nstyle["fgcolor"] = "red"
#     node.set_style(nstyle)


#############################


def generate_unique_folder_name(dataset_name):
    # Remove symbols that are not allowed in folder names
    allowed_chars = string.ascii_letters + string.digits + "_-"
    folder_name = ''.join(c for c in dataset_name if c in allowed_chars)
    
    # Generate a random string to make the folder name unique
    random_string = ''.join(random.choices(string.ascii_letters + string.digits, k=8))
    
    return f"{folder_name}_{random_string}"

@app.route('/upload', methods=['POST'])
def upload_file():
    if request.method == 'POST':
        dataset_name = request.form['dataset_name']
        dataset_description = request.form['dataset_description']
        superfamily = request.form['superfamily']
        #data_source = request.form.getlist('data_source')
        data_type = request.form.getlist('data_type')
        authors = request.form['authors']
        paper_link = request.form['paper_link']
        email = request.form['email']

        # Save files
        tree_file = request.files['tree_file']
        metadata_file = request.files['metadata_file']
        alignment_file = request.files['alignment_file']
        hmm_file = request.files['hmm_file']

        # Generate a unique folder name
        folder_name = generate_unique_folder_name(dataset_name)
        folder_path = os.path.join(app.config['UPLOAD_FOLDER'], folder_name)
        os.makedirs(folder_path)

        if tree_file:
            tree_file.save(os.path.join(folder_path, tree_file.filename))
        if metadata_file:
            metadata_file.save(os.path.join(folder_path, metadata_file.filename))
        if alignment_file:
            alignment_file.save(os.path.join(folder_path, alignment_file.filename))
        if hmm_file:
            hmm_file.save(os.path.join(folder_path, hmm_file.filename))

        # Save data to JSON file
        data = {
            'superfamily': superfamily,
            'name': dataset_name,
            'description': dataset_description,
            'data_type': data_type,
            'authors': authors,
            'paper_link': paper_link,
            'folder_path': folder_path,
            'email': email,
            'tree':os.path.join(folder_path, tree_file.filename),
            'metadata':os.path.join(folder_path, metadata_file.filename),
            'alignment':os.path.join(folder_path, alignment_file.filename),
        }
        json_file_path = os.path.join(folder_path, 'data.json')
        with open(json_file_path, 'w') as f:
            json.dump(data, f)

        return render_template('dataset_uploaded.html', email=email, dataset_name=dataset_name)

@app.route('/database')
def database_page():
    # Get a dictionary of the files in each folder
    #folders = {folder: os.listdir('database/' + folder) for folder in os.listdir('database/') if os.path.isdir('database/' + folder)}
    #print('Printing folders:::')
    #print(folders)  # Debugging line
    with open(os.path.join(database_dir,'db_structure.json')) as f:
        data = json.load(f)
    #print(data)
    return render_template('database.html',superfamilies=data['superfamilies'])



@app.route('/phylotree_render', methods=['POST','GET'])
def tree_renderer():

    # Open and read JSON file
    with open(os.path.join(database_dir,'db_structure.json')) as f:
        data = json.load(f)

    superfamilyName = request.args.get('superfamily')
    datasetName = request.args.get('dataset')
    print(superfamilyName)
    print(datasetName)
    # Extract necessary data
    # Find the matching superfamily and dataset
    success = False
    for superfamily in data['superfamilies']:
        if superfamily['name'] == superfamilyName:
            for dataset in superfamily['datasets']:
                if dataset['name'] == datasetName:
                    tree_link = dataset['tree']
                    print(tree_link)
                    metadata_link = dataset['metadata']
                    metadata_columns = dataset['metadata_columns']
                    datasetDescr = dataset['description']
                    success = True
                    break

    # Handle the case where no matching superfamily or dataset was found
    if not success:
        return print({'message': 'No matching superfamily or dataset found'}), 404

    print(os.path.join(database_dir,tree_link))
    with open(os.path.join(database_dir,tree_link), 'r') as f:
        print("reading the tree file")
        tree_content = f.read()
        
        
    print(tree_content)
    print("tree content length:", len(tree_content))
    df = pd.read_csv(os.path.join(database_dir,metadata_link),sep='\t')
    metadata_json = df.to_json(orient='records')


    # metadata_columns = json.dumps(metadata_columns)

    #columns = df.columns.tolist()

    return render_template('phylotree_render.html', nwk_data=tree_content, metadata=metadata_json, metadata_list=metadata_columns, datasetDescr=datasetDescr)


@app.route('/get_file',methods=['POST','GET'])
def get_file():
    the_file = request.args.get('filename')
    return send_from_directory('database', the_file)


@app.route('/tutorial',methods=['POST','GET'])
def tutorial():
    return render_template('tutorial.html')

@app.route('/upload',methods=['POST','GET'])
def upload_dataset():
    with open(os.path.join(database_dir, 'db_structure.json')) as f:
        data = json.load(f)
    superfamilies = data['superfamilies']
    superfamilies.append({'name': 'other'})  # Add "other" category
    return render_template('upload.html', superfamilies=superfamilies)

# @app.route('/results')
# def results():
#     return render_template('results.html')
def is_fasta(content):
    """Check if the content is in FASTA format using Biopython."""
    try:
        fasta_io = StringIO(content)
        records = list(SeqIO.parse(fasta_io, "fasta"))
        return len(records) > 0
    except Exception:
        return False



@app.route('/results/<job_id>', methods=['GET'])
def results(job_id):
    output_log_file_p = os.path.join(tmp_directory, job_id, 'output_log.json')
        # Read the current updates from the log file
    updates = []
    status = 'pending'
    if os.path.exists(output_log_file_p):
        with open(output_log_file_p, 'r') as f:
            try:
                log_data = json.load(f)
                status = log_data.get('status', 'pending')
                print("status ======",status)
                updates = log_data.get('updates', [])
            except json.JSONDecodeError as e:
                print(f"JSONDecodeError: {e}. Could not read updates.")

    return render_template('results.html', job_id=job_id)

@app.route('/epa_res/<job_id>/<query>/<tree_id>')
def get_jplace_data(job_id, query, tree_id):
    cache_key = f"{job_id}/{query}/{tree_id}"
    # Check if the data is already in the cache
    if cache_key in cache:
        data = cache[cache_key]
    else:
        file_path = os.path.join(tmp_directory, job_id, query, tree_id, 'epa_result.jplace')
        print("file_path",file_path)
        try:
            with open(file_path, 'r') as file:
                data = json.load(file)
                # Cache the data
                cache[cache_key] = data
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    placements = data['placements'][0]['p']
    print("read the placements file\n",placements)

        # Find the list with the highest 3rd value
    max_placement = max(placements, key=lambda x: x[2])
    
    like_weight_ratio = max_placement[2]
    pendant_length = max_placement[4]

    return jsonify({
        'like_weight_ratio': like_weight_ratio,
        'pendant_length': pendant_length
    })
@app.route('/api/download_sequences', methods=['POST'])
def download_sequences():
    data = request.json
    node_names = data.get('nodeNames', [])

    # Generate a FASTA file based on the node names
    fasta_content = ""
    for node in node_names:
        fasta_content += f">{node}\nSEQUENCE_FOR_{node}\n"

    # Create a file-like object for the FASTA content
    fasta_file = io.BytesIO(fasta_content.encode('utf-8'))

    # Send the file as a response
    return send_file(
        fasta_file,
        mimetype='text/plain',
        as_attachment=True,
        download_name='sequences.fasta'
    )

@socketio.on('connect')
def handle_connect():
    emit('status_update', {'status': 'Connected'})

    
@socketio.on('request_status')
def handle_request_status(data):
    job_id = data['job_id']

    read_updates(job_id)
def read_status(status_file):
    if not os.path.exists(status_file):
        time.sleep(10)
    with open(status_file, 'r') as f:
        return f.read().strip()
def read_updates(job_id):
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
            
            # Read and process lines from the start_row onwards
            for line in f:
                socketio.emit('status_update', {'status': status, 'updates': line.strip()})
                print("emitting update:", line.strip())
                last_position += 1
                print("last_position updated to:", last_position)

        time.sleep(1)
        print("status: |",status,"|")
        if status == 'finished' and not json_data_emitted:
            # Ensure all remaining lines are read before breaking the loop
            with open(log_file, 'r') as f:
                new_data = f.read()
                if new_data:
                    lines = new_data.splitlines()
                    for line in lines[last_position:]:
                        socketio.emit('status_update', {'status': status, 'updates': line.strip()})
                        print("emitting update:", line.strip())
                    print("last_position updated to:", last_position)
            json_file_path = os.path.join(tmp_directory, job_id, 'summary.json')
            if os.path.exists(json_file_path):
                with open(json_file_path, 'r') as f:
                    row_data_json = f.read()
                    socketio.emit('json_data', {'row_data_json': row_data_json}) 
                    json_data_emitted = True
            break
    return
# Add to PhyloNaP_WebApp/app.py

@app.route('/healthcheck')
def healthcheck():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})

@app.route('/jplace_render.html')
def jplace_render():
    jobId = request.args.get('jobId')
    query = request.args.get('query')
    treeId = request.args.get('treeId')

    # Construct the file path
    file_path = os.path.join(tmp_directory, jobId, query, treeId, 'epa_result.jplace')

    # Read the file content
    with open(file_path, 'r') as file:
        file_content = file.read()

    # Render the jplace_render.html template with the .jplace file content
    # return render_template('jplace_render.html', jplaceFileContent=file_content)
    with open(os.path.join(database_dir,'db_structure.json')) as f:
        data = json.load(f)


    # Extract necessary data
    # Find the matching superfamily and dataset
    success = False
    for superfamily in data['superfamilies']:
        for dataset in superfamily['datasets']:
            if dataset['id'] == treeId:
                tree_link = dataset['tree']
                print(tree_link)
                metadata_link = dataset['metadata']
                metadata_columns = dataset['metadata_columns']
                datasetDescr = dataset['description']
                success = True
                break

    # Handle the case where no matching superfamily or dataset was found
    if not success:
        return print({'message': 'No matching superfamily or dataset found'}), 404

    print(os.path.join(database_dir,tree_link))
    with open(os.path.join(file_path), 'r') as f:
        print("reading the tree file")
        jplace_content = f.read()
        
        
    print(jplace_content)
    df = pd.read_csv(os.path.join(database_dir,metadata_link),sep='\t')
    metadata_json = df.to_json(orient='records')


    # metadata_columns = json.dumps(metadata_columns)

    #columns = df.columns.tolist()

    return render_template('jplace_render.html', nwk_data=jplace_content, metadata=metadata_json, metadata_list=metadata_columns, datasetDescr=datasetDescr)
# Add this new route to app.py
# @app.route('/job_status/<job_id>', methods=['GET'])
# def job_status(job_id):
#     """Return the current job status and progress without using sockets"""
#     status_file = os.path.join(tmp_directory, job_id, 'output_status.txt')
#     log_file = os.path.join(tmp_directory, job_id, 'output_log.txt')
#     summary_file = os.path.join(tmp_directory, job_id, 'summary.json')
    
#     # Default response
#     response = {
#         'status': 'pending',
#         'progress': 0,
#         'log_lines': [],
#         'summary': None
#     }
    
#     # Check status
#     if os.path.exists(status_file):
#         with open(status_file, 'r') as f:
#             status = f.read().strip()
#             response['status'] = status
#             # Set progress based on status
#             if status == 'running':
#                 response['progress'] = 50
#             elif status == 'finished':
#                 response['progress'] = 100
    
#     # Get log lines (last 10 lines)
#     if os.path.exists(log_file):
#         with open(log_file, 'r') as f:
#             log_lines = f.readlines()
#             # Extract main stages for progress bar
#             main_stages = [line.strip() for line in log_lines 
#                           if "Running" in line or "finished" in line]
#             response['log_lines'] = main_stages[-5:] if main_stages else []
    
#     # Get summary data if finished
#     if response['status'] == 'finished' and os.path.exists(summary_file):
#         try:
#             with open(summary_file, 'r') as f:
#                 response['summary'] = json.load(f)
#         except json.JSONDecodeError:
#             response['summary'] = None
    
#     return jsonify(response)
# @app.route('/tree')
# def tree_page():
#     # Parse the tree file
#     with open('database/mt_test/tree_file.txt', 'r') as f:
#         tree_string = f.read()
#     tree = Tree(tree_string)

#     # Generate an image of the tree
#     ts = TreeStyle()
#     ts.show_leaf_name = True
#     tree.render("static/tree_image.png", tree_style=ts)

#     # Display the image on a webpage
#     image_url = url_for('static', filename='tree_image.png')
#     return render_template('tree.html', image_url=image_url)

# @app.route('/tree')
# def tree_page():
#     # Parse the tree file
#     with open('database/mt_test/group1.1_corr_keep.fa_al_trimmed.contree', 'r') as f:
#         tree_string = f.read()
#     tree = Tree(tree_string)

#     # Generate an image of the tree
#     ts = TreeStyle()
#     ts.show_leaf_name = True
#     tree.render("static/tree_image.png", tree_style=ts)

#     # Display the image on a webpage
#     image_url = url_for('static', filename='tree_image.png')
#     return render_template('tree.html', image_url=image_url)

'''
@app.route('/submit', methods=['GET', 'POST'])
def submit():
    if request.method == 'POST':
        # handle POST request
        pass
    else:
        # handle GET request
        results = []  # Define the results variable
        return render_template('submit.html', results=results)
'''

@app.errorhandler(404)
def page_not_found(error):
    return "Page not found", 404

# if __name__ == '__main__':
#     # db.create_all()  # create tables
#     app.run(debug=True)
print("app.config['HOST']",app.config['HOST'])
print("app.config['PORT']",app.config['PORT'])
#if __name__ == '__main__':
#    app.run(debug=True)
#    socketio.run(app, host=app.config['HOST'], port=app.config['PORT'], debug=True)
