import json
import os
import re

BOARD_FILE = "data/board_data.json"
OUTPUT_FILE = "data/tile_requirements.json"
TEMP_FILE = OUTPUT_FILE + ".tmp"


def make_key(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def detect_quantity(name):
    match = re.match(r"^(\d+)", name)
    return int(match.group(1)) if match else 1


def load_board():
    with open(BOARD_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    tiles = []

    # New format: {"boardData": [[...]]}
    for row in data["boardData"]:
        tiles.extend(row)

    return tiles

def input_ai_item_list(quantity_required):
    print("\n=== AI ITEM IMPORT ===")
    print("Paste AI output:")
    print("Format: Item name,quantity")
    print("Press Enter twice when finished.")
    print("======================\n")

    items = []
    blank_lines = 0

    while True:
        line = input()

        if not line.strip():
            blank_lines += 1

            if blank_lines >= 2:
                break

            continue

        blank_lines = 0

        parts = line.rsplit(",", 1)

        if len(parts) != 2:
            print(f"Invalid line skipped: {line}")
            continue

        name, quantity = parts

        items.append({
            "itemName": name.strip(),
            "itemId": None,
            "quantity": int(quantity.strip())
        })

    print(f"Imported {len(items)} items")

    return {
        "count": {
            "quantity": quantity_required,
            "from": items
        }
    }


def save_requirements(requirements):
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    with open(TEMP_FILE, "w", encoding="utf-8") as f:
        json.dump(requirements, f, indent=4)

    os.replace(TEMP_FILE, OUTPUT_FILE)


def load_existing():
    if not os.path.exists(OUTPUT_FILE):
        return {}

    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def input_item(default_quantity=1, indent=0, default_name=None):
    prefix = "  " * indent

    prompt = f"{prefix}Item name"

    if default_name:
        prompt += f" [{default_name}]"

    prompt += ": "

    item_name = input(prompt).strip()

    if not item_name and default_name:
        item_name = default_name

    return {
        "itemName": item_name,
        "itemId": None,
        "quantity": default_quantity
    }


def input_requirement(default_quantity=1, indent=0, tile_name=None):
    prefix = "  " * indent

    print(f"\n{prefix}Requirement type:")
    print(f"{prefix}1) item")
    print(f"{prefix}2) all_of")
    print(f"{prefix}3) any_of")
    print(f"{prefix}4) count")
    print(f"{prefix}5) paste AI item list")
    print(f"{prefix}q) quit")

    choice = input(f"{prefix}Choice: ").strip()

    if choice.lower() == "q":
        raise KeyboardInterrupt

    # allow direct item names
    if choice not in ["1", "2", "3", "4", "5"]:
        return {
            "itemName": choice,
            "itemId": None,
            "quantity": default_quantity
        }

    if choice == "1":
        return input_item(
            default_quantity,
            indent,
            tile_name
        )

    if choice in ["2", "3"]:
        amount = int(input(f"{prefix}How many entries? "))

        children = []

        for i in range(amount):
            print(f"\n{prefix}Entry {i + 1}")
            children.append(
                input_requirement(1, indent + 1)
            )

        return {
            "all_of" if choice == "2" else "any_of": children
        }

    if choice == "5":
        print("ENTERING AI IMPORT MODE")
        result = input_ai_item_list(default_quantity)
        print("AI IMPORT COMPLETE")
        return result

    if choice == "4":
        value = input(
            f"{prefix}How many required [{default_quantity}]: "
        ).strip()

        quantity = (
            default_quantity
            if value == ""
            else int(value)
        )

        print(
            f"{prefix}Paste AI item list now, "
            "or enter number of options manually:"
        )

        first_line = input(f"{prefix}> ").strip()

        # AI paste mode
        if "," in first_line:
            lines = [first_line]

            print(f"{prefix}Continue pasting. Empty line finishes.")

            while True:
                line = input()

                if not line.strip():
                    break

                lines.append(line.strip())

            children = []

            for line in lines:
                name, qty = line.rsplit(",", 1)

                children.append({
                    "itemName": name.strip(),
                    "itemId": None,
                    "quantity": int(qty.strip())
                })

    # Manual count mode
    else:
        amount = int(first_line)

        children = []

        for i in range(amount):
            print(f"\n{prefix}Option {i + 1}")
            children.append(
                input_requirement(1, indent + 1)
            )

    return {
        "count": {
            "quantity": quantity,
            "from": children
        }
    }

    


def main():
    tiles = load_board()
    requirements = load_existing()

    try:
        for tile in tiles:
            title = tile["title"]
            key = make_key(title)

            if key in requirements and requirements[key].get("requirements"):
                print(f"Skipping {title}")
                continue

            print("\n" + "=" * 50)
            print(f"Tile: {title}")

            if tile.get("description"):
                print(f"Description: {tile['description']}")

            quantity = detect_quantity(title)

            if quantity > 1:
                print(f"Detected quantity: {quantity}")

            # Preserve board metadata
            requirements[key] = {
                "title": title,
                "description": tile.get("description", ""),
                "points": int(tile.get("points", 0)),
                "image": tile["image"]["url"],
                "requirements": input_requirement(
                    quantity,
                    tile_name=title
                )
            }

            save_requirements(requirements)
            print(f"Saved {title}")

    except KeyboardInterrupt:
        print("\nStopping safely...")
        save_requirements(requirements)
        print("Progress saved.")

    print("\nDone.")


if __name__ == "__main__":
    main()