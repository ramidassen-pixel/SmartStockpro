/* SmartStock Pro — Auth (stub: replace with Supabase auth) */
const Auth = {
  user: null,

  async login(email, password) {
    // Replace with: const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (email && password) {
      this.user = { id:'u1', name:'Admin User', email, role:'admin' };
      Utils.storage.set('ssp_user', this.user);
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials' };
  },

  logout() {
    this.user = null;
    Utils.storage.del('ssp_user');
    window.location.reload();
  },

  check() {
    this.user = Utils.storage.get('ssp_user');
    return !!this.user;
  },

  hasRole(role) {
    const hierarchy = { viewer:1, staff:2, manager:3, admin:4 };
    return (hierarchy[this.user?.role]||0) >= (hierarchy[role]||0);
  },
};
