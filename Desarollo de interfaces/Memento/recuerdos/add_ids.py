import json, uuid

path = "recuerdos.json"

with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)

changed = 0
for m in data:
    if not m.get("_id"):
        m["_id"] = str(uuid.uuid4())
        changed += 1

with open(path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("IDs añadidos:", changed)

