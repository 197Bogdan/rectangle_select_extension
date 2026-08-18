const browserAPI = globalThis.browser || globalThis.chrome;

const action =
    browserAPI.action ||
    browserAPI.browserAction;

const storage =
    browserAPI.storage.local;

function updateBadge(enabled) {
    if (typeof action.setBadgeText === "function") {
        action.setBadgeText({
            text: enabled ? "●" : ""
        });
    }

    if (typeof action.setBadgeBackgroundColor === "function") {
        action.setBadgeBackgroundColor({
            color: "#1ee750"
        });
    }
}

// Initialize badge.
storage.get("enabled", (result) => {
    updateBadge(Boolean(result.enabled));
});

// React to settings changes.
browserAPI.storage.onChanged.addListener(
    (changes, areaName) => {
        if (areaName !== "local") {
            return;
        }

        if (changes.enabled) {
            updateBadge(
                Boolean(changes.enabled.newValue)
            );
        }
    }
);