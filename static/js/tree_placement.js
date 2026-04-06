let tree;
let allPlacements = [];
let highConfidencePlacements = [];
let currentDisplayPlacements = [];
let showingAllPlacements = false;
let bubbleSize;
let currentTree;
let treshold_to_display = 0.5;
let treshold_to_summary = 0.8;

// Stored placement clade summary so it can be recalled at any time
let placementCladeSummary = null;
let placementCladeLeaves = null;

// === Shared tooltip explanation texts (single source of truth) ===
const TOOLTIP_LWR = 'The ratio of the likelihood of this placement to the sum of likelihoods of all alternative placements within the same tree. Higher = more probable location. All LWR values for a query sum to 1.0.';
const TOOLTIP_LWR_SINGLE = TOOLTIP_LWR + ' With a single placement, LWR is always 1.0 — use pendant length to assess quality.';
const TOOLTIP_PL = 'The branch length connecting the query to the reference tree at the placement point. Reflects evolutionary distance — shorter = more reliable, longer = interpret with caution. Shown as dot color on the tree.';

// Helper: build an inline info-tooltip ? span (tooltip text stored in data attribute;
// the popup is positioned with JS so it's never clipped by overflow containers)
function infoTooltipHTML(text) {
    // Escape HTML-special chars for safe use inside a data-attribute
    const escaped = text.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    return `<span class="info-tooltip" data-tip="${escaped}">?</span>`;
}

// --- Global fixed-position tooltip logic (runs once) ---
(function initInfoTooltips() {
    let popup = null;

    function getPopup() {
        if (!popup) {
            popup = document.createElement('div');
            popup.className = 'info-tooltip-popup';
            document.body.appendChild(popup);
        }
        return popup;
    }

    document.addEventListener('mouseenter', function (e) {
        const trigger = e.target.closest('.info-tooltip[data-tip]');
        if (!trigger) return;
        const p = getPopup();
        p.textContent = trigger.getAttribute('data-tip');
        // Position above the icon
        const rect = trigger.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - 130; // 130 = half of 260px width
        if (left < 4) left = 4;
        if (left + 260 > window.innerWidth - 4) left = window.innerWidth - 264;
        p.style.left = left + 'px';
        p.style.top = (rect.top - 8) + 'px'; // 8px gap
        p.style.transform = 'translateY(-100%)';
        // Adjust arrow to point at the icon center
        const arrowLeft = rect.left + rect.width / 2 - left;
        p.style.setProperty('--arrow-left', arrowLeft + 'px');
        void p.offsetHeight; // force reflow
        p.classList.add('visible');
    }, true);

    document.addEventListener('mouseleave', function (e) {
        const trigger = e.target.closest('.info-tooltip[data-tip]');
        if (!trigger || !popup) return;
        popup.classList.remove('visible');
    }, true);
})();

// Scroll the tree panel so a placement node (by edge annotation) is visible
function scrollToPlacement(edgeAnnotation) {
    const treeContainer = document.querySelector('#tree');
    if (!treeContainer) { console.warn('scrollToPlacement: #tree not found'); return; }

    // Find the node by the data-edge attribute set in the node-styler
    const targetNode = treeContainer.querySelector('[data-edge="' + edgeAnnotation + '"]');
    if (!targetNode) { console.warn('scrollToPlacement: node not found for data-edge', edgeAnnotation); return; }

    // Use getBoundingClientRect relative to the scroll container
    const containerRect = treeContainer.getBoundingClientRect();
    const circle = targetNode.querySelector('circle');
    const target = circle || targetNode;
    const targetRect = target.getBoundingClientRect();

    // Calculate where it is inside the scrollable area
    const targetScrollTop = treeContainer.scrollTop + (targetRect.top - containerRect.top) - (containerRect.height / 2);
    const targetScrollLeft = treeContainer.scrollLeft + (targetRect.left - containerRect.left) - (containerRect.width / 2);

    treeContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth'
    });

    // Brief highlight flash on the circle
    if (circle) {
        const origStroke = circle.getAttribute('stroke') || circle.style.stroke || '';
        const origStrokeWidth = circle.getAttribute('stroke-width') || circle.style.strokeWidth || '';
        circle.setAttribute('stroke', '#e85d04');
        circle.setAttribute('stroke-width', '3');
        setTimeout(() => {
            if (origStroke) {
                circle.setAttribute('stroke', origStroke);
            } else {
                circle.removeAttribute('stroke');
            }
            if (origStrokeWidth) {
                circle.setAttribute('stroke-width', origStrokeWidth);
            } else {
                circle.removeAttribute('stroke-width');
            }
        }, 1500);
    }
}

// Show Placement Details panel (used by all click handlers)
function showPlacementDetails(confidence, pendantLength, edgeAnnotation) {
    const details = `
        <div style="padding: 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 8px;">
                <h4 style="margin: 0; color: #7B1B38;">Placement Info</h4>
                <button onclick="scrollToPlacement('${edgeAnnotation}')" class="btn btn-sm" style="font-size:10px; padding:2px 8px; background:#7B1B38; color:#fff; border:none; border-radius:4px; cursor:pointer;" title="Center tree on this placement"><i class="fa fa-crosshairs" style="margin-right:3px;"></i>Show on tree</button>
            </div>
            <p style="margin: 5px 0;"><strong>Likelihood weight ratio</strong> ${infoTooltipHTML(TOOLTIP_LWR)}<strong>:</strong> ${confidence.toFixed(4)}</p>
            <p style="margin: 5px 0;"><strong>Pendant length</strong> ${infoTooltipHTML(TOOLTIP_PL)}<strong>:</strong> ${pendantLength.toFixed(4)}</p>
        </div>
    `;

    const placementContainer = document.getElementById('placement-container');
    if (placementContainer) {
        const detailsDiv = document.createElement('div');
        detailsDiv.innerHTML = details;
        detailsDiv.style.marginTop = '10px';

        const existing = placementContainer.querySelector('.placement-details');
        if (existing) existing.remove();

        detailsDiv.className = 'placement-details';
        placementContainer.appendChild(detailsDiv);
    }
}

// Function to calculate color based on pendant length (evolutionary distance)
function getPlacementColor(pendantLength) {
    const startColor = { r: 123, g: 27, b: 56 }; // #7B1B38 (original red - good placement)
    const midColor = { r: 154, g: 89, b: 104 }; // #9a5968 (moderate placement)
    const endColor = { r: 189, g: 165, b: 171 }; // #bda5ab (bad placement)

    // Clamp pendant length to [0, 1.0] range
    const normalizedDistance = Math.min(pendantLength / 1.0, 1);

    // Use power curve (^1.5) to make transition faster
    const adjustedDistance = Math.pow(normalizedDistance, 1.5);

    let r, g, b;
    // Transition from red to mid color in first half, then mid to end color
    if (adjustedDistance < 0.5) {
        const t = adjustedDistance * 2; // 0 to 1
        r = Math.floor(startColor.r + (midColor.r - startColor.r) * t);
        g = Math.floor(startColor.g + (midColor.g - startColor.g) * t);
        b = Math.floor(startColor.b + (midColor.b - startColor.b) * t);
    } else {
        const t = (adjustedDistance - 0.5) * 2; // 0 to 1
        r = Math.floor(midColor.r + (endColor.r - midColor.r) * t);
        g = Math.floor(midColor.g + (endColor.g - midColor.g) * t);
        b = Math.floor(midColor.b + (endColor.b - midColor.b) * t);
    }

    return `rgb(${r}, ${g}, ${b})`;
}

// Function to add placement menu items to nodes
function addPlacementMenuItems(tree, bubbleData) {
    tree.phylotree.traverse_and_compute((node) => {
        const annotation = node.data?.annotation;
        const placementData = bubbleData[annotation];

        if (placementData !== undefined) {
            const confidence = placementData.confidence;
            const pendantLength = placementData.pendantLength;
            const isLeaf = !node.children || node.children.length === 0;
            const nodeType = isLeaf ? "Leaf" : "Internal Node";

            // Clear existing menu items related to placement
            if (!node.menu_items) {
                node.menu_items = [];
            } else {
                // Remove old placement items if they exist
                node.menu_items = node.menu_items.filter(item => {
                    const text = typeof item[0] === 'function' ? item[0](node) : item[0];
                    return !text.includes('Placement') && !text.includes('Confidence') && !text.includes('Pendant');
                });
            }

            // Add placement info header (not clickable, just info display)
            node.menu_items.push([
                (n) => `━━━ Placement Info (${nodeType}) ━━━`,
                () => { },
                () => true
            ]);

            node.menu_items.push([
                (n) => `Likelihood weight ratio: ${confidence.toFixed(4)}`,
                () => { },
                () => true
            ]);

            node.menu_items.push([
                (n) => `Pendant length: ${pendantLength.toFixed(4)}`,
                () => { },
                () => true
            ]);

            // Add clickable option to show details in placement container

        }
    });
}

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
    allPlacements = [];
    highConfidencePlacements = [];
    currentDisplayPlacements = [];
    showingAllPlacements = false;
    bubbleSize; // Declare bubbleSize at module level
    currentTree; // Keep reference to current tree
    treshold_to_display = 0.5; // Set threshold for high-confidence placements

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
    // Store confidence (placement[2]) and pendant_length (placement[4])
    const initialBubbleData = Object.fromEntries(
        currentDisplayPlacements.map(placement => [placement[0], { confidence: placement[2], pendantLength: placement[4] }])
    );

    bubbleSize = function (node) {
        const annotation = node.data?.annotation;
        const data = initialBubbleData[annotation];

        if (data !== undefined) {
            const confidence = data.confidence;
            // Use sqrt scaling to reduce maximum size, with a cap at 8
            const size = Math.min(Math.sqrt(parseFloat(confidence)) * 5, 5);
            console.log(`Node annotation: ${annotation}, Likelihood weight ratio: ${confidence}, Bubble size: ${size}`);
            return size;
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
            const data = initialBubbleData[annotation];
            const hasConfidence = data !== undefined;
            const isLeaf = !node.children || node.children.length === 0;

            if (hasConfidence) {
                container.classed("alternate", false);
                container.classed("circle", true);
                container.attr("data-edge", annotation); // tag for scrollToPlacement

                // For internal nodes with bubbles, add a special class
                if (!isLeaf) {
                    container.classed("internal-bubble", true);
                }

                // Color based on pendant_length (evolutionary distance)
                const pendantLength = data.pendantLength;
                const color = getPlacementColor(pendantLength);
                container.select('circle').style('fill', color);

                // Make bubble clickable - use namespaced event to avoid conflicts
                container.style('cursor', 'pointer')
                    .on('click.placement', function (d) {
                        if (d3.event) d3.event.stopPropagation();
                        const confidence = data.confidence;
                        const pendantLen = pendantLength;
                        showPlacementDetails(confidence, pendantLen, annotation);
                    });
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

    // Add placement menu items to nodes
    addPlacementMenuItems(renderedTree, initialBubbleData);

    // Add click handlers to placement bubbles after tree is rendered
    attachPlacementClickHandlers(initialBubbleData);

    // Auto-scroll tree to the best placement so it's visible on load
    setTimeout(() => {
        if (currentDisplayPlacements.length > 0) {
            // Scroll to the best placement (highest LWR)
            const best = currentDisplayPlacements.reduce((a, b) => b[2] > a[2] ? b : a);
            scrollToPlacement(best[0]);
        }
    }, 800);

    document.addEventListener("terminalNodesSelected", function (event) {
        const terminalNodes = event.detail;
        const nodeNames = terminalNodes.map(n => n.data.name);
        const filteredTable = getMetadataSubset(nodeNames, metadata);
        const metadataSummaryResult = getMetadataSummary(filteredTable);
        displayMetadataSummary(metadataSummaryResult);
    });
    // Display initial placements after tree is rendered
    updatePlacementContainer(currentDisplayPlacements, showingAllPlacements);
    console.log("After updatePlacementContainer");

    // Show the multi-placement explanation note if more than one placement
    const explanationEl = document.getElementById('placement-explanation');
    if (explanationEl && currentDisplayPlacements.length > 1) {
        explanationEl.style.display = 'block';
    }

    // Show colorbar legend
    const colorbar = document.getElementById('placement-colorbar');
    console.log('Colorbar element:', colorbar);
    if (colorbar) {
        colorbar.style.display = 'block';
        console.log('Colorbar display set to block');
    } else {
        console.warn('Colorbar element not found!');
    }

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

    // Initialize download functionality
    setupDownloadDataset(nwk, metadata);

    setupJplaceDownloads();

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

// Function to attach click handlers to placement bubbles after tree rendering
function attachPlacementClickHandlers(bubbleData) {
    console.log("Attaching click handlers to placement bubbles");
    console.log("bubbleData keys:", Object.keys(bubbleData));

    // Wait a bit for DOM to be ready, then select all circles
    setTimeout(() => {
        console.log("Looking for phylotree nodes...");
        const allNodes = document.querySelectorAll('.phylotree-node');
        console.log("Found phylotree nodes:", allNodes.length);

        // Try different selectors
        const allCircles = document.querySelectorAll('.phylotree-node circle');
        console.log("Found circles:", allCircles.length);

        // Iterate through all node groups
        allNodes.forEach((nodeGroup, index) => {
            // Get the node data from D3
            const d3Node = d3.select(nodeGroup);
            const nodeData = d3Node.datum();

            if (nodeData && nodeData.data) {
                const annotation = nodeData.data.annotation;
                const data = bubbleData[annotation];

                if (data !== undefined) {
                    console.log(`Node ${index} has placement data, annotation:`, annotation);

                    // Add click handler using native JavaScript
                    nodeGroup.style.cursor = 'pointer';
                    nodeGroup.addEventListener('click', function (event) {
                        event.stopPropagation();
                        event.preventDefault();

                        console.log("CLICKED on placement bubble!", annotation);

                        const confidence = data.confidence;
                        const pendantLength = data.pendantLength;
                        showPlacementDetails(confidence, pendantLength, annotation);
                    }, true); // Use capture phase

                    // Also add to the circle element
                    const circle = nodeGroup.querySelector('circle');
                    if (circle) {
                        circle.style.cursor = 'pointer';
                        circle.style.pointerEvents = 'all';
                    }
                }
            }
        });
    }, 500);
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
    // Update bubble data - convert to object for quick lookup
    const bubbleData = Object.fromEntries(
        placementsToShow.map(placement => [placement[0], { confidence: placement[2], pendantLength: placement[4] }])
    );

    // Update bubble size function
    bubbleSize = function (node) {
        const annotation = node.data?.annotation;
        const data = bubbleData[annotation];

        if (data !== undefined) {
            const confidence = data.confidence;
            // Use sqrt scaling to reduce maximum size, with a cap at 8
            const size = Math.min(Math.sqrt(parseFloat(confidence)) * 8, 8);
            console.log(`Node annotation: ${annotation}, Confidence: ${confidence}, Bubble size: ${size}`);
            return size;
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

    // Re-attach click handlers after tree update
    setTimeout(() => attachPlacementClickHandlers(bubbleData), 100);
}

function updatePlacementContainer(placementsToShow, showAll) {
    const placementContainer = document.getElementById('placement-container');

    // Add state for showing best vs all placements
    const showAllPlacements = placementContainer.dataset.showAllPlacements === 'true';

    // Find the best placement (highest like_weight_ratio)
    const bestPlacement = placementsToShow.reduce((best, current) =>
        current[2] > best[2] ? current : best
    );

    // Helper for formatting numbers
    function formatNumber(val) {
        if (Math.abs(val) < 0.001 && val !== 0) {
            return Number(val).toExponential(2);
        } else {
            return Number(val).toFixed(4).replace(/\.?0+$/, '');
        }
    }

    const isSinglePlacement = placementsToShow.length === 1;

    // --- Single placement: simplified display ---
    if (isSinglePlacement) {
        const likeWeight = formatNumber(bestPlacement[2]);
        const pendantLen = formatNumber(bestPlacement[4]);
        const pendantVal = bestPlacement[4];
        const edgeNum = bestPlacement[0];

        let qualityNote = '';
        if (pendantVal < 0.1) {
            qualityNote = `<div style="font-size: 11px; color: #1a7d37; margin-top: 6px; padding: 5px 10px; background: #f0faf3; border: 1px solid #c3e6cb; border-radius: 4px;">
                <i class="fa fa-check-circle" style="margin-right: 4px;"></i>
                The evolutionary distance is very short — this placement is reliable.
            </div>`;
        } else if (pendantVal < 0.5) {
            qualityNote = `<div style="font-size: 11px; color: #6c757d; margin-top: 6px;">
                Moderate evolutionary distance to the placement node.
            </div>`;
        } else if (pendantVal <= 1.0) {
            qualityNote = `<div style="font-size: 11px; color: #b45309; margin-top: 6px; padding: 5px 10px; background: #fefcf3; border: 1px solid #f0e6c8; border-radius: 4px;">
                <i class="fa fa-exclamation-circle" style="margin-right: 4px;"></i>
                The evolutionary distance is considerable — interpret with some caution.
            </div>`;
        } else {
            qualityNote = `<div style="font-size: 11px; color: #b45309; margin-top: 6px; padding: 5px 10px; background: #fefcf3; border: 1px solid #f0e6c8; border-radius: 4px;">
                <i class="fa fa-exclamation-triangle" style="margin-right: 4px;"></i>
                The evolutionary distance is large — the query may be distant from the reference sequences in this clade. Interpret with caution.
            </div>`;
        }

        const summaryBox = `
            <ul style="background:#f8f9fa; border-radius:6px; border:1px solid #dee2e6; padding:12px 18px; list-style-type:none; font-size:13px; margin:0 0 10px 0;">
                <li style="margin-bottom: 4px;">
                    <span style="display:inline-block; min-width: 200px;"><strong>Likelihood weight ratio</strong>
                        ${infoTooltipHTML(TOOLTIP_LWR_SINGLE)}<strong>:</strong> ${likeWeight}</span>
                    <span style="display:inline-block; min-width: 180px;"><strong>Pendant length</strong>
                        ${infoTooltipHTML(TOOLTIP_PL)}<strong>:</strong> ${pendantLen}</span>
                </li>
            </ul>
            ${qualityNote}
            <div style="font-size: 11px; margin-top: 6px;">
                <a href="/help#interpreting-results" style="color: #7B1B38; text-decoration: none; font-weight: 500;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'"><i class="fa fa-question-circle" style="margin-right: 3px;"></i>How to interpret placement results</a>
                <button onclick="scrollToPlacement('${edgeNum}')" class="btn btn-sm" style="font-size:10px; padding:2px 8px; margin-left:10px; background:#7B1B38; color:#fff; border:none; border-radius:4px; cursor:pointer;" title="Center tree on this placement"><i class="fa fa-crosshairs" style="margin-right:3px;"></i>Show on tree</button>
            </div>
        `;

        // Show confidence toggle only if there are hidden low-confidence placements
        let confidenceToggleButton = '';
        if (allPlacements.length > 1) {
            const buttonText = showAll ?
                `Show only high-confidence (${highConfidencePlacements.length})` :
                `Show all placements (${allPlacements.length})`;
            confidenceToggleButton = `<button id="toggle-placements-btn" class="btn btn-sm btn-secondary mb-2">${buttonText}</button><br>`;
        }

        placementContainer.innerHTML = confidenceToggleButton + summaryBox;

        // Re-attach confidence toggle listener
        const toggleBtn = document.getElementById('toggle-placements-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                showingAllPlacements = !showingAllPlacements;
                const newPlacements = showingAllPlacements ? allPlacements : highConfidencePlacements;
                updatePlacementDisplay(newPlacements, showingAllPlacements);
                MRSA_summury(newPlacements, placements, tree, metadata);
            });
        }
        return;
    }

    // --- Multiple placements: full display ---

    // Create toggle button for high/all confidence placements
    let confidenceToggleButton = '';
    if (highConfidencePlacements.length > 0 && highConfidencePlacements.length < allPlacements.length) {
        const buttonText = showAll ?
            `Show only high-confidence (${highConfidencePlacements.length})` :
            `Show all placements (${allPlacements.length})`;
        confidenceToggleButton = `<button id="toggle-placements-btn" class="btn btn-sm btn-secondary mb-2">${buttonText}</button><br>`;
    }

    // Create status header (smaller font)
    let statusHeader = '';
    if (showAll) {
        statusHeader = `<div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;"><strong>Showing ${showAllPlacements ? 'all ' + allPlacements.length : 'best of ' + allPlacements.length} total placements. ${!showAllPlacements ? 'The largest dot on the tree marks the most probable placement.' : ''}</strong></div>`;
    } else if (highConfidencePlacements.length > 0) {
        statusHeader = `<div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;"><strong>Showing ${showAllPlacements ? 'all ' + highConfidencePlacements.length : 'best of ' + highConfidencePlacements.length} high-confidence placements (LWR > ${treshold_to_display}). ${!showAllPlacements ? 'The largest dot on the tree marks the most probable placement.' : ''}</strong></div>`;
    } else {
        statusHeader = `<div style="font-size: 12px; color: #6c757d; margin-bottom: 8px;"><strong>Showing ${showAllPlacements ? 'all ' + allPlacements.length : 'best of ' + allPlacements.length} placements (none with LWR > ${treshold_to_display}). ${!showAllPlacements ? 'The largest dot on the tree marks the most probable placement.' : ''}</strong></div>`;
    }

    // Create toggle button for best vs all placements
    const placementToggleText = showAllPlacements ?
        `Show the best only` :
        `Show all ${placementsToShow.length} placements`;

    const placementToggleButton = `<div style="margin-bottom: 10px;"><button id="toggle-placement-view-btn" class="btn btn-sm btn-outline-secondary" style="color: #495057; border-color: #6c757d; background-color: #f8f9fa; padding: 6px 12px; font-weight: 500;">${placementToggleText}</button></div>`;

    let summaryBox;

    if (showAllPlacements) {
        // Show all placements as a compact table
        const dataRows = placementsToShow.map((values, index) => {
            const likeWeight = formatNumber(values[2]);
            const pendantLen = formatNumber(values[4]);
            const edgeNum = values[0];
            return `<tr>
                <td style="font-weight:600; color:#7B1B38; padding:3px 6px 3px 0; white-space:nowrap;">${index + 1}.</td>
                <td style="padding:3px 6px; white-space:nowrap;">${likeWeight}</td>
                <td style="padding:3px 6px; white-space:nowrap;">${pendantLen}</td>
                <td style="padding:3px 2px;"><button onclick="scrollToPlacement('${edgeNum}')" class="btn btn-sm" style="font-size:9px; padding:1px 6px; background:#7B1B38; color:#fff; border:none; border-radius:3px; cursor:pointer; line-height:1.4;" title="Center tree on placement ${index + 1}"><i class="fa fa-crosshairs"></i></button></td>
            </tr>`;
        }).join('');

        summaryBox = `
            <div style="background:#f8f9fa; border-radius:6px; border:1px solid #dee2e6; padding:10px 14px; font-size:13px; margin:0 0 10px 0;">
                <table style="border-collapse:collapse; width:100%;">
                    <thead>
                        <tr style="border-bottom:1px solid #dee2e6;">
                            <th style="padding:3px 6px 5px 0;"></th>
                            <th style="padding:3px 6px 5px; font-weight:600; color:#6c757d; text-align:left; white-space:nowrap; font-size:12px;">LWR ${infoTooltipHTML(TOOLTIP_LWR)}</th>
                            <th style="padding:3px 6px 5px; font-weight:600; color:#6c757d; text-align:left; white-space:nowrap; font-size:12px;">PL ${infoTooltipHTML(TOOLTIP_PL)}</th>
                            <th style="padding:3px 2px 5px;"></th>
                        </tr>
                    </thead>
                    <tbody>${dataRows}</tbody>
                </table>
            </div>
            <div style="font-size: 11px; margin-top: 6px;"><a href="/help#interpreting-results" style="color: #7B1B38; text-decoration: none; font-weight: 500;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'"><i class="fa fa-question-circle" style="margin-right: 3px;"></i>How to interpret placement results</a></div>
        `;
    } else {
        // Show only the best placement
        const likeWeight = formatNumber(bestPlacement[2]);
        const pendantLen = formatNumber(bestPlacement[4]);
        const edgeNum = bestPlacement[0];

        summaryBox = `
            <div style="background:#f8f9fa; border-radius:6px; border:1px solid #dee2e6; padding:10px 14px; font-size:13px; margin:0 0 10px 0;">
                <div style="margin-bottom:4px;">
                    <span style="font-weight:600; color:#7B1B38;">Best:</span>
                    <strong>LWR</strong> ${infoTooltipHTML(TOOLTIP_LWR)}<strong>:</strong> ${likeWeight}
                    &nbsp;&middot;&nbsp;
                    <strong>PL</strong> ${infoTooltipHTML(TOOLTIP_PL)}<strong>:</strong> ${pendantLen}
                    <button onclick="scrollToPlacement('${edgeNum}')" class="btn btn-sm" style="font-size:9px; padding:1px 6px; margin-left:6px; background:#7B1B38; color:#fff; border:none; border-radius:3px; cursor:pointer; line-height:1.4;" title="Center tree on best placement"><i class="fa fa-crosshairs"></i></button>
                </div>
            </div>
            <div style="font-size: 11px; margin-top: 6px;"><a href="/help#interpreting-results" style="color: #7B1B38; text-decoration: none; font-weight: 500;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'"><i class="fa fa-question-circle" style="margin-right: 3px;"></i>How to interpret placement results</a></div>
        `;
    }

    // Update container content (button moved under statusHeader)
    placementContainer.innerHTML = confidenceToggleButton + statusHeader + placementToggleButton + summaryBox;


    // Add event listener to confidence toggle button
    const toggleBtn = document.getElementById('toggle-placements-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            showingAllPlacements = !showingAllPlacements;
            const newPlacements = showingAllPlacements ? allPlacements : highConfidencePlacements;
            updatePlacementDisplay(newPlacements, showingAllPlacements);
            MRSA_summury(newPlacements, placements, tree, metadata);
        });
    }

    // Add event listener to placement view toggle button
    const placementViewToggleBtn = document.getElementById('toggle-placement-view-btn');
    if (placementViewToggleBtn) {
        placementViewToggleBtn.addEventListener('click', function () {
            // Toggle the state
            const currentState = placementContainer.dataset.showAllPlacements === 'true';
            placementContainer.dataset.showAllPlacements = !currentState;

            // Refresh the display
            updatePlacementContainer(placementsToShow, showAll);
        });
    }
}
function findRoot(tree) {
    // If tree is an object with nodes in tree.children or tree.nodes
    if (tree.root) return tree.root;
    if (tree.children) {
        // Find the node with parent === null
        return tree.children.find(node => node.parent === null);
    }
    if (tree.nodes) {
        return tree.nodes.find(node => node.parent === null);
    }
    // If tree itself is the root node
    if (tree.parent === null) return tree;
    return null;
}
function getLeafNamesForEdge(tree, edgeNum) {
    let leafNames = [];
    function traverse(node) {
        if (!node) return; // <-- Prevents error
        console.log("Visiting node:", node.data?.name, "annotation:", node.data?.annotation, "edgeNum:", edgeNum);
        if (node.data && String(node.data.annotation) === String(edgeNum)) {
            // Collect all leaves under this node
            collectLeaves(node);
        } else if (node.children) {
            node.children.forEach(traverse);
        }
    }
    function collectLeaves(node) {
        if (!node) return; // <-- Prevents error
        if (!node.children || node.children.length === 0) {
            leafNames.push(node.data.name);
        } else {
            node.children.forEach(collectLeaves);
        }
    }
    const rootNode = findRoot(tree);
    traverse(rootNode);
    return leafNames;
}
/**
 * Given a tree and an array of edge numbers, find the MRCA node
 * and return all leaf names under that MRCA.
 */
function getLeavesUnderMRCAFromEdges(tree, edgeNums) {
    // 1. Get all leaf names for each edge
    let allLeafNames = [];
    edgeNums.forEach(edgeNum => {
        allLeafNames = allLeafNames.concat(getLeafNamesForEdge(tree, edgeNum));
    });

    // 2. Remove duplicates
    allLeafNames = Array.from(new Set(allLeafNames));

    // 3. Find MRCA node
    const mrcaNode = tree.mrca(allLeafNames);

    // 4. Collect all leaves under MRCA node
    let mrcaLeafNames = [];
    function collectLeaves(node) {
        if (!node.children || node.children.length === 0) {
            mrcaLeafNames.push(node.data.name);
        } else {
            node.children.forEach(collectLeaves);
        }
    }
    if (mrcaNode) {
        collectLeaves(mrcaNode);
    }

    return {
        mrcaNode,
        mrcaLeafNames
    };
}
function MRSA_summury(displayedPlacements, placements, tree, metadata) {
    //console.log("Sample tree root:", tree.root);
    //console.log("Sample child:", tree.root.children?.[0]);
    console.log("MRSA_summury called with displayedPlacements:", displayedPlacements);
    // const displayedEdgeNums = displayedPlacements.map(p => p[0]);
    // const relevantPlacements = placements.filter(p =>
    //     p.p.some(arr => displayedEdgeNums.includes(arr[0]))
    // );
    // const placementNames = relevantPlacements.flatMap(p => p.n);

    // let allLeafNames = [];
    // displayedEdgeNums.forEach(edgeNum => {
    //     allLeafNames = allLeafNames.concat(getLeafNamesForEdge(tree, edgeNum));
    // });

    // console.log("Placement nums:", displayedEdgeNums);
    // console.log("Placement names (all leaves):", allLeafNames)
    // Find the MRCA node
    // const mrcaNode = tree.mrca(allLeafNames);

    // console.log("MRCA node:", mrcaNode);

    // if (mrcaNode) {
    //     getTerminalNodesArrayPlacement(tree, metadata, mrcaNode);
    // } else {
    //     console.log("No MRCA node found for placement names:", placementNames);
    // }
    const displayedEdgeNums = displayedPlacements.map(p => p[0]);
    const { mrcaNode, mrcaLeafNames } = getLeavesUnderMRCAFromEdges(tree, displayedEdgeNums);

    if (mrcaNode) {
        // Now you have all leaves under the MRCA node!
        const terminalNodes = tree.selectAllDescendants(mrcaNode, true, true);


        console.log("currentTree type:", typeof currentTree);
        console.log("currentTree properties:", Object.keys(currentTree));
        console.log("currentTree.modifySelection:", typeof currentTree.modifySelection);

        // Try calling modifySelection on currentTree
        if (currentTree && typeof currentTree.modifySelection === "function") {
            try {
                // Use function-based selector to clear non-clade and select clade in one pass
                var descendantSet = new Set(terminalNodes);
                descendantSet.add(mrcaNode);
                currentTree.modifySelection(
                    function (link) { return descendantSet.has(link.target); },
                    currentTree.selection_attribute_name
                );
                console.log("modifySelection called successfully");
            } catch (error) {
                console.error("Error calling modifySelection:", error);
            }
        } else {
            console.warn("currentTree.modifySelection is not available");
            // Alternative: Just dispatch the event without visual selection
            const summaryEvent = new CustomEvent("terminalNodesSelected", { detail: terminalNodes });
            document.dispatchEvent(summaryEvent);
        }



        // Dispatch the event just like phylotree.js does
        // implemented the same way as simple metadata summary

        const filteredTable = getMetadataSubset(mrcaLeafNames, metadata);
        const metadataSummaryResult = getMetadataSummary(filteredTable);

        // Store for later recall via the "Show Placement Clade Summary" button
        placementCladeSummary = metadataSummaryResult;
        placementCladeLeaves = mrcaLeafNames;

        displayMetadataSummary(metadataSummaryResult, true);

        // Enable the recall button now that we have data
        const recallBtn = document.getElementById('show-placement-summary-btn');
        if (recallBtn) {
            recallBtn.disabled = false;
            recallBtn.style.opacity = '0.85';
            recallBtn.style.cursor = 'pointer';
            recallBtn.title = `Show metadata summary for the ${mrcaLeafNames.length}-leaf placement clade`;
        }
    } else {
        console.log("No MRCA node found for edge numbers:", displayedEdgeNums);
    }
}
function updateTreeVisualization(bubbleData) {
    // Update tree options for the existing tree
    const customTreeOptions = {
        'draw-size-bubbles': true,
        'node-span': bubbleSize,
        'node-styler': function (container, node) {
            const annotation = node.data?.annotation;
            const data = bubbleData[annotation];
            const hasConfidence = data !== undefined;
            const isLeaf = !node.children || node.children.length === 0;

            if (hasConfidence) {
                // High-confidence nodes - apply styling to both leaf and internal nodes
                container.classed("alternate", false);
                container.classed("circle", true);
                container.attr("data-edge", annotation); // tag for scrollToPlacement

                // For internal nodes with bubbles, add a special class for additional styling
                if (!isLeaf) {
                    container.classed("internal-bubble", true);
                }

                // Color based on pendant_length (evolutionary distance)
                const pendantLength = data.pendantLength;
                const color = getPlacementColor(pendantLength);
                container.select('circle').style('fill', color);

                // Make bubble clickable - use namespaced event to avoid conflicts
                container.style('cursor', 'pointer')
                    .on('click.placement', function (d) {
                        if (d3.event) d3.event.stopPropagation();
                        const confidence = data.confidence;
                        const pendantLen = pendantLength;
                        showPlacementDetails(confidence, pendantLen, annotation);
                    });
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

        // Re-add placement menu items after update
        addPlacementMenuItems(currentTree, bubbleData);

        // Trigger tree update/redraw
        currentTree.update();
        console.log("Tree updated with new placements");
    }
}






// Wire up the "Show Placement Clade Summary" button
document.addEventListener('DOMContentLoaded', function () {
    const recallBtn = document.getElementById('show-placement-summary-btn');
    if (recallBtn) {
        recallBtn.addEventListener('click', function () {
            if (placementCladeSummary) {
                displayMetadataSummary(placementCladeSummary, true);

                // Also re-select the placement clade on the tree for visual feedback
                if (placementCladeLeaves && placementCladeLeaves.length > 0 && tree) {
                    try {
                        const mrcaNode = tree.mrca(placementCladeLeaves);
                        if (mrcaNode) {
                            const terminalNodes = tree.selectAllDescendants(mrcaNode, true, true);
                            if (currentTree && typeof currentTree.modifySelection === 'function') {
                                // Use function-based selector to clear non-clade and select clade in one pass
                                var descendantSet = new Set(terminalNodes);
                                descendantSet.add(mrcaNode);
                                currentTree.modifySelection(
                                    function (link) { return descendantSet.has(link.target); },
                                    currentTree.selection_attribute_name
                                );
                            }
                        }
                    } catch (e) {
                        console.warn('Could not re-select placement clade leaves:', e);
                    }
                }

                // Scroll the metadata summary card into view
                const card = document.getElementById('metadata-summary-card');
                if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
});

main();