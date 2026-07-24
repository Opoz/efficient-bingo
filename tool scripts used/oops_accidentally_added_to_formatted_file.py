import json
from pathlib import Path

DROPS_FILE = Path("data") / "drops_formatted.json"
KPH_FILE = Path("data") / "kph.json"

with open(DROPS_FILE, "r", encoding="utf-8") as f:
    monsters = json.load(f)

kph_map = {}

for monster in monsters:
    kph = monster.get("KPH")

    # Only save manually entered values
    if kph is not None and kph != 1:
        kph_map[monster["id"]] = kph

with open(KPH_FILE, "w", encoding="utf-8") as f:
    json.dump(kph_map, f, indent=2, ensure_ascii=False)

print(f"Extracted {len(kph_map)} KPH values to {KPH_FILE}")