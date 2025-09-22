async function main() {
    const { container, width, height } = getContainerDimensions();

    const { nwk, metadata, metadataListArray: metadataListArray2, datasetDescr } = getTreeData();
    console.log("nwk: ", nwk);
    console.log("metadata: ", metadata);
    console.log("metadataListArray2: ", metadataListArray2);
    console.log("datasetDescr: ", datasetDescr);
    const tree = createTree(nwk);
    setupEventListeners(tree);
    console.log("tree: ", tree);
    customTreeOptions = {
        'draw-size-bubbles': true,
        'node-styler': function (container, node) {
            // Non-annotated nodes
            container.classed("alternate", true); // Add "alternate" class
            container.classed("circle", false); // Ensure "circle" class is removed
        }
    };
    let renderedTree = await renderTree(tree, width, height, customTreeOptions);
    console.log("renderedTree: ", renderedTree);
    addImagesAndMetadata(tree, metadata, metadataListArray2);
    setupSaveImageButton();
    setTreeSize(width, height);
    showTree(tree);

    // Initialize download functionality
    setupDownloadDataset(nwk, metadata);


    selectedLeavesArray = getTerminalNodesArray(tree, metadata)
    console.log("selectedLeavesArray: ", selectedLeavesArray);
    // metadataSummary(selectedLeavesArray, metadata)

    //test the clusters
    checkForClusters(tree);

    //make the tree panel apropiate size
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
main();