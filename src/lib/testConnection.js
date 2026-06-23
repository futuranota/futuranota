import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_PROJECT_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

console.log('Connecting to Supabase at:', supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: SUPABASE_PROJECT_URL or SUPABASE_ANON_KEY not set in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runTest() {
  try {
    // Intenta leer de la tabla companies
    console.log('Fetching companies...');
    const { data, error } = await supabase
      .from('companies')
      .select('*');

    if (error) {
      console.error('Supabase query error:', error.message);
      console.error('Details:', error);
      process.exit(1);
    }

    console.log('Connection successful! Companies found:', data.length);
    console.log('Data:', data);
  } catch (err) {
    console.error('Unexpected error:', err.message);
    process.exit(1);
  }
}

runTest();
