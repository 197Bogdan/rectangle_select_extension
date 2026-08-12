export function reconstructText(characters) {
    if (characters.length === 0) {
        return "";
    }

    // Sort visually:
    // top → bottom
    // left → right
    characters.sort((a, b) => {
        const verticalDifference =
            a.rect.top - b.rect.top;

        if (Math.abs(verticalDifference) > 2) {
            return verticalDifference;
        }

        return a.rect.left - b.rect.left;
    });

    let result = "";

    let currentRowTop =
        characters[0].rect.top;

    let previousCharacter =
        characters[0];

    result += previousCharacter.character;

    for (let i = 1; i < characters.length; i++) {
        const character =
            characters[i];

        const rowDifference =
            Math.abs(
                character.rect.top -
                currentRowTop
            );

        // New visual row
        if (rowDifference > 2) {
            result += "\n";

            currentRowTop =
                character.rect.top;
        }

        // Same row
        else {
            const horizontalGap =
                character.rect.left -
                previousCharacter.rect.right;

            if (horizontalGap > 5) {
                result += " ";
            }
        }

        result += character.character;

        previousCharacter =
            character;
    }

    return result;
}