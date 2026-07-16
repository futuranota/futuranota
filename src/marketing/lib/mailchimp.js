/** Mailchimp embedded audience form — keep in sync with Embed → Form of the list. */
export const MAILCHIMP = {
  action:
    'https://ticketradius.us1.list-manage.com/subscribe/post?u=a8c21b422d28dbeec55f9f9ce&id=cab54655b9&f_id=00d5d0e0f0',
  jsonUrl: 'https://ticketradius.us1.list-manage.com/subscribe/post-json',
  u: 'a8c21b422d28dbeec55f9f9ce',
  id: 'cab54655b9',
  fId: '00d5d0e0f0',
  honeypotName: 'b_a8c21b422d28dbeec55f9f9ce_cab54655b9',
  /** Audience tag applied on subscribe (from Mailchimp embed `tags` hidden field). */
  tags: '3182353',
};

function stripHtml(html) {
  if (!html) return '';
  const el = document.createElement('div');
  el.innerHTML = String(html);
  return (el.textContent || el.innerText || '').trim();
}

/**
 * Classic Mailchimp JSONP subscribe (works from SPA without leaving the page).
 * Resolves to `{ result: 'success'|'error', msg: string }`.
 */
export function subscribeMailchimp({ email, honeypot = '' }) {
  return new Promise((resolve, reject) => {
    const callbackName = `__mc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
      script.remove();
    };

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const timeoutId = window.setTimeout(() => {
      finish(reject, new Error('Mailchimp request timed out'));
    }, 12000);

    window[callbackName] = (data) => {
      finish(resolve, {
        result: data?.result === 'success' ? 'success' : 'error',
        msg: stripHtml(data?.msg) || (data?.result === 'success' ? 'Subscribed.' : 'Something went wrong.'),
      });
    };

    script.onerror = () => {
      finish(reject, new Error('Mailchimp network error'));
    };

    const params = new URLSearchParams({
      u: MAILCHIMP.u,
      id: MAILCHIMP.id,
      f_id: MAILCHIMP.fId,
      EMAIL: email,
      tags: MAILCHIMP.tags,
      c: callbackName,
    });
    params.set(MAILCHIMP.honeypotName, honeypot);

    script.src = `${MAILCHIMP.jsonUrl}?${params.toString()}`;
    document.body.appendChild(script);
  });
}
