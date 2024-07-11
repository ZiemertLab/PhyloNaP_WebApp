function parseNewick(a) {
  for (var e = [], r = {}, s = a.split(/\s*(;|\(|\)|,|:)\s*/), t = 0; t < s.length; t++) {
    var n = s[t];
    switch (n) {
      case "(":
        var c = {};
        r.branchset = [c], e.push(r), r = c;
        break;
      case ",":
        var c = {};
        e[e.length - 1].branchset.push(c), r = c;
        break;
      case ")":
        r = e.pop();
        break;
      case ":":
        break;
      default:
        var h = s[t - 1];
        ")" == h || "(" == h || "," == h ? (r.name = n) : ":" == h && (r.length = parseFloat(n));
    }
  }
  return r;
}

function renderTree(treeData) {
    // Create a tree layout with D3.js
    var height = 500;
    var width = 500;
    var tree = d3.layout.tree().size([800, 800]);  // Increase these values



    var svg = d3.select("body").append("svg")
    .attr("width", 800)  // Increase this value
    .attr("height", 800);  // Increase this value

    selector=svg.node();

    // Define a diagonal function
    var diagonal = d3.svg.diagonal().projection(function(d) { return [d.y, d.x]; });



    
    // Bind the data to the DOM and create g elements for each node
    var nodes = tree.nodes(treeData);
    var links = tree.links(nodes);
    var node = d3.select(selector).selectAll(".node")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

    // For each node, create a circle and a text element
    node.append("circle").attr("r", 4.5);
    node.append("text")
      .attr("dx", function(d) { return d.children ? -8 : 8; })
      .attr("dy", 3)
      .style("text-anchor", function(d) { return d.children ? "end" : "start"; })
      .text(function(d) { return d.name; });

    // Create the links between the nodes
    d3.select(selector).selectAll(".link")
      .data(links)
      .enter().append("path")
      .attr("class", "link")
      .attr("d", diagonal);
}