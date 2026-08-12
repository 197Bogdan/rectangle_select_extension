import { state } from "./state.js";
import { ensureTextNodeRectsCache, resetTextNodeRectsCache, getTextNodeRectsCache } from "./textRectCache.js";
import { enableAutoScroll, disableAutoScroll } from "./autoScroll.js";
import { debugLog } from "./debug.js";
import { intersects, contains } from "./geometry.js";
import { reconstructText } from "./textReconstruction.js";

const highlightStyle = document.createElement("style");
highlightStyle.textContent = `
    ::highlight(rectangle-selection) {
        background-color: Highlight;
        color: HighlightText;
    }
`;
document.documentElement.appendChild(highlightStyle);

export const selectionBox = document.createElement("div");
selectionBox.style.position = "fixed";
selectionBox.style.pointerEvents = "none";
selectionBox.style.zIndex = "2147483647";
selectionBox.style.border = "2px solid #4285f4";
selectionBox.style.background = "rgba(66, 133, 244, 0.15)";
selectionBox.style.display = "none";
document.documentElement.appendChild(selectionBox);

export function updateSelectionBox() {
    const left = Math.min(state.startX, state.endX) - window.scrollX;
    const top = Math.min(state.startY, state.endY) - window.scrollY;
    const width = Math.abs(state.endX - state.startX);
    const height = Math.abs(state.endY - state.startY);
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
}

export function showSelectionBox() {
    selectionBox.style.display = "block";
    updateSelectionBox();
}

export function hideSelectionBox() {
    selectionBox.style.display = "none";
}

// ============================================================
// SELECTION LOGIC
// ============================================================

export function startSelection() {

    if (state.selecting) {
        return;
    }

    state.selecting = true;

    // Make sure we are working with the current DOM.
    ensureTextNodeRectsCache();

    // Clear normal browser text selection.
    window.getSelection().removeAllRanges();

    // Convert current mouse position from viewport → document coords.
    state.startX = state.mouseX + window.scrollX;
    state.startY = state.mouseY + window.scrollY;
    state.endX = state.startX;
    state.endY = state.startY;
    showSelectionBox();
    enableAutoScroll();
    debugLog("Selection started:", state.startX, state.startY);
}

export function finishSelection() {

    if (!state.selecting) {
        return;
    }


    disableAutoScroll();
    state.selecting = false;
    // Make sure the latest selection is calculated while the append-only cache still exists.
    updateSelectedCharacters();
    hideSelectionBox();


    debugLog(
        "Selection finished:",
        {
            startX: state.startX,
            startY: state.startY,
            endX: state.endX,
            endY: state.endY
        }
    );

    resetTextNodeRectsCache();
}

export function updateSelectedCharacters() {
    const selectionRect = { 
        left: Math.min(state.startX, state.endX), 
        right: Math.max(state.startX, state.endX), 
        top: Math.min(state.startY, state.endY), 
        bottom: Math.max(state.startY, state.endY) 
    };

    const highlight = new Highlight();
    const selectedCharacters = [];

    // -------------------------
    // Process cached nodes
    // -------------------------
    for (const entry of getTextNodeRectsCache()) {
        const node = entry.node;

        if (!node.isConnected) {
            continue;
        }

        // -------------------------
        // Skip nodes that don't
        // intersect selection.
        // -------------------------
        if (!intersects(entry.rect, selectionRect)) {
            continue;
        }

        // =================================================
        // BUILD CHARACTER CACHE
        // =================================================

        if (!entry.characterRects) {
            entry.characterRects = [];
            for (let i = 0; i < node.length; i++) {
                const range = document.createRange();
                range.setStart(node, i);
                range.setEnd(node, i + 1);
                const viewportRect = range.getBoundingClientRect();
                const rect = { 
                    left: viewportRect.left + window.scrollX, 
                    top: viewportRect.top + window.scrollY, 
                    right: viewportRect.right + window.scrollX, 
                    bottom: viewportRect.bottom + window.scrollY, 
                    width: viewportRect.width, 
                    height: viewportRect.height 
                };
                entry.characterRects.push({ rect, range });
            }
        }

        // =================================================
        // FULLY SELECTED NODE
        // =================================================
        if (contains(selectionRect, entry.rect)) {
            const range = document.createRange();
            range.selectNodeContents(node);
            highlight.add(range);

            // Still store individual characters because
            // reconstructText() needs them.
            for (let i = 0; i < entry.characterRects.length; i++) {

                const character = entry.characterRects[i];
                selectedCharacters.push({
                    character: node.textContent[i],
                    rect: character.rect
                });
            }
            continue;
        }

        // =================================================
        // PARTIALLY SELECTED NODE
        // =================================================

        for (let i = 0; i < entry.characterRects.length; i++) {
            const character = entry.characterRects[i];
            const rect = character.rect;

            const isSelected = intersects(rect, selectionRect);
            if (!isSelected) {
                continue;
            }

            highlight.add(character.range);

            selectedCharacters.push({
                character: node.textContent[i],
                rect
            });
        }
    }
    CSS.highlights.set("rectangle-selection", highlight);
    state.selectedText = reconstructText(selectedCharacters);
    state.hasSelection = state.selectedText.length > 0;
}

let selectionUpdatePending = false;

export function scheduleSelectionUpdate() {

    if (selectionUpdatePending) {
        return;
    }

    selectionUpdatePending = true;
    requestAnimationFrame(() => {
        selectionUpdatePending = false;

        if (!state.selecting) {
            return;
        }

        ensureTextNodeRectsCache();
        updateSelectedCharacters();
    });
}

export function clearSelection() {
    CSS.highlights.delete("rectangle-selection");
    state.selectedText = "";
    state.hasSelection = false;

    debugLog("Selection cleared");
}

