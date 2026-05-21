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
  let lastSaveAt = 0;

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
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      // Keep realtime subscriptions alive across tab focus changes.
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }

  function emitStatus() {
    const status = computeStatus();
    statusListeners.forEach(cb => { try { cb(status); } catch (e) { console.error(e); } });
  }

  function computeStatus() {
    if (!getConfig()) return 'unconfigured';
    if (!client) return 'unconfigured';
    if (!currentUser) return 'signed-out';
    return 'signed-in';
  }

  async function init() {
    const cfg = getConfig();
    if (!cfg) { emitStatus(); return; }
    client = makeClient();
    if (!client) { emitStatus(); return; }

    // Check existing session (from localStorage / magic link redirect).
    const { data } = await client.auth.getSession();
    currentUser = data && data.session ? data.session.user : null;

    client.auth.onAuthStateChange((event, session) => {
      currentUser = session ? session.user : null;
      // Realtime sub needs to be (re)opened on sign-in, closed on sign-out.
      teardownRealtime();
      if (currentUser) setupRealtime();
      emitStatus();
    });

    if (currentUser) setupRealtime();
    emitStatus();
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
        filter: `user_id=eq.${currentUser.id}`,
      }, (payload) => {
        // Ignore the echo of our own write (debounce window).
        const now = Date.now();
        if (now - lastSaveAt < 1500) return;
        const next = payload.new && payload.new.data;
        if (next) dataListeners.forEach(cb => { try { cb(next); } catch (e) { console.error(e); } });
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

  async function configure({ url, anonKey }) {
    saveConfig({ url, anonKey });
    teardownRealtime();
    currentUser = null;
    client = makeClient();
    if (!client) {
      emitStatus();
      return { error: 'Supabase SDK not loaded' };
    }
    const { data } = await client.auth.getSession();
    currentUser = data && data.session ? data.session.user : null;
    if (currentUser) setupRealtime();
    emitStatus();
    return { ok: true };
  }

  function unconfigure() {
    teardownRealtime();
    if (client) client.auth.signOut().catch(() => {});
    clearConfig();
    client = null;
    currentUser = null;
    emitStatus();
  }

  async function signIn(email) {
    if (!client) return { error: 'Cloud sync not configured.' };
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    return error ? { error: error.message } : { ok: true };
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

  function onStatusChange(cb) {
    statusListeners.add(cb);
    return () => statusListeners.delete(cb);
  }

  function onRemoteData(cb) {
    dataListeners.add(cb);
    return () => dataListeners.delete(cb);
  }

  async function load() {
    if (!client || !currentUser) return { error: 'Not signed in' };
    const { data, error } = await client
      .from(STATE_TABLE)
      .select('data, updated_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (error) return { error: error.message };
    return { data: data ? data.data : null, updatedAt: data ? data.updated_at : null };
  }

  async function save(state) {
    if (!client || !currentUser) return { error: 'Not signed in' };
    lastSaveAt = Date.now();
    const { error } = await client
      .from(STATE_TABLE)
      .upsert({
        user_id: currentUser.id,
        data: state,
        updated_at: new Date().toISOString(),
      });
    return error ? { error: error.message } : { ok: true };
  }

  // Init eagerly so that magic-link redirects are handled on page load,
  // not on first interaction.
  init();

  window.CloudSync = {
    configure, unconfigure, signIn, signOut,
    getUser, isConfigured, status,
    onStatusChange, onRemoteData,
    load, save,
    getConfig,
  };
})();
