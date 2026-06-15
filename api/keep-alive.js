const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }
});

module.exports = async (req, res) => {
  const now = new Date().toISOString();
  console.log('Keep-alive ping at', now);

  const { error } = await supabase.from('qa_bot_messages').select('id').limit(1);

  if (error) {
    console.error('Keep-alive error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }

  res.status(200).json({ ok: true, pinged_at: now });
};
