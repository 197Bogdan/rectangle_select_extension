// Reconstructs from either full words or individual characters, using their bounding rectangles to determine visual order and spacing.
// items — an array of objects with the following properties: { text, rect }
export function reconstructText(items) {
    if (items.length === 0) {
        return "";
    }

    // Sort visually:
    // top → bottom
    // left → right
    items.sort((a, b) => {
        const verticalDifference =
            a.rect.top - b.rect.top;

        if (Math.abs(verticalDifference) > 2) {
            return verticalDifference;
        }

        return a.rect.left - b.rect.left;
    });

    let result = "";

    let currentRowTop = items[0].rect.top;

    let previousItem = items[0];

    result += previousItem.text;

    for (let i = 1; i < items.length; i++) {
        const item = items[i];

        const rowDifference = Math.abs(item.rect.top - currentRowTop);

        // New visual row
        if (rowDifference > 2) {
            result += "\n";
            currentRowTop = item.rect.top;
        }

        // Same row
        else {
            const horizontalGap = item.rect.left - previousItem.rect.right;

            if (horizontalGap > 5) {
                result += " ";
            }
        }

        result += item.text;

        previousItem = item;
    }

    return result;
}