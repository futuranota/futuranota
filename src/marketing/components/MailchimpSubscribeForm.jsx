import { useId, useState } from 'react';
import { MAILCHIMP, subscribeMailchimp } from '../lib/mailchimp.js';

/**
 * Styled subscribe row that POSTs to Mailchimp via JSONP (classic embed fields).
 * Keeps Futura Nota chrome; omits Mailchimp default CSS, badge, and SMS scripts.
 * Avoids target=_blank native POST, which was landing on Mailchimp with an empty EMAIL.
 */
export function MailchimpSubscribeForm({
  placeholder = 'you@studio.com',
  submitLabel = 'Subscribe',
  className = 'footer__news',
  inputClassName = 'footer__input',
  rowClassName = 'footer__news-row',
  inputProps = {},
}) {
  const reactId = useId();
  const formId = `mc-embedded-subscribe-form-${reactId}`;
  const emailId = `mce-EMAIL-${reactId}`;
  const [status, setStatus] = useState(/** @type {null | { type: 'success' | 'error', msg: string }} */ (null));
  const [pending, setPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const email = String(fd.get('EMAIL') || '').trim();
    const honeypot = String(fd.get(MAILCHIMP.honeypotName) || '');

    if (!email) {
      setStatus({ type: 'error', msg: 'Please enter your email.' });
      return;
    }

    setPending(true);
    setStatus(null);
    try {
      const result = await subscribeMailchimp({ email, honeypot });
      setStatus({ type: result.result, msg: result.msg });
      if (result.result === 'success') form.reset();
    } catch {
      setStatus({ type: 'error', msg: 'Could not reach Mailchimp. Try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className={className}
      action={MAILCHIMP.action}
      method="post"
      noValidate
      name="mc-embedded-subscribe-form"
      id={formId}
      onSubmit={handleSubmit}
    >
      <div className={rowClassName}>
        <input
          type="email"
          name="EMAIL"
          id={emailId}
          className={`${inputClassName} required email`}
          placeholder={placeholder}
          required
          autoComplete="email"
          aria-label="Email for newsletter"
          disabled={pending}
          {...inputProps}
        />
        <input type="hidden" name="tags" value={MAILCHIMP.tags} />
        {/* Honeypot — do not remove */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-5000px' }}>
          <input type="text" name={MAILCHIMP.honeypotName} tabIndex={-1} defaultValue="" />
        </div>
        <button
          className="btn btn-primary btn-sm"
          type="submit"
          name="subscribe"
          disabled={pending}
        >
          {pending ? '…' : submitLabel}
        </button>
      </div>
      {status ? (
        <p
          className={`footer__news-status footer__news-status--${status.type}`}
          role="status"
          aria-live="polite"
        >
          {status.msg}
        </p>
      ) : null}
    </form>
  );
}
