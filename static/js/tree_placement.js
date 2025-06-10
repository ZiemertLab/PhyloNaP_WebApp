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
    // displayNodeAnnotations(tree);
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

    if (placements && Array.isArray(placements[0].p)) {
        placementNumbers = placements[0].p.map(subArray => [subArray[0], subArray[1], subArray[2], subArray[3], subArray[4]]);
    }

    // Select the "placement-container" element
    const placementContainer = document.getElementById('placement-container');

    // Print the extracted numbers in the "placement-container"
    if (placementNumbers) {
        const headers = ["edge_num", "likelihood", "like_weight_ratio", "distal_length", "pendant_length"];
        const dataRows = placementNumbers.map((values, index) => {
            const formattedValues = values.map((val, i) => {
                const formattedVal = typeof val === 'number' ? val.toExponential(3) : val;
                return `${headers[i]}: ${formattedVal}`;
            });
            return `${index + 1}. ${formattedValues.join(' | ')}`;
        }).join('<br>');
        placementContainer.innerHTML = dataRows;
    } else {
        placementContainer.innerHTML = 'No placements found.';
    }


    // bubbleSize = function (a) {
    //     // console.log("Node type: ", isLeafNode(a) ? "Leaf" : "Inner Node");
    //     const num2 = extractedNumbersObj[a.data.annotation];
    //     if (num2 !== undefined) {
    //         console.log("a.data.annotation: ", a.data.annotation);
    //         console.log("num2: ", num2);
    //         return parseFloat(num2)*10;
    //         // return Math.sqrt(parseFloat(num2));
    //     }   else {
    //         console.log("No matching annotation for node: ", a.data.annotation);
    //         return 1; // return a default value
    //     }
    //     // else if (a.data.annotation == "0") {
    //     //     return 30;
    //     // } else {
    //     //     return null;
    //     // }
    // };
    bubbleSize = function (node) {
        const annotation = node.data?.annotation; // Safely access annotation
        const num2 = extractedNumbersObj[annotation]; // Lookup annotation in extractedNumbersObj
    
        if (num2 !== undefined) {
            console.log(`Node annotation: ${annotation}, Bubble size: ${num2 * 10}`);
            return parseFloat(num2) * 10; // Scale the bubble size
        } else {
            console.log(`No matching annotation for node: ${annotation}`);
            return 1; // Default sizes: larger for leaves, smaller for internal nodes
        }
    };

    // customTreeOptions = {
    //     'draw-size-bubbles': true,
    //     'node-span': bubbleSize,
    //     'node-styler': function (container, node) {
    //         const isAnnotated = extractedNumbersObj[node.data.annotation] !== undefined;
    //         container.classed("alternate", !isAnnotated); // Apply "alternate" class for unannotated nodes
    //     }
    // };
    customTreeOptions = {
        'draw-size-bubbles': true,
        'node-span': bubbleSize,
        'node-styler': function (container, node) {
            // Use the same logic as bubbleSize to determine if the node is annotated
            const annotation = node.data?.annotation; // Safely access annotation
            const num2 = extractedNumbersObj[annotation]; // Lookup annotation in extractedNumbersObj
    
            if (num2 !== undefined) {
                // Annotated nodes
                container.classed("alternate", false); // Ensure "alternate" class is removed
                container.classed("circle", true); // Add "circle" class for normal nodes
            } else {
                // Non-annotated nodes
                container.classed("alternate", true); // Add "alternate" class
                container.classed("circle", false); // Ensure "circle" class is removed
            }
        }
    };
    let renderedTree = await renderTree(tree, width, height, customTreeOptions);
    console.log("renderedTree: ", renderedTree);
    // debugger;
    addImagesAndMetadata(tree, metadata, metadataListArray2);
    setupSaveImageButton();
    // setupSaveImageButton();
    setTreeSize(width, height);
    // setTreeSizeWH(width, height);
    showTree(tree);
    // // At the end of tree_rendering.js
    selectedLeavesArray=getTerminalNodesArray(metadata)
    // metadataSummary(selectedLeavesArray, metadata)
    //test the clusters
    checkForClusters(tree);
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