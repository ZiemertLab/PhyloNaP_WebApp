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

console.log("printing nwk");
console.log(nwk);

const tree = new phylotree.phylotree(nwk);
// Compute the layout of the tree

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

// $(tree.display.container).empty();
$(tree.display.container).html(tree.display.show());