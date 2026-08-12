import { state } from "./state.js";
import { intersects } from "./geometry.js";
import { debugLog } from "./debug.js";

const CACHE_BUFFER_MULTIPLIER = 0.5;

// cache of all text nodes and their rectangles that are visible in the viewport or were visible in the viewport while selecting. 
// necessary because the user can scroll while selecting, and we don't want to lose the cache in that case.
let cachedTextNodeRects = [];
let cachedTextNodeRectsValid = false;
const cachedTextNodesSet = new Set();
let cacheRegion = null;


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
// Represents the currently visible region of the document, plus a buffer. Text nodes in this region are cached for selection purposes. The buffer allows the user to scroll while selecting without losing the cache.
// ============================================================
function getCacheRegion() {
    const bufferY = window.innerHeight * CACHE_BUFFER_MULTIPLIER;
    const bufferX = window.innerWidth * CACHE_BUFFER_MULTIPLIER;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth ?? 0);
    const documentHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);

    return {
        left: Math.max(0, window.scrollX - bufferX),
        top: Math.max(0, window.scrollY - bufferY),
        right: Math.min(documentWidth, window.scrollX + window.innerWidth + bufferX),
        bottom: Math.min(documentHeight, window.scrollY + window.innerHeight + bufferY)
    };
}

function addTextNodeRectsToCache(region) {
    const textNodes = getTextNodes();

    let addedCount = 0;

    for (const node of textNodes) {

        // Ignore detached nodes.
        if (!node.isConnected) {
            continue;
        }

        // Don't process a node already in the cache.
        if (cachedTextNodesSet.has(node)) {
            continue;
        }

        const range = document.createRange();
        range.selectNodeContents(node);
        const viewportRect = range.getBoundingClientRect();

        // Ignore invisible nodes.
        if (viewportRect.width === 0 && viewportRect.height === 0) {
            continue;
        }

        // Convert viewport coordinates to document coordinates.
        const documentRect = {
            left: viewportRect.left + window.scrollX,
            top: viewportRect.top + window.scrollY,
            right: viewportRect.right + window.scrollX,
            bottom: viewportRect.bottom + window.scrollY,
            width: viewportRect.width,            
            height: viewportRect.height,
        };

        // Only cache nodes that intersect the requested region.
        if (!intersects(documentRect, region)) {
            continue;
        }

        cachedTextNodeRects.push({
            node,
            rect: documentRect
        });

        cachedTextNodesSet.add(node);

        addedCount++;
    }

    return addedCount;
}

function rebuildVisibleTextNodeRectsCache() {
    cachedTextNodeRects = [];
    cachedTextNodesSet.clear();

    cacheRegion = getCacheRegion();
    const addedCount = addTextNodeRectsToCache(cacheRegion);
    cachedTextNodeRectsValid = true;

    debugLog(`Text cache rebuilt: ${addedCount} nodes`);
}

function expandTextNodeRectsCache() {
    const currentRegion = getCacheRegion();

    // No existing cache, build it only for the current region.
    if (!cacheRegion) {
        cacheRegion = currentRegion;
        const addedCount = addTextNodeRectsToCache(cacheRegion);
        cachedTextNodeRectsValid = true;

        debugLog(`Text cache initialized: ${addedCount} nodes`);

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

    cacheRegion = expandedRegion;
    const addedCount = addTextNodeRectsToCache(cacheRegion);
    cachedTextNodeRectsValid = true;

    if (addedCount > 0) {
        debugLog(`Text cache expanded: +${addedCount} nodes, total ${cachedTextNodeRects.length}`);
    }
}

export function ensureTextNodeRectsCache() {
    // No cache yet.
    if (
        !cachedTextNodeRectsValid ||
        !cacheRegion
    ) {
        if (state.selecting) {
            expandTextNodeRectsCache();
        } else {
            rebuildVisibleTextNodeRectsCache();
        }

        return;
    }

    const currentRegion = getCacheRegion();

    const outsideCache =
        currentRegion.top < cacheRegion.top ||
        currentRegion.bottom > cacheRegion.bottom ||
        currentRegion.left < cacheRegion.left ||
        currentRegion.right > cacheRegion.right;

    // Current region is already inside cache
    if (!outsideCache) {
        return;
    }

    // During selection, expand rather than rebuild.
    if (state.selecting) {
        expandTextNodeRectsCache();
    } else {
        rebuildVisibleTextNodeRectsCache();
    }
}

export function getTextNodeRectsCache() {
    return cachedTextNodeRects;
}

export function resetTextNodeRectsCache() {
    cachedTextNodeRects = [];
    cachedTextNodesSet.clear();
    cachedTextNodeRectsValid = false;
    cacheRegion = null;

    debugLog("Text cache reset");
}

export function logVisibleTextNodeRectsCache() {
    debugLog(
        `CACHED TEXT NODE RECTANGLES (${cachedTextNodeRects.length})`
    );

    const rows =
        cachedTextNodeRects.map(
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