const DEBUG = false;

export function debugLog(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

export function debugTable(rows) {
    if (DEBUG) {
        console.table(rows);
    }
}

export function logSelectedCharacterRects(
    lastSelectedCharacters
) {
    debugLog(
        `SELECTED CHARACTER RECTANGLES (${lastSelectedCharacters.length})`
    );

    const rows =
        lastSelectedCharacters.map(
            (entry, index) => {
                const rect = entry.rect;

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