import os
from pathlib import Path
import logging
import logging.handlers
import sys

# Base directory - derive based on current file location
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = "/ceph/ibmi/tgm/PhyloNaP/PhyloNaP_storage/"
# App configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "Sasha_PhyloNaP_paSSword")
PORT = int(os.environ.get("PORT", 443))
HOST = os.environ.get("HOST", "0.0.0.0")
#FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "True").lower() == "true"
FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "False").lower() == "true"

# Directory paths - use environment variables if set, otherwise use relative paths
TMP_DIRECTORY = os.environ.get("TMP_DIRECTORY", os.path.join(DATA_DIR, "tmp"))
DB_DIR = os.environ.get("DB_DIR", os.path.join(DATA_DIR, "PhyloNaP_database"))
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(DATA_DIR,"PhyloNaP_uploads"))


TREE_PLACEMENT_DIR = os.environ.get("TREE_PLACEMENT_DIR", os.path.join(BASE_DIR,"PhyloNaP_enzPlace"))
UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", os.path.join(BASE_DIR, "PhyloNaP_uploads"))

# SSL/TLS Certificate configuration                         
CERT_DIR = os.environ.get("CERT_DIR", os.path.join(BASE_DIR, "certificates"))
SSL_ENABLED = os.environ.get("SSL_ENABLED", "True").lower() == "true"
CERTFILE = os.environ.get("CERTFILE", os.path.join(CERT_DIR, "server-cert.pem"))
KEYFILE = os.environ.get("KEYFILE", os.path.join(CERT_DIR, "server-key.pem"))
CA_CERTS = os.environ.get("CA_CERTS", os.path.join(CERT_DIR, "ca-cert.pem"))


# Logging Configuration
LOG_DIR = os.environ.get("LOG_DIR", os.path.join(BASE_DIR, "logs"))
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
LOG_FORMAT = os.environ.get("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")
LOG_MAX_BYTES = int(os.environ.get("LOG_MAX_BYTES", 10485760))  # 10MB
LOG_BACKUP_COUNT = int(os.environ.get("LOG_BACKUP_COUNT", 5))

# Ensure log directory exists
os.makedirs(LOG_DIR, exist_ok=True)

# Add a filter to reduce noise in the logs
def setup_logger(name="phylonap"):
    """Set up and return a configured logger instance"""
    logger = logging.getLogger(name)
    
    # Set log level
    level = getattr(logging, LOG_LEVEL, logging.INFO)
    logger.setLevel(level)
    
    # Clear existing handlers to avoid duplicates
    if logger.hasHandlers():
        logger.handlers.clear()
    
    # Create rotating file handler with increased size
    file_handler = logging.handlers.RotatingFileHandler(
        os.path.join(LOG_DIR, f"{name}.log"),
        maxBytes=LOG_MAX_BYTES * 2,  # Double the log size
        backupCount=LOG_BACKUP_COUNT
    )
    
    # Create formatter
    formatter = logging.Formatter(LOG_FORMAT)
    file_handler.setFormatter(formatter)
    
    # Add console handler only in debug mode, not production
    if FLASK_DEBUG:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
    
    # Add file handler
    logger.addHandler(file_handler)
    
    return logger

# Reduce worker count and increase timeout
GUNICORN_CONFIG = {
    'bind': f"{HOST}:{PORT}",
    'workers': int(os.environ.get("GUNICORN_WORKERS", 2)),  # Reduced from 4 to 2
    'worker_class': 'eventlet',
    'threads': int(os.environ.get("GUNICORN_THREADS", 2)),
    'timeout': int(os.environ.get("GUNICORN_TIMEOUT", 300)),  # Increased from 120 to 300
    'graceful_timeout': int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", 60)),  # Increased
    'keepalive': int(os.environ.get("GUNICORN_KEEPALIVE", 5)),
    'accesslog': os.path.join(LOG_DIR, "access.log"),
    'errorlog': os.path.join(LOG_DIR, "error.log"),
    'loglevel': "info",  # Set to info to reduce log verbosity
    'max_requests': int(os.environ.get("GUNICORN_MAX_REQUESTS", 0)),  # Disable worker recycling
    'max_requests_jitter': int(os.environ.get("GUNICORN_MAX_REQUESTS_JITTER", 0)),  # Disable jitter
    'limit_request_line': int(os.environ.get("GUNICORN_LIMIT_REQUEST_LINE", 4094)),  # Increased from 4094
    'limit_request_fields': int(os.environ.get("GUNICORN_LIMIT_REQUEST_FIELD_SIZE", 100)),  # Increased from 8190
    'proc_name': "phylonap_gunicorn"
}
# Job Queue Configuration
MAX_CONCURRENT_JOBS = int(os.environ.get("MAX_CONCURRENT_JOBS", 2))
QUEUE_CHECK_INTERVAL = int(os.environ.get("QUEUE_CHECK_INTERVAL", 10))
JOB_TIMEOUT = int(os.environ.get("JOB_TIMEOUT", 3600))  # 1 hour default timeout