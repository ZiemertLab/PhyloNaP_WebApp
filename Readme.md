# PhyloNaP -  Phylogeny for Natural Product-producing enzymes

## Overview

PhyloNaP is the first large-scale resource dedicated to phylogenies of biosynthetic enzymes. The platform provides ~18,500 annotated and interactive phylogenetic trees enriched with chemical, functional, and taxonomic information. Users can classify their own sequences via phylogenetic placement, enabling functional inference in an evolutionary context.

**Website:** https://phylonap.cs.uni-tuebingen.de

## Abstract

Phylogenetic analysis is widely used to predict enzyme function, yet building annotated and reusable trees is labor-intensive. Existing resources rarely cover secondary metabolites' synthesising enzymes and lack the biosynthetic context needed for meaningful analysis.

We present PhyloNaP, the first large-scale resource dedicated to phylogenies of biosynthetic enzymes. PhyloNaP provides ~18,500 annotated and interactive trees enriched with chemical, functional, and taxonomic information. Users can classify their own sequences via phylogenetic placement, enabling functional inference in an evolutionary context. A contribution portal allows the community to submit curated trees. By combining scale, breadth of annotation, and interactive functionality, PhyloNaP fills a major gap in bioinformatics resources for enzyme discovery and annotation, with immediate applications to secondary metabolism and beyond.

## Key Features

### 🧬 Comprehensive Database
- **~18,500 phylogenetic trees** covering bacterial biosynthetic enzymes
- Focus on tailoring enzymes from bacterial biosynthetic gene clusters (BGCs)
- Integration with MiBiG, MITE, UniProt, and antiSMASH-DB
- Both curated expert datasets and automated pipeline-generated trees


### 🌳 Interactive Tree Viewer
- Dynamic phylogenetic tree visualization
- **Rerooting, zooming, and branch spacing** adjustment
- **Toggleable annotations**: functional, taxonomic, BGC classifications
- **Chemical structure visualization** directly on trees
- **Hyperlinks to reference databases** (MiBiG, SwissProt, MITE, PanBGC)
- **Highlighting proteins sourcing from the same BGC or Biosynthetic Gene Cluster Family (GCF)** with color coding

### 🔍 Sequence Classification
- **Phylogenetic placement** of user-submitted sequences
- Visual placement results with confidence metrics


### 🤝 Community Contributions
- **Submission portal** for manually annotated trees
- Expert review process for quality assurance


## Data Sources

- **MiBiG**: Minimum Information about a Biosynthetic Gene cluster
- **MITE**: Minimum Information about a Tailoring Enzyme
- **UniProt**: Universal Protein Resource
- **antiSMASH-DB**: Database of secondary metabolite biosynthetic gene clusters
- **PanBGC**: a user-friendly web tool to explore biosynthetic gene clusters (BGCs) diversity within Gene Cluster Families (GCFs)


### Setup the Web App locally

```bash
# Clone repository
git clone https://github.com/SashaKorenskaia/PhyloNaP_WebApp.git

# create folders nesessary for database to run
mkdir PhyloNaP_data
mkdir PhyloNaP_data/tmp
mkdir PhyloNaP_data/PhyloNaP_uploads

cd PhyloNaP_data
#download and unzip the PhyloNaP database
wget https://phylonap.cs.uni-tuebingen.de/download_file

# to be able to classify query sequence, insltall docker image (make sure that the docker installed and ruuning)
docker pull sashakorenskaia/phylonap-backend



# Install Python dependencies
cd ../PhyloNaP_WebApp
conda env create -f phylonap_test.yml
conda activate phylonap_test
```

create a config file **config_update.py** inside the PhyloNaP_WebApp directory: 

```python
import os
from pathlib import Path

# Base directory setup
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = os.path.join(BASE_DIR, "Phylonap_storage_local")

# Essential app configuration
PORT = int(os.environ.get("PORT", 8000))  # Using 8000 for local development
HOST = "127.0.0.1"  # localhost for local development
FLASK_DEBUG = True  # Enable debug mode for local development

# Required directory paths
TMP_DIRECTORY = os.path.join(DATA_DIR, "tmp")
DB_DIR = os.path.join(DATA_DIR, "PhyloNaP_database") #check that it matches with the directory name that you downloaded!
SQLITE_DB = os.path.join(DB_DIR, "phylonap.db")
UPLOAD_FOLDER = os.path.join(DATA_DIR, "PhyloNaP_uploads")

# SSL configuration (disabled for local development)
SSL_ENABLED = False
```

```bash
cd ..
python -m PhyloNaP_WebApp.app
cd PhyloNaP_WebApp

# Run application locally
flask run --host=127.0.0.1 --port=8000
```


Note: install the placement pipeline and the database separately — installation instructions coming soon.

The code for the protein classification pipeline available here:
https://github.com/SashaKorenskaia/PhyloNaP_placement_clean

## Third-Party Licenses

This product includes color specifications and designs developed by Cynthia Brewer (http://colorbrewer.org/).

This project includes third-party JavaScript libraries:
- **phylotree.js** by Stephen Shank and Sergei Pond (MIT License, https://github.com/veg/phylotree.js)
- **Colour Palette Generator** by Google (Apache License 2.0)
- **ColorBrewer** by Cynthia Brewer and others (Apache License 2.0)
- **Solarized** by Ethan Schoonover (MIT License)


License files are available in the `licenses/` directory.

## Citation

If you use PhyloNaP in your research, please cite:

[Citation will be added upon publication]

## Contact

**Mail:** For questions or feedback, please contact us at [aleksandra.korenskaia@uni-tuebingen.de](mailto:aleksandra.korenskaia@uni-tuebingen.de)

Ziemert Lab, University of Tübingen, Germany

## License

PhyloNaP is released under the [MIT License](https://opensource.org/licenses/MIT). The software is free to use for academic and commercial purposes.

## Contributing

We welcome community contributions! Please see our contribution guidelines and use the submission portal on the website to add your curated phylogenetic trees.

