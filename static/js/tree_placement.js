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
    let extractedNumbers; 
    if (placements && Array.isArray(placements[0].p)) {
        extractedNumbers = placements[0].p.map(subArray => [subArray[0], subArray[2]]);
        console.log("extractedNumbers: ", extractedNumbers);
    } else {
        console.log("placements or placements.p is not defined or not an array");
    }
    // const extractedNumbers = placements.p.map(subArray => [subArray[1], subArray[2]]);
    // console.log("extractedNumbers: ", extractedNumbers);
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

        // can draw the node of placement!!!
    // for (const pair of extractedNumbers) {
    //     const [num1, num2] = pair;
    //     console.log("num1: ", num1, ", num2: ", num2);
    // }
    // bubbleSize = function (a) {
    //     for (const pair of extractedNumbers) {
    //         const [num1, num2] = pair;
             
    //         if (a.data.annotation == num1) {
    //             return num2*10;
    //             } 
    //             // else if (a.data.annotation == "0") {
    //             // return 30;
    //             // } else {
    //             // return null;
    //             // }
    //         console.log("num1: ", num1, ", num2: ", num2);
    //     }

    // };

    // Convert extractedNumbers into an object
    const extractedNumbersObj = Object.fromEntries(extractedNumbers);

    bubbleSize = function (a) {
        const num2 = extractedNumbersObj[a.data.annotation];
        if (num2 !== undefined) {
            console.log("a.data.annotation: ", a.data.annotation);
            console.log("num2: ", num2);
            return parseFloat(num2)*10;
            // return Math.sqrt(parseFloat(num2));
        }   else {
            return 1; // return a default value
        }
        // else if (a.data.annotation == "0") {
        //     return 30;
        // } else {
        //     return null;
        // }
    };

    customTreeOptions={
        // add the placement annotation to the tree
        'draw-size-bubbles' : true,
        'node-span': bubbleSize,
    };

    let renderedTree = await renderTree(tree, width, height, customTreeOptions);
    console.log("renderedTree: ", renderedTree);
    // debugger;
    addImagesAndMetadata(tree, metadata, metadataListArray2);
    // setupSaveImageButton();
    setTreeSize(width, height);
    // setTreeSizeWH(width, height);
    showTree(tree);
    // // At the end of tree_rendering.js


    // //make the tree panel apropiate size
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