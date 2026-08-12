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