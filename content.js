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

let textNodes = [];

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

    const elapsed = performance.now() - start;

    console.log(
        "Scanned",
        textNodes.length,
        "text nodes in",
        elapsed.toFixed(2),
        "ms"
    );
}

// Scan the page once when the extension starts
scanTextNodes();

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

document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;

    if (!selecting) {
        return;
    }

    endX = mouseX;
    endY = mouseY;

    updateSelectionBox();
    updateHighlight();
});

// -------------------------
// Clear selection on click
// -------------------------

document.addEventListener("mousedown", (event) => {
    if (selecting) {
        return;
    }

    if (!hasSelection) {
        return;
    }

    clearSelection();
});

// -------------------------
// Start selection
// -------------------------

document.addEventListener("keydown", (event) => {
    if (event.key === "Shift" && !selecting) {
        selecting = true;

        // Clear normal browser text selection
        window.getSelection().removeAllRanges();

        startX = mouseX;
        startY = mouseY;

        endX = mouseX;
        endY = mouseY;

        selectionBox.style.display = "block";

        updateSelectionBox();

        console.log("Selection started:", startX, startY);
    }
});

// -------------------------
// Finish selection
// -------------------------

document.addEventListener("keyup", (event) => {
    if (event.key === "Shift" && selecting) {
        selecting = false;

        selectionBox.style.display = "none";

        console.log("Selection finished:", {
            startX,
            startY,
            endX,
            endY
        });
    }
});

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

document.documentElement.appendChild(highlightStyle);

// -------------------------
// Copy selected text
// -------------------------

document.addEventListener("keydown", async (event) => {
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
        await navigator.clipboard.writeText(selectedText);

        console.log("Copied:");
        console.log(selectedText);
    } catch (error) {
        console.error("Failed to copy:", error);
    }
});

// -------------------------
// Find selected characters
// -------------------------

function updateHighlight() {
    const totalStart = performance.now();

    const selectionRect = {
        left: Math.min(startX, endX),
        right: Math.max(startX, endX),
        top: Math.min(startY, endY),
        bottom: Math.max(startY, endY)
    };

    const highlight = new Highlight();
    const selectedCharacters = [];

    let createRangeTime = 0;
    let setRangeTime = 0;
    let geometryTime = 0;
    let intersectionTime = 0;
    let highlightAddTime = 0;

    let characterCount = 0;
    let selectedCount = 0;

    // Use cached text nodes instead of TreeWalker
    for (const node of textNodes) {
        for (let i = 0; i < node.length; i++) {
            characterCount++;

            // createRange
            let start = performance.now();

            const range = document.createRange();

            createRangeTime += performance.now() - start;

            // setStart + setEnd
            start = performance.now();

            range.setStart(node, i);
            range.setEnd(node, i + 1);

            setRangeTime += performance.now() - start;

            // getBoundingClientRect
            start = performance.now();

            const rect = range.getBoundingClientRect();

            geometryTime += performance.now() - start;

            // intersection test
            start = performance.now();

            const isSelected = intersects(
                rect,
                selectionRect
            );

            intersectionTime += performance.now() - start;

            if (isSelected) {
                // Highlight.add
                start = performance.now();

                highlight.add(range);

                highlightAddTime += performance.now() - start;

                selectedCharacters.push({
                    character: node.textContent[i],
                    rect: rect
                });

                selectedCount++;
            }
        }
    }

    // Apply highlight
    const highlightStart = performance.now();

    CSS.highlights.set(
        "rectangle-selection",
        highlight
    );

    const highlightTime =
        performance.now() - highlightStart;

    // Reconstruct text
    const reconstructStart = performance.now();

    selectedText = reconstructText(selectedCharacters);
    hasSelection = selectedText.length > 0;

    const reconstructTime =
        performance.now() - reconstructStart;

    // -------------------------
    // Timing results
    // -------------------------

    const totalTime =
        performance.now() - totalStart;

    console.log("----- updateHighlight timing -----");

    console.log(
        "Total:",
        totalTime.toFixed(2),
        "ms"
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
        "getBoundingClientRect:",
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

    console.log("----------------------------------");
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

        if (rowDifference > 2) {
            result += "\n";
            currentRowTop =
                character.rect.top;
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

    console.log("Selection cleared");
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