# app.py
from flask import Flask, render_template, request, redirect, url_for, Response, session
from flask import send_from_directory
#from ete3 import Tree
#from ete3 import Tree, WebTreeApplication, NodeStyle
#from ete3 import TreeStyle
#from WSGIMiddleware import WSGIMiddleware
import os
import logging
#from ete3 import TreeStyle

#ts = TreeStyle()



flask_app = Flask(__name__)
flask_app.secret_key = 'MySecretKeyPhyloNaPsTest'
app=flask_app
#app = WSGIMiddleware(flask_app)


@app.route('/')
def home():
    return render_template('index.html')

@app.route('/help')
def help_page():
    return render_template('help.html')

############ All about trees are here ############
# Create a TreeStyle instance to specify how the tree should be rendered

#ts.show_leaf_name = True




def change_color(node):
    # This function changes the color of a node
    nstyle = NodeStyle()
    nstyle["fgcolor"] = "red"
    node.set_style(nstyle)


#############################

@app.route('/database')
def database_page():
    # Get a dictionary of the files in each folder
    folders = {folder: os.listdir('database/' + folder) for folder in os.listdir('database/') if os.path.isdir('database/' + folder)}
    print('Printing folders:::')
    print(folders)  # Debugging line

    # Pass the list of files to the template
    return render_template('database.html', folders=folders)
# def draw_tree(t):
#     # Create a tree
#     # Create a WebTreeApplication instance
#     web_tree_app = WebTreeApplication(t)
#     # Render the tree
#     tree_html = web_tree_app.render()
#     return render_template('database.html', tree_html=tree_html)


# @app.route('/tree', methods=['POST'])
# def tree_renderer():
#     logging.info(f"Received form data: {request.form}")
#     app.wsgi_app = WSGIMiddleware(app.wsgi_app)
#     return 'Data set'

@app.route('/phylotree_render', methods=['POST','GET'])
def tree_renderer():
    logging.info(f"Received form data: {request.form}")
    folder = request.form['folder']
    file = request.form['file']

    with open(os.path.join('database',folder,file), 'r') as f:
        content = f.read()
    return render_template('phylotree_render.html', content = content)


@app.route('/get_file',methods=['POST','GET'])
def get_file():
    folder=request.form['folder']
    file=request.form['file']
    pictures=os.listdir('database/'+folder+'/pictures')
    return send_from_directory('database', os.path.join(folder,file))

# @app.route('/get_file/<filename>')
def get_file(filename):
    # Read the .contree file and return its contents
    with open('path/to/mt_test/' + filename + '.contree', 'r') as f:
        return f.read()

'''
@app.route('/submit', methods=['POST'])
def submit_sequence():
    sequence = request.form['sequence']
    # Compare sequence with database and calculate results
    return render_template('results.html', results=results)
'''
@app.route('/tutorial',methods=['POST','GET'])
def tutorial():
    return render_template('tutorial.html')

@app.route('/results')
def results():
    return render_template('results.html')

@app.route('/submit', methods=['POST'])
def submit():
    sequence = request.form['sequence']
    # handle the POST request here
    # redirect the user to the "Results" page
    return redirect(url_for('results'))

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

if __name__ == '__main__':
    db.create_all()  # create tables
    app.run(debug=True)