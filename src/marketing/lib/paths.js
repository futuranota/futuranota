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
};

export function sectionPath(slug) {
  if (!slug || slug === 'home') return PATHS.home;
  return PATHS[slug] ?? `/${slug}`;
}

export function authPath(mode) {
  return mode === 'signin' ? PATHS.login : PATHS.signup;
}

/** @param {string} slug */
export function blogPostPath(slug) {
  return `${PATHS.blogs}/${slug}`;
}
