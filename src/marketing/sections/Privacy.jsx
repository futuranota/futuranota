const LAST_UPDATED = 'July 2, 2026';

export function Privacy() {
  return (
    <article className="privacy-doc" data-screen-label="privacy">
      <div className="privacy-doc__wrap">
        <header className="privacy-doc__head">
          <h1>Privacy</h1>
          <p className="privacy-doc__name">Privacy Policy</p>
          <p className="privacy-doc__updated">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="privacy-doc__body">
          <section className="privacy-doc__section">
            <p>
              Futura Nota (&ldquo;we&rdquo;, &ldquo;us&rdquo;) respects your privacy. This policy explains how we
              collect, use, share, and protect personal information when you use the Platform, create an account, or
              pay for a plan, and what rights you have over that information.
            </p>
            <p>
              Please read it carefully. We show material changes by updating the date above. If you keep using the
              Service after a change, you accept the updated policy. We encourage you to review it from time to time.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Information that we collect</h2>
            <p>
              We collect information when you visit the site, create an account, use the workspace, or pay for a plan.
              By using Futura Nota you agree to the collection, use, and processing described here, including sharing
              with the processors we need to run the Service. That information may include the categories below.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Personal data</h2>
            <p>
              Personal data is information that can identify you, such as your name, email address, and the basic
              profile details Google shares if you sign in with Google. You give us this when you register, sign in,
              or write to us. Sharing it is voluntary, but without an account you cannot use the Service. You must be
              at least 18 years old.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Derivative data</h2>
            <p>
              Derivative data is information our systems collect automatically when you use the Platform, such as your
              IP address, browser type, device type, the dates and times you access it, and the pages you view. It may
              include cookies and similar log data, described below. We use it to operate and secure the Service. On
              its own it is not a profile we sell or share with other users.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Financial data</h2>
            <p>
              Financial data is information related to how you pay, so you can support a paid plan. Futura Nota
              does not store full card numbers. Payments are processed by Buy Me a Coffee, which handles payment
              details under its own terms. We keep only what we need to know that a payment went through.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Cookies</h2>
            <p>
              We use cookies, small text files stored on your device, to keep you signed in, remember preferences,
              protect the Service, and understand how the site is used.
            </p>
            <p>We may use these kinds of cookies:</p>
            <ul>
              <li>
                Essential cookies help the site run and keep your session, so pages load and you stay signed in.
              </li>
              <li>
                Functionality cookies remember choices such as language or theme, so you do not enter them again.
              </li>
            </ul>
            <p>
              You can turn cookies off in your browser. Sign-in and parts of the Service may stop working if you do.
              If you keep using Futura Nota without disabling cookies, you consent to this use. We do not use cookies
              to sell your information.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Email confirmations</h2>
            <p>
              When we send you email, we may learn whether a message was delivered or opened. We use that only to
              know whether account and billing messages reach you, and to improve those messages. Email is sent
              through Resend.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Processing your information</h2>
            <p>
              Work we cannot do ourselves is done by processors we choose: Buy Me a Coffee for payments, Google for
              sign-in, Groq for AI features you request, and Resend for email. We send each of them only what that
              task needs.
              We may also process data ourselves to run your account, keep the Service working, keep records, meet
              legal duties, and protect Futura Nota and its users.
            </p>
            <p>We may process:</p>
            <ul>
              <li>Account data, such as your name, email, and plan.</li>
              <li>Usage data, such as your IP address and how you use the workspace.</li>
              <li>Content you put in the Service. That content remains yours.</li>
              <li>Messages you send us.</li>
              <li>Transaction records for purchases.</li>
              <li>The email address you use if you join the newsletter.</li>
            </ul>
            <p>
              We do this with your consent, to perform our contract with you, for our legitimate interest in operating
              the Service, and to comply with the law. The notes, plans, and files you create stay yours. We process
              them only to provide the Service, including the AI processing described above.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Security of your information</h2>
            <p>
              We use a recognized payment processor and reasonable security practices to protect personal data. No
              method of transmission or storage is completely secure, and we cannot guarantee absolute security. You
              send information to us at your own risk. If we learn of a breach that creates a serious risk to you, we
              will notify you. Your workspace data is stored privately and is not available to other users.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Confirm personal data and its use</h2>
            <p>
              You may ask us to confirm what personal data we hold about you, for what purposes, and whether we share
              it with the processors named in this policy. We will give you copies unless doing so would affect
              someone else&rsquo;s rights. You may also ask us to update or delete your account data, except for
              records we must keep by law. We may ask you to verify your identity first.
            </p>
            <p>
              Write to{' '}
              <a href="mailto:contacto@futuranota.com" className="privacy-doc__link">
                contacto@futuranota.com
              </a>
              . These terms are governed by the laws of the State of Florida, United States.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
