let selecting = false;

let mouseX = 0;
let mouseY = 0;

let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;

const eventKey = "Control";

console.log("Rectangle select extension loaded.");

document.addEventListener("keydown", (event) => {
    if (event.key === eventKey && !selecting) {
        selecting = true;

        startX = mouseX;
        startY = mouseY;

        endX = mouseX;
        endY = mouseY;

        console.log("Selection started:", startX, startY);
    }
});

// Always remember where the cursor is.
document.addEventListener("mousemove", (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;

    if (!selecting) {
        return;
    }

    endX = mouseX;
    endY = mouseY;
});

document.addEventListener("keyup", (event) => {
    if (event.key === eventKey && selecting) {
        selecting = false;

        console.log("Selection finished:", endX, endY);

        selectCharacters();
    }
});


function selectCharacters() {
    const selectionRect = {
        left: Math.min(startX, endX),
        right: Math.max(startX, endX),
        top: Math.min(startY, endY),
        bottom: Math.max(startY, endY)
    };

    console.log("Selected rectangle:", selectionRect);

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
    );

    let node;

    while (node = walker.nextNode()) {
        for (let i = 0; i < node.length; i++) {
            const range = document.createRange();

            range.setStart(node, i);
            range.setEnd(node, i + 1);

            const rect = range.getBoundingClientRect();

            if (intersects(rect, selectionRect)) {
                console.log(
                    "SELECTED:",
                    JSON.stringify(node.textContent[i])
                );
            }
        }
    }
}


function intersects(a, b) {
    return (
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top
    );
}