import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data: rank, error: rankError } = await supabase
        .from('gm_capability_rankings')
        .select('*')
        .limit(1);

    console.log("Ranking Error: ", rankError);
    console.log("Ranking Data: ", JSON.stringify(rank, null, 2));

    const { data: cap, error: capError } = await supabase
        .from('gm_capabilities')
        .select(`
      capability_id,
      capability_name,
      capability_summary,
      gm_dimension_id,
      gm_dimensions ( dimension_name )
    `)
        .limit(1);

    console.log("Cap Error: ", capError);
    console.log("Cap Data: ", JSON.stringify(cap, null, 2));
}

checkSchema();
