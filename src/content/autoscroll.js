import { state } from "./state.js";

let autoScrollFrame = null;

const AUTO_SCROLL_ZONE = 80;
const AUTO_SCROLL_MAX_SPEED = 120;

function tryAutoScroll() {
    if (!state.selecting) {
        disableAutoScroll();
        return;
    }

    let scrollY = 0;

    // Near top
    if (state.mouseY < AUTO_SCROLL_ZONE) {
        const distance =
            AUTO_SCROLL_ZONE - state.mouseY;

        scrollY =
            -Math.min(
                AUTO_SCROLL_MAX_SPEED,
                distance /
                    AUTO_SCROLL_ZONE *
                    AUTO_SCROLL_MAX_SPEED
            );
    }

    // Near bottom
    else if (
        state.mouseY >
        window.innerHeight - AUTO_SCROLL_ZONE
    ) {
        const distance =
            state.mouseY -
            (window.innerHeight - AUTO_SCROLL_ZONE);

        scrollY =
            Math.min(
                AUTO_SCROLL_MAX_SPEED,
                distance /
                    AUTO_SCROLL_ZONE *
                    AUTO_SCROLL_MAX_SPEED
            );
    }

    if (scrollY !== 0) {
        window.scrollBy(0, scrollY);
    }

    autoScrollFrame =
        requestAnimationFrame(tryAutoScroll);
}

export function enableAutoScroll() {
    if (autoScrollFrame !== null) {
        return;
    }

    autoScrollFrame =
        requestAnimationFrame(tryAutoScroll);
}

export function disableAutoScroll() {
    if (autoScrollFrame === null) {
        return;
    }

    cancelAnimationFrame(autoScrollFrame);

    autoScrollFrame = null;
}