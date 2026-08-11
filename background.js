browser.commands.onCommand.addListener(async (command) => {
    if (command !== "toggle-rectangle-selection") {
        return;
    }

    const result = await browser.storage.local.get("enabled");
    const enabled = !(result.enabled ?? false);

    await browser.storage.local.set({ enabled });
});