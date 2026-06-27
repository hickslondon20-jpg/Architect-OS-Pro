require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function verify() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('agency_snapshot_revenue_model')
    .select('*')
    .eq('snapshot_instance_id', '75f4c60d-fc91-4d80-be51-1c56d0823030')
    .single();

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }
  
  console.log('Test Record Data:', JSON.stringify(data, null, 2));
}

verify();
