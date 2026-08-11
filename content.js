let selecting = false;

let mouseX = 0;
let mouseY = 0;

let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;


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
// Mouse tracking
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
// Start selection
// -------------------------

document.addEventListener("keydown", (event) => {
    if (event.key === "Shift" && !selecting) {
        selecting = true;

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
// Find selected characters
// -------------------------

function updateHighlight() {
    const selectionRect = {
        left: Math.min(startX, endX),
        right: Math.max(startX, endX),
        top: Math.min(startY, endY),
        bottom: Math.max(startY, endY)
    };

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
    );

    const highlight = new Highlight();
    const selectedCharacters = [];

    let node;

    while (node = walker.nextNode()) {
        for (let i = 0; i < node.length; i++) {
            const range = document.createRange();

            range.setStart(node, i);
            range.setEnd(node, i + 1);

            const rect = range.getBoundingClientRect();

            if (intersects(rect, selectionRect)) {
                highlight.add(range);

                selectedCharacters.push(
                    node.textContent[i]
                );
            }
        }
    }

    CSS.highlights.set(
        "rectangle-selection",
        highlight
    );

    const selectedText = selectedCharacters.join("");

    console.log(selectedText);
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