// app/cloudSync.js — Supabase wrapper for cross-device sync.
//
// Lifecycle:
//   1. configure(url, anonKey) → stored in localStorage, Supabase client
//      created.
//   2. signIn(email) → magic link sent. User clicks → page reloads with
//      auth tokens in the URL hash, Supabase consumes them, session saved.
//   3. load() → fetches the single jsonb row for this user.
//   4. save(state) → upserts the row.
//   5. subscribe(cb) → cb fires whenever the row changes (from another
//      device, mainly).
//
// The whole timecard state is stored as one jsonb blob per user — small
// enough that a full read/write per change is fine, and avoids the
// complexity of mapping our 5 entity types to relational tables.

(function () {
  const CONFIG_KEY = 'trp-tc-cloud-config';
  const STATE_TABLE = 'tc_state';

  let client = null;
  let currentUser = null;
  let realtimeChannel = null;
  let statusListeners = new Set();
  let dataListeners = new Set();
  let errorListeners = new Set();
  let lastSaveAt = 0;
  let lastError = null;
  let lastSyncOkAt = null;
  let initDone = false;

  let readyResolve;
  const whenReady = new Promise(function (resolve) { readyResolve = resolve; });

  function getRedirectUrl() {
    return window.location.origin + window.location.pathname;
  }

  function setLastError(msg) {
    lastError = msg || null;
    errorListeners.forEach(function (cb) {
      try { cb(lastError); } catch (e) { console.error(e); }
    });
  }

  function clearLastError() {
    setLastError(null);
  }

  function getConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function clearConfig() {
    localStorage.removeItem(CONFIG_KEY);
  }

  function makeClient() {
    const cfg = getConfig();
    if (!cfg || !cfg.url || !cfg.anonKey) return null;
    if (!window.supabase || !window.supabase.createClient) return null;
    return window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'implicit',
      },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }

  function emitStatus() {
    const status = computeStatus();
    statusListeners.forEach(function (cb) {
      try { cb(status); } catch (e) { console.error(e); }
    });
  }

  function computeStatus() {
    if (!getConfig()) return 'unconfigured';
    if (!client) return 'unconfigured';
    if (!currentUser) return 'signed-out';
    return 'signed-in';
  }

  // Strip Supabase auth tokens from the hash once the session is established.
  // Leaves #approve= / #receipt= links untouched.
  function cleanAuthHashIfPresent() {
    const h = window.location.hash || '';
    if (!h || h.match(/^#(approve|receipt)=/)) return;
    if (h.indexOf('access_token=') >= 0 || h.indexOf('type=magiclink') >= 0 || h.indexOf('error=') >= 0) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  async function refreshSession() {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) {
      setLastError('Session check failed: ' + error.message);
      currentUser = null;
      return null;
    }
    currentUser = data && data.session ? data.session.user : null;
    if (currentUser) cleanAuthHashIfPresent();
    return currentUser;
  }

  async function init() {
    try {
      const cfg = getConfig();
      if (!cfg) { emitStatus(); return; }
      client = makeClient();
      if (!client) {
        setLastError('Supabase SDK not loaded. Check your network connection.');
        emitStatus();
        return;
      }

      client.auth.onAuthStateChange(function (event, session) {
        currentUser = session ? session.user : null;
        teardownRealtime();
        if (currentUser) {
          setupRealtime();
          cleanAuthHashIfPresent();
          clearLastError();
        }
        emitStatus();
      });

      await refreshSession();
      if (currentUser) setupRealtime();
      emitStatus();
    } catch (e) {
      setLastError('Cloud sync init failed: ' + (e.message || String(e)));
      emitStatus();
    } finally {
      initDone = true;
      readyResolve();
    }
  }

  function setupRealtime() {
    if (!client || !currentUser) return;
    teardownRealtime();
    realtimeChannel = client
      .channel('tc_state:' + currentUser.id)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: STATE_TABLE,
        filter: 'user_id=eq.' + currentUser.id,
      }, function (payload) {
        const now = Date.now();
        if (now - lastSaveAt < 1500) return;
        const next = payload.new && payload.new.data;
        if (next) {
          dataListeners.forEach(function (cb) {
            try { cb(next); } catch (e) { console.error(e); }
          });
        }
      })
      .subscribe();
  }

  function teardownRealtime() {
    if (realtimeChannel && client) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  }

  // ----- Public API ------------------------------------------------------

  async function configure(opts) {
    clearLastError();
    saveConfig({ url: opts.url, anonKey: opts.anonKey });
    teardownRealtime();
    currentUser = null;
    client = makeClient();
    if (!client) {
      emitStatus();
      return { error: 'Supabase SDK not loaded' };
    }
    await refreshSession();
    if (currentUser) setupRealtime();
    emitStatus();
    return { ok: true };
  }

  function unconfigure() {
    teardownRealtime();
    if (client) client.auth.signOut().catch(function () {});
    clearConfig();
    client = null;
    currentUser = null;
    clearLastError();
    emitStatus();
  }

  async function signIn(email) {
    if (!client) return { error: 'Cloud sync not configured.' };
    clearLastError();
    const redirectTo = getRedirectUrl();
    const { error } = await client.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setLastError(error.message);
      return { error: error.message };
    }
    return { ok: true, redirectTo: redirectTo };
  }

  async function signOut() {
    if (!client) return;
    teardownRealtime();
    await client.auth.signOut();
    currentUser = null;
    emitStatus();
  }

  function getUser() { return currentUser; }
  function isConfigured() { return !!getConfig() && !!client; }
  function status() { return computeStatus(); }
  function getLastError() { return lastError; }
  function getLastSyncOkAt() { return lastSyncOkAt; }

  function onStatusChange(cb) {
    statusListeners.add(cb);
    return function () { statusListeners.delete(cb); };
  }

  function onRemoteData(cb) {
    dataListeners.add(cb);
    return function () { dataListeners.delete(cb); };
  }

  function onErrorChange(cb) {
    errorListeners.add(cb);
    return function () { errorListeners.delete(cb); };
  }

  async function load() {
    await whenReady;
    if (!client || !currentUser) return { error: 'Not signed in' };
    const { data, error } = await client
      .from(STATE_TABLE)
      .select('data, updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) {
      setLastError('Load failed: ' + error.message);
      return { error: error.message };
    }
    clearLastError();
    return { data: data ? data.data : null, updatedAt: data ? data.updated_at : null };
  }

  async function save(state) {
    await whenReady;
    if (!client || !currentUser) return { error: 'Not signed in' };
    lastSaveAt = Date.now();
    const { error } = await client
      .from(STATE_TABLE)
      .upsert({
        user_id: currentUser.id,
        data: state,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) {
      setLastError('Save failed: ' + error.message);
      console.error('[CloudSync] save failed:', error.message);
      return { error: error.message };
    }
    lastSyncOkAt = new Date().toISOString();
    clearLastError();
    return { ok: true };
  }

  // Ping Supabase + tc_state table so setup problems surface immediately.
  async function testConnection() {
    await whenReady;
    if (!client) return { error: 'Cloud sync not configured.' };
    if (!currentUser) return { error: 'Not signed in yet.' };

    const { error: authError } = await client.auth.getUser();
    if (authError) {
      setLastError('Auth check failed: ' + authError.message);
      return { error: authError.message };
    }

    const { error } = await client
      .from(STATE_TABLE)
      .select('updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (error) {
      setLastError('Database check failed: ' + error.message);
      return { error: error.message, hint: describeDbError(error.message) };
    }

    clearLastError();
    return { ok: true };
  }

  function describeDbError(msg) {
    const lower = (msg || '').toLowerCase();
    if (lower.indexOf('relation') >= 0 && lower.indexOf('does not exist') >= 0) {
      return 'Run the SQL in SUPABASE_SETUP.md to create the tc_state table.';
    }
    if (lower.indexOf('row-level security') >= 0 || lower.indexOf('permission denied') >= 0) {
      return 'Check RLS policies on tc_state in Supabase (see SUPABASE_SETUP.md Step 3).';
    }
    return null;
  }

  init();

  window.CloudSync = {
    configure: configure,
    unconfigure: unconfigure,
    signIn: signIn,
    signOut: signOut,
    getUser: getUser,
    isConfigured: isConfigured,
    status: status,
    getLastError: getLastError,
    getLastSyncOkAt: getLastSyncOkAt,
    getRedirectUrl: getRedirectUrl,
    onStatusChange: onStatusChange,
    onRemoteData: onRemoteData,
    onErrorChange: onErrorChange,
    load: load,
    save: save,
    testConnection: testConnection,
    getConfig: getConfig,
    whenReady: whenReady,
  };
})();
