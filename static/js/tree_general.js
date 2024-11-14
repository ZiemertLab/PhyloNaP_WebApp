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

window.getContainerDimensions = function(){
  let container = d3.select('#tree');
  var line = d3.line()
      .x(function(d) { return x(d.date); })
      .y(function(d) { return y(d.close); });
  const width = container.node().getBoundingClientRect().width;
  // const height = container.node().getBoundingClientRect().height*0.8;
  const height = container.node().offsetHeight;
  // window.onload = function() {
  //   const container = d3.select('#tree');
  //   const height = container.node().getBoundingClientRect().height;
  //   c
  // }
  // const height = container.node().getBoundingClientRect().height;
  console.log( `initiate Width: ${width}, Height: ${height}`);
  return { container, width, height };
}

window.getTreeData = function() {

  const nwk = document.getElementById('tree_data').getAttribute('nwk_data');
  console.log("nwk = " + nwk);
  var metadata = JSON.parse(document.getElementById('tree_data').getAttribute('metadata'));
  var metadataList=document.getElementById('tree_data').getAttribute('metadata_list');
  var datasetDescr=document.getElementById('tree_data').getAttribute('datasetDescr');

  // var metadataList = JSON.parse(localStorage.getItem('metadataList'));
  console.log("metadataList = " + metadataList);
  console.log(typeof metadataList);

  metadataList = metadataList.replace(/'/g, '"');
  var metadataListArray1 = JSON.parse(metadataList);
  console.log("metadataListArray = ", metadataListArray1);
  console.log(typeof metadataListArray1);
  return {nwk, metadata, metadataListArray:metadataListArray1, datasetDescr };
}



window.createTree = function(nwk) {
  return new phylotree.phylotree(nwk);
}

window.setupEventListeners = function(tree) {
  document.querySelectorAll("[data-direction]").forEach(function(element) {
    element.addEventListener("click", function(e) {
      console.log("y spacing 1: ", tree.display.spacing_y());
      console.log("x spacing 1: ", tree.display.spacing_x());
        var which_function =
            this.getAttribute("data-direction") == "vertical"
                ? tree.display.spacing_x.bind(tree.display)
                : tree.display.spacing_y.bind(tree.display)
                console.log("non vertical spacing: ", tree.display.spacing_y());
                console.log("y spacing 2 data-amount: ",  Number(this.getAttribute("data-amount")));
        which_function(which_function() + Number(this.getAttribute("data-amount"))).update();
    });
  });

  document.querySelectorAll(".phylotree-layout-mode").forEach(function(element) {
    element.addEventListener("click", function(e) {
        if (tree.display.radial() != (this.getAttribute("data-mode") == "radial")) {
            document.querySelectorAll(".phylotree-layout-mode").forEach(function(btn) {
                btn.classList.toggle("active");
            });
            tree.display.radial(!tree.display.radial()).update();
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
  document.querySelectorAll('.phylotree-align-toggler').forEach(function(toggler) {
    toggler.addEventListener('click', function(e) {
      if (!tree || !tree.display || !tree.display.options) {
        console.error('Tree display options are not defined');
        return;
      }
      var button_align = this.getAttribute('data-align');
      var tree_align = tree.display.options.alignTips;

      if (tree_align != button_align) {
        tree.display.alignTips(button_align == 'right');
        document.querySelectorAll('.phylotree-align-toggler').forEach(function(toggler) {
          toggler.classList.toggle('active');
        });
        tree.display.update();
      }
    });
  });

  document.getElementById('midpoint-root-btn').addEventListener('click', function() {
    const result = phylotree.computeMidpoint(tree);
    console.log('Midpoint result:', result);
  });
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
  tree.display.radial(false).separation(function(a, b) {
    return 0;
  });
}

function node_colorizer(element, data) {
  try {
    var count_class = 0;

    selection_set.forEach(function(d, i) {
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
  } catch (e) {}
}

function edge_colorizer(element, data) {

  try {
    var count_class = 0;

    selection_set.forEach(function(d, i) {
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
  } catch (e) {}
}

// Render the tree
// add the selection to the tree
window.renderTree = function(tree, height, width, customOptions) {
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
  const options = {...commonOptions, ...customOptions};
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

// Render bootstrap values
window.drawBootstrapValues = function(tree) {
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



window.checkSVGSize = function() {
  // Create a new MutationObserver
  setTimeout(function() {
    // Select the SVG element
    var svg = document.querySelector('#tree svg');

    // Create a new MutationObserver
    var observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
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


window.addImagesAndMetadata = function(tree, metadata, metadataListArray) {
  let activeColumns = 0;

  function renderNP(){
    activeColumns++;

    let nodes = d3.selectAll('.node').filter(d => d.data.name.startsWith("BGC"));
    nodes.each(function(d) {
      let transformValue = d3.select(this).attr('transform');
      let translateValues = transformValue.match(/translate\(([^)]+)\)/)[1].split(',').map(Number);
      let bgc = d.data.name.split("_")[0];
      let image = "static/images/"+bgc+"_1.png";

    // Check if the image exists
    fetch(image, { method: 'HEAD' })
      .then(response => {
        if (response.ok) {
          let img = d3.select(this).append("image")
            .attr('xlink:href', image)
            .attr('x', 200+activeColumns*200-translateValues[0])
            .attr('y', -50)
            .attr('width', 100)
            .attr('height', 100)
            .attr('class', "NP");
            console.log('image:width', img.attr('width'));

          img.on('click', function() {
            d3.select('#enlarged-image').attr('src', image);
          });
        }
      })
      .catch(error => {
        console.error('Error checking image existence:', error);
      });
    });
  }

  function hideNP(){
    activeColumns--;
    d3.selectAll('image.NP').remove();
  }

  function renderReaction() {
    activeColumns++;

    let nodes = d3.selectAll('.node').filter(d => !d.data.name.startsWith("AS0"));
    nodes.each(function(d) {
      let transformValue = d3.select(this).attr('transform');
      let translateValues = transformValue.match(/translate\(([^)]+)\)/)[1].split(',').map(Number);
      let id = d.data.name;
      let image = "static/images_reactions/" + id + ".png";
      if (image) {
        fetch(image)
          .then(response => {
            if (response.ok) {
              let img = d3.select(this).append("image")
                .attr('xlink:href', image)
                .attr('x', 200+activeColumns*200-translateValues[0])
                .attr('y', -50)
                .attr('width', 100)
                .attr('height', 100)
                .attr('class', "Reaction");

              img.on('click', function() {
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
  }

  function hideReaction(){
    activeColumns--;
    d3.selectAll('image.Reaction').remove();
  }

  function renderMetadata(columnName){
    activeColumns++;
    let annot = metadata.reduce((obj, item) => {
      obj[item["ID"]] = item[columnName];
      return obj;
    }, {});
    console.log('metadata:', columnName, annot);
    setTimeout(function() {
      // Select the nodes where you want to add the image
      // let nodes = d3.selectAll('.node').filter(d => annot.hasOwnProperty(d.data.name));
      // nodes.append("text")
      // .text(function (d) { return annot[d.data.name]; }) // Use the text method here
      // .attr('x', 400)
      // .attr('y', 0);
      //let leaveFontSize = d3.select('.leaf-class').style('font-size');
      let nodes = d3.selectAll('.node').filter(d => annot.hasOwnProperty(d.data.name));
      nodes.each(function(d) {
        let text = annot[d.data.name];
        if (text) { // Check if text is not null
          let leaveFontSize = d3.select(this).attr('font-size');
          let transformValue = d3.select(this).attr('transform');
          // let translateValues = transformValue.match(/translate\(([^)]+)\)/)[1].split(',').map(Number);
          // let translateValues = transformValue.match(/translate\(([^,]+),([^)]+)\)/)[1];
          // let translateValues = transformValue.match(/translate\(([^,]+),([^)]+)\)/).slice(1).map(Number);
          let match = transformValue.match(/translate\s*\(\s*([0-9.-]+)/);
          let translateValues = parseFloat(match[1]);
          console.log('transformValue:', transformValue);
          console.log('translateValues:', translateValues);
          // let textElement = d3.select(this).append('text').attr('x', 200+activeColumns*200+translateValues).attr('y', 0).attr('class', columnName).attr("font-size", leaveFontSize);
          // let textElement = d3.select(this).append('text').attr('x', activeColumns*200-translateValues).attr('y', 0).attr('class', columnName).attr("font-size", leaveFontSize).attr("debugging", translateValues);
          let textElement = d3.select(this).append('text').attr('x', 200+activeColumns*200-translateValues).attr('y', 0).attr('class', columnName).attr("font-size", leaveFontSize).attr("debugging", translateValues);

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

  }
  function hideMetadata(columnName){
    // Remove the text elements associated with this columnName
    activeColumns--;
    d3.selectAll(`text.${columnName}`).remove();
  }
  // Check if the buttons exist and the event listeners are being attached
  // console.log(document.getElementById('enzyme-function-button'));
  // console.log(document.getElementById('species-button'));
  // console.log(document.getElementById('biosyn-class-button'));

  // ['Enzyme_function', 'Species', 'biosyn_class'].forEach(id => {
  metadataListArray.forEach(id => {
    let button = document.getElementById(id);
    button.dataset.active = 'false'; // Add data-active attribute

    button.addEventListener('click', function() {
      if (button.dataset.active === 'false') {
        // If the button is not active, display the content and set the button to active
        renderMetadata(id);
        button.dataset.active = 'true';
        button.classList.add('active-button');
        button.classList.remove('non-active-button');
      } else {
        // If the button is active, hide the content and set the button to inactive
        hideMetadata(id);
        button.dataset.active = 'false';
        button.classList.remove('active-button');
        button.classList.add('non-active-button');
      }
    });
    buttonContainer.appendChild(button);
  });

  ["BGC_product"].forEach(id => {
    let button = document.getElementById(id);
    button.dataset.active = 'false'; // Add data-active attribute

    button.addEventListener('click', function() {
      if (button.dataset.active === 'false') {
        // If the button is not active, display the content and set the button to active
        renderNP();
        // change the spacing of the tree!
        tree.display.spacing_x(50).update();
        button.dataset.active = 'true';
        button.classList.add('active-button');
        button.classList.remove('non-active-button');
        console.log(`Button ${id} activated`);
      } else {
        // If the button is active, hide the content and set the button to inactive
        hideNP(id);
        button.dataset.active = 'false';
        button.classList.remove('active-button');
        button.classList.add('non-active-button');
        console.log(`Button ${id} deactivated`);
      }
    });
  });


  ["Reaction"].forEach(id => {
    let button = document.getElementById(id);
    button.dataset.active = 'false'; // Add data-active attribute

    button.addEventListener('click', function() {
      if (button.dataset.active === 'false') {
        // If the button is not active, display the content and set the button to active
        renderReaction();
        // change the spacing of the tree!
        tree.display.spacing_x(50).update();
        button.dataset.active = 'true';
      } else {
        // If the button is active, hide the content and set the button to inactive
        hideReaction(id);
        button.dataset.active = 'false';
      }
    });
  });
}

window.setupSaveImageButton = function() {

  // define the function for saving the image

  var datamonkey_save_image = function(type, container) {
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
        function(blob) {
          var url = window.URL.createObjectURL(blob);
          var pom = document.createElement("a");
          pom.setAttribute("download", "image.png");
          pom.setAttribute("href", url);
          $("body").append(pom);
          pom.click();
          pom.remove();
        },
        function(error) {
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
    saveImageBtn.addEventListener("click", function(e) {
      datamonkey_save_image("svg", "#tree_container");
    });
  } else {
    console.log('Save image button not found');
  }
}

window.setTreeSize = function(width, height) {
  console.log('Tree rendered, set up the proper size');
  setTimeout(function() {
    d3.select('#tree svg')
      .attr('width', width);
      // .attr('height', height);
  }, 10000);
}

window.setTreeSizeWH = function(width, height) {
  console.log('Tree rendered, set up the proper size');
  setTimeout(function() {
    d3.select('#tree svg')
      .attr('width', width)
      .attr('height', height);
  }, 10000);
}

window.showTree = function(tree) {
  console.log('showing tree');
  $(tree.display.container).html(tree.display.show());
}

window.setupSplitPanel = function() {
  // At the end of tree_rendering.js
  $(document).ready(function() {
    Split(['.tree-panel', '.details'], {
    // Split(['.tree', '.details'], {
      sizes: [75, 25],
      minSize: 100,
      gutterSize: 5,
      cursor: 'col-resize'
    });
  });
}
window.iterateOverJplaceNodes = function() {
  // check if the jplace annotation is parsed
  let nodes = d3.selectAll('.node');
  nodes.each(function(d) {
    annotation = d.data.annotation;
    console.log(annotation);
  });
}

window.getEnzymesSummary = function(tree, node, metadata, metadataListArray) {
  // Get all the leaves that are included in the subtree
  selectedNodes=tree.selectAllDescendants(node, true, false)
  console.log("Print the selected nodes");
  console.log(selectedNodes);
}