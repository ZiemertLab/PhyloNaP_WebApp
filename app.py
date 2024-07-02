# app.py
from flask import Flask, render_template, request, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from ete3 import Tree, TreeStyle

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:////tmp/test.db'
db = SQLAlchemy(app)

class Sequence(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.String(500))

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/help')
def help_page():
    return render_template('help.html')

@app.route('/database')
def database_page():
    return render_template('database.html')

'''
@app.route('/submit', methods=['POST'])
def submit_sequence():
    sequence = request.form['sequence']
    # Compare sequence with database and calculate results
    return render_template('results.html', results=results)
'''
@app.route('/results')
def results():
    return render_template('results.html')

@app.route('/submit', methods=['POST'])
def submit():
    sequence = request.form['sequence']
    # handle the POST request here
    # redirect the user to the "Results" page
    return redirect(url_for('results'))

@app.route('/tree')
def tree_page():
    # Parse the tree file
    with open('database/mt_test/tree_file.txt', 'r') as f:
        tree_string = f.read()
    tree = Tree(tree_string)

    # Generate an image of the tree
    ts = TreeStyle()
    ts.show_leaf_name = True
    tree.render("static/tree_image.png", tree_style=ts)

    # Display the image on a webpage
    image_url = url_for('static', filename='tree_image.png')
    return render_template('tree.html', image_url=image_url)

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