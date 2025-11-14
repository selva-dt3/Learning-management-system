import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';

export default function DebugRealtime() {
  const supabase = getSupabaseClient();
  const [log, setLog] = useState([]);

  useEffect(() => {
    const ch = supabase.channel('debug').on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, (payload) => {
      setLog(prev => [...prev, JSON.stringify(payload)]);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase]);

  return (
    <div className="container" style={{ padding: 24 }}>
      <h3>Realtime Debug (lessons)</h3>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{log.join('\n')}</pre>
    </div>
  );
}
