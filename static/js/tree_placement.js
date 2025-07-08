let tree;
let allPlacements = [];
let highConfidencePlacements = [];
let currentDisplayPlacements = [];
let showingAllPlacements = false;
let bubbleSize;
let currentTree;
let treshold_to_display = 0.5;

async function main() {

    const { container, width, height } = getContainerDimensions();

    const { nwk: jplace_content, metadata, metadataListArray: metadataListArray2, datasetDescr } = getTreeData();
    console.log("jplace_content: ", jplace_content);
    console.log("metadata: ", metadata);
    console.log("metadataListArray2: ", metadataListArray2);
    console.log("datasetDescr: ", datasetDescr);

    const jplace_content_obj = JSON.parse(jplace_content);
    const nwk = jplace_content_obj.tree;
    const placements = jplace_content_obj.placements;
    console.log("nwktree: ", nwk);
    console.log("placements: ", placements);

    // === PLACEMENT DATA PROCESSING ===
    let allPlacements = [];
    let highConfidencePlacements = [];
    let currentDisplayPlacements = [];
    let showingAllPlacements = false;
    let bubbleSize; // Declare bubbleSize at module level
    let currentTree; // Keep reference to current tree
    let treshold_to_display = 0.5; // Set threshold for high-confidence placements

    // Create tree and setup
    tree = createTree(nwk);
    setupEventListeners(tree);
    console.log("tree: ", tree);

    if (placements && Array.isArray(placements[0].p)) {

        // Extract all placement data [edge_num, likelihood, like_weight_ratio, distal_length, pendant_length]
        allPlacements = placements[0].p.map(subArray => [subArray[0], subArray[1], subArray[2], subArray[3], subArray[4]]);

        // Filter high confidence placements (like_weight_ratio > 0.3)
        highConfidencePlacements = allPlacements.filter(placement => placement[2] > treshold_to_display);

        // Determine what to display initially
        if (highConfidencePlacements.length > 0) {
            currentDisplayPlacements = highConfidencePlacements;
            showingAllPlacements = false;
            console.log(`Found ${highConfidencePlacements.length} high-confidence placements out of ${allPlacements.length} total`);
        } else {
            currentDisplayPlacements = allPlacements;
            showingAllPlacements = true;
            console.log(`No high-confidence placements found, showing all ${allPlacements.length} placements`);
        }
    } else {
        console.log("placements or placements.p is not defined or not an array");
        return;
    }

    // === INITIAL SETUP ===
    // Create initial bubble size function
    const initialBubbleData = Object.fromEntries(
        currentDisplayPlacements.map(placement => [placement[0], placement[2]])
    );

    bubbleSize = function (node) {
        const annotation = node.data?.annotation;
        const confidence = initialBubbleData[annotation];

        if (confidence !== undefined) {
            console.log(`Node annotation: ${annotation}, Confidence: ${confidence}, Bubble size: ${confidence * 10}`);
            return parseFloat(confidence) * 10;
        } else {
            console.log(`No matching annotation for node: ${annotation}`);
            return 1;
        }
    };

    // Render tree initially
    const initialTreeOptions = {
        'draw-size-bubbles': true,
        'node-span': bubbleSize,
        'node-styler': function (container, node) {
            const annotation = node.data?.annotation;
            const hasConfidence = initialBubbleData[annotation] !== undefined;
            const isLeaf = !node.children || node.children.length === 0;

            if (hasConfidence) {
                container.classed("alternate", false);
                container.classed("circle", true);

                // For internal nodes with bubbles, add a special class
                if (!isLeaf) {
                    container.classed("internal-bubble", true);
                }
            } else {
                container.classed("alternate", true);
                container.classed("circle", false);
                container.classed("internal-bubble", false);
            }
        }
    };
    console.log("Before renderTree");
    let renderedTree = await renderTree(tree, width, height, initialTreeOptions);
    console.log("After renderTree");

    currentTree = renderedTree; // Store reference to the tree
    console.log("renderedTree: ", renderedTree);

    // Display initial placements after tree is rendered
    updatePlacementContainer(currentDisplayPlacements, showingAllPlacements);
    console.log("After updatePlacementContainer");

    // Display MRCA clade summary for current placements
    MRSA_summury(currentDisplayPlacements, placements, tree, metadata);
    console.log("After MRSA_summury");
    // Complete setup
    addImagesAndMetadata(tree, metadata, metadataListArray2);
    console.log("After addImagesAndMetadata");

    setupSaveImageButton();
    console.log("After setupSaveImageButton");

    setTreeSize(width, height);
    console.log("After setTreeSize");

    showTree(tree);
    console.log("After showTree");

    selectedLeavesArray = getTerminalNodesArray(tree, metadata);
    console.log("selectedLeavesArray: ", selectedLeavesArray);
    checkForClusters(tree);

    $(document).ready(function () {
        Split(['.tree-panel', '.details'], {
            sizes: [75, 25],
            minSize: 100,
            gutterSize: 5,
            cursor: 'col-resize'
        });
    });
}

function displayPlacementSummary(placements) {
    const placementContainer = document.getElementById('placement-container');
    if (!placementContainer) return;

    placementContainer.innerHTML = ''; // Clear previous

    if (!placements || placements.length === 0) {
        placementContainer.innerHTML = '<p style="color: #6c757d; font-style: italic;">No placements available</p>';
        return;
    }

    // Helper for formatting numbers
    function formatNumber(val) {
        if (Math.abs(val) < 0.001 && val !== 0) {
            return Number(val).toExponential(2);
        } else {
            return Number(val).toFixed(4).replace(/\.?0+$/, '');
        }
    }

    // Build the summary box
    const summarySection = document.createElement('div');
    summarySection.style.marginBottom = '15px';
    summarySection.style.padding = '10px 18px';
    summarySection.style.backgroundColor = '#f8f9fa';
    summarySection.style.borderRadius = '6px';
    summarySection.style.border = '1px solid #dee2e6';

    const list = document.createElement('ul');
    list.style.margin = '0';
    list.style.paddingLeft = '20px';
    list.style.fontSize = '13px';
    list.style.lineHeight = '1.5';

    placements.forEach((placement) => {
        const likeWeight = formatNumber(placement[2]);
        const pendantLen = formatNumber(placement[4]);

        const listItem = document.createElement('li');
        listItem.style.marginBottom = '4px';

        listItem.innerHTML = `
      <span style="display:inline-block; min-width: 170px;"><strong>Likelihood weight ratio:</strong> ${likeWeight}</span>
      <span style="display:inline-block; min-width: 150px;"><strong>Pendant length:</strong> ${pendantLen}</span>
    `;

        list.appendChild(listItem);
    });

    summarySection.appendChild(list);
    placementContainer.appendChild(summarySection);
}

function getTerminalNodesArrayPlacement(tree, metadata, targetNode) {
    // Collect all terminal (leaf) node names under targetNode
    let nodeNames = [];
    function collectLeaves(node) {
        if (!node.children || node.children.length === 0) {
            nodeNames.push(node.data.name);
        } else {
            node.children.forEach(collectLeaves);
        }
    }
    console.log("targetNode: ", targetNode);
    console.log("N nodes: ", nodeNames.length);
    console.log("nodeNames: ", nodeNames);
    collectLeaves(targetNode);

    // Now display the metadata summary for these leaves
    filteredTable = getMetadataSubset(nodeNames, metadata);
    metadataSummaryResult = getMetadataSummary(filteredTable)
    console.log('Metadata summary:', metadataSummaryResult);
    return nodeNames;
}

// function getTerminalNodesArrayPlacement(tree, metadata, targetNode) {
//     let nodeNames = [];
//     document.addEventListener('terminalNodesSelected', event => {
//         nodeNames = [];

//         function collectLeaves(node) {
//             if (!node.children || node.children.length === 0) {
//                 nodeNames.push(node.data.name);
//             } else {
//                 node.children.forEach(collectLeaves);
//             }
//         }
//         collectLeaves(targetNode);
//         console.log('Node names:', targetNode);
//         filteredTable = getMetadataSubset(targetNode, metadata);
//         metadataSummaryResult = getMetadataSummary(filteredTable)
//         console.log('Metadata summary:', metadataSummaryResult);
//         displayMetadataSummary(metadataSummaryResult);
//     });
//     return nodeNames;
// }
// === PLACEMENT DISPLAY AND VISUALIZATION ===
function updatePlacementDisplay(placementsToShow, showAll = false) {
    // Update bubble data - convert to object for quick lookup [edge_num, like_weight_ratio]
    const bubbleData = Object.fromEntries(
        placementsToShow.map(placement => [placement[0], placement[2]])
    );

    // Update bubble size function
    bubbleSize = function (node) {
        const annotation = node.data?.annotation;
        const confidence = bubbleData[annotation];

        if (confidence !== undefined) {
            console.log(`Node annotation: ${annotation}, Confidence: ${confidence}, Bubble size: ${confidence * 10}`);
            return parseFloat(confidence) * 10;
        } else {
            console.log(`No matching annotation for node: ${annotation}`);
            return 1;
        }
    };

    // Update placement container display
    updatePlacementContainer(placementsToShow, showAll);
    //displayPlacementSummary(placements);

    // Update tree visualization
    updateTreeVisualization(bubbleData);
}

function updatePlacementContainer(placementsToShow, showAll) {
    const placementContainer = document.getElementById('placement-container');

    // Create toggle button if high confidence placements exist
    let toggleButton = '';
    if (highConfidencePlacements.length > 0 && highConfidencePlacements.length < allPlacements.length) {
        const buttonText = showAll ?
            `Show only high-confidence (${highConfidencePlacements.length})` :
            `Show all placements (${allPlacements.length})`;
        toggleButton = `<button id="toggle-placements-btn" class="btn btn-sm btn-secondary mb-2">${buttonText}</button><br>`;
    }

    // Create status header
    let statusHeader = '';
    if (highConfidencePlacements.length > 0) {
        if (showAll) {
            statusHeader = `<strong>Showing all ${allPlacements.length} placements</strong><br>`;
        } else {
            statusHeader = `<strong>Showing ${highConfidencePlacements.length} high-confidence placements (like_weight_ratio > ${treshold_to_display})</strong><br>`;
        }
    } else {
        statusHeader = `<strong>Showing all ${allPlacements.length} placements (none with like_weight_ratio > ${treshold_to_display})</strong><br>`;
    }

    // Helper for formatting numbers
    function formatNumber(val) {
        if (Math.abs(val) < 0.001 && val !== 0) {
            return Number(val).toExponential(2);
        } else {
            return Number(val).toFixed(4).replace(/\.?0+$/, '');
        }
    }

    // Add numbering to each row
    const dataRows = placementsToShow.map((values, index) => {
        const likeWeight = formatNumber(values[2]);
        const pendantLen = formatNumber(values[4]);
        return `
                <li style="margin-bottom: 4px;">
                    <span style="font-weight:600; color:#7B1B38;">${index + 1}.</span>
                    <span style="display:inline-block; min-width: 170px;"><strong>Likelihood weight ratio:</strong> ${likeWeight}</span>
                    <span style="display:inline-block; min-width: 150px;"><strong>Pendant length:</strong> ${pendantLen}</span>
                </li>
            `;
    }).join('');

    // Wrap in a styled box similar to Metadata summary
    const summaryBox = `
            <ul style="background:#f8f9fa; border-radius:6px; border:1px solid #dee2e6; padding:12px 18px; list-style-type:none; font-size:13px; margin:0 0 10px 0;">
                ${dataRows}
            </ul>
        `;

    // Update container content
    placementContainer.innerHTML = toggleButton + statusHeader + summaryBox;

    // Add event listener to toggle button
    const toggleBtn = document.getElementById('toggle-placements-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            showingAllPlacements = !showingAllPlacements;
            const newPlacements = showingAllPlacements ? allPlacements : highConfidencePlacements;
            updatePlacementDisplay(newPlacements, showingAllPlacements);
            MRSA_summury(newPlacements, placements, tree, metadata); // <-- update here as well
        });
    }
}

function MRSA_summury(displayedPlacements, placements, tree, metadata) {
    console.log("MRSA_summury called with displayedPlacements:", displayedPlacements);
    const displayedEdgeNums = displayedPlacements.map(p => p[0]);
    const relevantPlacements = placements.filter(p =>
        p.p.some(arr => displayedEdgeNums.includes(arr[0]))
    );
    const placementNames = relevantPlacements.flatMap(p => p.n);
    console.log("Placement nums:", displayedEdgeNums);
    console.log("Placement names:", placementNames)
    // Find the MRCA node
    const mrcaNode = tree.mrca(placementNames);

    console.log("MRCA node:", mrcaNode);

    if (mrcaNode) {
        getTerminalNodesArrayPlacement(tree, metadata, mrcaNode);
    } else {
        console.log("No MRCA node found for placement names:", placementNames);
    }
}
function updateTreeVisualization(bubbleData) {
    // Update tree options for the existing tree
    const customTreeOptions = {
        'draw-size-bubbles': true,
        'node-span': bubbleSize,
        'node-styler': function (container, node) {
            const annotation = node.data?.annotation;
            const hasConfidence = bubbleData[annotation] !== undefined;
            const isLeaf = !node.children || node.children.length === 0;

            if (hasConfidence) {
                // High-confidence nodes - apply styling to both leaf and internal nodes
                container.classed("alternate", false);
                container.classed("circle", true);

                // For internal nodes with bubbles, add a special class for additional styling
                if (!isLeaf) {
                    container.classed("internal-bubble", true);
                }
            } else {
                // Low-confidence or no-confidence nodes
                container.classed("alternate", true);
                container.classed("circle", false);
                container.classed("internal-bubble", false);
            }
        }
    };

    // Update the tree options directly
    if (currentTree) {
        // Apply new options to existing tree
        Object.keys(customTreeOptions).forEach(key => {
            currentTree.options[key] = customTreeOptions[key];
        });

        // Trigger tree update/redraw
        currentTree.update();
        console.log("Tree updated with new placements");
    }
}






main();