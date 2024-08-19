// function parseNewick(a) {
//   for (var e = [], r = {}, s = a.split(/\s*(;|\(|\)|,|:)\s*/), t = 0; t < s.length; t++) {
//     var n = s[t];
//     switch (n) {
//       case "(":
//         var c = {};
//         r.branchset = [c], e.push(r), r = c;
//         break;
//       case ",":
//         var c = {};
//         e[e.length - 1].branchset.push(c), r = c;
//         break;
//       case ")":
//         r = e.pop();
//         break;
//       case ":":
//         break;
//       default:
//         var h = s[t - 1];
//         ")" == h || "(" == h || "," == h ? (r.name = n) : ":" == h && (r.length = parseFloat(n));
//     }
//   }
//   return r;
// }

// function renderTree(treeData) {
//     // Create a tree layout with D3.js
//     var height = 500;
//     var width = 500;
//     var tree = d3.layout.tree().size([800, 800]);  // Increase these values



//     var svg = d3.select("body").append("svg")
//     .attr("width", 800)  // Increase this value
//     .attr("height", 800);  // Increase this value

//     selector=svg.node();

//     // Define a diagonal function
//     var diagonal = d3.svg.diagonal().projection(function(d) { return [d.y, d.x]; });



    
//     // Bind the data to the DOM and create g elements for each node
//     var nodes = tree.nodes(treeData);
//     var links = tree.links(nodes);
//     var node = d3.select(selector).selectAll(".node")
//       .data(nodes)
//       .enter().append("g")
//       .attr("class", "node")
//       .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

//     // For each node, create a circle and a text element
//     node.append("circle").attr("r", 4.5);
//     node.append("text")
//       .attr("dx", function(d) { return d.children ? -8 : 8; })
//       .attr("dy", 3)
//       .style("text-anchor", function(d) { return d.children ? "end" : "start"; })
//       .text(function(d) { return d.name; });

//     // Create the links between the nodes
//     d3.select(selector).selectAll(".link")
//       .data(links)
//       .enter().append("path")
//       .attr("class", "link")
//       .attr("d", diagonal);
// }

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

const tree = new phylotree.phylotree(nwk);
// Compute the layout of the tree

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
  'zoom': true,
  'node-styler': colorNodesByName
});

// Add images after the tree has been rendered
setTimeout(function() {
  // Select the nodes where you want to add the image
  let nodes = d3.selectAll('.node').filter(d => images.hasOwnProperty(d.data.name));

  // Append an image to these nodes
  nodes.append("image")
    .attr('xlink:href', function (d) { return images[d.data.name]; })
    .attr('x', 200)
    .attr('y', -50)
    .attr('width', 100)
    .attr('height', 100);

  nodes.append("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", 200)
    .attr("y2", 0)
    .attr("stroke", "black");
  }, 0);
    // Render the tree from chatgpt
//let treeContainer = d3.select("#tree-container");

//treeContainer.call(tree.render);

// Add images next to leaf nodes
// tree.selectAll(".node")
//     .filter(d => tree.isLeafNode(d))
//     .append("image")
//     .attr("xlink:href", d => d.annotations.image)
//     .attr("x", 8)  // Adjust position as needed
//     .attr("y", -8) // Adjust position as needed
//     .attr("width", 16)  // Adjust size as needed
//     .attr("height", 16) // Adjust size as needed
//     .attr("class", "leaf-image");







// const renderedTree = tree.render({
//     container: '#tree',
//     height:500, 
//     width:500,
//     'left-right-spacing': 'fit-to-size', 
//     'top-bottom-spacing': 'fit-to-size'
// });



// function renderMetadata(columnName) {
//   // Find the column in the metadata
//   var column = metadata.find(function(column) {
//       return column.name === columnName;
//   });
//   console.log('column:', column); 
//   console.log('metadata:', metadata); 
//   // If the column was found, render its values
//   if (column) {
//       tree.getTips().forEach(function(node) {
//           // Find the row in the column for this node
//           console.log("Debugging message");
//           var row = column.values.find(function(row) {
//               return row.id === node.name;
//           });
//           console.log('row:', row);
//           // If the row was found, render its value
//           if (row) {
//               node.text = row.value;
//           }
//       });

//       // Re-render the tree
//       tree.render();
//   }
// }

function renderMetadata(columnName){
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
        let textElement = d3.select(this).append('text').attr('x', 400).attr('y', 0).attr('class', columnName);
    
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

// $(tree.display.container).empty();
$(tree.display.container).html(tree.display.show());