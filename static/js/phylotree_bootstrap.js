import * as d3 from "d3";
import "../../modules/phylotree.js/src/main";

nwk = "(((((YP_0038120:0.3990275855,ZP_0509506:0.4708403113)16:0.0827617173,((((YP_0028009:0.0983484613,ABK15514:0.1322882846)100:0.2658296649,ZP_1077782:0.6890206276)54:0.1249721135,ZP_0111387:0.3178024438)33:0.0462544520,((YP_433139:0.3823668263,YP_958213:0.3906268190)69:0.1354198970,ZP_0130727:0.3058092646)36:0.1005193390)18:0.0211735847)22:0.0605114450,(((YP_0030742:0.1830349875,YP_526727:0.1042282207)95:0.1357964298,ZP_1013419:0.3702960354)78:0.0718566437,ZP_0950340:0.3886711834)70:0.1073072978)71:0.1546311852,((ZP_0998998:0.0955996985,ZP_1049308:0.0615438616)99:0.3920705702,(YP_0021568:0.3911667388,((((YP_0029865:0.0841201303,AFB73763:0.0283518412)17:0.0000014632,EHB20458:0.0687641880)59:0.0542412622,ZP_0296170:0.3755247695)92:0.1582934488,YP_0050935:0.3509942991)82:0.1264119120)58:0.0310116086)98:0.2431064013)100:1.1356345531,ZP_1115340:0.1260949059,ZP_0206258:0.1548044869);"
tree = Phylotree {
    newick_string: "(((((YP_0038120:0.3990275855,ZP_0509506:0.47084031…ZP_1115340:0.1260949059,ZP_0206258:0.1548044869);"
    nodes: Zh {data: Object, height: 8, depth: 0, parent: null, children: Array(3), text_angle: null, text_align: null, radius: null, angle: null, y: 0, x: 581, id: 44, screen_x: 0, screen_y: 581}
    links: Array(43) [Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, Object, …]
    parsed_tags: Array(0) []
    partitions: Array(0) []
    branch_length_accessor: ƒ(_node, new_length)
    branch_length: ƒ(_node, new_length)
    logger: console {debug: ƒ(), error: ƒ(), log: ƒ(), info: ƒ(), warn: ƒ(), clear: ƒ(), dir: ƒ(), dirxml: ƒ(), table: ƒ(), trace: ƒ(), assert: ƒ(), count: ƒ(), countReset: ƒ(), profile: ƒ(), profileEnd: ƒ(), time: ƒ(), timeLog: ƒ(), timeEnd: ƒ(), timeStamp: ƒ(), takeHeapSnapshot: ƒ(), …}
    selection_attribute_name: "selected"
    display: TreeRender {css_classes: Object, phylotree: Phylotree, container: undefined, separation: ƒ(_node, _previous), _nodeLabel: ƒ(_node), svg: Pn, selectionCallback: null, scales: Array(2), size: Array(2), fixed_width: Array(2), font_size: 12, scale_bar_font_size: 12, offsets: Array(2), draw_branch: ƒ(a), draw_scale_bar: ƒ(h), edge_placer: ƒ(edge, where), count_listener_handler: ƒ(), layout_listener_handler: ƒ(), node_styler: ƒ(element, data), edge_styler: null, …}
    <prototype>: Phylotree {isLeafNode: ƒ(node), mrca: ƒ(), hasBranchLengths: ƒ(), getBranchLengths: ƒ(), branchName: ƒ(attr), normalizeBranchLengths: ƒ(attr), scaleBranchLengths: ƒ(scale_by), getNewick: ƒ(annotator), resortChildren: ƒ(comparator, start_node, filter), setBranchLength: ƒ(attr), maxParsimony: ƒ(respect_existing, attr_name), getTipLengths: ƒ(), leftChildRightSibling: ƒ(root), graftANode: ƒ(graft_at, new_child, new_parent, lengths), deleteANode: ƒ(index), getTips: ƒ(), getInternals: ƒ(), getRootNode: ƒ(), getNodes: ƒ(), getNodeByName: ƒ(name), …}
  }



  phylotree = Object {
  centerOfTree: ƒ(tree, power)
  clusterPicker: ƒ(tree, bootstrap_threshold, diameter_threshold, root_node, missing_bootstrap_value)
  computeMidpoint: ƒ(tree)
  extract_dates: ƒ(…)
  fitRootToTip: ƒ(tree)
  inOrder: ƒ(node, callback, backtrack)
  leftChildRightSibling: ƒ(root)
  loadAnnotations: ƒ(tree, label, annotations)
  pairwise_distances: ƒ(tree)
  parseAnnotations: ƒ(buf)
  phylopart: ƒ(tree, bootstrap_threshold, percentile_threshold, missing_bootstrap_value, resolution)
  phylotree: class
  postOrder: ƒ(node, callback, backtrack)
  preOrder: ƒ(node, callback, backtrack)
  rootToTip: ƒ(tree)
  sackin: ƒ(tree)
}
colorScale = ƒ(n)
colorNodesByName = ƒ(element, data)
renderedTree = TreeRender {css_classes: Object, phylotree: Phylotree, container: undefined, separation: ƒ(_node, _previous), _nodeLabel: ƒ(_node), svg: Pn, selectionCallback: null, scales: Array(2), size: Array(2), fixed_width: Array(2), font_size: 12, scale_bar_font_size: 12, offsets: Array(2), draw_branch: ƒ(a), draw_scale_bar: ƒ(h), edge_placer: ƒ(edge, where), count_listener_handler: ƒ(), layout_listener_handler: ƒ(), node_styler: ƒ(element, data), edge_styler: null, …}
bootstrapNodes = Array(21) [Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, Zh, …]