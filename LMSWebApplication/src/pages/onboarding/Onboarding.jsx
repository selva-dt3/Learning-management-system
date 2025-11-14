import React, { useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import { toUserMessage } from '../../utils/errors';

export default function Onboarding() {
  const { user } = useAuth();
  const supabase = getSupabaseClient();
  const [nda, setNda] = useState(false);
  const [coc, setCoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async () => {
    setSaving(true);
    setMsg('');
    try {
      const { error } = await supabase.from('onboarding_status').upsert({
        user_id: user?.id,
        nda_signed: nda,
        coc_signed: coc,
        acknowledged_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setMsg('Onboarding acknowledgments saved.');
    } catch (err) {
      setMsg(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>Onboarding</h2>
      <label><input type="checkbox" checked={nda} onChange={e=>setNda(e.target.checked)} /> I have read and agree to the NDA</label>
      <br/>
      <label><input type="checkbox" checked={coc} onChange={e=>setCoc(e.target.checked)} /> I have read and agree to the Code of Conduct</label>
      <div style={{ marginTop: 16 }}><button onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Acknowledge'}</button></div>
      {msg && <p style={{ color: msg.includes('saved') ? 'green' : 'tomato' }}>{msg}</p>}
    </div>
  );
}
