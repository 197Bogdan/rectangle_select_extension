let enabled = false;

browser.storage.local.get("enabled").then((result) => {
    enabled = result.enabled ?? false;

    if (!enabled) {
        clearSelection();
    }
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) {
        return;
    }

    enabled = changes.enabled.newValue;

    if (!enabled) {
        selecting = false;
        selectionBox.style.display = "none";
        clearSelection();
    }
});

let selecting = false;

let selectedText = "";
let hasSelection = false;

let mouseX = 0;
let mouseY = 0;

let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;

// Only text nodes currently visible in the viewport.
// Each entry contains:
// { node, rect }
let visibleTextNodeRects = [];
let visibleTextNodeRectsValid = false;


// -------------------------
// Get all text nodes in the page
// -------------------------

function getTextNodes() {
    const textNodes = [];

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
    );

    let node;

    while (node = walker.nextNode()) {
        textNodes.push(node);
    }
    return textNodes;
}


// -------------------------
// Get all visible text nodes in the viewport
// They are invalidated on scroll or resize.
// -------------------------

function rebuildVisibleTextNodeRects() {
    visibleTextNodeRects = [];

    const viewport = {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight
    };

    const textNodes = getTextNodes();
    for (const node of textNodes) {

        // -------------------------
        // Get text node bounds
        // -------------------------

        const range = document.createRange();

        range.selectNodeContents(node);

        const rect = range.getBoundingClientRect();


        // -------------------------
        // Ignore invisible nodes
        // -------------------------

        if (rect.width === 0 && rect.height === 0) {
            continue;
        }


        // -------------------------
        // Ignore nodes outside viewport
        // -------------------------

        if (!intersects(rect, viewport)) {
            continue;
        }


        // -------------------------
        // Cache visible nodes
        // -------------------------

        visibleTextNodeRects.push({
            node,
            rect
        });
    }

    visibleTextNodeRectsValid = true;
}


// -------------------------
// Debug: print all visible text-node rectangles
// -------------------------

function logVisibleTextNodeRects() {

    console.log(
        `VISIBLE TEXT NODE RECTANGLES (${visibleTextNodeRects.length})`
    );

    const rows = visibleTextNodeRects.map((entry, index) => {

        const rect = entry.rect;

        return {
            index,
            text: entry.node.textContent,
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
    });

    console.table(rows);
}


// -------------------------
// Invalidate viewport cache
// -------------------------

function invalidateVisibleTextNodeRects() {
    visibleTextNodeRectsValid = false;
}


// -------------------------
// Invalidate viewport cache on scroll or resize
// -------------------------

window.addEventListener("scroll", () => {
    invalidateVisibleTextNodeRects();
});

window.addEventListener("resize", () => {
    invalidateVisibleTextNodeRects();
});

const observer = new MutationObserver(() => {
    invalidateVisibleTextNodeRects();
});

observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
});


// -------------------------
// Selection UI
// -------------------------

const selectionBox = document.createElement("div");

selectionBox.style.position = "fixed";
selectionBox.style.pointerEvents = "none";
selectionBox.style.zIndex = "2147483647";
selectionBox.style.border = "2px solid #4285f4";
selectionBox.style.background = "rgba(66, 133, 244, 0.15)";
selectionBox.style.display = "none";

document.documentElement.appendChild(selectionBox);


function updateSelectionBox() {

    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);

    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;

    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
}


// -------------------------
// Dynamically update selection box
// -------------------------

document.addEventListener(
    "mousemove",
    (event) => {

        if (!enabled) {
            return;
        }

        mouseX = event.clientX;
        mouseY = event.clientY;

        if (!selecting) {
            return;
        }

        endX = mouseX;
        endY = mouseY;

        updateSelectionBox();

        updateSelectedCharacters();
    }
);


// -------------------------
// Clear selection on click
// -------------------------

document.addEventListener(
    "mousedown",
    (event) => {

        if (!enabled) {
            return;
        }

        if (selecting) {
            return;
        }

        if (!hasSelection) {
            return;
        }

        clearSelection();
    }
);


// -------------------------
// Start selection
// -------------------------

document.addEventListener(
    "keydown",
    (event) => {

        if (!enabled) {
            return;
        }

        if (event.key === "Shift" && !selecting) {

            selecting = true;

            // Clear normal browser text selection
            window.getSelection().removeAllRanges();

            startX = mouseX;
            startY = mouseY;

            endX = mouseX;
            endY = mouseY;

            // Show selection box
            selectionBox.style.display = "block";

            updateSelectionBox();

            console.log(
                "Selection started:",
                startX,
                startY
            );
        }
    }
);


// -------------------------
// Finish selection
// -------------------------

document.addEventListener(
    "keyup",
    (event) => {

        if (!enabled) {
            return;
        }

        if (event.key === "Shift" && selecting) {

            selecting = false;

            // Hide selection box
            selectionBox.style.display = "none";


            // Make sure the latest selection has been calculated
            updateSelectedCharacters();


            console.log(
                "Selection finished:",
                {
                    startX,
                    startY,
                    endX,
                    endY
                }
            );


            // -------------------------
            // DEBUG OUTPUT
            // -------------------------

            // console.log(
            //     "=============================="
            // );

            // console.log(
            //     "SELECTION RECTANGLE"
            // );

            // console.table([{
            //     left: Math.min(startX, endX),
            //     top: Math.min(startY, endY),
            //     right: Math.max(startX, endX),
            //     bottom: Math.max(startY, endY),
            //     width: Math.abs(endX - startX),
            //     height: Math.abs(endY - startY)
            // }]);


            // console.log(
            //     "=============================="
            // );

            // Print all visible text-node rectangles
            // logVisibleTextNodeRects();


            // console.log(
            //     "=============================="
            // );

            // // Print all selected character rectangles
            // logSelectedCharacterRects();


            // console.log(
            //     "=============================="
            // );

            // console.log(
            //     "SELECTED TEXT:"
            // );

            // console.log(selectedText);
        }
    }
);


// -------------------------
// Custom highlight
// -------------------------

const highlightStyle = document.createElement("style");

highlightStyle.textContent = `
    ::highlight(rectangle-selection) {
        background-color: Highlight;
        color: HighlightText;
    }
`;

document.documentElement.appendChild(
    highlightStyle
);


// -------------------------
// Copy selected text
// -------------------------

document.addEventListener(
    "keydown",
    async (event) => {

        if (!enabled) {
            return;
        }

        if (!hasSelection) {
            return;
        }

        const isCopy =
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "c";

        if (!isCopy) {
            return;
        }

        const nativeSelection = window.getSelection();

        // Let normal browser selection handle Ctrl+C
        if (!nativeSelection.isCollapsed) {
            return;
        }

        event.preventDefault();

        try {

            await navigator.clipboard.writeText(
                selectedText
            );

            console.log("Copied:");
            console.log(selectedText);

        } catch (error) {

            console.error(
                "Failed to copy selection to clipboard:",
                error
            );
        }
    }
);


// -------------------------
// Update selected characters and highlight them
// -------------------------

function updateSelectedCharacters() {

    // -------------------------
    // Make sure viewport cache exists
    // -------------------------

    if (!visibleTextNodeRectsValid) {
        rebuildVisibleTextNodeRects();
    }


    // -------------------------
    // Selection rectangle
    // -------------------------

    const selectionRect = {
        left: Math.min(startX, endX),
        right: Math.max(startX, endX),

        top: Math.min(startY, endY),
        bottom: Math.max(startY, endY)
    };


    const highlight = new Highlight();

    const selectedCharacters = [];


    let nodeCount = 0;
    let characterCount = 0;
    let selectedCount = 0;


    // -------------------------
    // Process ONLY visible nodes
    // -------------------------

    for (const entry of visibleTextNodeRects) {

        nodeCount++;

        const node = entry.node;


        // -------------------------
        // Process characters
        // -------------------------

        for (let i = 0; i < node.length; i++) {

            characterCount++;

            const range = document.createRange();

            range.setStart(node, i);
            range.setEnd(node, i + 1);


            const rect = range.getBoundingClientRect();

            const isSelected =
                intersects(rect, selectionRect);


            if (isSelected) {

                highlight.add(range);

                selectedCharacters.push({
                    character: node.textContent[i],
                    rect
                });

                selectedCount++;
            }
        }
    }


    // -------------------------
    // Apply highlight
    // -------------------------

    CSS.highlights.set(
        "rectangle-selection",
        highlight
    );


    // -------------------------
    // Reconstruct text
    // -------------------------

    selectedText =
        reconstructText(selectedCharacters);

    hasSelection =
        selectedText.length > 0;


    // Store the current selected rectangles
    // so they can be printed after selection.
    lastSelectedCharacters =
        selectedCharacters;
}


// -------------------------
// Selected character data
// -------------------------

let lastSelectedCharacters = [];


// -------------------------
// Debug: print all selected character rectangles
// -------------------------

function logSelectedCharacterRects() {

    console.log(
        `SELECTED CHARACTER RECTANGLES (${lastSelectedCharacters.length})`
    );

    const rows = lastSelectedCharacters.map(
        (entry, index) => {

            const rect = entry.rect;

            return {
                index,
                character: entry.character,
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
            };
        }
    );

    console.table(rows);
}


// -------------------------
// Reconstruct selected text
// -------------------------

function reconstructText(characters) {

    if (characters.length === 0) {
        return "";
    }


    // Sort visually:
    // top → bottom, then left → right

    characters.sort((a, b) => {

        const verticalDifference =
            a.rect.top - b.rect.top;

        if (Math.abs(verticalDifference) > 2) {
            return verticalDifference;
        }

        return a.rect.left - b.rect.left;
    });


    let result = "";

    let currentRowTop =
        characters[0].rect.top;

    let previousCharacter =
        characters[0];


    result += previousCharacter.character;


    for (
        let i = 1;
        i < characters.length;
        i++
    ) {

        const character =
            characters[i];


        const rowDifference =
            Math.abs(
                character.rect.top -
                currentRowTop
            );


        // New visual row
        if (rowDifference > 2) {

            result += "\n";

            currentRowTop =
                character.rect.top;

        } else {

            // Same row: detect a visual gap
            // between words/cells

            const horizontalGap =
                character.rect.left -
                previousCharacter.rect.right;


            if (horizontalGap > 5) {
                result += " ";
            }
        }


        result += character.character;

        previousCharacter =
            character;
    }


    return result;
}


// -------------------------
// Clear selection
// -------------------------

function clearSelection() {

    CSS.highlights.delete(
        "rectangle-selection"
    );

    selectedText = "";

    hasSelection = false;

    lastSelectedCharacters = [];

    console.log(
        "Selection cleared"
    );
}


// -------------------------
// Rectangle intersection
// -------------------------

function intersects(a, b) {

    return (
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top
    );
}
