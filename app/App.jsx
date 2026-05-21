// app/App.jsx — top-level shell. Two render paths:
//   1. URL hash starts with #approve= → render the standalone Approval page
//      (Katrina's view; doesn't touch Erika's localStorage).
//   2. URL hash starts with #receipt= → import Katrina's signed receipt
//      into local state then drop back to the normal app.
//   3. Otherwise → render Erika's normal app (Home / Timesheet / Time Off /
//      History).

const { useState: useStateA, useEffect: useEffectA } = React;

function App() {
  const { state, actions } = useStore();
  const user = currentUser(state);

  const tabs = ['home', 'timesheet', 'timeoff', 'history'];
  const tabLabels = {
    home: 'Home',
    timesheet: 'Timesheet',
    timeoff: 'Time Off',
    history: 'History',
  };

  const [tab, setTab] = useStateA(() => {
    const saved = localStorage.getItem('trp-tc-tab');
    if (saved && tabs.includes(saved)) return saved;
    return tabs[0];
  });
  useEffectA(() => { localStorage.setItem('trp-tc-tab', tab); }, [tab]);

  // Toast for when a receipt has just been imported from a #receipt= link.
  const [receiptToast, setReceiptToast] = useStateA(null);

  // Cloud settings modal toggle.
  const [showCloud, setShowCloud] = useStateA(false);

  // Handle inbound receipt links: import + clean the URL + show a toast.
  useEffectA(() => {
    function handleHash() {
      const p = readHashPayload();
      if (!p) return;
      if (p.kind === 'receipt') {
        actions.importApprovalReceipt(p.payload);
        setReceiptToast(p.payload);
        // Strip hash without reload.
        history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []); // eslint-disable-line

  function renderPage() {
    switch (tab) {
      case 'home': return <Home />;
      case 'timesheet': return <Timesheet />;
      case 'timeoff': return <TimeOff />;
      case 'history': return <History />;
      default: return <Home />;
    }
  }

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <img src="assets/TRP-Icon-Blue.png" alt="The Representation Project" />
          <div className="brand-text">
            Timecard
            <span className="sub">The Representation Project</span>
          </div>
        </div>
        <div className="nav">
          {tabs.map(t => (
            <button
              key={t}
              className={`nav-link ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {tabLabels[t]}
            </button>
          ))}
        </div>
        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
          <CloudStatusBadge onClick={() => setShowCloud(true)} />
          <UserChip user={user} />
        </div>
      </div>
      {renderPage()}

      {showCloud && <CloudSettingsModal onClose={() => setShowCloud(false)} />}

      {receiptToast && (
        <ReceiptImportedToast
          receipt={receiptToast}
          onClose={() => setReceiptToast(null)}
        />
      )}
    </div>
  );
}

function UserChip({ user }) {
  const initials = user.name.split(/\s+|-/).map(s => s[0]).join('').slice(0, 2);
  return (
    <div className="user-chip" style={{position: 'relative'}}>
      <div className="avatar">{initials}</div>
      <div className="info">
        <div className="name">{user.name}</div>
        <div className="role">{user.title}</div>
      </div>
    </div>
  );
}

function ReceiptImportedToast({ receipt, onClose }) {
  const when = receipt.signedAt
    ? new Date(receipt.signedAt).toLocaleString(undefined, {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
    : '—';
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24, right: 24, zIndex: 100,
        maxWidth: 380,
        background: 'white',
        border: '1px solid var(--trp-pacific-blue)',
        borderLeft: '6px solid var(--trp-pacific-blue)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 32px rgba(0, 62, 86, 0.18)',
        padding: '16px 18px',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-display)', textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-caps)', fontWeight: 700,
        fontSize: 11, color: 'var(--trp-pacific-700)', marginBottom: 6,
      }}>
        Approval Received
      </div>
      <div style={{fontSize: 14, color: 'var(--trp-navy)', fontWeight: 700, lineHeight: 1.3}}>
        {receipt.signedName} signed off on your timecard
      </div>
      <div className="tiny muted" style={{marginTop: 4}}>
        {when} · period {receipt.periodStart} → {receipt.periodEnd}
      </div>
      <div style={{display: 'flex', gap: 8, marginTop: 12}}>
        <button className="btn small" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}

// ----- Top-level entrypoint -----
//
// Decide which "app" to mount: the normal employee app, or the standalone
// approval page (which never reads/writes localStorage and only shows the
// pay period the link encodes).

function Root() {
  const [hashPayload, setHashPayload] = useStateA(() => readHashPayload());

  useEffectA(() => {
    function onChange() { setHashPayload(readHashPayload()); }
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  // Approval-mode: render the standalone page outside the store provider
  // so we never accidentally taint Katrina's session with leftover state.
  if (hashPayload && hashPayload.kind === 'approve') {
    return <ApprovalPage payload={hashPayload.payload} />;
  }

  // Receipt links AND normal usage both load the regular app — the app's
  // effect handles importing the receipt and stripping the hash.
  return (
    <StoreProvider>
      <App />
    </StoreProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);
