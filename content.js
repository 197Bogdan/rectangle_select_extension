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
        resetTextNodeCache();
    }
});

const DEBUG = true;

function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

function debugTable(rows) {
    if (DEBUG) {
        console.table(rows);
    }
}

let selecting = false;
let rPressed = false;
let leftMousePressed = false;

let selectedText = "";
let hasSelection = false;

// -------------------------
// Mouse coordinates
//
// mouseX / mouseY are viewport coordinates.
// start/end are DOCUMENT coordinates.
// -------------------------

let mouseX = 0;
let mouseY = 0;

let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;

// ============================================================
// TEXT GEOMETRY CACHE
// ============================================================
//
// Text rectangles are stored in DOCUMENT coordinates.
//
// Normally the cache covers the viewport plus a buffer.
//
// IMPORTANT:
//
// While selecting, the cache is APPEND-ONLY.
//
// This means if the user scrolls:
//
//     old cached nodes
//           +
//     newly discovered nodes
//
// are all kept.
//
// The cache is reset when the selection finishes.
// ============================================================

let visibleTextNodeRects = [];

let visibleTextNodeRectsValid = false;

// Keep track of nodes already in the cache so that when we
// expand the cache we don't add the same node repeatedly.
const cachedTextNodes = new Set();

// How far beyond the viewport we cache.
// 0.5 viewport widths/heights on each side.
const CACHE_BUFFER_MULTIPLIER = 0.5;

// Document-coordinate bounds of the current cache.
let cacheRegion = null;

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
// Get the document-coordinate
// cache region around the viewport
// -------------------------

function getCacheRegion() {
    const bufferY =
        window.innerHeight *
        CACHE_BUFFER_MULTIPLIER;

    const bufferX =
        window.innerWidth *
        CACHE_BUFFER_MULTIPLIER;

    const documentWidth =
        Math.max(
            document.documentElement.scrollWidth,
            document.body?.scrollWidth ?? 0
        );

    const documentHeight =
        Math.max(
            document.documentElement.scrollHeight,
            document.body?.scrollHeight ?? 0
        );

    return {
        left: Math.max(
            0,
            window.scrollX - bufferX
        ),

        top: Math.max(
            0,
            window.scrollY - bufferY
        ),

        right: Math.min(
            documentWidth,
            window.scrollX +
                window.innerWidth +
                bufferX
        ),

        bottom: Math.min(
            documentHeight,
            window.scrollY +
                window.innerHeight +
                bufferY
        )
    };
}

// -------------------------
// Check whether a rectangle
// is inside/intersects the cache
// -------------------------

function isInsideCache(rect, region) {
    return intersects(rect, region);
}

// ============================================================
// ADD TEXT NODES TO CACHE
// ============================================================
//
// Adds nodes to the existing cache.
//
// Existing nodes are NEVER removed.
//
// ============================================================

function addTextNodesToCache(region) {

    const textNodes = getTextNodes();

    let addedCount = 0;

    for (const node of textNodes) {

        // Ignore detached nodes.
        if (!node.isConnected) {
            continue;
        }

        // Don't process a node that is already cached.
        if (cachedTextNodes.has(node)) {
            continue;
        }

        // -------------------------
        // Get text node bounds
        // -------------------------

        const range =
            document.createRange();

        range.selectNodeContents(node);

        const viewportRect =
            range.getBoundingClientRect();

        // -------------------------
        // Ignore invisible nodes
        // -------------------------

        if (
            viewportRect.width === 0 &&
            viewportRect.height === 0
        ) {
            continue;
        }

        // -------------------------
        // Convert viewport coordinates
        // to document coordinates.
        // -------------------------

        const documentRect = {
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
        // Only cache nodes inside
        // the requested region.
        // -------------------------

        if (
            !isInsideCache(
                documentRect,
                region
            )
        ) {
            continue;
        }

        visibleTextNodeRects.push({
            node,
            rect: documentRect
        });

        cachedTextNodes.add(node);

        addedCount++;
    }

    return addedCount;
}

// ============================================================
// RESET TEXT NODE CACHE
// ============================================================
//
// Completely discards the accumulated cache.
//
// Called when a selection finishes so the next selection
// starts with a fresh viewport + buffer cache.
// ============================================================

function resetTextNodeCache() {

    visibleTextNodeRects = [];

    cachedTextNodes.clear();

    visibleTextNodeRectsValid = false;

    cacheRegion = null;

    debugLog("Text cache reset");
}

// ============================================================
// REBUILD THE TEXT-NODE CACHE
// ============================================================
//
// This completely replaces the cache.
//
// Used when NOT selecting.
// ============================================================

function rebuildVisibleTextNodeRects() {

    visibleTextNodeRects = [];

    cachedTextNodes.clear();

    cacheRegion = getCacheRegion();

    const addedCount =
        addTextNodesToCache(cacheRegion);

    visibleTextNodeRectsValid = true;

    debugLog(
        `Text cache rebuilt: ${addedCount} nodes`
    );
}

// ============================================================
// EXPAND CACHE
// ============================================================
//
// Used while selecting.
//
// IMPORTANT:
// This does NOT clear the existing cache.
//
// The new cache region is the union of the old cache region
// and the newly required region.
// ============================================================

function expandTextNodeCache() {

    const currentRegion =
        getCacheRegion();

    // If there isn't an existing cache yet,
    // initialize it.
    if (!cacheRegion) {

        cacheRegion = currentRegion;

        const addedCount =
            addTextNodesToCache(cacheRegion);

        visibleTextNodeRectsValid = true;

        debugLog(
            `Text cache initialized: ${addedCount} nodes`
        );

        return;
    }

    // -------------------------
    // Expand the existing region.
    // -------------------------

    const expandedRegion = {

        left: Math.min(
            cacheRegion.left,
            currentRegion.left
        ),

        top: Math.min(
            cacheRegion.top,
            currentRegion.top
        ),

        right: Math.max(
            cacheRegion.right,
            currentRegion.right
        ),

        bottom: Math.max(
            cacheRegion.bottom,
            currentRegion.bottom
        )
    };

    cacheRegion = expandedRegion;

    const addedCount =
        addTextNodesToCache(cacheRegion);

    visibleTextNodeRectsValid = true;

    if (addedCount > 0) {
        debugLog(
            `Text cache expanded: +${addedCount} nodes, total ${visibleTextNodeRects.length}`
        );
    }
}

// ============================================================
// DETERMINE WHETHER WE NEED TO UPDATE CACHE
// ============================================================

function ensureTextNodeCache() {

    // No cache yet.
    if (
        !visibleTextNodeRectsValid ||
        !cacheRegion
    ) {

        if (selecting) {
            expandTextNodeCache();
        } else {
            rebuildVisibleTextNodeRects();
        }

        return;
    }

    const currentRegion =
        getCacheRegion();

    const outsideCache =
        currentRegion.top < cacheRegion.top ||
        currentRegion.bottom > cacheRegion.bottom ||
        currentRegion.left < cacheRegion.left ||
        currentRegion.right > cacheRegion.right;

    if (!outsideCache) {
        return;
    }

    // ========================================================
    // IMPORTANT:
    //
    // During selection we NEVER rebuild.
    //
    // We expand the existing cache instead.
    // ========================================================

    if (selecting) {
        expandTextNodeCache();
    } else {
        rebuildVisibleTextNodeRects();
    }
}

// -------------------------
// Debug: print cached
// text-node rectangles
// -------------------------

function logVisibleTextNodeRects() {

    debugLog(
        `CACHED TEXT NODE RECTANGLES (${visibleTextNodeRects.length})`
    );

    const rows =
        visibleTextNodeRects.map(
            (entry, index) => {

                const rect = entry.rect;

                return {
                    index,

                    text:
                        entry.node.textContent,

                    left: rect.left,
                    top: rect.top,

                    right: rect.right,
                    bottom: rect.bottom,

                    width: rect.width,
                    height: rect.height
                };
            }
        );

    debugTable(rows);
}

// -------------------------
// Invalidate text geometry
//
// Called when DOM changes.
//
// IMPORTANT:
// While selecting, we DO NOT invalidate
// the existing cache.
// -------------------------

function invalidateVisibleTextNodeRects() {

    if (selecting) {
        return;
    }

    visibleTextNodeRectsValid = false;

    cacheRegion = null;

    cachedTextNodes.clear();
}

// -------------------------
// Scroll
//
// We DON'T invalidate the cache
// on every scroll.
//
// While selecting, leaving the buffer
// EXPANDS the cache rather than rebuilding it.
// -------------------------

window.addEventListener(
    "scroll",
    () => {

        if (!selecting) {
            return;
        }

        ensureTextNodeCache();

        updateSelectionBox();
        updateSelectedCharacters();
    },
    {
        passive: true
    }
);

document.addEventListener("wheel", (event) => {
    if (!selecting) {
        return;
    }

    event.preventDefault();

    window.scrollBy({
        left: 0,
        top: event.deltaY,
        behavior: "auto"
    });
}, {
    passive: false
});

// -------------------------
// Resize
//
// Resize can change what belongs
// in the cache.
// -------------------------

window.addEventListener(
    "resize",
    () => {

        if (selecting) {

            // During selection, don't throw away
            // anything we've already cached.
            //
            // Just expand the cache to include
            // the new viewport.

            expandTextNodeCache();

            updateSelectionBox();
            updateSelectedCharacters();

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

        // During selection, keep everything
        // already cached.
        //
        // The next cache expansion will discover
        // newly-created nodes.

        if (selecting) {
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
// SELECTION UI
// ============================================================

const selectionBox =
    document.createElement("div");

selectionBox.style.position = "fixed";
selectionBox.style.pointerEvents = "none";
selectionBox.style.zIndex = "2147483647";

selectionBox.style.border =
    "2px solid #4285f4";

selectionBox.style.background =
    "rgba(66, 133, 244, 0.15)";

selectionBox.style.display =
    "none";

document.documentElement.appendChild(
    selectionBox
);

// -------------------------
// Update selection box
//
// start/end are DOCUMENT coordinates.
// CSS position is VIEWPORT coordinates.
// -------------------------

function updateSelectionBox() {

    const left =
        Math.min(startX, endX) -
        window.scrollX;

    const top =
        Math.min(startY, endY) -
        window.scrollY;

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

// ============================================================
// MOUSE
// ============================================================

document.addEventListener(
    "mousemove",
    (event) => {

        if (!enabled) {
            return;
        }

        // Mouse coordinates are viewport-relative.
        mouseX = event.clientX;
        mouseY = event.clientY;

        if (!selecting) {
            return;
        }

        event.preventDefault();

        // Convert mouse coordinates to
        // document coordinates.
        endX =
            event.clientX +
            window.scrollX;

        endY =
            event.clientY +
            window.scrollY;

        updateSelectionBox();

        updateSelectedCharacters();
    }
);

// ============================================================
// CLEAR SELECTION ON CLICK
// ============================================================

document.addEventListener(
"mousedown",
(event) => {

    if (!enabled) {
        return;
    }

    // Left mouse button
    if (event.button === 0) {

        leftMousePressed = true;

        // If R is already being held,
        // start rectangle selection.
        if (rPressed && !selecting) {
            event.preventDefault();
            startSelection();
            return;
        }
    }

    // If we're not starting a selection,
    // clicking normally clears the previous one.
    if (!selecting && hasSelection) {
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

        leftMousePressed = false;

        // Releasing left click ends selection.
        if (selecting) {
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

        if (!enabled) {
            return;
        }

        if (
            event.key.toLowerCase() === "r"
        ) {

            rPressed = true;

            // If left click is already held,
            // start rectangle selection.
            if (
                leftMousePressed &&
                !selecting
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

        if (!enabled) {
            return;
        }

        if (
            event.key.toLowerCase() === "r"
        ) {

            rPressed = false;

            // Releasing R ends selection.
            if (selecting) {
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

        if (!enabled) {
            return;
        }

        if (!hasSelection) {
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
                selectedText
            );

            debugLog("Copied:");
            debugLog(selectedText);

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

    if (selecting) {
        return;
    }

    selecting = true;

    // Make sure we are working with
    // the current DOM.
    ensureTextNodeCache();

    // Clear normal browser text selection.
    window.getSelection()
        .removeAllRanges();

    // Convert current mouse position
    // from viewport → document coords.
    startX =
        mouseX +
        window.scrollX;

    startY =
        mouseY +
        window.scrollY;

    endX = startX;
    endY = startY;

    // Show selection box.
    selectionBox.style.display =
        "block";

    updateSelectionBox();

    debugLog(
        "Selection started:",
        startX,
        startY
    );
}


// ============================================================
// FINISH SELECTION
// ============================================================

function finishSelection() {

    if (!selecting) {
        return;
    }

    selecting = false;

    // Hide selection box.
    selectionBox.style.display =
        "none";

    // Make sure the latest selection
    // is calculated while the
    // append-only cache still exists.
    updateSelectedCharacters();

    debugLog(
        "Selection finished:",
        {
            startX,
            startY,
            endX,
            endY
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
    // Make sure the cache is
    // current and covers the
    // current viewport.
    // -------------------------

    ensureTextNodeCache();

    // -------------------------
    // Selection rectangle
    //
    // Everything here is now
    // DOCUMENT coordinates.
    // -------------------------

    const selectionRect = {

        left:
            Math.min(
                startX,
                endX
            ),

        right:
            Math.max(
                startX,
                endX
            ),

        top:
            Math.min(
                startY,
                endY
            ),

        bottom:
            Math.max(
                startY,
                endY
            )
    };

    const highlight =
        new Highlight();

    const selectedCharacters = [];

    let nodeCount = 0;
    let characterCount = 0;
    let selectedCount = 0;

    // -------------------------
    // Process ONLY cached nodes.
    //
    // Since the cache is append-only
    // during selection, this includes
    // text from earlier scroll positions.
    // -------------------------

    for (
        const entry
        of visibleTextNodeRects
    ) {

        nodeCount++;

        const node =
            entry.node;

        // DOM may have changed since
        // the cache was generated.
        if (!node.isConnected) {
            continue;
        }

        // -------------------------
        // Process characters
        // -------------------------

        for (
            let i = 0;
            i < node.length;
            i++
        ) {

            characterCount++;

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

            // getBoundingClientRect()
            // returns VIEWPORT coordinates.
            const viewportRect =
                range.getBoundingClientRect();

            // Convert to DOCUMENT coordinates.
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

            const isSelected =
                intersects(
                    rect,
                    selectionRect
                );

            if (isSelected) {

                highlight.add(range);

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

    CSS.highlights.set(
        "rectangle-selection",
        highlight
    );

    // -------------------------
    // Reconstruct text
    // -------------------------

    selectedText =
        reconstructText(
            selectedCharacters
        );

    hasSelection =
        selectedText.length > 0;

    // Store current selected rectangles.
    lastSelectedCharacters =
        selectedCharacters;
}

// ============================================================
// SELECTED CHARACTER DATA
// ============================================================

let lastSelectedCharacters = [];

// -------------------------
// Debug: selected rectangles
// -------------------------

function logSelectedCharacterRects() {

    debugLog(
        `SELECTED CHARACTER RECTANGLES (${lastSelectedCharacters.length})`
    );

    const rows =
        lastSelectedCharacters.map(
            (entry, index) => {

                const rect =
                    entry.rect;

                return {
                    index,

                    character:
                        entry.character,

                    left: rect.left,
                    top: rect.top,

                    right: rect.right,
                    bottom: rect.bottom,

                    width: rect.width,
                    height: rect.height
                };
            }
        );

    debugTable(rows);
}

// ============================================================
// RECONSTRUCT SELECTED TEXT
// ============================================================

function reconstructText(
    characters
) {

    if (characters.length === 0) {
        return "";
    }

    // -------------------------
    // Sort visually:
    // top → bottom
    // left → right
    // -------------------------

    characters.sort(
        (a, b) => {

            const verticalDifference =
                a.rect.top -
                b.rect.top;

            if (
                Math.abs(
                    verticalDifference
                ) > 2
            ) {

                return verticalDifference;
            }

            return (
                a.rect.left -
                b.rect.left
            );
        }
    );

    let result = "";

    let currentRowTop =
        characters[0].rect.top;

    let previousCharacter =
        characters[0];

    result +=
        previousCharacter.character;

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

        // -------------------------
        // New visual row
        // -------------------------

        if (rowDifference > 2) {

            result += "\n";

            currentRowTop =
                character.rect.top;

        } else {

            // -------------------------
            // Same row:
            // detect visual gap
            // -------------------------

            const horizontalGap =
                character.rect.left -
                previousCharacter.rect.right;

            if (
                horizontalGap > 5
            ) {
                result += " ";
            }
        }

        result +=
            character.character;

        previousCharacter =
            character;
    }

    return result;
}

// ============================================================
// CLEAR SELECTION
// ============================================================

function clearSelection() {

    CSS.highlights.delete(
        "rectangle-selection"
    );

    selectedText = "";

    hasSelection = false;

    lastSelectedCharacters = [];

    debugLog(
        "Selection cleared"
    );
}

// ============================================================
// RECTANGLE INTERSECTION
// ============================================================

function intersects(a, b) {

    return (
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top
    );
}