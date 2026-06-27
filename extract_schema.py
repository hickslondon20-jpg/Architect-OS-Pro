import json

with open(r'C:\Users\Hicks\.gemini\antigravity\brain\9eee76e4-e1cc-47b9-9d8a-1b6102efaeac\.system_generated\steps\12\output.txt', 'r') as f:
    data = json.load(f)

tables = [
    'agency_snapshot_market_footprint',
    'agency_snapshot_economic_foundation',
    'agency_snapshot_revenue_model',
    'agency_snapshot_delivery_architecture',
    'agency_snapshot_dashboard',
    'vi_agency_snapshots'
]

for t in data['tables']:
    name = t['name'].replace('public.', '')
    if name in tables:
        print(f"\n--- {name} ---")
        for c in t['columns']:
            print(f"{c['name']} ({c['data_type']})")
