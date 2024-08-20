const height = 500;
const width = 500;
//const nwk = `{{ content }}`;
var nwk = document.getElementById('tree-container').getAttribute('nwk_data');
//var metadata = document.getElementById('tree-container').getAttribute('metadata');
var metadata = JSON.parse(document.getElementById('metadata-container').getAttribute('metadata'));

console.log("printing nwk");
console.log(nwk);

console.log("printing metadata");
console.log(metadata);

let activeColumns = 0;
const tree = new phylotree.phylotree(nwk);

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

// Compute the layout of the tree
// var tree_align = tree.display.options.alignTips;
// console.log("printing tree_align");
// console.log(tree_align);
//tree.display.alignTips(button_align == "right");
leaves=tree.getTips();
leaves.forEach(leaf => {
  if (leaf.name === "BGC0001061_ACN64833.1") {
    leaf.name = "BGC0001061_ACN64833.1";
  }
});
console.log(leaves);
//leaves=tree.getLeaves();
console.log("printing leaves");


// Render bootstrap values
bootstrapNodes = tree.getInternals();
colorScale = d3.scaleSequential(d3.interpolateReds);
colorNodesByName = function (element, data) {
  if (_.includes(bootstrapNodes, data)) {
    element.style("stroke", colorScale(parseFloat(data.data.name) / 100));
  }
};

// Define the images and their corresponding node IDs
let images = {
  "BGC0001061_ACN64833.1": "static/pictures/1.jpg",
  "BGC0000247_CAK50791.1": "static/pictures/5.jpg",
  "BGC0000269_ADE34508.1": "static/pictures/3.jpg",
  "BGC0000230_AAM33664.1": "static/pictures/4.jpg"
};

// let images = {
//   "BGC0001061_ACN64833.1": "images/1.jpg",
//   "BGC0000247_CAK50791.1": "images/5.jpg",
//   "BGC0000269_ADE34508.1": "images/3.jpg",
//   "BGC0000230_AAM33664.1": "images/4.jpg"
// };

// Assign the images to the leaf nodes
tree.getTips().forEach(node => {
  if (images.hasOwnProperty(node.name)) {
    tree.assignAttributes({ [node.name]: { image: images[node.name] } });
  }
});


// Render the tree
const renderedTree = tree.render({
  container: '#tree',
  height: height,
  width: width,
  'align-tips': false,
  'internal-names': true,
  'alignTips': false ,
  // 'left-right-spacing': 'fit-to-size', 
  // 'top-bottom-spacing': 'fit-to-size',
  'zoom': true,
  'node-styler': colorNodesByName
});

// Add images after the tree has been rendered
setTimeout(function() {
  // Select the nodes where you want to add the image
  let nodes = d3.selectAll('.node').filter(d => images.hasOwnProperty(d.data.name));

  // Append an image to these nodes
  // nodes.append("image")
  //   .attr('xlink:href', function (d) { return images[d.data.name]; })
  //   .attr('x', 200)
  //   .attr('y', -50)
  //   .attr('width', 100)
  //   .attr('height', 100);

  // nodes.append("line")
  //   .attr("x1", 0)
  //   .attr("y1", 0)
  //   .attr("x2", 200)
  //   .attr("y2", 0)
  //   .attr("stroke", "black");
  }, 0);
    // Render the tree from chatgpt
//let treeContainer = d3.select("#tree-container");

//treeContainer.call(tree.render);

function renderNP(){
  let nodes = d3.selectAll('.node').filter(d => d.data.name.startsWith("BGC"));
  nodes.each(function(d) {
    let bgc = d.data.name.split("_")[0];
    let image = "static/images/"+bgc+"_1.png";
    if (image) {
      let img = d3.select(this).append("image")
        .attr('xlink:href', image)
        .attr('x', 200)
        .attr('y', -50)
        .attr('width', 100)
        .attr('height', 100)
        .attr('class', "NP");

      img.on('click', function() {
        d3.select('#enlarged-image').attr('src', image);
      });


      // let link = d3.select(this).append('a')
      //   .attr('href', image)
      //   .attr('target', '_blank');

      // link.append("image")
      //   .attr('xlink:href', image)
      //   .attr('x', 200)
      //   .attr('y', -50)
      //   .attr('width', 100)
      //   .attr('height', 100)
      //   .attr('class', "NP");

      
      // d3.select(this).append("image")
      //   .attr('xlink:href', image)
      //   .attr('x', 200)
      //   .attr('y', -50)
      //   .attr('width', 100)
      //   .attr('height', 100)
      //   .attr('class', "NP");
    }
  });
}
function hideNP(){
  d3.selectAll('image.NP').remove();
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
    let nodes = d3.selectAll('.node').filter(d => annot.hasOwnProperty(d.data.name));
    nodes.each(function(d) {
      let text = annot[d.data.name];
      if (text) { // Check if text is not null
        let textElement = d3.select(this).append('text').attr('x', 400+activeColumns*200).attr('y', 0).attr('class', columnName);
    
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

['Enzyme_function', 'Species', 'biosyn_class'].forEach(id => {
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
      hideMetadata(id);
      button.dataset.active = 'false';
    }
  });
});

// display metadata
// document.getElementById('enzyme-function-button').addEventListener('click', function() {
//   renderMetadata('Enzyme_function');
// });

// document.getElementById('species-button').addEventListener('click', function() {
//   renderMetadata('Species');
// });

// document.getElementById('biosyn-class-button').addEventListener('click', function() {
//   renderMetadata('biosyn_class');
// });




// Save the image
var saveImageBtn = document.querySelector("#save_image");
if (saveImageBtn) {
  saveImageBtn.addEventListener("click", function(e) {
    datamonkey_save_image("svg", "#tree_container");
  });
} else {
  console.log('Save image button not found');
}
// $(tree.display.container).empty();
$(tree.display.container).html(tree.display.show());