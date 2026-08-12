import { state } from "./state.js";
import { intersects } from "./geometry.js";
import { debugLog } from "./debug.js";

const CACHE_BUFFER_MULTIPLIER = 0.5;

let visibleTextNodeRects = [];
let visibleTextNodeRectsValid = false;

const cachedTextNodes = new Set();

let cacheRegion = null;

// ============================================================
// GET ALL TEXT NODES
// ============================================================

function getTextNodes() {
    const textNodes = [];

    const walker =
        document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT
        );

    let node;

    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    return textNodes;
}

// ============================================================
// CACHE REGION
// ============================================================

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

// ============================================================
// ADD TEXT NODES TO CACHE
// ============================================================

function addTextNodesToCache(region) {
    const textNodes =
        getTextNodes();

    let addedCount = 0;

    for (const node of textNodes) {

        // Ignore detached nodes.
        if (!node.isConnected) {
            continue;
        }

        // Don't process a node already in the cache.
        if (cachedTextNodes.has(node)) {
            continue;
        }

        const range =
            document.createRange();

        range.selectNodeContents(node);

        const viewportRect =
            range.getBoundingClientRect();

        // Ignore invisible nodes.
        if (
            viewportRect.width === 0 &&
            viewportRect.height === 0
        ) {
            continue;
        }

        // Convert viewport coordinates
        // to document coordinates.
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

        // Only cache nodes that intersect
        // the requested region.
        if (
            !intersects(
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
// RESET CACHE
// ============================================================

export function resetTextNodeCache() {
    visibleTextNodeRects = [];

    cachedTextNodes.clear();

    visibleTextNodeRectsValid = false;

    cacheRegion = null;

    debugLog("Text cache reset");
}

// ============================================================
// REBUILD CACHE
// ============================================================

function rebuildVisibleTextNodeRects() {
    visibleTextNodeRects = [];

    cachedTextNodes.clear();

    cacheRegion =
        getCacheRegion();

    const addedCount =
        addTextNodesToCache(
            cacheRegion
        );

    visibleTextNodeRectsValid = true;

    debugLog(
        `Text cache rebuilt: ${addedCount} nodes`
    );
}

// ============================================================
// EXPAND CACHE
// ============================================================

function expandTextNodeCache() {
    const currentRegion =
        getCacheRegion();

    // No existing cache.
    if (!cacheRegion) {
        cacheRegion =
            currentRegion;

        const addedCount =
            addTextNodesToCache(
                cacheRegion
            );

        visibleTextNodeRectsValid = true;

        debugLog(
            `Text cache initialized: ${addedCount} nodes`
        );

        return;
    }

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

    cacheRegion =
        expandedRegion;

    const addedCount =
        addTextNodesToCache(
            cacheRegion
        );

    visibleTextNodeRectsValid = true;

    if (addedCount > 0) {
        debugLog(
            `Text cache expanded: +${addedCount} nodes, total ${visibleTextNodeRects.length}`
        );
    }
}

// ============================================================
// ENSURE CACHE
// ============================================================

export function ensureTextNodeCache() {

    // No cache yet.
    if (
        !visibleTextNodeRectsValid ||
        !cacheRegion
    ) {
        if (state.selecting) {
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

    // During selection, expand rather than rebuild.
    if (state.selecting) {
        expandTextNodeCache();
    } else {
        rebuildVisibleTextNodeRects();
    }
}

// ============================================================
// INVALIDATE CACHE
// ============================================================

export function invalidateVisibleTextNodeRects() {
    // Don't invalidate while selecting.
    if (state.selecting) {
        return;
    }

    visibleTextNodeRectsValid = false;

    cacheRegion = null;

    cachedTextNodes.clear();
}

// ============================================================
// GET CACHE
// ============================================================

export function getVisibleTextNodeRects() {
    return visibleTextNodeRects;
}

// ============================================================
// DEBUG
// ============================================================

export function logVisibleTextNodeRects() {
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

    console.table(rows);
}