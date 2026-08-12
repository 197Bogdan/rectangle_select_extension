import { state } from "./state.js";
import {
    startAutoScroll,
    stopAutoScroll
} from "./autoScroll.js";
import {
    intersects,
    contains
} from "./geometry.js";
import {
    debugLog,
    debugTable,
    logSelectedCharacterRects
} from "./debug.js";
import { reconstructText } from "./textReconstruction.js";
import {
    ensureTextNodeCache,
    resetTextNodeCache,
    invalidateVisibleTextNodeRects,
    getVisibleTextNodeRects
} from "./textCache.js";
import {
    updateSelectionBox,
    showSelectionBox,
    hideSelectionBox
} from "./selectionBox.js";

browser.storage.local.get("enabled").then((result) => {
    state.enabled = result.enabled ?? false;

    if (!state.enabled) {
        clearSelection();
    }
});

browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes.enabled) {
        return;
    }

    state.enabled = changes.enabled.newValue;

    if (!state.enabled) {
        state.selecting = false;
        stopAutoScroll();
        hideSelectionBox();
        clearSelection();
        resetTextNodeCache();
    }
});


// -------------------------
// Scroll
//
// While selecting, leaving the buffer
// expands the cache rather than rebuilding it.
// -------------------------

window.addEventListener(
    "scroll",
    () => {

        if (!state.selecting) {
            return;
        }

        // The mouse stays at the same viewport
        // position while the document moves underneath it.
        state.endX =
            state.mouseX +
            window.scrollX;

        state.endY =
            state.mouseY +
            window.scrollY;

        updateSelectionBox();
        scheduleSelectionUpdate();
    },
    {
        passive: true
    }
);

// -------------------------
// Resize
// -------------------------

window.addEventListener(
    "resize",
    () => {

        if (state.selecting) {

            updateSelectionBox();
            scheduleSelectionUpdate();

            return;
        }

        invalidateVisibleTextNodeRects();
    }
);

// -------------------------
// Watch for dynamically generated
// / modified page content.
// -------------------------

const observer =
    new MutationObserver(() => {

        if (state.selecting) {
            return;
        }

        invalidateVisibleTextNodeRects();
    });

observer.observe(
    document.body,
    {
        childList: true,
        subtree: true,
        characterData: true
    }
);

// ============================================================
// MOUSE
// ============================================================

document.addEventListener(
    "mousemove",
    (event) => {

        if (!state.enabled) {
            return;
        }

        // Mouse coordinates are viewport-relative.
        state.mouseX = event.clientX;
        state.mouseY = event.clientY;

        if (!state.selecting) {
            return;
        }

        event.preventDefault();

        // Convert mouse coordinates to
        // document coordinates.
        state.endX =
            event.clientX +
            window.scrollX;

        state.endY =
            event.clientY +
            window.scrollY;

        updateSelectionBox();
        scheduleSelectionUpdate();
    }
);

// ============================================================
// CLEAR SELECTION ON CLICK
// ============================================================

document.addEventListener(
    "mousedown",
    (event) => {

        if (!state.enabled) {
            return;
        }

        // Left mouse button
        if (event.button === 0) {

            state.leftMousePressed = true;

            // If R is already being held,
            // start rectangle selection.
            if (state.rPressed && !state.selecting) {
                event.preventDefault();
                startSelection();
                return;
            }
        }

        // If we're not starting a selection,
        // clicking normally clears the previous one.
        if (!state.selecting && state.hasSelection) {
            clearSelection();
        }
    }
);

document.addEventListener(
    "mouseup",
    (event) => {

        if (event.button !== 0) {
            return;
        }

        state.leftMousePressed = false;

        // Releasing left click ends selection.
        if (state.selecting) {
            finishSelection();
        }
    }
);

// ============================================================
// START SELECTION
// ============================================================

document.addEventListener(
    "keydown",
    (event) => {

        if (!state.enabled) {
            return;
        }

        if (
            event.key.toLowerCase() === "r"
        ) {

            state.rPressed = true;

            // If left click is already held,
            // start rectangle selection.
            if (
                state.leftMousePressed &&
                !state.selecting
            ) {
                startSelection();
            }
        }
    }
);

// ============================================================
// FINISH SELECTION
// ============================================================

document.addEventListener(
    "keyup",
    (event) => {

        if (!state.enabled) {
            return;
        }

        if (
            event.key.toLowerCase() === "r"
        ) {

            state.rPressed = false;

            // Releasing R ends selection.
            if (state.selecting) {
                finishSelection();
            }
        }
    }
);

// ============================================================
// CUSTOM HIGHLIGHT
// ============================================================

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

// ============================================================
// COPY SELECTED TEXT
// ============================================================

document.addEventListener(
    "keydown",
    async (event) => {

        if (!state.enabled) {
            return;
        }

        if (!state.hasSelection) {
            return;
        }

        const isCopy =
            (
                event.ctrlKey ||
                event.metaKey
            ) &&
            event.key.toLowerCase() === "c";

        if (!isCopy) {
            return;
        }

        const nativeSelection =
            window.getSelection();

        // Let normal browser selection
        // handle Ctrl+C.
        if (!nativeSelection.isCollapsed) {
            return;
        }

        event.preventDefault();

        try {

            await navigator.clipboard.writeText(
                state.selectedText
            );

            debugLog("Copied:");
            debugLog(state.selectedText);

        } catch (error) {

            console.error(
                "Failed to copy selection to clipboard:",
                error
            );
        }
    }
);

// ============================================================
// START SELECTION
// ============================================================

function startSelection() {

    if (state.selecting) {
        return;
    }

    state.selecting = true;

    // Make sure we are working with
    // the current DOM.
    ensureTextNodeCache();

    // Clear normal browser text selection.
    window.getSelection()
        .removeAllRanges();

    // Convert current mouse position
    // from viewport → document coords.
    state.startX =
        state.mouseX +
        window.scrollX;

    state.startY =
        state.mouseY +
        window.scrollY;

    state.endX = state.startX;
    state.endY = state.startY;

    // Show selection box.
    showSelectionBox();

    startAutoScroll();

    debugLog(
        "Selection started:",
        state.startX,
        state.startY
    );
}

// ============================================================
// FINISH SELECTION
// ============================================================

function finishSelection() {

    if (!state.selecting) {
        return;
    }

    stopAutoScroll();

    state.selecting = false;

    // Hide selection box.
    hideSelectionBox();

    // Make sure the latest selection
    // is calculated while the
    // append-only cache still exists.
    updateSelectedCharacters();

    debugLog(
        "Selection finished:",
        {
            startX: state.startX,
            startY: state.startY,
            endX: state.endX,
            endY: state.endY
        }
    );

    // Discard accumulated cache.
    resetTextNodeCache();
}

// ============================================================
// UPDATE SELECTED CHARACTERS
// ============================================================

function updateSelectedCharacters() {

    // -------------------------
    // Selection rectangle
    // -------------------------

    const selectionRect = {
        left:
            Math.min(
                state.startX,
                state.endX
            ),

        right:
            Math.max(
                state.startX,
                state.endX
            ),

        top:
            Math.min(
                state.startY,
                state.endY
            ),

        bottom:
            Math.max(
                state.startY,
                state.endY
            )
    };

    const highlight =
        new Highlight();

    const selectedCharacters = [];
    // -------------------------
    // Process cached nodes
    // -------------------------

    for (
        const entry
        of getVisibleTextNodeRects()
    ) {

        const node =
            entry.node;

        if (!node.isConnected) {
            continue;
        }

        // -------------------------
        // Skip nodes that don't
        // intersect selection.
        // -------------------------

        if (
            !intersects(
                entry.rect,
                selectionRect
            )
        ) {
            continue;
        }

        // =================================================
        // BUILD CHARACTER CACHE
        // =================================================

        if (!entry.characterRects) {

            entry.characterRects = [];

            for (
                let i = 0;
                i < node.length;
                i++
            ) {

                // -------------------------
                // Range creation
                // -------------------------

                const range =
                    document.createRange();

                range.setStart(
                    node,
                    i
                );

                range.setEnd(
                    node,
                    i + 1
                );


                // -------------------------
                // Get character geometry
                // -------------------------

                const viewportRect =
                    range.getBoundingClientRect();


                // -------------------------
                // Convert to document coords
                // -------------------------

                const rect = {

                    left:
                        viewportRect.left +
                        window.scrollX,

                    top:
                        viewportRect.top +
                        window.scrollY,

                    right:
                        viewportRect.right +
                        window.scrollX,

                    bottom:
                        viewportRect.bottom +
                        window.scrollY,

                    width:
                        viewportRect.width,

                    height:
                        viewportRect.height
                };

                // -------------------------
                // Cache range + rectangle
                // -------------------------

                entry.characterRects.push({
                    rect,
                    range
                });
            }
        }


        // =================================================
        // FULLY SELECTED NODE
        // =================================================

        if (
            contains(
                selectionRect,
                entry.rect
            )
        ) {

            // One range for the entire text node.
            const range =
                document.createRange();

            range.selectNodeContents(node);

            highlight.add(range);

            // Still store individual characters because
            // reconstructText() needs them.
            for (
                let i = 0;
                i < entry.characterRects.length;
                i++
            ) {

                const character =
                    entry.characterRects[i];

                selectedCharacters.push({
                    character:
                        node.textContent[i],

                    rect:
                        character.rect
                });
            }

            continue;
        }

        // =================================================
        // PARTIALLY SELECTED NODE
        // =================================================

        for (
            let i = 0;
            i < entry.characterRects.length;
            i++
        ) {

            const character =
                entry.characterRects[i];

            const rect =
                character.rect;

            // -------------------------
            // Intersection
            // -------------------------

            const isSelected =
                intersects(
                    rect,
                    selectionRect
                );


            if (!isSelected) {
                continue;
            }

            // -------------------------
            // Highlight
            // -------------------------

            highlight.add(
                character.range
            );

            // -------------------------
            // Store selected character
            // -------------------------

            selectedCharacters.push({

                character:
                    node.textContent[i],

                rect
            });
        }
    }

    CSS.highlights.set(
        "rectangle-selection",
        highlight
    );

    state.selectedText =
        reconstructText(
            selectedCharacters
        );

    state.hasSelection =
        state.selectedText.length > 0;

    lastSelectedCharacters =
        selectedCharacters;
}

let selectionUpdatePending = false;

function scheduleSelectionUpdate() {

    if (selectionUpdatePending) {
        return;
    }

    selectionUpdatePending = true;

    requestAnimationFrame(() => {

        selectionUpdatePending = false;

        if (!state.selecting) {
            return;
        }

        ensureTextNodeCache();
        updateSelectedCharacters();
    });
}

// ============================================================
// SELECTED CHARACTER DATA
// ============================================================

let lastSelectedCharacters = [];


// ============================================================
// CLEAR SELECTION
// ============================================================

function clearSelection() {

    CSS.highlights.delete(
        "rectangle-selection"
    );

    state.selectedText = "";
    state.hasSelection = false;
    lastSelectedCharacters = [];

    debugLog("Selection cleared");
}
