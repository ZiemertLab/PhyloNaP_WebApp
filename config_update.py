import os
from pathlib import Path

# Base directory - derive based on current file location
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = "/ceph/ibmi/tgm/PhyloNaP/PhyloNaP_storage/"
# App configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "Sasha_PhyloNaP_paSSword")
PORT = int(os.environ.get("PORT", 80))
HOST = os.environ.get("HOST", "0.0.0.0")
FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "True").lower() == "true"

# Directory paths - use environment variables if set, otherwise use relative paths
TMP_DIRECTORY = os.environ.get("TMP_DIRECTORY", os.path.join(DATA_DIR, "tmp"))
DB_DIR = os.environ.get("DB_DIR", os.path.join(DATA_DIR, "PhyloNaP_database"))
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(DATA_DIR,"PhyloNaP_uploads"))


TREE_PLACEMENT_DIR = os.environ.get("TREE_PLACEMENT_DIR", os.path.join(BASE_DIR,"PhyloNaP_enzPlace"))
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(BASE_DIR, "PhyloNaP_uploads"))

# SSL/TLS Certificate configuration
CERT_DIR = os.environ.get("CERT_DIR", os.path.join(BASE_DIR, "certificates"))
SSL_ENABLED = os.environ.get("SSL_ENABLED", "False").lower() == "true"
CERTFILE = os.environ.get("CERTFILE", os.path.join(CERT_DIR, "server-cert.pem"))
KEYFILE = os.environ.get("KEYFILE", os.path.join(CERT_DIR, "server-key.pem"))
CA_CERTS = os.environ.get("CA_CERTS", os.path.join(CERT_DIR, "ca-cert.pem"))