// Shared app state and tiny helpers. Lives in its own module so the data layer and the UI can both import it without cycles.
export const state = {
  user: null,
  company: null,      // branding/context for the active company portal
  products: [],
  categories: [],
  today: null,
  viewCompanyId: null, // super admin "open portal"
};

try { state.viewCompanyId = Number(sessionStorage.getItem('dk_view_company')) || null; } catch { /* storage blocked */ }
export function setViewCompany(id) {
  state.viewCompanyId = id;
  try { id ? sessionStorage.setItem('dk_view_company', String(id)) : sessionStorage.removeItem('dk_view_company'); } catch { /* ignore */ }
}

export class ApiError extends Error { constructor(msg, status) { super(msg); this.status = status; } }

export const can = (p) => !!state.user?.permissions?.includes(p);
export const isSuper = () => state.user?.role === 'super_admin';
/** Company whose data the app is showing right now. */
export const activeCompanyId = () => state.viewCompanyId || state.user?.company_id || null;
/** Creation order for lists: saved rows by id, then rows still waiting to upload (negative ids) in the order they were added. */
export const rowOrder = (id) => (id > 0 ? id : 1e12 + Math.abs(id));
