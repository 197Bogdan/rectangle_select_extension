import { state } from "./state.js";
import { enableAutoScroll, disableAutoScroll } from "./autoScroll.js";
import { debugLog } from "./debug.js";
import { resetTextNodeRectsCache } from "./textRectCache.js";
import { updateSelectionBox, hideSelectionBox, 
    startSelection, finishSelection, clearSelection, scheduleSelectionUpdate
 } from "./selection.js";

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
        disableAutoScroll();
        hideSelectionBox();
        clearSelection();
        resetTextNodeRectsCache();
    }
});


// -------------------------
// Watch for dynamically generated
// / modified page content.
// -------------------------

const observer =
    new MutationObserver(() => {
        if (state.selecting) {
            return;
        }

        resetTextNodeRectsCache();
    });

observer.observe(
    document.body,
    {
        childList: true,
        subtree: true,
        characterData: true
    }
);

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
// Invalidate cache on resize
// -------------------------

window.addEventListener(
    "resize",
    () => {
        if (state.selecting) {
            updateSelectionBox();
            scheduleSelectionUpdate();

            return;
        }

        resetTextNodeRectsCache();
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

// ============================================================
// STOP SELECTION
// ============================================================
document.addEventListener(
    "mouseup",
    (event) => {
        if (event.button !== 0) {
            return;
        }

        // Releasing left click ends selection.
        state.leftMousePressed = false;
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

        if (event.key.toLowerCase() === "r") {
            state.rPressed = true;

            // If left click is already held,
            // start rectangle selection.
            if (state.leftMousePressed && !state.selecting) {
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

        // Releasing R ends selection.
        if (event.key.toLowerCase() === "r") {
            state.rPressed = false;
            if (state.selecting) {
                finishSelection();
            }
        }
    }
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

        const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";
        if (!isCopy) {
            return;
        }

        const nativeSelection = window.getSelection();

        // Let normal browser selection handle Ctrl+C.
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
            console.error("Failed to copy selection to clipboard:", error);
        }
    }
);