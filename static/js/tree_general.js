// import { clearAllSelections } from './phylotree.js';

// import { select as d3select, drag as d3drag } from "//d3js.org/d3.v6.js";

// const d3 = {
//   select: d3select,
//   drag: d3drag,
//   line: d3line,
//   scaleSequential: d3scaleSequential,
//   interpolateReds: d3interpolateReds,
//   selectAll: d3selectAll,
//   // add other D3 functions here as needed
// };

// import phylotree from "/static/js/phylotree.js/dist/phylotree.js";

window.getContainerDimensions = function () {
  let container = d3.select('#tree');
  var line = d3.line()
    .x(function (d) { return x(d.date); })
    .y(function (d) { return y(d.close); });
  const width = container.node().getBoundingClientRect().width;
  // const height = container.node().getBoundingClientRect().height*0.8;
  const height = container.node().offsetHeight;
  // window.onload = function() {
  //   const container = d3.select('#tree');
  //   const height = container.node().getBoundingClientRect().height;
  //   c
  // }
  // const height = container.node().getBoundingClientRect().height;
  console.log(`initiate Width: ${width}, Height: ${height}`);
  return { container, width, height };
}

window.getTreeData = function () {

  const nwk = document.getElementById('tree_data').getAttribute('nwk_data');
  console.log("nwk = " + nwk);
  var metadata = JSON.parse(document.getElementById('tree_data').getAttribute('metadata'));
  var metadataList = document.getElementById('tree_data').getAttribute('metadata_list');
  var datasetDescr = document.getElementById('tree_data').getAttribute('datasetDescr');

  // var metadataList = JSON.parse(localStorage.getItem('metadataList'));
  console.log("metadataList = " + metadataList);
  console.log(typeof metadataList);

  metadataList = metadataList.replace(/'/g, '"');
  var metadataListArray1 = JSON.parse(metadataList);
  console.log("metadataListArray = ", metadataListArray1);
  console.log(typeof metadataListArray1);
  return { nwk, metadata, metadataListArray: metadataListArray1, datasetDescr };
}


// Add download dataset functionality
window.setupDownloadDataset = function (nwk, metadata) {

  // Download tree file (.nwk)
  window.downloadTreeFile = function () {
    try {
      const fileName = prompt('Enter a name for the tree file (default: phylogenetic_tree.nwk):', 'phylogenetic_tree.nwk') || 'phylogenetic_tree.nwk';
      if (!nwk) throw new Error('Tree data not found');
      const blob = new Blob([nwk], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download tree file: ' + error.message);
    }
  };

  // Download metadata file (.tsv)
  window.downloadMetadataFile = function () {
    try {
      const fileName = prompt('Enter a name for the metadata file (default: metadata.tsv):', 'metadata.tsv') || 'metadata.tsv';
      if (!metadata || metadata.length === 0) throw new Error('No metadata available');
      const headers = Object.keys(metadata[0]);
      const tsvContent = [
        headers.join('\t'),
        ...metadata.map(row =>
          headers.map(header => {
            const value = row[header];
            return value == null ? '' : String(value).replace(/\t/g, ' ');
          }).join('\t')
        )
      ].join('\n');
      const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Failed to download metadata file: ' + error.message);
    }
  };

  // Helper to attach listeners (can be called multiple times safely)
  function attachDownloadListeners() {
    const downloadTreeBtn = document.getElementById('download-tree-btn');
    if (downloadTreeBtn && !downloadTreeBtn._listenerAttached) {
      downloadTreeBtn.addEventListener('click', window.downloadTreeFile);
      downloadTreeBtn._listenerAttached = true;
    }
    const downloadMetadataBtn = document.getElementById('download-metadata-btn');
    if (downloadMetadataBtn && !downloadMetadataBtn._listenerAttached) {
      downloadMetadataBtn.addEventListener('click', window.downloadMetadataFile);
      downloadMetadataBtn._listenerAttached = true;
    }
  }

  // Attach listeners after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachDownloadListeners);
  } else {
    attachDownloadListeners();
  }

  // Also, if you render buttons dynamically, call this again after rendering.
};

// Add this at the end of tree_general.js, after the existing functions

// === FONT ADJUSTMENT FUNCTIONALITY ===
window.setupTreeNameFontAdjustment = function () {
  // Function to adjust tree name font size based on number of lines
  function adjustTreeNameFontSize() {
    const treeNameElement = document.getElementById('tree_name');
    if (!treeNameElement) {
      console.log('Tree name element not found');
      return;
    }

    // ALWAYS log that this function is running
    console.log('=== adjustTreeNameFontSize STARTED ===');

    // Reset to default size first
    treeNameElement.classList.remove('js-resized');
    treeNameElement.style.removeProperty('--js-font-size');

    // Force a reflow to get accurate measurements
    treeNameElement.offsetHeight;

    // Get the element's dimensions
    const elementHeight = treeNameElement.offsetHeight;
    const computedStyle = window.getComputedStyle(treeNameElement);
    const lineHeight = parseFloat(computedStyle.lineHeight);
    const fontSize = parseFloat(computedStyle.fontSize);

    // ALWAYS log these measurements
    console.log(`MEASUREMENTS:`, {
      elementHeight,
      lineHeight,
      fontSize,
      textLength: treeNameElement.textContent.length,
      containerWidth: treeNameElement.offsetWidth
    });

    // Try different line height calculations
    const calculatedLines1 = Math.round(elementHeight / lineHeight);
    const calculatedLines2 = Math.round(elementHeight / fontSize);
    const calculatedLines3 = Math.round(elementHeight / (fontSize * 1.2));

    console.log(`LINE CALCULATIONS:`, {
      calculatedLines1,
      calculatedLines2,
      calculatedLines3
    });

    // Use character-based estimation as primary method
    const textLength = treeNameElement.textContent.length;
    const containerWidth = treeNameElement.offsetWidth;
    const avgCharWidth = fontSize * 0.6; // Rough estimate
    const charsPerLine = Math.floor(containerWidth / avgCharWidth);
    const estimatedLines = Math.ceil(textLength / charsPerLine);

    console.log(`CHARACTER-BASED ESTIMATION:`, {
      textLength,
      containerWidth,
      avgCharWidth,
      charsPerLine,
      estimatedLines
    });

    // Use the character-based estimation if it seems more reliable
    let numberOfLines = estimatedLines;

    // Fallback to height-based calculation if character estimation seems off
    if (estimatedLines <= 1 && calculatedLines1 > 1) {
      numberOfLines = calculatedLines1;
      console.log('Using height-based calculation as fallback');
    }

    console.log(`FINAL numberOfLines: ${numberOfLines}`);

    // If more than 3 lines, aggressively reduce font size
    if (numberOfLines > 3) {
      console.log(`Tree name has ${numberOfLines} lines, adjusting font size...`);
      let newFontSize;

      if (numberOfLines === 4) {
        newFontSize = '24px';  // Much smaller - regular text size
      } else if (numberOfLines === 5) {
        newFontSize = '22px';  // Smaller
      } else if (numberOfLines === 6) {
        newFontSize = '20px';  // Even smaller
      } else {
        newFontSize = '16px';  // Very small but readable
      }

      // Set the custom property and add the class
      treeNameElement.style.setProperty('--js-font-size', newFontSize);
      treeNameElement.classList.add('js-resized');
      treeNameElement.style.setProperty('line-height', '1.1', 'important');
      treeNameElement.style.setProperty('font-weight', '600', 'important');

      console.log(`Adjusted tree name to: ${newFontSize}`);

      // Check again after adjustment
      setTimeout(() => {
        const newHeight = treeNameElement.offsetHeight;
        const newComputedStyle = window.getComputedStyle(treeNameElement);
        const newLineHeight = parseFloat(newComputedStyle.lineHeight);
        const newFontSize = parseFloat(newComputedStyle.fontSize);
        const newLines = Math.round(newHeight / newLineHeight);
        console.log(`After adjustment: ${newLines} lines (height: ${newHeight}, lineHeight: ${newLineHeight}, fontSize: ${newFontSize})`);
      }, 50);
    } else {
      console.log('Tree name fits in 3 lines or less, no adjustment needed');
    }

    console.log('=== adjustTreeNameFontSize ENDED ===');
  }

  // Also check what other scripts might be affecting the element
  function checkForOtherScripts() {
    console.log('=== CHECKING FOR OTHER SCRIPTS ===');
    const treeNameElement = document.getElementById('tree_name');
    if (treeNameElement) {
      // Monitor for any changes to the element
      const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            console.log('STYLE CHANGED BY SOMETHING ELSE:', {
              oldValue: mutation.oldValue,
              newValue: treeNameElement.style.cssText,
              target: mutation.target
            });
          }
        });
      });

      observer.observe(treeNameElement, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['style', 'class']
      });

      console.log('Style change monitor installed');
    }
  }

  // Run when DOM is loaded
  document.addEventListener('DOMContentLoaded', function () {
    console.log('=== DOM LOADED (from tree_general.js) ===');
    checkForOtherScripts();
    setTimeout(adjustTreeNameFontSize, 500);
  });

  // Also run when window is resized
  window.addEventListener('resize', function () {
    console.log('=== WINDOW RESIZED (from tree_general.js) ===');
    setTimeout(adjustTreeNameFontSize, 500);
  });

  // Expose the function globally so it can be called manually
  window.adjustTreeNameFontSize = adjustTreeNameFontSize;
};

// Auto-initialize when the script loads
window.setupTreeNameFontAdjustment();

window.createTree = function (nwk) {
  return new phylotree.phylotree(nwk);
}

window.setupEventListeners = function (tree) {
  document.querySelectorAll("[data-direction]").forEach(function (element) {
    element.addEventListener("click", function (e) {
      console.log("y spacing 1: ", tree.display.spacing_y());
      console.log("x spacing 1: ", tree.display.spacing_x());
      var which_function =
        this.getAttribute("data-direction") == "vertical"
          ? tree.display.spacing_x.bind(tree.display)
          : tree.display.spacing_y.bind(tree.display)
      console.log("non vertical spacing: ", tree.display.spacing_y());
      console.log("y spacing 2 data-amount: ", Number(this.getAttribute("data-amount")));
      which_function(which_function() + Number(this.getAttribute("data-amount"))).update();

      // Add cache invalidation after spacing changes
      if (window.invalidateColumnCache) {
        window.invalidateColumnCache();
      }
    });
  });

  document.querySelectorAll(".phylotree-layout-mode").forEach(function (element) {
    element.addEventListener("click", function (e) {
      if (tree.display.radial() != (this.getAttribute("data-mode") == "radial")) {
        document.querySelectorAll(".phylotree-layout-mode").forEach(function (btn) {
          btn.classList.toggle("active");
        });
        tree.display.radial(!tree.display.radial()).update();

        // Add cache invalidation after layout changes
        if (window.invalidateColumnCache) {
          window.invalidateColumnCache();
        }
      }
    });
  });

  document.querySelectorAll('.phylotree-align-toggler').forEach(function (toggler) {
    toggler.addEventListener('click', function (e) {
      if (!tree || !tree.display || !tree.display.options) {
        console.error('Tree display options are not defined');
        return;
      }
      var button_align = this.getAttribute('data-align');
      var tree_align = tree.display.options.alignTips;

      if (tree_align != button_align) {
        tree.display.alignTips(button_align == 'right');
        document.querySelectorAll('.phylotree-align-toggler').forEach(function (toggler) {
          toggler.classList.toggle('active');
        });
        tree.display.update();

        // Add cache invalidation after alignment changes
        if (window.invalidateColumnCache) {
          window.invalidateColumnCache();
        }
      }
    });
  });

  // document.querySelectorAll(".reroot-button").forEach(function(element) {
  //   element.addEventListener("click", function(e) {
  //     const nodeId = this.getAttribute("data-node-id");
  //     const node = tree.getNodeById(nodeId);
  //     if (node) {
  //       const hierarchyNode = d3.hierarchy(node.data);
  //       debugger
  //       tree.reroot(node).update();
  //     }
  //   });
  // });
  document.querySelectorAll('.phylotree-align-toggler').forEach(function (toggler) {
    toggler.addEventListener('click', function (e) {
      if (!tree || !tree.display || !tree.display.options) {
        console.error('Tree display options are not defined');
        return;
      }
      var button_align = this.getAttribute('data-align');
      var tree_align = tree.display.options.alignTips;

      if (tree_align != button_align) {
        tree.display.alignTips(button_align == 'right');
        document.querySelectorAll('.phylotree-align-toggler').forEach(function (toggler) {
          toggler.classList.toggle('active');
        });
        tree.display.update();
      }
      // window.setTreeSize(width, height)
    });
  });

  // remove this (non working) option for now  
  //   document.getElementById('midpoint-root-btn').addEventListener('click', function() {
  //     const result = phylotree.computeMidpoint(tree);
  //     console.log('Midpoint result:', result);
  //   });
}
// document.querySelector("#toggle_animation").addEventListener("click", function(e) {
//   var current_mode = this.classList.contains("active");
//   this.classList.toggle("active");
//   tree.options({ transitions: !current_mode });
// });







// Compute the layout of the tree
// var tree_align = tree.display.options.alignTips;
// console.log("printing tree_align");
// console.log(tree_align);
//tree.display.alignTips(button_align == "right");

//console.log(leaves);
//leaves=tree.getLeaves();
//console.log("printing leaves");

// additional functions
function default_tree_settings() {
  tree = phylotree();
  tree.branchLength(null);
  tree.branchName(null);
  tree.display.radial(false).separation(function (a, b) {
    return 0;
  });
}

function node_colorizer(element, data) {
  try {
    var count_class = 0;

    selection_set.forEach(function (d, i) {
      if (data[d]) {
        count_class++;
        element.style(
          "fill",
          color_scheme(i),
          i == current_selection_id ? "important" : null
        );
      }
    });

    if (count_class > 1) {
    } else {
      if (count_class == 0) {
        element.style("fill", null);
      }
    }
  } catch (e) { }
}

function edge_colorizer(element, data) {

  try {
    var count_class = 0;

    selection_set.forEach(function (d, i) {
      if (data[d]) {
        count_class++;
        element.style(
          "stroke",
          color_scheme(i),
          i == current_selection_id ? "important" : null
        );
      }
    });

    if (count_class > 1) {
      element.classed("branch-multiple", true);
    } else if (count_class == 0) {
      element.style("stroke", null).classed("branch-multiple", false);
    }
  } catch (e) { }
}

// Render the tree
// add the selection to the tree
window.renderTree = function (tree, height, width, customOptions) {
  const commonOptions = {
    container: '#tree',
    height: height,
    width: width,
    "left-right-spacing": "fixed-step",
    'align-tips': false,
    'internal-names': false,
    //'left-right-spacing': 'fit-to-size', 
    // 'top-bottom-spacing': 'fit-to-size',
    'top-bottom-spacing': 'fixed-step',
    // if spacing minimum is too unsuitable (too big), the button of changing the tree spacing will not work
    // 'minimum-per-level-spacing': 150,
    // 'maximum-per-level-spacing': 400,
    // 'minimum-per-node-spacing': 100,
    // 'maximum-per-node-spacing': 200,
    // 'zoom': true,
    'zoom': false,
    // 'node-styler': colorNodesByName,
    "draw_scale_bar": true,
    // reroot: true,
    'fixed_width': [250, 500],
  };
  const options = { ...commonOptions, ...customOptions };
  console.log('options:', options);

  let renderedTree = tree.render(options);

  // current_selection_name = $("#selection_name_box").val(),
  // current_selection_name = selection_set[current_selection_id];
  // current_selection_id = 0,
  // $('#tree_container').on('reroot', function (e) {  
  //   update_selection_names();

  //   tree.display.countHandler(count => {
  //     $("#selected_branch_counter").text(function(d) {
  //       return count[current_selection_name];
  //     });
  //   });

  // });

  // tree.display.selectionLabel(current_selection_name);

  // tree.display.countHandler(count => {
  //   $("#selected_branch_counter").text(function(d) {
  //     return count[current_selection_name];
  //   });
  // });



  // update_selection_names();

  // $("#newick_modal").modal("hide");

  // $(tree.display.container).empty();
  // $(tree.display.container).html(tree.display.show()); 
  d3.select('#tree svg')
    .call(d3.drag().on("drag", null));

  return renderedTree
}

// Add this function to get tree positioning information
window.getTreePositionInfo = function (tree) {
  // console.log('=== Checking tree object ===');
  // console.log('Tree:', tree);
  // console.log('Tree.display:', tree ? tree.display : 'tree is null/undefined');

  if (!tree.display) {
    console.warn('Tree display not available');
    return null;
  }

  const display = tree.display;

  return {
    // Most distant leaf position (rightmost in linear layout)
    rightMostLeaf: display.right_most_leaf,

    // Tree extents (bounding box)
    extents: display._extents,

    // Scale information
    scales: display.scales,

    // Size information
    size: display.size,

    // Offsets (padding)
    offsets: display.offsets,
    leftOffset: display.options["left-offset"],

    // Font and spacing
    shownFontSize: display.shown_font_size,
    labelWidth: display.label_width,

    // Layout type
    isRadial: display.radial(),
    layout: display.options["layout"],

    // Calculate column start position
    getColumnStartPosition: function () {
      // This is where your annotation columns should start
      return display.right_most_leaf + 20; // Add 20px padding
    },

    // Get scale bar end position
    getScaleEndPosition: function () {
      if (display.radial()) {
        return display.radius;
      } else {
        // return display.size[1] - display.offsets[1] - display.options["left-offset"] - display.shown_font_size;
        return display.size[1];
      }
    }
  };
};

// Render bootstrap values
window.drawBootstrapValues = function (tree) {
  bootstrapNodes = tree.getInternals();
  colorScale = d3.scaleSequential(d3.interpolateReds);
  colorNodesByName = function (element, data) {
    if (_.includes(bootstrapNodes, data)) {
      element.style("stroke", colorScale(parseFloat(data.data.name) / 100));
    }
  };
}
// Set up a click event handler on the SVG
// $('#tree svg').on('click', function() {
//   // Set the width and height to the initial values
//   $(this).attr('width', initialWidth);
//   $(this).attr('height', initialHeight);
// });
//d3.select('#tree svg')
//  .call(d3.drag().on("drag", null));

window.checkSVGSize = function () {
  // Create a new MutationObserver
  setTimeout(function () {
    // Select the SVG element
    var svg = document.querySelector('#tree svg');

    // Create a new MutationObserver
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === 'width' || mutation.attributeName === 'height') {
          console.log('SVG size changed:', svg.getAttribute('width'), svg.getAttribute('height'));
        }
      });
    });

    // Start observing the SVG for attribute changes
    observer.observe(svg, { attributes: true });
  }, 1000);

  console.log(tree.Width, tree.Height);
  console.log(`Width: ${width}, Height: ${height}`);
  d3.select('#tree svg')
    .attr('width', width)
    .attr('height', height);
}
// Add images after the tree has been rendered

// nodes.append("line")
//   .attr("x1", 0)
//   .attr("y1", 0)
//   .attr("x2", 200)
//   .attr("y2", 0)
//   .attr("stroke", "black");

// Add this function to tree_general.js

/**
 * Create external links table from metadata
 * @param {Object} metadata - The metadata object containing sequence information
 */
window.createExternalLinksTable = function (metadata) {
  console.log('createExternalLinksTable called with:', metadata);

  const hyperlinkContainer = document.getElementById('hyperlink-container');

  if (!hyperlinkContainer) {
    console.error('hyperlink-container element not found');
    return;
  }

  // Clear existing content except the header
  const header = hyperlinkContainer.querySelector('h4');
  hyperlinkContainer.innerHTML = '';
  if (header) {
    hyperlinkContainer.appendChild(header);
  }

  // Handle both array and object formats
  let metadataArray = [];
  if (Array.isArray(metadata)) {
    metadataArray = metadata;
  } else if (metadata && typeof metadata === 'object') {
    // Convert object to array
    metadataArray = Object.values(metadata);
  } else {
    console.warn('Invalid metadata format:', typeof metadata);
    const noDataMsg = document.createElement('p');
    noDataMsg.textContent = 'No external links available - invalid metadata format';
    noDataMsg.style.fontStyle = 'italic';
    noDataMsg.style.color = '#666';
    hyperlinkContainer.appendChild(noDataMsg);
    return;
  }

  if (metadataArray.length === 0) {
    const noDataMsg = document.createElement('p');
    noDataMsg.textContent = 'No external links available - empty metadata';
    noDataMsg.style.fontStyle = 'italic';
    noDataMsg.style.color = '#666';
    hyperlinkContainer.appendChild(noDataMsg);
    return;
  }

  console.log('Processing metadata array with', metadataArray.length, 'items');
  console.log('First item keys:', Object.keys(metadataArray[0] || {}));

  // Define link templates for different ID types
  const linkTemplates = {
    'Uniprot_ID': {
      name: 'UniProt',
      url: 'https://www.uniprot.org/uniprotkb/{id}',
      description: 'Protein sequence and functional information'
    },
    'mibig': {
      name: 'MIBiG',
      url: 'https://mibig.secondarymetabolites.org/repository/{id}',
      description: 'Biosynthetic gene cluster information'
    },
    'PDB_IDs': {
      name: 'PDB',
      url: 'https://www.rcsb.org/structure/{id}',
      description: 'Protein structure data'
    },
    'MITE_ID': {
      name: 'MITE',
      url: 'https://mite.bioinformatics.nl/repository/{id}',
      description: 'Metabolic information'
    },
    'FAM_ID': {
      name: 'PanBGC',
      url: 'https://panbgc-db.cs.uni-tuebingen.de/bgc/{id}',
      description: 'Protein family information'
    }
  };

  // Collect all external links
  const externalLinks = [];

  // Iterate through all sequences in metadata
  metadataArray.forEach((sequenceData, index) => {
    if (!sequenceData || typeof sequenceData !== 'object') {
      console.warn(`Invalid sequence data at index ${index}:`, sequenceData);
      return;
    }

    const sequenceId = sequenceData.ID || sequenceData.id || `sequence_${index}`;

    // Check each column type for IDs
    Object.keys(linkTemplates).forEach(columnName => {
      const columnValue = sequenceData[columnName];

      if (columnValue &&
        columnValue !== '' &&
        columnValue !== 'NaN' &&
        columnValue !== 'nan' &&
        columnValue !== 'null' &&
        columnValue !== null &&
        columnValue !== 'undefined') {

        const template = linkTemplates[columnName];

        // Convert to string and handle multiple IDs separated by semicolon, comma, or pipe
        const rawIds = String(columnValue);
        const ids = rawIds.split(/[;,|]/).map(id => id.trim()).filter(id => id && id !== '');

        ids.forEach(id => {
          // Clean the ID (remove any prefixes/suffixes if needed)
          const cleanId = cleanIdentifier(id, columnName);

          if (cleanId) {
            externalLinks.push({
              id: cleanId,
              originalId: id,
              source: template.name,
              url: template.url.replace('{id}', cleanId),
              description: template.description,
              sequenceId: sequenceId
            });
          }
        });
      }
    });
  });

  console.log('Found', externalLinks.length, 'external links');

  // Remove duplicates
  const uniqueLinks = removeDuplicateLinks(externalLinks);

  console.log('After removing duplicates:', uniqueLinks.length, 'links');

  if (uniqueLinks.length === 0) {
    const noLinksMsg = document.createElement('p');
    noLinksMsg.textContent = 'No external links found in metadata';
    noLinksMsg.style.fontStyle = 'italic';
    noLinksMsg.style.color = '#666';
    hyperlinkContainer.appendChild(noLinksMsg);
    return;
  }

  // Create table
  const table = document.createElement('table');
  table.className = 'table table-sm table-striped';
  table.style.fontSize = '12px';
  table.style.marginTop = '10px';

  // Create header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['ID', 'Source', 'Link'].forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    th.style.backgroundColor = '#f8f9fa';
    th.style.fontWeight = 'bold';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Create body
  const tbody = document.createElement('tbody');

  // Group links by source for better organization
  const linksBySource = {};
  uniqueLinks.forEach(link => {
    if (!linksBySource[link.source]) {
      linksBySource[link.source] = [];
    }
    linksBySource[link.source].push(link);
  });

  // Add rows to table
  Object.keys(linksBySource).sort().forEach(source => {
    linksBySource[source].forEach((link, index) => {
      const row = document.createElement('tr');

      // ID column
      const idCell = document.createElement('td');
      idCell.textContent = link.id;
      idCell.style.fontFamily = 'monospace';
      row.appendChild(idCell);

      // Source column (only show for first item of each source)
      const sourceCell = document.createElement('td');
      if (index === 0) {
        sourceCell.textContent = link.source;
        sourceCell.style.fontWeight = 'bold';
      }
      row.appendChild(sourceCell);

      // Link column
      const linkCell = document.createElement('td');
      const linkElement = document.createElement('a');
      linkElement.href = link.url;
      linkElement.target = '_blank';
      linkElement.textContent = 'View';
      linkElement.style.color = '#3D3D3D';
      linkElement.style.textDecoration = 'underline';
      linkElement.title = `${link.description} - ${link.id}`;

      // Add external link icon if Font Awesome is available
      if (typeof FontAwesome !== 'undefined' || document.querySelector('link[href*="font-awesome"]')) {
        const icon = document.createElement('i');
        icon.className = 'fa fa-external-link';
        icon.style.marginLeft = '4px';
        icon.style.fontSize = '10px';
        linkElement.appendChild(icon);
      }

      linkCell.appendChild(linkElement);
      row.appendChild(linkCell);

      tbody.appendChild(row);
    });
  });

  table.appendChild(tbody);
  hyperlinkContainer.appendChild(table);

  // Add a summary
  const summary = document.createElement('p');
  summary.style.fontSize = '11px';
  summary.style.color = '#666';
  summary.style.marginTop = '10px';
  summary.textContent = `Found ${uniqueLinks.length} external links from ${Object.keys(linksBySource).length} sources`;
  hyperlinkContainer.appendChild(summary);

  console.log('External links table created successfully');
};

/**
 * Clean identifier based on the column type
 * @param {string} id - Raw identifier
 * @param {string} columnName - Column name to determine cleaning strategy
 * @returns {string} - Cleaned identifier
 */
function cleanIdentifier(id, columnName) {
  if (!id || typeof id !== 'string') return '';

  // Remove common prefixes and clean up
  let cleanId = id.trim();

  switch (columnName) {
    case 'Uniprot_ID':
      // UniProt IDs are typically 6-10 characters, alphanumeric
      cleanId = cleanId.replace(/^(UniProt:|UP:)/i, '');
      break;
    case 'mibig':
      // MIBiG IDs are typically BGC followed by 7 digits
      cleanId = cleanId.replace(/^(MIBiG:|BGC-)/i, '');
      if (!cleanId.startsWith('BGC') && /^\d{7}$/.test(cleanId)) {
        cleanId = 'BGC' + cleanId;
      }
      break;
    case 'PDB_IDs':
      // PDB IDs are 4 characters
      cleanId = cleanId.replace(/^(PDB:|pdb:)/i, '');
      cleanId = cleanId.toUpperCase();
      break;
    case 'MITE_ID':
      // Clean MITE IDs
      cleanId = cleanId.replace(/^(MITE:|mite:)/i, '');
      break;
    case 'FAM_ID':
      // Pfam IDs typically start with PF
      cleanId = cleanId.replace(/^(Pfam:|PF:)/i, '');
      if (!cleanId.startsWith('PF') && /^\d+/.test(cleanId)) {
        cleanId = 'PF' + cleanId.padStart(5, '0');
      }
      break;
  }

  return cleanId;
}

/**
 * Remove duplicate links based on ID and source
 * @param {Array} links - Array of link objects
 * @returns {Array} - Array of unique links
 */
function removeDuplicateLinks(links) {
  const seen = new Set();
  return links.filter(link => {
    const key = `${link.source}:${link.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Update external links when a node is selected
 * @param {Object} nodeData - Selected node data
 * @param {Object} fullMetadata - Complete metadata object
 */
window.updateExternalLinksForNode = function (nodeData, fullMetadata) {
  if (!nodeData || !nodeData.name) {
    // Show all links if no specific node is selected
    createExternalLinksTable(fullMetadata);
    return;
  }

  // Filter metadata for the selected node
  const nodeMetadata = {};
  if (fullMetadata[nodeData.name]) {
    nodeMetadata[nodeData.name] = fullMetadata[nodeData.name];
  }

  createExternalLinksTable(nodeMetadata);
};

// Initialize external links table when page loads
document.addEventListener('DOMContentLoaded', function () {
  // This will be called when the tree is loaded and metadata is available
  if (window.treeMetadata) {
    createExternalLinksTable(window.treeMetadata);
  }
});

window.addImagesAndMetadata = function (tree, metadata, metadataListArray) {

  let activeColumns = 0;
  let maxColumns = 0;
  let columnSlots = [];
  let warningTimeout = null; // Add timeout variable

  // Add these new variables for caching column positions
  let cachedColumnStartX = null;
  let cachedTreeWidth = null;
  let cachedTreeHeight = null;


  // Function to get or calculate column start position
  function getColumnStartX() {
    const positionInfo = window.getTreePositionInfo(tree);

    if (!positionInfo) {
      console.warn('Could not get tree position info, using fallback');
      return 200; // Fallback value
    }

    // Check if we need to recalculate (tree size changed or first time)
    const currentWidth = positionInfo.size ? positionInfo.size[0] : 0;
    const currentHeight = positionInfo.size ? positionInfo.size[1] : 0;

    if (cachedColumnStartX === null ||
      cachedTreeWidth !== currentWidth ||
      cachedTreeHeight !== currentHeight) {

      cachedColumnStartX = positionInfo.getScaleEndPosition() + 70;
      cachedTreeWidth = currentWidth;
      cachedTreeHeight = currentHeight;

      console.log(`Column start position updated: ${cachedColumnStartX}`);
    }

    return cachedColumnStartX;
  }

  // Function to invalidate cache (call this when tree is updated)
  function invalidateColumnPositionCache() {
    cachedColumnStartX = null;
    cachedTreeWidth = null;
    cachedTreeHeight = null;
    console.log('Column position cache invalidated');
  }
  window.invalidateColumnCache = invalidateColumnPositionCache;
  // Calculate maximum columns based on container width
  function calculateMaxColumns() {
    const container = document.getElementById('tree-container') || document.getElementById('tree');
    const containerWidth = container ? container.offsetWidth : window.innerWidth;
    const columnWidth = 200;
    const treeMinWidth = getColumnStartX(); // Use the new function to get column start position
    const availableWidth = containerWidth - treeMinWidth;
    maxColumns = Math.max(1, Math.floor(availableWidth / columnWidth));

    // Resize columnSlots array if needed
    if (columnSlots.length !== maxColumns) {
      const oldSlots = [...columnSlots];
      columnSlots = new Array(maxColumns).fill(false);
      // Copy existing slots
      for (let i = 0; i < Math.min(oldSlots.length, maxColumns); i++) {
        columnSlots[i] = oldSlots[i];
      }
    }

    console.log(`Max columns: ${maxColumns}`);
    return maxColumns;
  }

  // Find next available slot
  function getNextAvailableSlot() {
    for (let i = 0; i < columnSlots.length; i++) {
      if (!columnSlots[i]) {
        return i;
      }
    }
    return -1;
  }

  // Free a column slot
  function freeColumnSlot(columnName) {
    const slotIndex = columnSlots.indexOf(columnName);
    if (slotIndex !== -1) {
      columnSlots[slotIndex] = false;
    }
    return slotIndex;
  }

  // Get CSS variable function
  function getCSSVariable(variableName) {
    return getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  }

  // Show warning when user tries to exceed limit
  function showColumnWarning() {
    let warningContainer = document.getElementById('column-warning');

    if (!warningContainer) {
      warningContainer = createWarningContainer();
    }

    // Clear any existing timeout
    if (warningTimeout) {
      clearTimeout(warningTimeout);
    }

    // If warning is already visible, trigger blink effect
    if (warningContainer.style.display === 'block') {
      blinkWarning(warningContainer);
    } else {
      // Show the warning with full opacity
      warningContainer.style.display = 'block';
      warningContainer.style.opacity = '1';
    }

    warningContainer.textContent = `Maximum ${maxColumns} columns reached. Remove some annotations to add new ones.`;

    // Set timeout to fade out after 3 seconds (reduced from 5 seconds)
    warningTimeout = setTimeout(() => {
      fadeOutWarning(warningContainer);
    }, 1000);
  }

  // Add new blink function
  function blinkWarning(warningContainer) {
    // Quick blink effect - flash the warning
    warningContainer.style.transform = 'translate(-50%, -50%) scale(1.1)';
    warningContainer.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.4)'; // Changed to darker, subtler shadow

    setTimeout(() => {
      warningContainer.style.transform = 'translate(-50%, -50%) scale(1)';
      warningContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    }, 150);

    // Also add a quick opacity blink
    warningContainer.style.opacity = '0.7';
    setTimeout(() => {
      warningContainer.style.opacity = '1';
    }, 100);
  }

  // Add the missing fadeOutWarning function after the blinkWarning function:
  function fadeOutWarning(warningContainer) {
    let opacity = 1;
    const fadeInterval = setInterval(() => {
      opacity -= 0.1; // Changed from 0.05 to 0.1 for faster fade
      warningContainer.style.opacity = opacity;

      if (opacity <= 0) {
        clearInterval(fadeInterval);
        warningContainer.style.display = 'none';
      }
    }, 40); // Changed from 50ms to 40ms for faster fade (10 steps * 40ms = 400ms total)
  }

  // Update the createWarningContainer function to remove the bright border:
  function createWarningContainer() {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'column-warning';

    // Position the warning 15% higher than center (0.5 - 0.15 = 0.35)
    const treeContainer = document.getElementById('tree-container') || document.getElementById('tree');
    const containerRect = treeContainer ? treeContainer.getBoundingClientRect() : { top: 100, left: 50, width: 400, height: 400 };

    warningDiv.style.cssText = `
      position: fixed;
      top: ${containerRect.top + (containerRect.height * 0.35)}px;
      left: ${containerRect.left + (containerRect.width * 0.5)}px;
      transform: translate(-50%, -50%);
      z-index: 1000;
      background-color: #E0E0E0;
      color: #7B1B38;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: none;
      opacity: 1;
      transition: all 0.15s ease-in-out;
      white-space: nowrap;
      text-align: center;
    `;

    document.body.appendChild(warningDiv);

    // Update position on window resize (also 15% higher)
    window.addEventListener('resize', () => {
      const newRect = treeContainer ? treeContainer.getBoundingClientRect() : { top: 100, left: 50, width: 400, height: 400 };
      warningDiv.style.top = `${newRect.top + (newRect.height * 0.35)}px`;
      warningDiv.style.left = `${newRect.left + (newRect.width * 0.5)}px`;
    });

    return warningDiv;
  }
  // Add the checkImagesExist function after createWarningContainer:
  async function checkImagesExist(metadata, imageType) {
    console.log('=== checkImagesExist STARTED ===');
    console.log('metadata:', metadata);
    console.log('metadata length:', metadata ? metadata.length : 'metadata is null/undefined');
    console.log('imageType:', imageType);

    if (!metadata || metadata.length === 0) {
      console.warn('No metadata available for image check');
      return false;
    }

    // For BGC_product, scan the entire dataset until we find a BGC
    if (imageType === 'BGC_product') {
      console.log('Scanning entire dataset for BGC entries...');

      let bgcCount = 0;
      for (let i = 0; i < metadata.length; i++) {
        const item = metadata[i];

        if (item.hasOwnProperty('Cluster') && item.Cluster && item.Cluster.startsWith("BGC")) {
          bgcCount++;
          console.log(`*** FOUND BGC entry ${bgcCount} at index ${i}: ${item.Cluster} ***`);

          // Test this BGC entry for images
          let bgc = item.Cluster;
          let bgc1 = bgc.split('.')[0];
          let image1 = "/static/images/" + bgc + "_1.png";
          let image2 = "/static/images/" + bgc1 + "_1.png";

          console.log('Testing BGC:', bgc);
          console.log('BGC1 (split):', bgc1);
          console.log('Image1 path:', image1);
          console.log('Image2 path:', image2);

          try {
            const response1 = await fetch(image1, { method: 'HEAD' });
            const response2 = await fetch(image2, { method: 'HEAD' });

            console.log('Response1 status:', response1.status, response1.ok);
            console.log('Response2 status:', response2.status, response2.ok);

            if (response1.ok || response2.ok) {
              console.log('*** FOUND WORKING BGC IMAGE! ***');
              return true;
            }
          } catch (error) {
            console.log('Fetch error for BGC:', error);
          }

          // Stop after testing first 10 BGC entries to avoid too many requests
          if (bgcCount >= 10) {
            console.log('Tested 10 BGC entries, stopping search');
            break;
          }
        }

        // Log progress every 50 items to see scan progress
        if (i % 50 === 0) {
          console.log(`Scanned ${i} items, found ${bgcCount} BGC entries so far`);
        }
      }

      console.log(`Finished scanning. Total BGC entries found: ${bgcCount}`);
      if (bgcCount === 0) {
        console.log('No BGC entries found in entire dataset');
      }
      return false;
    }

    // For other image types (Reaction), use the original logic with sample
    const sampleSize = Math.min(10, metadata.length);
    const sampleEntries = metadata.slice(0, sampleSize);

    console.log('sampleSize:', sampleSize);
    console.log('sampleEntries:', sampleEntries);

    for (let item of sampleEntries) {
      console.log('Processing item:', item);

      if (imageType === 'Reaction') {
        let image = "/static/images_reactions/" + item.ID + ".png";
        try {
          const response = await fetch(image, { method: 'HEAD' });
          if (response.ok) {
            return true;
          }
        } catch (error) {
          continue;
        }
      }
    }

    console.log('No images found for imageType:', imageType);
    console.log('=== checkImagesExist END ===');
    return false;
  }

  // Initialize on first call
  calculateMaxColumns();

  function colorSameCluster() {
    let columnName = 'Cluster';

    // SAFETY CHECK: Ensure metadata exists and has the required column
    if (!metadata || metadata.length === 0) {
      console.error('No metadata available for clustering');
      return;
    }

    if (!metadata[0].hasOwnProperty(columnName)) {
      console.error(`Column '${columnName}' not found in metadata`);
      console.log('Available columns:', Object.keys(metadata[0]));
      return;
    }

    if (metadata.length > 0) {
      let columnNames = Object.keys(metadata[0]);
      console.log("Available columns:", columnNames);
    } else {
      console.log("No metadata available.");
    }

    console.log(columnName);
    let annot = metadata.reduce((obj, item) => {
      obj[item["ID"]] = item[columnName];
      return obj;
    }, {});

    console.log('annot:', annot);
    let nodes = d3.selectAll('.node').filter(d => annot.hasOwnProperty(d.data.name));

    // Group nodes by their text content
    let textGroups = {};
    nodes.each(function (d) {
      let text = annot[d.data.name];
      console.log('text:', text);
      if (text !== null && text !== undefined && text !== '') {
        if (!textGroups[text]) {
          textGroups[text] = [];
        }
        textGroups[text].push(this);
      }
    });

    // Filter out text groups with only one element
    textGroups = Object.keys(textGroups).filter(text => textGroups[text].length > 1).reduce((obj, key) => {
      obj[key] = textGroups[key];
      return obj;
    }, {});

    console.log('textGroups with more than one:', textGroups);

    if (Object.keys(textGroups).length === 0) {
      console.log('No clusters with multiple members found');
      return;
    }

    var clusters_colors = palette('tol-rainbow', Object.keys(textGroups).length);
    Object.keys(textGroups).forEach((text, index) => {
      textGroups[text].forEach(node => {
        let textElement = d3.select(node).select('text');
        if (textElement.node()) {
          let bbox = textElement.node().getBBox();
          d3.select(node)
            .insert('rect', 'text')
            .attr('x', bbox.x - 2) // Adjust as needed
            .attr('y', bbox.y - 2) // Adjust as needed
            .attr('width', bbox.width + 4) // Adjust as needed
            .attr('height', bbox.height + 4) // Adjust as needed
            .style('fill', clusters_colors[index]); // Use different color from clusters_colors
        }
      });
    });
  }
  function removeColors() {
    d3.selectAll('rect').remove();
  }
  // Add column header functions
  function createColumnHeader(columnName, slotIndex) {
    console.log(`Creating header: ${columnName} at slot ${slotIndex}`); // Add this line

    // Remove any existing header for this slot
    d3.selectAll(`.column-header[data-slot="${slotIndex}"]`).remove();

    const treeSvg = d3.select('#tree svg');

    if (treeSvg.empty()) {
      console.warn('Tree SVG not found for header placement');
      return;
    }

    const headerX = getColumnStartX() + 20 + slotIndex * 200;
    // const headerX = 200 + slotIndex * 200;
    const headerY = 20; // Position above the tree content

    console.log(`Header position: x=${headerX}, y=${headerY}`); // Add this line

    // Add header text to the SVG
    const headerElement = treeSvg.append('text')
      .attr('class', 'column-header')
      .attr('data-slot', slotIndex)
      .attr('x', headerX)
      .attr('y', headerY)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('font-weight', 'bold')
      .attr('fill', '#7B1B38')
      .text(columnName);

    console.log('Header element created:', headerElement.node()); // Add this line
  }

  function removeColumnHeader(slotIndex) {
    d3.selectAll(`.column-header[data-slot="${slotIndex}"]`).remove();
  }
  function renderNP() {
    const slotIndex = getNextAvailableSlot();
    if (slotIndex === -1) {
      console.warn('No available column slots for NP');
      return false;
    }

    columnSlots[slotIndex] = 'NP';

    // Add this line:
    createColumnHeader('BGC Products', slotIndex);

    let columnName = 'Cluster';
    if (metadata.length > 0) {
      let columnNames = Object.keys(metadata[0]);
      console.log("Available columns:", columnNames);
    } else {
      console.log("No metadata available.");
    }
    console.log(columnName);
    let annot = metadata.reduce((obj, item) => {
      obj[item["ID"]] = item[columnName];
      return obj;
    }, {});
    console.log('annot:', annot);
    let nodes = d3.selectAll('.node').filter(d => annot.hasOwnProperty(d.data.name));
    nodes.each(function (d) {
      let transformValue = d3.select(this).attr('transform');
      // Fix: Use the same approach as metadata
      let match = transformValue.match(/translate\s*\(\s*([0-9.-]+)/);
      let translateValues = parseFloat(match[1]);

      let bgc = annot[d.data.name];
      if (bgc && bgc.startsWith("BGC")) {
        let bgc1 = bgc.split('.')[0];
        console.log(bgc, ': Checking images');

        let image1 = "static/images/" + bgc + "_1.png";
        let image2 = "static/images/" + bgc1 + "_1.png";
        console.log('Checking image1:', image1);
        console.log('Checking image2:', image2);

        // Function to check if an image exists
        async function imageExists(image_url) {
          try {
            const response = await fetch(image_url, { method: 'HEAD' });
            return response.ok;
          } catch {
            return false;
          }
        }

        // Check if the image exists
        Promise.all([imageExists(image1), imageExists(image2)]).then(([exists1, exists2]) => {
          let image;
          if (exists1) {
            image = image1;
          } else if (exists2) {
            image = image2;
          } else {
            console.log('Image does not exist for both naming conventions');
            return;
          }

          let img = d3.select(this).append("image")
            .attr('xlink:href', image)
            .attr('x', (d) => {
              return getColumnStartX() + slotIndex * 200 - translateValues; // Now translateValues is a number
            })
            .attr('y', -50)
            .attr('width', 100)
            .attr('height', 100)
            .attr('class', "NP")
            .attr('data-slot', slotIndex); // Add slot tracking

          console.log('image:width', img.attr('width'));

          img.on('click', function () {
            d3.select('#enlarged-image').attr('src', image);
          });
        });
      }
    });
    return true;
  }

  function hideNP() {
    const freedSlot = freeColumnSlot('NP');
    removeColumnHeader(freedSlot); // Add this line
    d3.selectAll('image.NP').remove();
    console.log(`Freed NP from slot ${freedSlot}`);
  }

  function renderReaction() {
    const slotIndex = getNextAvailableSlot();
    if (slotIndex === -1) {
      console.warn('No available column slots for Reaction');
      return false;
    }

    columnSlots[slotIndex] = 'Reaction';

    // Add this line:
    createColumnHeader('Reactions', slotIndex);

    let nodes = d3.selectAll('.node').filter(d => !d.data.name.startsWith("AS0"));
    nodes.each(function (d) {
      let transformValue = d3.select(this).attr('transform');
      // Fix: Use the same approach as metadata
      let match = transformValue.match(/translate\s*\(\s*([0-9.-]+)/);
      let translateValues = parseFloat(match[1]);

      let id = d.data.name;
      let image = "static/images_reactions/" + id + ".png";
      if (image) {
        fetch(image)
          .then(response => {
            if (response.ok) {
              let img = d3.select(this).append("image")
                .attr('xlink:href', image)
                .attr('x', (d) => {
                  return getColumnStartX() + slotIndex * 200 - translateValues; // Now translateValues is a number
                })
                .attr('y', -50)
                .attr('width', 100)
                .attr('height', 100)
                .attr('class', "Reaction")
                .attr('data-slot', slotIndex);

              img.on('click', function () {
                d3.select('#enlarged-image').attr('src', image);
              });

            } else {
              console.log('Image does not exist:', image);
            }
          })
          .catch(error => {
            console.log('Error checking image:', error);
          });
      }
    });
    return true;
  }

  function hideReaction() {
    const freedSlot = freeColumnSlot('Reaction');
    removeColumnHeader(freedSlot); // Add this line
    d3.selectAll('image.Reaction').remove();
    console.log(`Freed Reaction from slot ${freedSlot}`);
  }

  function renderMetadata(columnName) {
    const slotIndex = getNextAvailableSlot();
    if (slotIndex === -1) {
      console.warn(`No available column slots for ${columnName}`);
      return false;
    }

    columnSlots[slotIndex] = columnName;

    // Add these lines:
    const displayName = columnName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    createColumnHeader(displayName, slotIndex);

    let annot = metadata.reduce((obj, item) => {
      obj[item["ID"]] = item[columnName];
      return obj;
    }, {});
    console.log('metadata:', columnName, annot);
    setTimeout(function () {
      // Select the nodes where you want to add the image
      // let nodes = d3.selectAll('.node').filter(d => annot.hasOwnProperty(d.data.name));
      // nodes.append("text")
      // .text(function (d) { return annot[d.data.name]; }) // Use the text method here
      // .attr('x', 400)
      // .attr('y', 0);
      //let leaveFontSize = d3.select('.leaf-class').style('font-size');
      let nodes = d3.selectAll('.node').filter(d => annot.hasOwnProperty(d.data.name));
      nodes.each(function (d) {
        let text = annot[d.data.name];
        if (text) { // Check if text is not null
          let leaveFontSize = d3.select(this).attr('font-size');
          let transformValue = d3.select(this).attr('transform');
          // let translateValues = transformValue.match(/translate\(([^)]+)\)/)[1].split(',').map(Number);
          // let translateValues = transformValue.match(/translate\(([^,]+),([^)]+)\)/)[1];
          // let translateValues = transformValue.match(/translate\(([^,]+),([^)]+)\)/).slice(1).map(Number);
          let match = transformValue.match(/translate\s*\(\s*([0-9.-]+)/);
          let translateValues = parseFloat(match[1]);
          // console.log('transformValue:', transformValue);
          // console.log('translateValues:', translateValues);
          // let textElement = d3.select(this).append('text').attr('x', 200+activeColumns*200+translateValues).attr('y', 0).attr('class', columnName).attr("font-size", leaveFontSize);
          // let textElement = d3.select(this).append('text').attr('x', activeColumns*200-translateValues).attr('y', 0).attr('class', columnName).attr("font-size", leaveFontSize).attr("debugging", translateValues);
          let textElement = d3.select(this).append('text')
            // .attr('x', 200 + slotIndex * 200 - translateValues) // Use slotIndex
            .attr('x', (d) => {

              return getColumnStartX() + slotIndex * 200 - translateValues;

            })
            .attr('y', 0)
            .attr('class', columnName)
            .attr("font-size", leaveFontSize)
            .attr("debugging", translateValues)
            .attr('data-slot', slotIndex); // Add slot tracking

          if (text.length > 80) {
            let firstLine = text.substring(0, 80);
            let secondLine = text.substring(80);

            textElement.append('tspan').text(firstLine);
            textElement.append('tspan').attr('x', 400).attr('dy', '1em').text(secondLine);
          } else {
            textElement.text(text);
          }
        }
      });
    }, 0);

    return true;
  }
  function hideMetadata(columnName) {
    const freedSlot = freeColumnSlot(columnName);
    removeColumnHeader(freedSlot); // Add this line
    d3.selectAll(`text.${columnName}`).remove();
    console.log(`Freed ${columnName} from slot ${freedSlot}`);
  }
  // Check if the buttons exist and the event listeners are being attached
  // console.log(document.getElementById('enzyme-function-button'));
  // console.log(document.getElementById('species-button'));
  // console.log(document.getElementById('biosyn-class-button'));

  // ['Enzyme_function', 'Species', 'biosyn_class'].forEach(id => {

  // Annotation field in the tree-controls area - animate the buttons when clicked
  const buttonContainer = document.querySelector('.button-container') || document.getElementById('button-container') || document.body;

  metadataListArray.forEach(id => {
    let button = document.getElementById(id);
    button.dataset.active = 'false'; // Add data-active attribute

    button.addEventListener('click', function () {
      // Check if slots are available for inactive buttons
      if (button.dataset.active === 'false' && getNextAvailableSlot() === -1) {
        console.warn('No available slots for new columns');
        showColumnWarning(); // Show warning when user tries to add more
        return;
      }

      if (button.dataset.active === 'false') {
        if (renderMetadata(id)) {
          button.dataset.active = 'true';
          button.classList.add('active-button');
          button.classList.remove('non-active-button');
        }
      } else {
        hideMetadata(id);
        button.dataset.active = 'false';
        button.classList.remove('active-button');
        button.classList.add('non-active-button');
      }
    });
    buttonContainer.appendChild(button);
  });

  ["cluster"].forEach(id => {
    // CHECK if 'Cluster' column exists in metadata before creating button
    let hasClusterColumn = false;
    if (metadata && metadata.length > 0) {
      hasClusterColumn = metadata[0].hasOwnProperty('Cluster');
      console.log('Checking for Cluster column:', hasClusterColumn);
      console.log('Available columns:', Object.keys(metadata[0]));
    }

    // Only create button if Cluster column exists
    if (hasClusterColumn) {
      let button = document.getElementById(id);
      if (button) {
        button.dataset.active = 'false'; // Add data-active attribute

        button.addEventListener('click', function () {
          if (button.dataset.active === 'false') {
            // If the button is not active, display the content and set the button to active
            colorSameCluster(id);
            button.dataset.active = 'true';
            button.classList.add('active-button');
            button.classList.remove('non-active-button');
          } else {
            // If the button is active, hide the content and set the button to inactive
            removeColors(id);
            button.dataset.active = 'false';
            button.classList.remove('active-button');
            button.classList.add('non-active-button');
          }
        });
        buttonContainer.appendChild(button);
        console.log('Cluster button created and added');
      } else {
        console.log('Cluster button element not found in DOM');
      }
    } else {
      console.log('Cluster column not found in metadata - button not created');
      // OPTIONAL: Hide the button if it exists in HTML but shouldn't be shown
      let button = document.getElementById(id);
      if (button) {
        button.style.display = 'none';
        console.log('Cluster button hidden because column does not exist');
      }
    }
  });


  // Remove the updateButtonStates calls and the old resize handler
  // Just keep the calculateMaxColumns call:
  calculateMaxColumns();

  // Simplified resize handler
  window.addEventListener('resize', function () {
    const oldMaxColumns = maxColumns;

    // Invalidate cache on resize
    invalidateColumnPositionCache();

    calculateMaxColumns();

    if (maxColumns < oldMaxColumns) {
      // Handle overflow - remove columns that no longer fit
      for (let i = maxColumns; i < oldMaxColumns; i++) {
        if (columnSlots[i]) {
          const columnName = columnSlots[i];
          console.log(`Removing ${columnName} due to resize`);

          const button = document.getElementById(columnName) ||
            document.getElementById(columnName === 'NP' ? 'BGC_product' : columnName);
          if (button && button.dataset.active === 'true') {
            button.click();
          }
        }
      }
    }
  });

  // Check BGC_product images and conditionally show button
  (async function () {
    let hasBGCImages = false;
    if (metadata && metadata.length > 0) {
      hasBGCImages = await checkImagesExist(metadata, 'BGC_product');
      console.log('Checking for BGC_product images:', hasBGCImages);
    }

    ["BGC_product"].forEach(id => {
      let button = document.getElementById(id);

      if (hasBGCImages && button) {
        button.dataset.active = 'false';

        button.addEventListener('click', function () {
          if (button.dataset.active === 'false' && getNextAvailableSlot() === -1) {
            console.warn('No available slots for new columns');
            showColumnWarning();
            return;
          }

          if (button.dataset.active === 'false') {
            if (renderNP()) {
              tree.display.spacing_x(50).update();
              button.dataset.active = 'true';
              button.classList.add('active-button');
              button.classList.remove('non-active-button');
              console.log(`Button ${id} activated`);
            }
          } else {
            hideNP();
            button.dataset.active = 'false';
            button.classList.remove('active-button');
            button.classList.add('non-active-button');
            console.log(`Button ${id} deactivated`);
          }
        });

        // ADD THIS LINE:
        // buttonContainer.appendChild(button);
        console.log('BGC_product button created and added');
      } else {
        console.log('BGC_product images not found - button hidden');
        if (button) {
          button.style.display = 'none';
        }
      }
    });
  })();

  // Check Reaction images and conditionally show button
  (async function () {
    let hasReactionImages = false;
    if (metadata && metadata.length > 0) {
      hasReactionImages = await checkImagesExist(metadata, 'Reaction');
      console.log('Checking for Reaction images:', hasReactionImages);
    }

    ["Reaction"].forEach(id => {
      let button = document.getElementById(id);

      if (hasReactionImages && button) {
        button.dataset.active = 'false';

        button.addEventListener('click', function () {
          if (button.dataset.active === 'false' && getNextAvailableSlot() === -1) {
            console.warn('No available slots for new columns');
            showColumnWarning();
            return;
          }

          if (button.dataset.active === 'false') {
            if (renderReaction()) {
              tree.display.spacing_x(50).update();
              button.dataset.active = 'true';
              button.classList.add('active-button');
              button.classList.remove('non-active-button');
            }
          } else {
            hideReaction();
            button.dataset.active = 'false';
            button.classList.remove('active-button');
            button.classList.add('non-active-button');
          }
        });

        // ADD THIS LINE:
        // buttonContainer.appendChild(button);
        console.log('Reaction button created and added');
      } else {
        console.log('Reaction images not found - button hidden');
        if (button) {
          button.style.display = 'none';
        }
      }
    });
  })();
  // Initialize external links with the metadata we already have
  console.log('Initializing external links with metadata from addImagesAndMetadata');
  window.treeMetadata = metadata;
  if (window.createExternalLinksTable) {
    createExternalLinksTable(metadata);
  }
}

window.setupSaveImageButton = function () {

  // define the function for saving the image

  var datamonkey_save_image = function (type, container) {
    var prefix = {
      xmlns: "http://www.w3.org/2000/xmlns/",
      xlink: "http://www.w3.org/1999/xlink",
      svg: "http://www.w3.org/2000/svg"
    };

    function get_styles(doc) {
      function process_stylesheet(ss) {
        try {
          if (ss.cssRules) {
            for (var i = 0; i < ss.cssRules.length; i++) {
              var rule = ss.cssRules[i];
              if (rule.type === 3) {
                // Import Rule
                process_stylesheet(rule.styleSheet);
              } else {
                // hack for illustrator crashing on descendent selectors
                if (rule.selectorText) {
                  if (rule.selectorText.indexOf(">") === -1) {
                    styles += "\n" + rule.cssText;
                  }
                }
              }
            }
          }
        } catch (e) {
          //console.log("Could not process stylesheet : " + ss); // eslint-disable-line
        }
      }

      var styles = "",
        styleSheets = doc.styleSheets;

      if (styleSheets) {
        for (var i = 0; i < styleSheets.length; i++) {
          process_stylesheet(styleSheets[i]);
        }
      }

      return styles;
    }
    // var svg = $(container).find("svg")[0];
    // if (!svg) {
    //   svg = $(container)[0];
    // }
    var svg = document.querySelector('svg');
    if (svg) {
      svg.setAttribute("version", "1.1");
    } else {
      console.log('SVG element not found');
    }

    var styles = get_styles(window.document);

    svg.setAttribute("version", "1.1");

    var defsEl = document.createElement("defs");
    svg.insertBefore(defsEl, svg.firstChild);

    var styleEl = document.createElement("style");
    defsEl.appendChild(styleEl);
    styleEl.setAttribute("type", "text/css");

    // removing attributes so they aren't doubled up
    svg.removeAttribute("xmlns");
    svg.removeAttribute("xlink");

    // These are needed for the svg
    if (!svg.hasAttributeNS(prefix.xmlns, "xmlns")) {
      svg.setAttributeNS(prefix.xmlns, "xmlns", prefix.svg);
    }

    if (!svg.hasAttributeNS(prefix.xmlns, "xmlns:xlink")) {
      svg.setAttributeNS(prefix.xmlns, "xmlns:xlink", prefix.xlink);
    }

    var source = new XMLSerializer()
      .serializeToString(svg)
      .replace("</style>", "<![CDATA[" + styles + "]]></style>");
    var doctype =
      '<?xml version="1.0" standalone="no"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">';
    var to_download = [doctype + source];
    var image_string =
      "data:image/svg+xml;base66," + encodeURIComponent(to_download);

    if (navigator.msSaveBlob) {
      // IE10
      download(image_string, "image.svg", "image/svg+xml");
    } else if (type == "png") {
      b64toBlob(
        image_string,
        function (blob) {
          var url = window.URL.createObjectURL(blob);
          var pom = document.createElement("a");
          pom.setAttribute("download", "image.png");
          pom.setAttribute("href", url);
          $("body").append(pom);
          pom.click();
          pom.remove();
        },
        function (error) {
          console.log(error); // eslint-disable-line
        }
      );
    } else {
      var pom = document.createElement("a");
      pom.setAttribute("download", "image.svg");
      pom.setAttribute("href", image_string);
      $("body").append(pom);
      pom.click();
      pom.remove();
    }
  };

  // Save the image

  var saveImageBtn = document.querySelector("#save_image");
  if (saveImageBtn) {
    saveImageBtn.addEventListener("click", function (e) {
      datamonkey_save_image("svg", "#tree_container");
    });
  } else {
    console.log('Save image button not found');
  }
}

window.setTreeSize = function (width, height) {
  console.log('Tree rendered, set up the proper size');
  setTimeout(function () {
    d3.select('#tree svg')
      .attr('width', width);
    // .attr('height', height);
  }, 1000);
}

window.setTreeSizeWH = function (width, height) {
  console.log('Tree rendered, set up the proper size');
  setTimeout(function () {
    d3.select('#tree svg')
      .attr('width', width)
      .attr('height', height);
  }, 10000);
}

window.showTree = function (tree) {
  console.log('showing tree');
  $(tree.display.container).html(tree.display.show());
}

window.setupSplitPanel = function () {
  // At the end of tree_rendering.js
  $(document).ready(function () {
    Split(['.tree-panel', '.details'], {
      // Split(['.tree', '.details'], {
      sizes: [75, 25],
      minSize: 100,
      gutterSize: 5,
      cursor: 'col-resize'
    });
  });
}
window.iterateOverJplaceNodes = function () {
  // check if the jplace annotation is parsed
  let nodes = d3.selectAll('.node');
  nodes.each(function (d) {
    annotation = d.data.annotation;
    console.log(annotation);
  });
}

//window.getEnzymesSummary = function(tree, node, metadata, metadataListArray) {
// Get all the leaves that are included in the subtree
// selectedNodes=tree.selectAllDescendants(node, true, false)
// console.log("Print the selected nodes");
// console.log(selectedNodes);



// window.getEnzymesSummary = function() {
//   document.addEventListener('terminalNodesSelected', a => console.log('?', a.detail.data.name))

// }
// // Function to process terminal nodes
// function processTerminalNodes(nodes) {
//   console.log("Processing terminal nodes:", nodes);
// }
// Function to process terminal nodes
window.processTerminalNodes = function (nodes) {
  console.log("Processing terminal nodes:", nodes);
}

// Add event listener for the custom event
window.addEventListener("terminalNodesSelected", function (event) {
  const terminal_nodes = event.detail;
  window.processTerminalNodes(terminal_nodes);
});


const getMetadataSubset = function (nodeNames, metadata) {
  const filteredTable = metadata.filter(row => nodeNames.includes(row.ID));
  //console.log('Filtered metadata table:', filteredTable);
  return filteredTable;
}
const getMetadataSummary = function (filteredTable) {
  let summary = {};
  filteredTable.forEach(row => {
    for (const [key, value] of Object.entries(row)) {
      if (key === 'ID' || value === null) continue; // Skip the 'ID' column
      if (!summary[key]) {
        summary[key] = {};
      }
      if (!summary[key][value]) {
        summary[key][value] = 0;
      }
      summary[key][value]++;
    }
  });
  return summary;
}

// const displayMetadataSummary = function(summary) {
//   const summaryContainer = document.getElementById('summary-container');
//   if (summaryContainer) {
//     summaryContainer.innerHTML = ''; // Clear previous content

//     for (const [key, values] of Object.entries(summary)) {
//       const columnDiv = document.createElement('div');
//       columnDiv.classList.add('summary-column');
//       const columnTitle = document.createElement('h3');
//       columnTitle.textContent = key;
//       columnDiv.appendChild(columnTitle);

//       for (const [value, count] of Object.entries(values)) {
//         const valueDiv = document.createElement('div');
//         valueDiv.textContent = `${value}: ${count}`;
//         columnDiv.appendChild(valueDiv);
//       }

//       summaryContainer.appendChild(columnDiv);
//     }
//   } else {
//     console.error('summaryContainer element not found');
//   }
// }

const displayMetadataSummary = function (summary, showPlacementHeader = false) {
  const summaryContainer = document.getElementById('summary-container');
  const metadataHeading = document.getElementById('metadata-summary-heading');

  if (summaryContainer) {
    summaryContainer.innerHTML = ''; // Clear previous content

    // Filter out empty columns and calculate diversity scores
    const validColumns = [];
    for (const [key, values] of Object.entries(summary)) {
      const valueEntries = Object.entries(values).filter(([value, count]) => value !== null && value !== undefined && value !== '');

      if (valueEntries.length > 0) {
        const totalCount = valueEntries.reduce((sum, [, count]) => sum + count, 0);
        const uniqueValues = valueEntries.length;

        // Calculate diversity score (fewer unique values = more interesting)
        const diversityScore = uniqueValues / totalCount;

        validColumns.push({
          key,
          values: Object.fromEntries(valueEntries),
          uniqueValues,
          totalCount,
          diversityScore
        });
      }
    }

    // Show the heading only if we have valid content
    if (metadataHeading && validColumns.length > 0) {
      metadataHeading.style.display = 'block';
    } else if (metadataHeading) {
      metadataHeading.style.display = 'none';
      return; // Exit early if no valid columns
    }

    // Add Placement status header if requested
    if (showPlacementHeader && validColumns.length > 0) {
      const statusHeader = document.createElement('div');
      statusHeader.style.cssText = `
            font-size: 12px; 
            color: #6c757d; 
            margin-bottom: 8px;
          `;
      statusHeader.innerHTML = '<strong>For the clade of placements</strong>';
      summaryContainer.appendChild(statusHeader);
    }

    // Sort columns by diversity score (ascending - least diverse first)
    validColumns.sort((a, b) => a.diversityScore - b.diversityScore);

    // Determine which columns to show expanded by default
    const maxAutoExpanded = 3;
    let autoExpandedCount = 0;

    validColumns.forEach((column, index) => {
      const { key, values, uniqueValues, totalCount } = column;

      const columnDiv = document.createElement('div');
      columnDiv.classList.add('summary-column');
      columnDiv.setAttribute('draggable', 'true');
      columnDiv.setAttribute('data-column-key', key);
      columnDiv.style.cssText = `
        margin-bottom: 15px;
        border-left: 3px solid #7B1B38;
        padding-left: 10px;
        background-color: white;
        border-radius: 6px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        transition: all 0.2s ease;
        cursor: grab;
        position: relative;
      `;

      // Add drag & drop styling and functionality
      let draggedElement = null;

      columnDiv.addEventListener('dragstart', (e) => {
        draggedElement = columnDiv;
        columnDiv.style.opacity = '0.6';
        columnDiv.style.cursor = 'grabbing';
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', columnDiv.outerHTML);
      });

      columnDiv.addEventListener('dragend', (e) => {
        columnDiv.style.opacity = '1';
        columnDiv.style.cursor = 'grab';
        columnDiv.style.transform = 'none';
        // Remove all drag indicators
        document.querySelectorAll('.summary-column').forEach(col => {
          col.style.borderTop = '';
          col.style.borderBottom = '';
        });
      });

      columnDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        if (draggedElement && draggedElement !== columnDiv) {
          const rect = columnDiv.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;

          // Show drop indicator
          if (e.clientY < midpoint) {
            columnDiv.style.borderTop = '3px solid #7B1B38';
            columnDiv.style.borderBottom = '';
          } else {
            columnDiv.style.borderBottom = '3px solid #7B1B38';
            columnDiv.style.borderTop = '';
          }
        }
      });

      columnDiv.addEventListener('dragleave', (e) => {
        // Only remove borders if we're really leaving the element
        const rect = columnDiv.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
          e.clientY < rect.top || e.clientY > rect.bottom) {
          columnDiv.style.borderTop = '';
          columnDiv.style.borderBottom = '';
        }
      });

      columnDiv.addEventListener('drop', (e) => {
        e.preventDefault();

        if (draggedElement && draggedElement !== columnDiv) {
          const rect = columnDiv.getBoundingClientRect();
          const midpoint = rect.top + rect.height / 2;

          // Insert the dragged element
          if (e.clientY < midpoint) {
            summaryContainer.insertBefore(draggedElement, columnDiv);
          } else {
            summaryContainer.insertBefore(draggedElement, columnDiv.nextSibling);
          }
        }

        // Clean up styles
        columnDiv.style.borderTop = '';
        columnDiv.style.borderBottom = '';
      });

      // Create header with statistics and move controls
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = `
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 8px 0;
        border-radius: 4px;
        transition: background-color 0.2s;
        position: relative;
      `;

      // Add hover effect
      headerDiv.addEventListener('mouseenter', () => {
        headerDiv.style.backgroundColor = '#f5f5f5';
      });
      headerDiv.addEventListener('mouseleave', () => {
        headerDiv.style.backgroundColor = 'transparent';
      });

      // Add drag handle icon
      const dragHandle = document.createElement('span');
      dragHandle.innerHTML = '⋮⋮'; // Vertical dots
      dragHandle.style.cssText = `
        color: #999;
        font-size: 16px;
        margin-right: 8px;
        cursor: grab;
        user-select: none;
        line-height: 1;
        letter-spacing: -2px;
      `;
      dragHandle.addEventListener('mousedown', () => {
        dragHandle.style.cursor = 'grabbing';
      });
      dragHandle.addEventListener('mouseup', () => {
        dragHandle.style.cursor = 'grab';
      });

      const columnTitle = document.createElement('h3');
      columnTitle.textContent = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      columnTitle.style.cssText = `
        font-size: 16px;
        margin: 0;
        font-weight: 600;
        color: #333;
        flex: 1;
      `;

      // Add statistics badge
      const statsSpan = document.createElement('span');
      statsSpan.textContent = `(${uniqueValues} ${uniqueValues === 1 ? 'value' : 'values'})`;
      statsSpan.style.cssText = `
        font-size: 12px;
        color: #666;
        margin-left: 8px;
        font-weight: normal;
      `;

      // Color code based on diversity
      if (uniqueValues <= 2) {
        statsSpan.style.color = '#d73502'; // Red for most interesting (least diverse)
        statsSpan.style.fontWeight = '500';
      } else if (uniqueValues <= 4) {
        statsSpan.style.color = '#f57c00'; // Orange for moderately interesting
      }

      // Add arrow buttons for manual reordering
      const arrowContainer = document.createElement('div');
      arrowContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        margin-left: 8px;
        gap: 2px;
      `;

      const upArrow = document.createElement('button');
      upArrow.innerHTML = '▲';
      upArrow.style.cssText = `
        background: none;
        border: none;
        color: #7B1B38;
        cursor: pointer;
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 2px;
        transition: background-color 0.2s;
        line-height: 1;
      `;
      upArrow.addEventListener('mouseenter', () => upArrow.style.backgroundColor = '#e8e8e8');

      upArrow.addEventListener('mouseleave', () => upArrow.style.backgroundColor = 'transparent');
      upArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const prevSibling = columnDiv.previousElementSibling;
        if (prevSibling && prevSibling.classList.contains('summary-column')) {
          summaryContainer.insertBefore(columnDiv, prevSibling);
        }
      });

      const downArrow = document.createElement('button');
      downArrow.innerHTML = '▼';
      downArrow.style.cssText = `
        background: none;
        border: none;
        color: #7B1B38;
        cursor: pointer;
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 2px;
        transition: background-color 0.2s;
        line-height: 1;
      `;
      downArrow.addEventListener('mouseenter', () => downArrow.style.backgroundColor = '#e8e8e8');
      downArrow.addEventListener('mouseleave', () => downArrow.style.backgroundColor = 'transparent');
      downArrow.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextSibling = columnDiv.nextElementSibling;
        if (nextSibling && nextSibling.classList.contains('summary-column')) {
          summaryContainer.insertBefore(nextSibling, columnDiv);
        }
      });

      arrowContainer.appendChild(upArrow);
      arrowContainer.appendChild(downArrow);

      // Create toggle button
      const shouldExpand = (autoExpandedCount < maxAutoExpanded && uniqueValues <= 4) || uniqueValues <= 2;
      if (shouldExpand) autoExpandedCount++;

      const toggleButton = document.createElement('button');
      toggleButton.innerHTML = shouldExpand ? '&#9660;' : '&#9654;'; // Down or right arrow
      toggleButton.classList.add('toggle-button');
      toggleButton.style.cssText = `
        background: none;
        border: none;
        font-size: 14px;
        color: #7B1B38;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 3px;
        transition: background-color 0.2s;
        margin-left: 8px;
      `;

      // Toggle button hover effect
      toggleButton.addEventListener('mouseenter', () => {
        toggleButton.style.backgroundColor = '#e8e8e8';
      });
      toggleButton.addEventListener('mouseleave', () => {
        toggleButton.style.backgroundColor = 'transparent';
      });

      // Assemble header
      headerDiv.appendChild(dragHandle);
      headerDiv.appendChild(columnTitle);
      headerDiv.appendChild(statsSpan);
      headerDiv.appendChild(arrowContainer);
      headerDiv.appendChild(toggleButton);
      columnDiv.appendChild(headerDiv);

      // Create content div
      const contentDiv = document.createElement('div');
      contentDiv.classList.add('content');
      contentDiv.style.display = shouldExpand ? 'block' : 'none';
      contentDiv.style.marginTop = '8px';

      // Sort values by count (descending) for better readability
      const sortedValues = Object.entries(values).sort(([, a], [, b]) => b - a);

      sortedValues.forEach(([value, count]) => {
        const valueDiv = document.createElement('div');
        valueDiv.classList.add('value-entry');
        valueDiv.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 8px;
          margin: 2px 0;
          background-color: #f8f9fa;
          border-radius: 4px;
          font-size: 13px;
        `;

        const valueSpan = document.createElement('span');
        valueSpan.textContent = value || '(empty)';
        valueSpan.style.color = '#333';
        valueSpan.style.fontWeight = '500';

        const countSpan = document.createElement('span');
        countSpan.textContent = count;
        countSpan.style.cssText = `
          background-color: #7B1B38;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 600;
          min-width: 20px;
          text-align: center;
        `;

        valueDiv.appendChild(valueSpan);
        valueDiv.appendChild(countSpan);
        contentDiv.appendChild(valueDiv);
      });

      // Toggle functionality
      const toggleContent = () => {
        if (contentDiv.style.display === 'none') {
          contentDiv.style.display = 'block';
          toggleButton.innerHTML = '&#9660;'; // Down arrow
        } else {
          contentDiv.style.display = 'none';
          toggleButton.innerHTML = '&#9654;'; // Right arrow
        }
      };

      headerDiv.addEventListener('click', (e) => {
        // Don't toggle if clicking on drag handle or arrow buttons
        if (e.target === dragHandle || e.target === upArrow || e.target === downArrow) {
          return;
        }
        toggleContent();
      });

      toggleButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double toggle
        toggleContent();
      });

      columnDiv.appendChild(contentDiv);
      summaryContainer.appendChild(columnDiv);
    });

    // Add a summary footer if there are many columns
    if (validColumns.length > 5) {
      const footerDiv = document.createElement('div');
      footerDiv.style.cssText = `
        margin-top: 20px;
        padding: 10px;
        background-color: #f0f0f0;
        border-radius: 6px;
        font-size: 12px;
        color: #666;
        text-align: center;
      `;
      footerDiv.textContent = `Showing ${validColumns.length} metadata columns • Drag cards to reorder or use ▲▼ arrows`;
      summaryContainer.appendChild(footerDiv);
    }
  } else {
    console.error('summaryContainer element not found');
  }
}

// // Add this to your tree initialization code (likely in your main tree rendering function)
// window.initializeExternalLinks = function (metadata) {
//   // Store metadata globally for external links
//   window.treeMetadata = metadata;

//   // Initialize external links table
//   if (window.createExternalLinksTable) {
//     createExternalLinksTable(metadata);
//   }
// };


