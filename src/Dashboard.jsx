function Dashboard({ user, onSignOut, signingOut, message }) {
  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <a className="dashboard-brand" href="/dashboard">
          <span className="brand-mark" aria-hidden="true"><span></span><span></span></span>
          Vijay Portal
        </a>
        <nav className="dashboard-nav" aria-label="Dashboard">
          <a href="#overview">Overview</a>
          <a href="#account">My Account</a>
        </nav>
        <button className="dashboard-sign-out" type="button" onClick={onSignOut} disabled={signingOut}>
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </header>

      <main className="dashboard-main">
        {message && <p className="dashboard-error" role="alert">{message}</p>}
        <section className="dashboard-welcome" id="overview" aria-labelledby="dashboard-title">
          <p className="eyebrow">Your member dashboard</p>
          <h1 id="dashboard-title">Welcome to your dashboard.</h1>
          <p>Welcome back, {user.name || user.email}. Make yourself at home.</p>
          <a className="dashboard-account-link" href="#account">View your account &rarr;</a>
        </section>

        <div className="dashboard-grid">
          <section className="dashboard-card" id="account" aria-labelledby="account-title">
            <p className="eyebrow">Your profile</p>
            <h2 id="account-title">My account</h2>
            <div className="dashboard-profile">
              {user.picture
                ? <img className="dashboard-avatar" src={user.picture} alt="" referrerPolicy="no-referrer" />
                : <span className="dashboard-avatar dashboard-initial" aria-hidden="true">{(user.name || user.email).slice(0, 1).toUpperCase()}</span>}
              <p>{user.name || user.email}</p>
            </div>
            <dl className="dashboard-account">
              <div><dt>Email address</dt><dd>{user.email}</dd></div>
              <div><dt>Sign-in method</dt><dd>Google</dd></div>
            </dl>
            <p className="dashboard-card-note">Your profile details come from your Google account.</p>
          </section>

          <section className="dashboard-card" aria-labelledby="space-title">
            <p className="eyebrow">Room to grow</p>
            <h2 id="space-title">Your personal space</h2>
            <div className="dashboard-empty">
              <span className="dashboard-empty-mark" aria-hidden="true">+</span>
              <h3>A fresh start.</h3>
              <p>Your dashboard is ready. Member features are not available yet.</p>
            </div>
          </section>
        </div>
        <footer className="dashboard-footer">Vijay Portal / Quietly made for living well</footer>
      </main>
    </div>
  )
}

export default Dashboard
