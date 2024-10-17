async function main() {

    const { container, width, height } = getContainerDimensions();

    const {nwk: jplace_content, metadata, metadataListArray:metadataListArray2, datasetDescr } = getTreeData();
    console.log("jplace_content: ", jplace_content);
    console.log("metadata: ", metadata);
    console.log("metadataListArray2: ", metadataListArray2);
    console.log("datasetDescr: ", datasetDescr);
    
    const jplace_content_obj = JSON.parse(jplace_content);
    const nwk = jplace_content_obj.tree;
    const placements = jplace_content_obj.placements;
    console.log("nwktree: ", nwk);
    console.log("placements: ", placements);
    // const { container, width, height } = getContainerDimensions();
    // const jplace_file = document.getElementById('tree_data').getAttribute('nwk_data');
    // console.log("nwk = " + jplace_tree);
    // const jplace_stats = document.getElementById('tree_data').getAttribute('nwk_data');
    // console.log("nwk = " + jplace_stats);
    // const { metadata, metadataListArray:metadataListArray2, datasetDescr } = getTreeData();
    // console.log("nwk: ", nwk);
    // console.log("metadata: ", metadata);
    // console.log("metadataListArray2: ", metadataListArray2);
    // console.log("datasetDescr: ", datasetDescr);
    const tree = createTree(nwk);
    setupEventListeners(tree);
    console.log("tree: ", tree);
    customTreeOptions={};

    //     // can draw the node of placement!!!
    // bubbleSize = function (a) {
    //     if (a.data.annotation == "1") {
    //     return 20;
    //     } else if (a.data.annotation == "0") {
    //     return 30;
    //     } else {
    //     return null;
    //     }
    // };
    // customTreeOptions={
    //     // add the placement annotation to the tree
    //     'draw-size-bubbles' : true,
    //     'node-span': bubbleSize,
    // };

    let renderedTree = await renderTree(tree, width, height, customTreeOptions);
    console.log("renderedTree: ", renderedTree);
    addImagesAndMetadata(tree, metadata, metadataListArray2);
    // setupSaveImageButton();
    setTreeSize(width, height);
    showTree(tree);
    // // At the end of tree_rendering.js


    // //make the tree panel apropiate size
    // $(document).ready(function() {
    //     Split(['.tree-panel', '.details'], {
    //     // Split(['.tree', '.details'], {
    //     sizes: [75, 25],
    //     minSize: 100,
    //     gutterSize: 5,
    //     cursor: 'col-resize'
    //     });
    // });
}
main();