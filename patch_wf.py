import json

input_file = r"C:\Users\Hicks\.gemini\antigravity\brain\ab2cc1a2-06f3-4111-bc6c-7b3f0b9d4a10\.system_generated\steps\1323\output.txt"
output_file = r"C:\Users\Hicks\.gemini\antigravity\brain\ab2cc1a2-06f3-4111-bc6c-7b3f0b9d4a10\updated_workflow.json"

with open(input_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Extract workflow object
wf = data.get("workflow", data)
if "activeVersion" in wf:
    wf_data = wf["activeVersion"]
else:
    wf_data = wf

# Update connections
conns = wf_data.get("connections", {})
if "Supabase Final Write" in conns:
    # re-route
    conns["Supabase Final Write"]["main"] = [[{"node": "Sync cc_versions Status", "type": "main", "index": 0}]]
    conns["Sync cc_versions Status"] = {
        "main": [[{"node": "Success Response", "type": "main", "index": 0}]]
    }

# Add nodes
nodes = wf_data.get("nodes", [])

# Find Success Response and move it
for n in nodes:
    if n["name"] == "Success Response":
        pos = n.get("position", [6800, -48])
        n["position"] = [pos[0] + 240, pos[1]]

sync_node = {
    "parameters": {
        "operation": "update",
        "tableId": "cc_versions",
        "filters": {
            "conditions": [
                {
                    "keyName": "id",
                    "condition": "eq",
                    "keyValue": "={{ $('Validate Input').first().json.version_id }}"
                }
            ]
        },
        "fieldsUi": {
            "fieldValues": [
                {
                    "fieldId": "synthesis_status",
                    "fieldValue": "complete"
                }
            ]
        }
    },
    "id": "e7c2e9d2-1c6f-4d3b-8255-abcdef123456",
    "name": "Sync cc_versions Status",
    "type": "n8n-nodes-base.supabase",
    "typeVersion": 1,
    "position": [
        6800,
        -48
    ]
}

nodes.append(sync_node)

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(wf, f, indent=2)

print(f"Patched workflow saved to {output_file}")
