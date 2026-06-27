const fs = require('fs');
const filepath = 'c:\\\\Users\\\\Hicks\\\\Downloads\\\\WF-MR-01 _ M+R Audit GPT Synthesis.json';
const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

const writeNodeNames = ['Supabase: Write Call 1 Outputs', 'Supabase: Write Call 2 Outputs', 'Supabase: Write Call 3 Outputs'];

for(const node of data.nodes) {
  if (writeNodeNames.includes(node.name)) {
    // We were instructed to use credential "supabaseApi"
    // And set tableId, matchColumns, operation
    
    node.credentials = {
      "supabaseApi": {
        "id": "hM5b9Oz8nwW6QZJF", // we know this is the ID from our earlier check, but by name is safer. Actually n8n node export usually stores id/name
        "name": "Supabase account"
      }
    };
    
    // Sometimes it just needs the type and name
    
    node.parameters = {
      ...node.parameters,
      operation: 'upsert',
      tableId: 'gm_assessment_gpt_outputs',
      matchColumns: 'assessment_id,slot_id,entity_type,entity_id'
    };
  }
}

fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
console.log('Successfully updated Group 5 nodes.');
