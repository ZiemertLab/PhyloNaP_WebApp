import * as d3 from "d3";
import "../../modules/phylotree.js/src/main";


class Phylotree extends Component {
    state = {};

    /**
     * For general node styling within the phylogenetic tree
     *
     * @param {HTMLElement} container
     * @param {Object} node
     */
    nodeStyler = (container, node) => {
        let is_leaf = d3.layout.phylotree.is_leafnode(node)
        let is_collapsed = node["own-collapse"]
        let div = d3.select("#tooltip");
        let lookFor = is_collapsed ? node["show-name"] : node.name; // Either clade or leaf
        if (is_leaf || is_collapsed) {
            container
                .selectAll("circle")
                .style({ "fill": "black" }) // Style is covered by index.css
                .attr({ r: 2 })
                .on("mouseover", () => {
                    d3.selectAll(`.node-${lookFor}.guides`).classed("highlighted-guide", true);
                    div.transition().duration(200).style("opacity", 0.9).style("display", "flex");
                    div
                        .html(lookFor)
                        .style("left", d3.event.pageX + "px")
                        .style("top", d3.event.pageY - 28 + "px");
                })
                .on("mouseout", () => {
                    d3.selectAll(`.node-${lookFor}.guides`).classed("highlighted-guide", false);
                    div.transition().duration(500).style("opacity", 0);
                });

            if (is_collapsed) {
                container.selectAll("polygon").remove()
                const numberLeavesShown = (this.props.shownNodes).length
                const sizeTriangle = 12
                const heightTriangle = Math.min(this.container.offsetHeight * 0.95 / numberLeavesShown, sizeTriangle)
                container.insert("polygon", ":first-child").attr({ points: `${sizeTriangle},-${heightTriangle} 1,0 ${sizeTriangle},${heightTriangle}` }).style({ fill: "url(#gradient-collapse)" })
                node["changed-form"] = true
            }
        } else if (node) {
            if (node["changed-form"]) {
                container
                    .selectAll("polygon").remove()
                node["changed-form"] = false
            }

            container
                .selectAll("circle")
                .style("fill", "lightgray")
                .attr({ r: node.has_hidden_nodes ? 4 : 3 })
                .on("mouseout", null)
                .on("mouseover", null);
        }
        if (node["show-snp-table"]) {
            container.selectAll("circle").style({ fill: "lightblue" }).attr({ r: 7 });
        }
    };

    /**
     * Aggregates the selected clade
     * @param {Object} node
     */
    collapseNode(node) {
        if (!node["own-collapse"]) {
            node["own-collapse"] = true;
            node["show-name"] = this.props.onCollapse(node);
        } else {
            node["show-name"] = "";
            node["own-collapse"] = false;
            this.props.onDecollapse(node);
        }
        this.props.onSelection(this.props.tree.get_selection());
    }

    /**
     * Opens modal for rename of clade
     * @param {Object} node
     */
    renameClade(node) {
        this.props.onOpenRenameClade(node);
    }

    /**
     * Shows the SNPs distributed to the selected node.
     * @param {Object} node selected
     */
    showSNPsfromNode(node) {
        this.props.tree.get_nodes().filter(
            node => node["show-snp-table"]).forEach(
                node => node["show-snp-table"] = false)
        node["show-snp-table"] = true
        let node_name = this.props.ids.numToLabel[node.tempid];
        let descendants = this.props.tree
            .descendants(node)
            .filter((d) => d.tempid !== node.tempid)
            .map((d) => this.props.ids.numToLabel[d.tempid]);
        let supportSNPs = this.props.snpdata.support;
        class Phylotree {
            constructor(props) {
                this.props = props;
            }

            modifyListOfSNPs(listSNPs, listNames) {
                return _.uniqWith(
                    listSNPs
                        .filter((snp) => listNames.includes(snp.node))
                        .map((snp) => ({
                            pos: snp.pos,
                            allele: snp.allele,
                            inActualNode: snp.node === listNames[0],
                        }))
                        .sort((a, b) => d3.ascending(parseInt(a.pos), parseInt(b.pos))),
                    _.isEqual
                );
            }

            remberCladeSelection(node) {
                let descendants = this.props.tree
                    .descendants(node)
                    .filter((d) => d.tempid !== node.tempid);
                this.props.rememberCladeSelection(node, descendants);
            }

            startStatisticsDialog(node) {
                this.props.showStatisticsModal();
                this.remberCladeSelection(node);
            }

            isStatisticPossible(node) {
                if (this.props.computeStatistics) {
                    this.startStatisticsDialog(node);
                } else {
                    this.props.showUploadFilesModal();
                }
            }

            hideNode(node) {
                if (!node["hidden-t"]) {
                    node["hidden-t"] = true;
                    this.props.tree
                        .modify_selection(
                            [node].concat(this.props.tree.select_all_descendants(node, true, true)),
                            "notshown",
                            true,
                            true,
                            "true"
                        )
                        .update_has_hidden_nodes()
                        .update();

                    this.props.onHide(this.props.tree.descendants(node));
                    this.props.onSelection(this.props.tree.get_selection());
                }
            }

            shouldComponentUpdate(nextProp, nextState) {
                return nextProp.newick !== undefined && nextProp.newick !== this.props.newick;
            }

            componentDidUpdate(prevProp) {
                if (prevProp.newick !== this.props.newick) {
                    this.renderTree(this.props.newick);
                }
            }

            componentDidMount() {
                let margin_top = this.container.offsetHeight * 0.05;
                this.props.tree
                    .size([this.container.offsetHeight, this.container.offsetWidth])
                    .svg(
                        d3
                            .select(this.container)
                            .append("svg")
                            .attr("id", "tree-display")
                            .attr({ height: this.container.offsetHeight, width: this.container.offsetWidth })
                            .append("g")
                            .attr("id", "transform-group")
                            .attr("transform", `translate(${[0, margin_top]})`)
                            .append("g")
                            .attr("id", "zoom-phylotree")
                    );
                this.container.addEventListener("mousemove", this.horizontalDrag);
                this.container.addEventListener("wheel", this.horizontalZoom);
                let gradient = d3
                    .select("#tree-display")
                    .append("defs")
                    .append("linearGradient")
                    .attr("id", "gradient-collapse");
                gradient.append("stop").attr({ offset: "0%", "stop-color": "black" });
                gradient.append("stop").attr({ offset: "100%", "stop-color": "white" });
            }

            horizontalZoom(ev) {
                if (ev.ctrlKey) {
                    ev.preventDefault();
                    let selection = d3.select("#zoom-phylotree");
                    let transform = selection.attr("transform") || "translate(0,0)scale(1,1)";
                    transform = d3.transform(transform);
                    let scale = transform.scale[0];
                    scale = scale + ev.deltaY * -0.001;
                    scale = Math.min(Math.max(0.8, scale), 10);
                    let scaleDifference = Math.min(0, this.container.offsetWidth - this.container.offsetWidth * transform.scale[0]);
                    let translateX = Math.max(transform.translate[0], scaleDifference);

                    let transformString = `translate(${translateX},${transform.translate[1]})scale(${scale},${transform.scale[1]})`;
                    selection.attr("transform", `${transformString}`);
                }
            }

            horizontalDrag(ev) {
                if (this.props.dragActive) {
                    ev.preventDefault();
                    let selection = d3.select("#zoom-phylotree");
                    let transform = selection.attr("transform") || "translate(0,0)scale(1,1)";
                    transform = d3.transform(transform);
                    let translateX = transform.translate[0] + ev.movementX;
                    let scaleDifference = Math.min(0, this.container.offsetWidth - this.container.offsetWidth * transform.scale[0]);
                    translateX = Math.max(Math.min(10, translateX), scaleDifference);
                    let transformString = `translate(${translateX},${transform.translate[1]})scale(${transform.scale[0]},${transform.scale[1]})`;
                    selection.attr("transform", `${transformString}`);
                }
            }

            renderTree(input_tree) {
                const addTimeoutCursor = (func, time = 10) => {
                    document.body.style.cursor = "wait";
                    window.setTimeout(() => {
                        func();
                        document.body.style.cursor = "default";
                    }, time);
                };

                this.props.tree(input_tree).style_nodes(this.nodeStyler).layout();
                this.props.onUploadTree(this.props.tree.get_nodes());
                let count = 1;
                this.props.tree.traverse_and_compute((d) => {
                    d.tempid = count;
                    count = count + 1;
                    return d;
                });

                this.props.tree.get_nodes().forEach((tnode) => {
                    d3.layout.phylotree.add_custom_menu(
                        tnode,
                        () => (!this.props.cladogramState ? "Show as cladogram" : "Show as dendrogram"),
                        () => this.props.updateCladogramm(),
                        (node) => node.depth === 0
                    );
                    d3.layout.phylotree.add_custom_menu(
                        tnode,
                        () => "Show SNPs in sidebar",
                        () => addTimeoutCursor(() => this.showSNPsfromNode(tnode), 50),
                        () => true
                    );
                    d3.layout.phylotree.add_custom_menu(
                        tnode,
                        () => "Compute statistics for clade",
                        () => addTimeoutCursor(() => this.isStatisticPossible(tnode), 1),
                        () => true
                    );
                    d3.layout.phylotree.add_custom_menu(
                        tnode,
                        (node) => (node["own-collapse"] ? "Decollapse subtree" : "Collapse substree"),
                        () => addTimeoutCursor(() => this.collapseNode(tnode, this.props.tree, this.props.onCollapse), 1),
                        () => !d3.layout.phylotree.is_leafnode(tnode)
                    );
                    d3.layout.phylotree.add_custom_menu(
                        tnode,
                        (node) => `Hide this ${d3.layout.phylotree.is_leafnode(node) ? "node" : "subtree"}`,
                        () => addTimeoutCursor(() => this.hideNode(tnode, this.props.tree)),
                        (node) => node.depth !== 0
                    );
                    d3.layout.phylotree.add_custom_menu(
                        tnode,
                        () => "Show the hidden nodes",
                        () => addTimeoutCursor(() => this.props.onShowMyNodes(tnode)),
                        (node) => node.has_hidden_nodes || node.depth === 0 || false
                    );
                    d3.layout.phylotree.add_custom_menu(
                        tnode,
                        (node) => (node["own-collapse"] || false) && "Rename clade",
                        () => this.renameClade(tnode),
                        (node) => node["own-collapse"] || false
                    );
                    d3.select("#tree-display").selectAll("polygon").remove();
                });

                this.runSelection();
            }

            runSelection() {
                this.props.tree.selection_callback((selection) => {
                    this.props.onSelection(selection);
                });
            }

            render() {
                return <div className="lchild" ref={(el) => (this.container = el)} />;
            }
        }

        export default Phylotree;
