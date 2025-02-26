async function main() {
    const { container, width, height } = getContainerDimensions();

    const { nwk, metadata, metadataListArray:metadataListArray2, datasetDescr } = getTreeData();
    console.log("nwk: ", nwk);
    console.log("metadata: ", metadata);
    console.log("metadataListArray2: ", metadataListArray2);
    console.log("datasetDescr: ", datasetDescr);
    const tree = createTree(nwk);
    setupEventListeners(tree);
    console.log("tree: ", tree);
    customTreeOptions={};
    let renderedTree = await renderTree(tree, width, height, customTreeOptions);
    console.log("renderedTree: ", renderedTree);
    addImagesAndMetadata(tree, metadata, metadataListArray2);
    setupSaveImageButton();
    setTreeSize(width, height);
    showTree(tree);
    // At the end of tree_rendering.js

    selectedLeavesArray=getTerminalNodesArray(metadata)
    console.log("selectedLeavesArray: ", selectedLeavesArray);
    // metadataSummary(selectedLeavesArray, metadata)

    //test the clusters
    checkForClusters(tree);

    //make the tree panel apropiate size
    $(document).ready(function() {
        Split(['.tree-panel', '.details'], {
        // Split(['.tree', '.details'], {
        sizes: [75, 25],
        minSize: 100,
        gutterSize: 5,
        cursor: 'col-resize'
        });
    });
    // tree.nodes.forEach(node => {
    //     console.log(" PRINTING THE PROPERTIES OF THE NODES");
    //     // Expose the node to the global scope for inspection
    //     window.currentNode = node;

    //     // Log the node to the console
    //     console.log(node);
    //     console.dir(node);

    //     // List all properties of the node
    //     for (let property in node) {
    //         if (node.hasOwnProperty(property)) {
    //             console.log(property + ": " + node[property]);
    //         }
    //     }
    // });
    // console.log("PRINTING THE PROPERTIES OF THE NODE");

    // // Access the first node in the tree.nodes array
    // let node = tree.nodes[0];

    // // Expose the node to the global scope for inspection
    // window.currentNode = node;

    // // Log the node to the console
    // console.log(node);
    // console.dir(node);

    // // List all properties of the node
    // for (let property in node) {
    //     if (node.hasOwnProperty(property)) {
    //         console.log(property + ": " + node[property]);
    //     }
    // }
    console.log("PRINTING THE PROPERTIES OF THE NODE");
    let nodes = d3.selectAll('.node');
    node=nodes[0];
    console.log(node);
    console.dir(node);

    
}
main();