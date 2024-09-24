// get the tree from the jplace file
tree = jplace.tree;
// get the placement from the jplace file

const fs = require('fs');

// Read the JSON file
fs.readFile('/path/to/your/file.json', 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }

    // Parse the JSON data
    const jsonData = JSON.parse(data);

    // Access the "tree" and "placements" fields
    const tree = jsonData.tree;
    const placements = jsonData.placements;

    // Access the "p" and "n" fields within "placements"
    placements.forEach((placement) => {
        const p = placement.p;
        const n = placement.n;

        // Do something with the "p" and "n" values
        console.log(`p: ${p}, n: ${n}`);
    });
});
