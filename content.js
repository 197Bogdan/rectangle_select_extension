let selecting = false;

let mouseX = 0;
let mouseY = 0;

let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;

let selectedText = "";
let hasSelection = false;

// -------------------------
// Cached text nodes
// -------------------------

// All text nodes in the page.
// This is relatively cheap to keep around.
let textNodes = [];

// Only text nodes currently visible in the viewport.
// Each entry contains:
// {
//     node,
//     rect
// }
let visibleTextNodeRects = [];

let visibleTextNodeRectsValid = false;


// -------------------------
// Scan all text nodes
// -------------------------

function scanTextNodes() {
    const start = performance.now();

    textNodes = [];

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
    );

    let node;

    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    const elapsed =
        performance.now() - start;

    console.log(
        "Scanned",
        textNodes.length,
        "text nodes in",
        elapsed.toFixed(2),
        "ms"
    );
}


// -------------------------
// Build viewport cache
// -------------------------

function rebuildVisibleTextNodeRects() {
    const start = performance.now();

    visibleTextNodeRects = [];

    const viewport = {
        left: 0,
        top: 0,
        right: window.innerWidth,
        bottom: window.innerHeight
    };

    let visibleCount = 0;

    for (const node of textNodes) {
        // -------------------------
        // Get text node bounds
        // -------------------------

        const range = document.createRange();

        range.selectNodeContents(node);

        const rect =
            range.getBoundingClientRect();

        // -------------------------
        // Ignore invisible nodes
        // -------------------------

        if (
            rect.width === 0 &&
            rect.height === 0
        ) {
            continue;
        }

        // -------------------------
        // Ignore nodes outside viewport
        // -------------------------

        if (!intersects(rect, viewport)) {
            continue;
        }

        // -------------------------
        // Cache visible node
        // -------------------------

        visibleTextNodeRects.push({
            node,
            rect
        });

        visibleCount++;
    }

    visibleTextNodeRectsValid = true;

    const elapsed =
        performance.now() - start;

    console.log(
        "Rebuilt viewport cache:",
        visibleCount,
        "visible text nodes in",
        elapsed.toFixed(2),
        "ms"
    );
}


// -------------------------
// Invalidate viewport cache
// -------------------------

function invalidateVisibleTextNodeRects() {
    visibleTextNodeRectsValid = false;
}


// Scrolling changes getBoundingClientRect()
// coordinates.
window.addEventListener("scroll", () => {
    invalidateVisibleTextNodeRects();
});


// Resizing can change text wrapping
// and therefore geometry.
window.addEventListener("resize", () => {
    invalidateVisibleTextNodeRects();
});


// -------------------------
// Scan page once when extension starts
// -------------------------

scanTextNodes();


// -------------------------
// Selection UI
// -------------------------

const selectionBox =
    document.createElement("div");

selectionBox.style.position = "fixed";
selectionBox.style.pointerEvents = "none";
selectionBox.style.zIndex = "2147483647";
selectionBox.style.border =
    "2px solid #4285f4";
selectionBox.style.background =
    "rgba(66, 133, 244, 0.15)";
selectionBox.style.display = "none";

document.documentElement.appendChild(
    selectionBox
);


function updateSelectionBox() {
    const left =
        Math.min(startX, endX);

    const top =
        Math.min(startY, endY);

    const width =
        Math.abs(endX - startX);

    const height =
        Math.abs(endY - startY);

    selectionBox.style.left =
        `${left}px`;

    selectionBox.style.top =
        `${top}px`;

    selectionBox.style.width =
        `${width}px`;

    selectionBox.style.height =
        `${height}px`;
}


// -------------------------
// Dynamically update selection box
// -------------------------

document.addEventListener(
    "mousemove",
    (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;

        if (!selecting) {
            return;
        }

        endX = mouseX;
        endY = mouseY;

        updateSelectionBox();
        updateHighlight();
    }
);


// -------------------------
// Clear selection on click
// -------------------------

document.addEventListener(
    "mousedown",
    (event) => {
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
        if (
            event.key === "Shift" &&
            !selecting
        ) {
            selecting = true;

            // Clear normal browser text selection
            window.getSelection()
                .removeAllRanges();

            startX = mouseX;
            startY = mouseY;

            endX = mouseX;
            endY = mouseY;

            selectionBox.style.display =
                "block";

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
        if (
            event.key === "Shift" &&
            selecting
        ) {
            selecting = false;

            selectionBox.style.display =
                "none";

            console.log(
                "Selection finished:",
                {
                    startX,
                    startY,
                    endX,
                    endY
                }
            );
        }
    }
);


// -------------------------
// Custom highlight
// -------------------------

const highlightStyle =
    document.createElement("style");

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
        if (!hasSelection) {
            return;
        }

        const isCopy =
            (event.ctrlKey || event.metaKey) &&
            event.key.toLowerCase() === "c";

        if (!isCopy) {
            return;
        }

        const nativeSelection =
            window.getSelection();

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
                "Failed to copy:",
                error
            );
        }
    }
);


// -------------------------
// Find selected characters
// -------------------------

function updateHighlight() {
    const totalStart =
        performance.now();


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


    const highlight =
        new Highlight();

    const selectedCharacters = [];


    // -------------------------
    // Timers
    // -------------------------

    let createRangeTime = 0;
    let setRangeTime = 0;
    let geometryTime = 0;
    let intersectionTime = 0;
    let highlightAddTime = 0;

    let nodeCount = 0;
    let characterCount = 0;
    let selectedCount = 0;


    // -------------------------
    // Process ONLY visible nodes
    // -------------------------

    for (
        const entry
        of visibleTextNodeRects
    ) {
        nodeCount++;

        const node =
            entry.node;


        // -------------------------
        // Process characters
        // -------------------------

        for (
            let i = 0;
            i < node.length;
            i++
        ) {
            characterCount++;


            // -------------------------
            // createRange
            // -------------------------

            let start =
                performance.now();

            const range =
                document.createRange();

            createRangeTime +=
                performance.now() - start;


            // -------------------------
            // setStart + setEnd
            // -------------------------

            start =
                performance.now();

            range.setStart(
                node,
                i
            );

            range.setEnd(
                node,
                i + 1
            );

            setRangeTime +=
                performance.now() - start;


            // -------------------------
            // getBoundingClientRect
            // -------------------------

            start =
                performance.now();

            const rect =
                range.getBoundingClientRect();

            geometryTime +=
                performance.now() - start;


            // -------------------------
            // Intersection test
            // -------------------------

            start =
                performance.now();

            const isSelected =
                intersects(
                    rect,
                    selectionRect
                );

            intersectionTime +=
                performance.now() - start;


            // -------------------------
            // Selected
            // -------------------------

            if (isSelected) {

                start =
                    performance.now();

                highlight.add(range);

                highlightAddTime +=
                    performance.now() - start;


                selectedCharacters.push({
                    character:
                        node.textContent[i],

                    rect
                });

                selectedCount++;
            }
        }
    }


    // -------------------------
    // Apply highlight
    // -------------------------

    const highlightStart =
        performance.now();

    CSS.highlights.set(
        "rectangle-selection",
        highlight
    );

    const highlightTime =
        performance.now() -
        highlightStart;


    // -------------------------
    // Reconstruct text
    // -------------------------

    const reconstructStart =
        performance.now();

    selectedText =
        reconstructText(
            selectedCharacters
        );

    hasSelection =
        selectedText.length > 0;

    const reconstructTime =
        performance.now() -
        reconstructStart;


    // -------------------------
    // Timing results
    // -------------------------

    const totalTime =
        performance.now() -
        totalStart;


    console.log(
        "----- updateHighlight timing -----"
    );


    console.log(
        "Total:",
        totalTime.toFixed(2),
        "ms"
    );


    console.log(
        "Cached visible text nodes:",
        nodeCount
    );


    console.log(
        "Characters processed:",
        characterCount
    );


    console.log(
        "Characters selected:",
        selectedCount
    );


    console.log(
        "createRange:",
        createRangeTime.toFixed(2),
        "ms"
    );


    console.log(
        "setStart + setEnd:",
        setRangeTime.toFixed(2),
        "ms"
    );


    console.log(
        "Character getBoundingClientRect:",
        geometryTime.toFixed(2),
        "ms"
    );


    console.log(
        "intersects:",
        intersectionTime.toFixed(2),
        "ms"
    );


    console.log(
        "highlight.add:",
        highlightAddTime.toFixed(2),
        "ms"
    );


    console.log(
        "CSS.highlights.set:",
        highlightTime.toFixed(2),
        "ms"
    );


    console.log(
        "reconstructText:",
        reconstructTime.toFixed(2),
        "ms"
    );


    console.log(
        "Unaccounted:",
        (
            totalTime -
            createRangeTime -
            setRangeTime -
            geometryTime -
            intersectionTime -
            highlightAddTime -
            highlightTime -
            reconstructTime
        ).toFixed(2),
        "ms"
    );


    console.log(
        "----------------------------------"
    );
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

    for (let i = 1; i < characters.length; i++) {
        const character = characters[i];

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
            // Same row: detect a visual gap between words/cells
            const horizontalGap =
                character.rect.left -
                previousCharacter.rect.right;

            if (horizontalGap > 5) {
                result += " ";
            }
        }

        result += character.character;

        previousCharacter = character;
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