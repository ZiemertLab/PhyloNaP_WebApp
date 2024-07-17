from flask import Flask, render_template, request, redirect, url_for, Response, session
from ete3 import Tree, WebTreeApplication, NodeStyle
from ete3 import TreeStyle
import logging
from flask import send_from_directory


logging.basicConfig(level=logging.INFO)

class WSGIMiddleware:
    def __init__(self, flask_app):
        self.flask_app = flask_app

    def __call__(self, environ, start_response):
        logging.info(f"Received request: {environ['PATH_INFO']}")
        if environ['PATH_INFO'].startswith('/tree'):
            if environ['REQUEST_METHOD'] == 'POST':
                # Get the path to Newick string from the POST request
                

                folder = request.form['folder']
                filename = request.form['filename']
                newickString=send_from_directory('database', filename)

                # Save the Newick string in the session
                #session['newick_string'] = newick_string

                # Redirect the user to the tree page



            if newickString is not None:
                # Create a tree from the Newick string
                t = Tree(newickString)

                # Create a WebTreeApplication instance
                web_tree_app = WebTreeApplication(t)

                # Pass the request to the WebTreeApplication
                return web_tree_app(environ, start_response)
            else:
                # Handle the case where the Newick string is not in the session
                return self.flask_app(environ, start_response)
        else:
            logging.info("Falling back to original Flask app")
            return self.flask_app(environ, start_response)

        
    def __getattr__(self, name):
        return getattr(self.flask_app, name)