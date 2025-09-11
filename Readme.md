# PhyloNaP - Phylogenetic Natural Product Database

## Overview

PhyloNaP is the first large-scale resource dedicated to phylogenies of biosynthetic enzymes. The platform provides ~18,500 annotated and interactive phylogenetic trees enriched with chemical, functional, and taxonomic information. Users can classify their own sequences via phylogenetic placement, enabling functional inference in an evolutionary context.

**Website:** https://phylonap.cs.uni-tuebingen.de

## Abstract

Phylogenetic analysis is widely used to predict enzyme function, yet building annotated and reusable trees is labor-intensive. Existing resources rarely cover secondary metabolites' synthesising enzymes and lack the biosynthetic context needed for meaningful analysis.

We present PhyloNaP, the first large-scale resource dedicated to phylogenies of biosynthetic enzymes. PhyloNaP provides ~18,500 annotated and interactive trees enriched with chemical, functional, and taxonomic information. Users can classify their own sequences via phylogenetic placement, enabling functional inference in an evolutionary context. A contribution portal allows the community to submit curated trees. By combining scale, breadth of annotation, and interactive functionality, PhyloNaP fills a major gap in bioinformatics resources for enzyme discovery and annotation, with immediate applications to secondary metabolism and beyond.

## Key Features

### 🧬 Comprehensive Database
- **~18,500 phylogenetic trees** covering biosynthetic enzymes
- Focus on tailoring enzymes from bacterial biosynthetic gene clusters (BGCs)
- Integration with MiBiG, MITE, UniProt, and antiSMASH-DB
- Both curated expert datasets and automated pipeline-generated trees

### 🔍 Sequence Classification
- **Phylogenetic placement** of user-submitted sequences
- Functional inference in evolutionary context
- MMseqs2-based similarity search (30% identity, 50% coverage threshold)
- Visual placement results with confidence metrics

### 🌳 Interactive Tree Viewer
- Dynamic phylogenetic tree visualization
- **Rerooting, zooming, and branch spacing** adjustment
- **Toggleable annotations**: functional, taxonomic, BGC classifications
- **Chemical structure visualization** directly on trees
- **Hyperlinks to reference databases** (MiBiG, SwissProt, MITE, PanBGC)
- **Cluster family highlighting** with color coding

### 📊 Rich Metadata Integration
- Chemical, functional, and taxonomic annotations
- Experimental reaction data and validated BGCs
- Structure and reaction scheme display
- PanBGC integration for BGC family analysis

### 🤝 Community Contributions
- **Submission portal** for manually annotated trees
- Expert review process for quality assurance
- Growing collection of community-curated datasets

## Use Cases

### 🧪 Natural Product Discovery
- Predict biosynthetic functions of uncharacterized enzymes
- Identify novel enzymatic activities
- Connect sequences to chemical structures

### ⚗️ Enzyme Engineering
- Find homologs for synthetic biology applications
- Understand structure-function relationships
- Support rational enzyme design

### 🔬 Functional Annotation
- Classify tailoring enzymes in BGCs
- Predict substrate specificity
- Infer reaction mechanisms

### 📚 Research & Education
- Explore enzyme family evolution
- Visualize phylogenetic relationships
- Access curated reference trees

## Getting Started

1. **Browse Database**: Explore trees using filters for enzyme family, data source, or experimental annotations
2. **Analyze Sequences**: Submit FASTA sequences for phylogenetic placement
3. **Explore Results**: Use interactive tree viewer to examine placements and annotations
4. **Contribute**: Submit your own curated phylogenetic trees

## Technical Features

- **Web-based interface** - no software installation required
- **Interactive visualization** with D3.js
- **Multiple sequence alignment** (MAFFT)
- **Phylogenetic placement** pipeline
- **Database integration** with external resources
- **Export capabilities** for trees and alignments

## Data Sources

- **MiBiG**: Minimum Information about a Biosynthetic Gene cluster
- **MITE**: Marine Microbial Eukaryotic Transcriptome Sequencing Project
- **UniProt**: Universal Protein Resource
- **antiSMASH-DB**: Database of secondary metabolite biosynthetic gene clusters
- **PanBGC**: Pan-biosynthetic gene cluster database

## Installation & Development

### Prerequisites
- Python 3.8+
- Node.js (for frontend dependencies)
- Required Python packages (see `requirements.txt`)

### Setup

```bash
# Clone repository
git clone [repository-url]
cd PhyloNaP_WebApp

# Install Python dependencies
conda env create -f phylonap_test.yml
conda activate phylonap_test
# Run application
python app.py
```

Note: install the placement pipeline and the database separately — installation instructions coming soon.

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

