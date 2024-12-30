# app.py
import sys
import uuid
import subprocess
#print(sys.executable)
from flask import Flask, render_template, request, redirect, url_for, Response, session, jsonify
from flask import send_from_directory
from urllib.parse import urlparse, unquote
from werkzeug.utils import secure_filename

#from ete3 import Tree
#from ete3 import Tree, WebTreeApplication, NodeStyle
#from ete3 import TreeStyle
#from WSGIMiddleware import WSGIMiddleware
import os
import logging
import json
import pandas as pd
import ast
from flask_socketio import SocketIO, emit
import threading
import time

# from docker import DockerClient
# #from ete3 import TreeStyle

# #ts = TreeStyle()

# docker_client = DockerClient(base_url='unix://var/run/docker.sock')
# # Start a new Docker container
# container = docker_client.containers.run('phylo-place', detach=True)

tmp_directory = '/Users/sasha/Desktop/tubingen/thePhyloNaP/PhyloNaP/tmp'
tree_placement_dir='/Users/sasha/Desktop/tubingen/thePhyloNaP/PhyloNaP/PhyloNaP_enzPlace'
database_dir='/Users/sasha/Desktop/tubingen/thePhyloNaP/PhyloNaP/PhyloNaP_database'
cache={}

flask_app = Flask(__name__)
flask_app.secret_key = 'MySecretKeyPhyloNaPsTest'
app=flask_app

#app = WSGIMiddleware(flask_app)
socketio = SocketIO(app)
def background_thread(job_id, filename):
    
    print('Running background thread for job ', job_id)
    print("Before subprocess.Popen")
    process = subprocess.Popen(['python', os.path.join(tree_placement_dir, 'place_enz.py'), os.path.join(tmp_directory, job_id, filename), os.path.join(tmp_directory, job_id)], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    print("After subprocess.Popen")
    for line in iter(process.stdout.readline, b''):
        # print("emitting update running")
        line_decoded = line.decode('utf-8')
        print("process_log ====================", line_decoded)
    #     socketio.emit('update', {'status': 'running', 'data': line.decode('utf-8')})
    #         # Save the update to a file
    #     with open(os.path.join(tmp_directory, job_id, 'updates.txt'), 'a') as f:
    #         f.write(line_decoded)
        # Wait for the process to finish
        # Start a thread to read updates from the log file
    # socketio.start_background_task(read_updates, job_id)

    # Wait for the process to finish
    process.wait()

    # # Check if the process has finished
    # if process.poll() is not None:
    #     # Emit an 'update' event with the job status
    #     print("emitting update finished")
    #     socketio.emit('update', {'status': 'finished', 'data': f'Job {job_id} finished'})
    # # process.wait()

    # # Check if the process has finished
    # if process.poll() is not None:
    #     # Emit an 'update' event with the job status
    #     print("emitting update finished")
    #     socketio.emit('update', {'status': 'finished', 'data': f'Job {job_id} finished'})
    #     with open(os.path.join(tmp_directory, job_id, 'status.txt'), 'w') as f:
    #         f.write('finished')

# def read_updates(job_id):
#     output_log_file_p = os.path.join(tmp_directory, job_id, 'output_log.json')
#     print("output_log_file_p",output_log_file_p)
#     print("\n\n\n\n\n\n\n\n\n\n")
#     last_position = 0

#     while True:
#         if not os.path.exists(output_log_file_p):
#             time.sleep(1)  # Wait for a short period before checking again
#             continue
#         # if os.path.getsize(output_log_file_p) == 0:
#         #     print(f"File {output_log_file_p} is empty. Retrying...")
#         #     time.sleep(1)  # Wait for a short period before checking again
#         #     continue
#         with open(output_log_file_p, 'r') as f:
#             f.seek(last_position)
#             print(f)
#             try:
#                 #log_data = json.load(f)
#                 new_data = f.read()
#                 if not new_data:
#                     time.sleep(1)  # Wait for a short period before checking again
#                     continue
#                 # Attempt to parse the new data as JSON
#                 log_data = json.loads(new_data)
#                 status = log_data.get('status')
#                 updates = log_data.get('updates', [])

#                 for update in updates:
#                     socketio.emit('update', {'status': status, 'data': update})
#                 last_position = f.tell()
#             except json.JSONDecodeError as e:
#                 print(f"JSONDecodeError: {e}. Retrying...")
#                 time.sleep(1)  # Wait for a short period before checking again
#                 continue

#             # status = log_data.get('status')
#             # updates = log_data.get('updates', [])

#             # for update in updates:
#             #     socketio.emit('update', {'status': status, 'data': update})

#             # last_position = f.tell()

#         if status == 'finished':
#             break

#         time.sleep(1)  # Wait for a short period before checking for updates again
#     return

@app.route('/')
def home():
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
    return render_template('upload.html')

# @app.route('/results')
# def results():
#     return render_template('results.html')

@app.route('/submit', methods=['POST'])
# def submit():
#     sequence = request.form['sequence']
#     # handle the POST request here
#     # redirect the user to the "Results" page
#     return redirect(url_for('results'))
def submit():
    # Check if a file was uploaded
    sequence = request.form['sequence']
    file = request.files.get('file')

    if sequence == '' and (file is None or file.filename == ''):
        return 'No fasta sequence was uploaded', 400

    # Generate a unique job ID
    job_id = str(uuid.uuid4())
    print('Job ID:', job_id)
    os.makedirs(os.path.join(tmp_directory, job_id))
    if file and file.filename != '':
        filename = secure_filename(file.filename)
        file.save(os.path.join(tmp_directory, job_id, filename))
        print('File uploaded:', filename)
    elif sequence != '':
        filename='sequence.fasta'
        with open(os.path.join(tmp_directory, job_id, filename), 'w') as f:
            f.write(sequence)
    threading.Thread(target=background_thread, args=(job_id, filename)).start()

    #return render_template('results.html', job_id=job_id)
    return redirect(url_for('results', job_id=job_id))
    #return redirect(url_for('results'))

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

@socketio.on('connect')
def handle_connect():
    emit('status_update', {'status': 'Connected'})

    
@socketio.on('request_status')
def handle_request_status(data):
    job_id = data['job_id']

    read_updates(job_id)
def read_status(status_file):
    if not os.path.exists(status_file):
        time.sleep(1)
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

if __name__ == '__main__':
    socketio.run(app, debug=True)