import json
from pathlib import Path
from urllib.parse import quote

DATA_FILE = Path("data") / "drops_formatted.json"

# Load data
with open(DATA_FILE, "r", encoding="utf-8") as f:
    monsters = json.load(f)

for monster in monsters:
    name = monster.get("name", "Unknown")

    # URL-encode the page title and jump to the Money making section
    wiki_url = (
        f"https://oldschool.runescape.wiki/w/{quote(name.replace(' ', '_'))}"
        "#Money_making"
    )

    while True:
        try:
            value = input(f"Kills per hour ({wiki_url}): ").strip()

            # Blank = skip this entry
            if value == "":
                break

            kph = float(value)
            if kph.is_integer():
                kph = int(kph)

            monster["KPH"] = kph
            break

        except ValueError:
            print("Please enter a valid number or press Enter to skip.")

# Save updated data
with open(DATA_FILE, "w", encoding="utf-8") as f:
    json.dump(monsters, f, indent=2, ensure_ascii=False)

print("Done! Updated KPH values saved.")