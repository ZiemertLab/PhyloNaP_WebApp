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

        // can draw the node of placement!!!
    bubbleSize = function (a) {
        if (a.data.annotation == "1") {
        return 20;
        } else if (a.data.annotation == "0") {
        return 30;
        } else {
        return null;
        }
    };
    customTreeOptions={
        // add the placement annotation to the tree
        'draw-size-bubbles' : true,
        'node-span': bubbleSize,
    };

    let renderedTree = await renderTree(tree, width, height, customTreeOptions);
    console.log("renderedTree: ", renderedTree);
    addImagesAndMetadata(tree, metadata, metadataListArray2);
    setupSaveImageButton();
    setTreeSize(width, height);
    showTree(tree);
    // At the end of tree_rendering.js


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
}
main();