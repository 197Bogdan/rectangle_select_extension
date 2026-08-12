import { state } from "./state.js";

export const selectionBox = document.createElement("div");

selectionBox.style.position = "fixed";
selectionBox.style.pointerEvents = "none";
selectionBox.style.zIndex = "2147483647";

selectionBox.style.border = "2px solid #4285f4";
selectionBox.style.background = "rgba(66, 133, 244, 0.15)";
selectionBox.style.display = "none";

document.documentElement.appendChild(selectionBox);

export function updateSelectionBox() {
    const left =
        Math.min(state.startX, state.endX) -
        window.scrollX;

    const top =
        Math.min(state.startY, state.endY) -
        window.scrollY;

    const width =
        Math.abs(state.endX - state.startX);

    const height =
        Math.abs(state.endY - state.startY);

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
