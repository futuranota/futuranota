import { MAILCHIMP } from '../lib/mailchimp.js';

/**
 * Styled subscribe row that POSTs to Mailchimp (classic embed fields).
 * Keeps Futura Nota chrome; omits Mailchimp default CSS, badge, and SMS scripts.
 */
export function MailchimpSubscribeForm({
  placeholder = 'you@studio.com',
  submitLabel = 'Subscribe',
  className = 'footer__news',
  inputClassName = 'footer__input',
  rowClassName = 'footer__news-row',
  inputProps = {},
}) {
  return (
    <form
      className={className}
      action={MAILCHIMP.action}
      method="post"
      target="_blank"
      noValidate
      name="mc-embedded-subscribe-form"
      id="mc-embedded-subscribe-form"
    >
      <div className={rowClassName}>
        <input
          type="email"
          name="EMAIL"
          id="mce-EMAIL"
          className={`${inputClassName} required email`}
          placeholder={placeholder}
          required
          autoComplete="email"
          aria-label="Email for newsletter"
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
          id="mc-embedded-subscribe"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
