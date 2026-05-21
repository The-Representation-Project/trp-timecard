// app/CloudSettings.jsx — Settings panel for cloud sync (Supabase).
//
// Lives behind a ⚙ icon in the topbar. Three states:
//   1. Unconfigured — paste URL + anon key.
//   2. Configured but signed out — enter email, send magic link.
//   3. Signed in — show status, sign out / clear config.
//
// On first sign-in on a device that already has local data, prompts to
// upload that local data to the cloud (one-time migration).

const { useState: useStateCS, useEffect: useEffectCS } = React;

function useCloudStatus() {
  const [status, setStatus] = useStateCS(() =>
    window.CloudSync ? window.CloudSync.status() : 'unconfigured'
  );
  useEffectCS(() => {
    if (!window.CloudSync) return;
    return window.CloudSync.onStatusChange(setStatus);
  }, []);
  return status;
}

function CloudStatusBadge({ onClick }) {
  const status = useCloudStatus();
  const label = {
    'unconfigured': 'Local only',
    'signed-out': 'Sync — sign in',
    'signed-in': '✓ Synced',
  }[status] || status;
  const color = {
    'unconfigured': 'var(--trp-stone-700)',
    'signed-out': 'var(--trp-orange-700)',
    'signed-in': 'var(--trp-pacific-700)',
  }[status] || 'var(--trp-stone-700)';
  const bg = {
    'unconfigured': 'var(--trp-cream-100)',
    'signed-out': 'var(--trp-orange-100)',
    'signed-in': 'var(--trp-pacific-50)',
  }[status] || 'var(--trp-cream-100)';
  return (
    <button
      onClick={onClick}
      title="Cloud sync settings"
      style={{
        background: bg, color, border: `1px solid ${color}`,
        borderRadius: 'var(--radius-sm)',
        padding: '6px 10px', cursor: 'pointer',
        fontFamily: 'var(--font-display)', textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-caps)', fontSize: 10, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      ⚙ {label}
    </button>
  );
}

function CloudSettingsModal({ onClose }) {
  const status = useCloudStatus();

  return (
    <Modal title="Cloud Sync" subtitle="Sync your timecard across phone, laptop, and any other device." onClose={onClose} maxWidth={520}>
      {status === 'unconfigured' && <ConfigureForm onClose={onClose} />}
      {status === 'signed-out' && <SignInForm onClose={onClose} />}
      {status === 'signed-in' && <SignedInPanel onClose={onClose} />}
    </Modal>
  );
}

// ----- 1. Configure (paste URL + anon key) ------------------------------

function ConfigureForm({ onClose }) {
  const existing = window.CloudSync && window.CloudSync.getConfig();
  const [url, setUrl] = useStateCS(existing ? existing.url : '');
  const [anonKey, setAnonKey] = useStateCS(existing ? existing.anonKey : '');
  const [error, setError] = useStateCS('');
  const [submitting, setSubmitting] = useStateCS(false);

  async function save() {
    setError('');
    const trimmedUrl = url.trim().replace(/\/+$/, '');
    const trimmedKey = anonKey.trim();
    if (!trimmedUrl.startsWith('https://') || !trimmedUrl.includes('.supabase.co')) {
      setError('That doesn\'t look like a Supabase URL. It should start with https:// and end with .supabase.co.');
      return;
    }
    if (trimmedKey.length < 50 || !trimmedKey.startsWith('eyJ')) {
      setError('That doesn\'t look like an anon key. It should start with "eyJ" and be a long string.');
      return;
    }
    setSubmitting(true);
    const result = await window.CloudSync.configure({ url: trimmedUrl, anonKey: trimmedKey });
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  return (
    <>
      <div className="cert-box" style={{borderLeftColor: 'var(--trp-stone-500)', background: 'var(--trp-cream-100)'}}>
        <strong style={{fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-caps)', fontSize: 10, display: 'block', marginBottom: 4}}>
          First-time setup
        </strong>
        Follow the steps in <strong>SUPABASE_SETUP.md</strong> (included in
        the project folder) to create a free Supabase account and project.
        Then paste the two values from your Supabase API settings here.
      </div>

      <label className="field">
        <span className="lbl">Project URL</span>
        <input
          type="url"
          placeholder="https://abcdefghij.supabase.co"
          value={url}
          onChange={e => { setUrl(e.target.value); setError(''); }}
          autoFocus
        />
      </label>
      <label className="field">
        <span className="lbl">anon / public API key</span>
        <textarea
          rows={3}
          placeholder="eyJhbGciOi..."
          value={anonKey}
          onChange={e => { setAnonKey(e.target.value); setError(''); }}
          style={{fontFamily: 'ui-monospace, monospace', fontSize: 11}}
        />
        <div className="tiny muted" style={{marginTop: 4}}>
          The "anon" key only — never the "service_role" key.
        </div>
      </label>

      {error && (
        <div className="comment-block warn" style={{margin: '8px 0 12px'}}>{error}</div>
      )}

      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn" onClick={save} disabled={submitting}>
          {submitting ? 'Connecting…' : 'Save & Connect'}
        </button>
      </div>
    </>
  );
}

// ----- 2. Sign in (magic link) ------------------------------------------

function SignInForm({ onClose }) {
  const [email, setEmail] = useStateCS('erika@therepproject.org');
  const [error, setError] = useStateCS('');
  const [sent, setSent] = useStateCS(false);
  const [submitting, setSubmitting] = useStateCS(false);

  async function send() {
    setError('');
    setSubmitting(true);
    const result = await window.CloudSync.signIn(email.trim());
    setSubmitting(false);
    if (result.error) setError(result.error);
    else setSent(true);
  }

  function clearConfig() {
    if (confirm('Clear cloud config? You\'ll have to re-paste your Supabase URL and key.')) {
      window.CloudSync.unconfigure();
    }
  }

  if (sent) {
    return (
      <>
        <div className="comment-block" style={{borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
          <span className="from" style={{color: 'var(--trp-pacific-700)'}}>Check your inbox</span>
          We sent a sign-in link to <strong>{email}</strong>. Click the link
          on this device to finish signing in. The page will refresh
          automatically once you're authenticated.
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={() => setSent(false)}>← Use a different email</button>
          <button className="btn" onClick={onClose}>OK</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cert-box" style={{borderLeftColor: 'var(--trp-pacific-blue)'}}>
        Sign in to start syncing this device with your cloud data. You'll
        get a one-click sign-in link by email — no password.
      </div>

      <label className="field">
        <span className="lbl">Your email</span>
        <input
          type="email"
          value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }}
          autoFocus
        />
      </label>

      {error && <div className="comment-block warn" style={{margin: '8px 0 12px'}}>{error}</div>}

      <div className="modal-actions" style={{flexWrap: 'wrap'}}>
        <button className="btn ghost" onClick={clearConfig} style={{color: 'var(--trp-coral-700)', marginRight: 'auto'}}>
          ↩ Clear cloud config
        </button>
        <button className="btn ghost" onClick={onClose}>Later</button>
        <button className="btn" onClick={send} disabled={submitting || !email.trim()}>
          {submitting ? 'Sending…' : 'Send sign-in link'}
        </button>
      </div>
    </>
  );
}

// ----- 3. Signed in (status + sign out + first-time migration) ----------

function SignedInPanel({ onClose }) {
  const { state, actions } = useStore();
  const user = window.CloudSync.getUser();
  const [migrationState, setMigrationState] = useStateCS(null);
  // null | 'asking' | 'uploading' | 'done'

  // First sign-in on a device that has local-only data → offer to upload.
  useEffectCS(() => {
    if (migrationState) return;
    const hasLocalData =
      (state.timeEntries && state.timeEntries.length > 0) ||
      (state.leaveEntries && state.leaveEntries.length > 0) ||
      (state.weekSubmissions && state.weekSubmissions.length > 0);
    const migrationKey = 'trp-tc-migration-asked-' + (user ? user.id : 'unknown');
    const alreadyAsked = localStorage.getItem(migrationKey);
    if (hasLocalData && !alreadyAsked) {
      setMigrationState('asking');
    }
    // eslint-disable-next-line
  }, []);

  async function uploadLocal() {
    setMigrationState('uploading');
    const result = await window.CloudSync.save(state);
    if (!result.error) {
      localStorage.setItem('trp-tc-migration-asked-' + user.id, '1');
      setMigrationState('done');
    } else {
      alert('Upload failed: ' + result.error);
      setMigrationState(null);
    }
  }

  async function discardLocal() {
    // Pull whatever is in the cloud (may be empty for fresh devices).
    const { data } = await window.CloudSync.load();
    if (data) actions.replaceAll(data);
    localStorage.setItem('trp-tc-migration-asked-' + user.id, '1');
    setMigrationState('done');
  }

  async function signOut() {
    if (confirm('Sign out of cloud sync? Your local data stays on this device.')) {
      await window.CloudSync.signOut();
    }
  }

  function clearConfig() {
    if (confirm('Sign out AND clear the cloud URL/key from this device? You\'ll have to re-enter them to reconnect.')) {
      window.CloudSync.unconfigure();
    }
  }

  return (
    <>
      <div className="comment-block" style={{borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
        <span className="from" style={{color: 'var(--trp-pacific-700)'}}>Signed in as</span>
        <strong>{user ? user.email : '—'}</strong>
        <div className="tiny muted" style={{marginTop: 4}}>
          Every change you make on this device syncs automatically. Open the
          same app on your phone, sign in with the same email, and you'll
          see the same data.
        </div>
      </div>

      {migrationState === 'asking' && (
        <div className="comment-block warn" style={{margin: '0 0 14px'}}>
          <span className="from">One-time migration</span>
          This device has timecard data that isn't in the cloud yet. Upload
          it now, or replace it with whatever's currently in the cloud?
          <div style={{display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap'}}>
            <button className="btn small" onClick={uploadLocal}>
              ↑ Upload local → cloud
            </button>
            <button className="btn ghost small" onClick={discardLocal} style={{color: 'var(--trp-coral-700)'}}>
              ↓ Use cloud data (discard local)
            </button>
          </div>
        </div>
      )}
      {migrationState === 'uploading' && (
        <div className="comment-block">Uploading…</div>
      )}
      {migrationState === 'done' && (
        <div className="comment-block" style={{borderLeftColor: 'var(--trp-pacific-blue)', background: 'var(--trp-pacific-50)'}}>
          ✓ Sync established. All future changes flow to the cloud automatically.
        </div>
      )}

      <div className="modal-actions" style={{flexWrap: 'wrap'}}>
        <button className="btn ghost" onClick={clearConfig} style={{color: 'var(--trp-coral-700)', marginRight: 'auto'}}>
          ↩ Sign out & clear config
        </button>
        <button className="btn ghost" onClick={signOut}>Sign out</button>
        <button className="btn" onClick={onClose}>Done</button>
      </div>
    </>
  );
}

Object.assign(window, { CloudStatusBadge, CloudSettingsModal });
