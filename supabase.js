import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://dazkjzjjrwdpyedessot.supabase.co'
const supabaseKey = 'sb_publishable_-5NVaKADBCT2_fJ9u4P1JQ_-t8veNg8'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)