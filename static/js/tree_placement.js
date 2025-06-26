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

    if (placements && Array.isArray(placements[0].p)) {
        // Extract all placement data [edge_num, likelihood, like_weight_ratio, distal_length, pendant_length]
        allPlacements = placements[0].p.map(subArray => [subArray[0], subArray[1], subArray[2], subArray[3], subArray[4]]);

        // Filter high confidence placements (like_weight_ratio > 0.3)
        highConfidencePlacements = allPlacements.filter(placement => placement[2] > 0.3);

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

    // Create tree and setup
    const tree = createTree(nwk);
    setupEventListeners(tree);
    console.log("tree: ", tree);

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
                statusHeader = `<strong>Showing ${highConfidencePlacements.length} high-confidence placements (like_weight_ratio > 0.3)</strong><br>`;
            }
        } else {
            statusHeader = `<strong>Showing all ${allPlacements.length} placements (none with like_weight_ratio > 0.3)</strong><br>`;
        }

        // Create data rows
        const headers = ["edge_num", "likelihood", "like_weight_ratio", "distal_length", "pendant_length"];
        const dataRows = placementsToShow.map((values, index) => {
            const formattedValues = values.map((val, i) => {
                const formattedVal = typeof val === 'number' ? val.toExponential(3) : val;
                return `${headers[i]}: ${formattedVal}`;
            });
            return `${index + 1}. ${formattedValues.join(' | ')}`;
        }).join('<br>');

        // Update container content
        placementContainer.innerHTML = toggleButton + statusHeader + '<br>' + dataRows;

        // Add event listener to toggle button
        const toggleBtn = document.getElementById('toggle-placements-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                showingAllPlacements = !showingAllPlacements;
                const newPlacements = showingAllPlacements ? allPlacements : highConfidencePlacements;
                updatePlacementDisplay(newPlacements, showingAllPlacements);
            });
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

    let renderedTree = await renderTree(tree, width, height, initialTreeOptions);
    currentTree = renderedTree; // Store reference to the tree
    console.log("renderedTree: ", renderedTree);

    // Display initial placements after tree is rendered
    updatePlacementContainer(currentDisplayPlacements, showingAllPlacements);

    // Complete setup
    addImagesAndMetadata(tree, metadata, metadataListArray2);
    setupSaveImageButton();
    setTreeSize(width, height);
    showTree(tree);

    selectedLeavesArray = getTerminalNodesArray(metadata);
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

main();