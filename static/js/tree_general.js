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
  var nwk = document.getElementById('tree_data').getAttribute('nwk_data');
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
  return { nwk, metadata, metadataListArray:metadataListArray1, datasetDescr };
}



window.createTree = function(nwk) {
  return new phylotree.phylotree(nwk);
}

window.setupEventListeners = function(tree) {
  document.querySelectorAll("[data-direction]").forEach(function(element) {
    element.addEventListener("click", function(e) {
        var which_function =
            this.getAttribute("data-direction") == "vertical"
                ? tree.display.spacing_x.bind(tree.display)
                : tree.display.spacing_y.bind(tree.display);
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

// document.querySelector("#toggle_animation").addEventListener("click", function(e) {
//   var current_mode = this.classList.contains("active");
//   this.classList.toggle("active");
//   tree.options({ transitions: !current_mode });
// });

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


  document.querySelectorAll('.phylotree-align-toggler').forEach(function(toggler) {
    toggler.addEventListener('click', function(e) {
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
}

// Compute the layout of the tree
// var tree_align = tree.display.options.alignTips;
// console.log("printing tree_align");
// console.log(tree_align);
//tree.display.alignTips(button_align == "right");

//console.log(leaves);
//leaves=tree.getLeaves();
//console.log("printing leaves");

// Render the tree
window.renderTree = function(tree, height, width, customOptions) {
  const commonOptions = {
    container: '#tree',
    height: height,
    width: width,
    "left-right-spacing": "fixed-step",
    'align-tips': true,
    'internal-names': true,
    //'left-right-spacing': 'fit-to-size', 
    'top-bottom-spacing': 'fit-to-size',
    'zoom': true,
    // 'node-styler': colorNodesByName,
    "draw_scale_bar": true,
  };
  const options = {...commonOptions, ...customOptions};
  console.log('options:', options);

  let renderedTree = tree.render(options);

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
      if (image) {
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
          let translateValues = transformValue.match(/translate\(([^)]+)\)/)[1].split(',').map(Number);
          
          console.log('leaveFontSize:', leaveFontSize);
          let textElement = d3.select(this).append('text').attr('x', 200+activeColumns*200-translateValues[0]).attr('y', 0).attr('class', columnName).attr("font-size", leaveFontSize);
      
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
      } else {
        // If the button is active, hide the content and set the button to inactive
        hideMetadata(id);
        button.dataset.active = 'false';
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
        button.dataset.active = 'true';
      } else {
        // If the button is active, hide the content and set the button to inactive
        hideNP(id);
        button.dataset.active = 'false';
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

