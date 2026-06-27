const fs = require('fs');
const filepath = 'c:\\\\Users\\\\Hicks\\\\Downloads\\\\WF-MR-01 _ M+R Audit GPT Synthesis.json';
const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));

// Group 3 Code nodes cleanup
const codeNodeNames = ['Code: Build Call 1 Prompt', 'Code: Build Call 2 Prompt', 'Code: Build Call 3 Prompt'];
for(const node of data.nodes) {
  if (codeNodeNames.includes(node.name) && node.type === 'n8n-nodes-base.code') {
    let jsCode = node.parameters.jsCode;
    
    // Remove the const systemPrompt block
    jsCode = jsCode.replace(/const systemPrompt = `[\s\S]*?`;\n\n/, '');
    
    // Replace the return object to remove callX_system_prompt
    if (node.name.includes('Call 1')) {
      jsCode = jsCode.replace(
        'return [{ json: { ...d, gpt_run_id, call1_system_prompt: systemPrompt, call1_user_prompt: userPrompt } }];',
        'return [{ json: { ...d, gpt_run_id, call1_user_prompt: userPrompt } }];'
      );
    } else if (node.name.includes('Call 2')) {
      jsCode = jsCode.replace(
        'return [{ json: { assessment_id, gpt_run_id, call2_system_prompt: systemPrompt, call2_user_prompt: userPrompt } }];',
        'return [{ json: { assessment_id, gpt_run_id, call2_user_prompt: userPrompt } }];'
      );
    } else if (node.name.includes('Call 3')) {
      jsCode = jsCode.replace(
        'return [{ json: { assessment_id, gpt_run_id, capability_count: allCaps.length, call3_system_prompt: systemPrompt, call3_user_prompt: userPrompt } }];',
        'return [{ json: { assessment_id, gpt_run_id, capability_count: allCaps.length, call3_user_prompt: userPrompt } }];'
      );
    }
    
    node.parameters.jsCode = jsCode;
  }
}

// Group 4 OpenAI nodes configuration
const openAiNames = ['OpenAI: Call 1 – Characterisation', 'OpenAI: Call 2 – Synthesis', 'OpenAI: Call 3 – Capability Rationale'];
for(const node of data.nodes) {
  if (openAiNames.includes(node.name)) {
    // Determine the user prompt referencer
    let up = '';
    let pPrompt = '';
    if (node.name === 'OpenAI: Call 1 – Characterisation') {
      up = "={{ $('Code: Build Call 1 Prompt').first().json.call1_user_prompt }}";
      pPrompt = "[PLACEHOLDER — Call 1 system prompt. To be populated in prompt engineering session. Do not run this workflow until this field contains the full system prompt.]";
    } else if (node.name === 'OpenAI: Call 2 – Synthesis') {
      up = "={{ $('Code: Build Call 2 Prompt').first().json.call2_user_prompt }}";
      pPrompt = "[PLACEHOLDER — Call 2 system prompt. To be populated in prompt engineering session. Do not run this workflow until this field contains the full system prompt.]";
    } else if (node.name === 'OpenAI: Call 3 – Capability Rationale') {
      up = "={{ $('Code: Build Call 3 Prompt').first().json.call3_user_prompt }}";
      pPrompt = "[PLACEHOLDER — Call 3 system prompt. To be populated in prompt engineering session. Do not run this workflow until this field contains the full system prompt.]";
    }

    if(!node.parameters.messages) {
      node.parameters.messages = { messageValues: [] };
    } else if (!node.parameters.messages.messageValues) {
      node.parameters.messages.messageValues = [];
    }
    
    // Rebuild messages
    node.parameters.messages.messageValues = [
      {
        "role": "system",
        "content": pPrompt
      },
      {
        "role": "user",
        "content": up
      }
    ];
  }
}

fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
console.log('Successfully updated JSON.');
