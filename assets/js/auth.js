var Auth = {
  currentUser: null,

  async boot() {
    DB.load();
    const session = Utils.storage.get('ssp_session');
    if (session && session.uid) {
      const users = DB.get('users') || [];
      const user = users.find(u => u.id === session.uid);
      if (user && user.status !== 'pending') {
        this.currentUser = user;
        return true;
      }
    }
    return false;
  },

  async login() {
    const username = Utils.val('l-user');
    const password = Utils.val('l-pass');
    if (!username) { this._err('login-err', 'Enter your username'); return; }
    if (!password) { this._err('login-err', 'Enter your password'); return; }
    const users = DB.get('users') || [];
    if (users.length === 0) { this._err('login-err', 'No accounts found. Please create an account first.'); return; }
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) { this._err('login-err', 'Username not found'); return; }
    const ok = await this._verifyPw(password, user.password);
    if (!ok) { this._err('login-err', 'Incorrect password'); return; }
    this.currentUser = user;
    Utils.storage.set('ssp_session', { uid: user.id });
    App.showShell();
  },

  async signup() {
    const biz    = Utils.val('s-biz');
    const name   = Utils.val('s-name');
    const uname  = Utils.val('s-user');
    const pw     = Utils.val('s-pass');
    if (!biz)   { this._err('signup-err', 'Enter your business name'); return; }
    if (!name)  { this._err('signup-err', 'Enter your full name'); return; }
    if (!uname) { this._err('signup-err', 'Choose a username'); return; }
    if (pw.length < 6) { this._err('signup-err', 'Password must be at least 6 characters'); return; }
    const users = DB.get('users') || [];
    if (users.find(u => u.username.toLowerCase() === uname.toLowerCase())) {
      this._err('signup-err', 'Username already taken'); return;
    }
    const hashed = await this._hashPw(pw);
    const user = { id:Utils.uid('U'), username:uname, name, role:'owner', status:'active', createdAt:Utils.today(), password:hashed };
    users.push(user);
    DB.set('users', users);
    DB.saveSettings({ bizName: biz, currency: '$' });
    this.currentUser = user;
    Utils.storage.set('ssp_session', { uid: user.id });
    App.showShell();
  },

  logout() {
    this.currentUser = null;
    Utils.storage.del('ssp_session');
    location.reload();
  },

  showTab(tab) {
    const inF  = Utils.get('login-form');
    const upF  = Utils.get('signup-form');
    const tIn  = Utils.get('ltab-in');
    const tUp  = Utils.get('ltab-up');
    const errI = Utils.get('login-err');
    const errS = Utils.get('signup-err');
    if (errI) errI.classList.add('hidden');
    if (errS) errS.classList.add('hidden');
    if (tab === 'in') {
      inF && inF.classList.remove('hidden');
      upF && upF.classList.add('hidden');
      tIn && tIn.classList.add('active');
      tUp && tUp.classList.remove('active');
    } else {
      upF && upF.classList.remove('hidden');
      inF && inF.classList.add('hidden');
      tUp && tUp.classList.add('active');
      tIn && tIn.classList.remove('active');
    }
  },

  togglePw(id) {
    const el = Utils.get(id);
    if (el) el.type = el.type === 'password' ? 'text' : 'password';
  },

  _err(id, msg) {
    const el = Utils.get(id);
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  },

  async _hashPw(pw) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    } catch { return btoa(pw); }
  },

  async _verifyPw(pw, stored) {
    const hashed = await this._hashPw(pw);
    return hashed === stored || btoa(pw) === stored || pw === stored;
  },
};
