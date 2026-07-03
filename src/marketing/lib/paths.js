/** Marketing site route paths (React Router). */
export const PATHS = {
  home: '/',
  horizon: '/horizon',
  how: '/how',
  marketplace: '/horizon',
  blogs: '/blogs',
  welcome: '/welcome',
  login: '/login',
  signup: '/signup',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  app: '/app',
  admin: '/panel',
  terms: '/signup/terms',
};

export function sectionPath(slug) {
  if (!slug || slug === 'home') return PATHS.home;
  return PATHS[slug] ?? `/${slug}`;
}

export function authPath(mode, opts) {
  const base = mode === 'signin' ? PATHS.login : PATHS.signup;
  const params = new URLSearchParams();
  if (opts?.plan) params.set('plan', opts.plan);
  if (opts?.billing) params.set('billing', opts.billing);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** @param {string} slug */
export function blogPostPath(slug) {
  return `${PATHS.blogs}/${slug}`;
}
