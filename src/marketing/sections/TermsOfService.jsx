import { Link } from 'react-router-dom';
import { PATHS } from '../lib/paths.js';

const LAST_UPDATED = 'October 16, 2026';

export function TermsOfService() {
  return (
    <article className="privacy-doc" data-screen-label="terms of service">
      <div className="privacy-doc__wrap">
        <header className="privacy-doc__head">
          <h1>Terms of Service</h1>
          <p className="privacy-doc__updated">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="privacy-doc__body">
          <section className="privacy-doc__section">
            <p>
              By checking the box next to these Terms of Service and clicking the &ldquo;Purchase&rdquo; or
              &ldquo;Subscribe&rdquo; button, you, the purchaser (&ldquo;Customer&rdquo; or &ldquo;You&rdquo;), agree
              to purchase access to Futura Nota provided by Futura Nota LLC (&ldquo;Company&rdquo;, &ldquo;We&rdquo;,
              &ldquo;Our&rdquo;, or &ldquo;Us&rdquo;) and agree to enter into this legally binding agreement, with
              terms as follows:
            </p>
            <p>
              For good and valuable consideration, Customer agrees to purchase a Futura Nota subscription
              (&ldquo;Subscription&rdquo; or &ldquo;Product&rdquo;) from Company. In exchange, Company agrees to
              provide access to the digital software and hosting services, with details as outlined below.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Acceptance of the Terms</h2>
            <p>
              These Terms of Service are entered into by and between You and Company. The following terms and
              conditions govern your access to and use of Futura Nota, including any content, functionality,
              step-by-step prompting tools, PDF/video embedding capabilities, prompt storage, embeddable prompt
              pages, and digital services offered on or through futuranota.com or its web application (the
              &ldquo;Website&rdquo; or &ldquo;Platform&rdquo;), whether as a guest or a registered user.
            </p>
            <p>
              Please read the Terms of Service carefully before you start to use the Platform. By using the
              Platform or by clicking to accept or agree to the Terms of Service when this option is made available
              to you, you accept and agree to be bound and abide by these Terms of Service and our{' '}
              <Link to={PATHS.privacy} className="privacy-doc__link">Privacy Policy</Link>
              {' '}incorporated herein by reference. If you do not want to agree to these Terms of Service or the
              Privacy Policy, you must not access or use the Platform.
            </p>
            <p>
              This Platform is offered and available to users who are 18 years of age or older. By using this
              Platform, you represent and warrant that you are of legal age to form a binding contract with the
              Company.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Subscription Details &amp; Deliverables</h2>
            <p>
              Futura Nota is a cloud-based web application and prompt management platform offered as a Monthly or
              Annual subscription service.
            </p>
            <h3>A) This Subscription includes</h3>
            <p>Customer understands and agrees this Subscription includes:</p>
            <ul>
              <li>
                <strong>Step-by-Step Prompting &amp; Storage System:</strong> Access to create, structure, organize,
                and store step-by-step prompts within the Customer&rsquo;s private cloud workspace.
              </li>
              <li>
                <strong>Embedded Media Support:</strong> Ability to upload, link, and embed third-party PDF files and
                video content directly into your prompting workflows and storage pages.
              </li>
              <li>
                <strong>Embeddable Prompt Pages (Commercial &amp; Personal Use):</strong> Access to tools that allow
                Customer to generate ready-to-use &ldquo;embed&rdquo; pages containing Customer&rsquo;s prompts, which
                Customer may use, share, or publish for both personal and commercial purposes (e.g., embedding on
                external websites, client portals, or digital products).
              </li>
              <li>
                <strong>Customer Portal &amp; Hosting Access:</strong> Access to an online portal where
                Customer&rsquo;s stored prompts, embedded PDFs/videos, and generated prompt embeds are hosted and
                accessible during an active subscription.
              </li>
            </ul>
            <h3>B) This Subscription does not include</h3>
            <p>Customer understands and agrees this Subscription does not include:</p>
            <ul>
              <li>
                <strong>Custom Software Development:</strong> Custom code or bespoke features built specifically for
                Customer.
              </li>
              <li>
                <strong>Direct Content Creation:</strong> Writing or creating prompts, videos, or PDF content on
                behalf of the Customer by Company staff.
              </li>
              <li>
                <strong>Third-Party Content Hosting Warranties:</strong> Direct file hosting for external illegal
                media or copyright-infringing video/PDF content.
              </li>
              <li>Any good or service other than that explicitly listed in Section A above.</li>
            </ul>
          </section>

          <section className="privacy-doc__section">
            <h2>User Content, Prompts &amp; Commercial Use License</h2>
            <h3>A) Ownership of Prompts &amp; Content</h3>
            <p>
              You retain full ownership of all original prompts, text, workflow structures, embedded media
              references, and documents that you write, upload, or construct within Futura Nota
              (&ldquo;Customer Content&rdquo;). Company does not claim ownership over Customer Content.
            </p>
            <h3>B) Commercial &amp; Personal Rights for Embeds</h3>
            <p>
              Customer is granted full rights to utilize the Embed Pages generated through Futura Nota for both
              Personal and Commercial use. This means Customer may embed their prompt pages into their own commercial
              websites, sales funnels, paid courses, or client deliverables.
            </p>
            <h3>C) Customer Responsibility &amp; Embedded Media Compliance</h3>
            <p>Customer represents and warrants that:</p>
            <ul>
              <li>
                Customer owns or has the necessary licenses and permissions to embed any PDF, video, or image
                uploaded or linked within Futura Nota.
              </li>
              <li>
                Customer Content does not violate any third-party copyright, trademark, privacy, or proprietary
                rights.
              </li>
              <li>
                Customer will not use embeddable prompt pages to distribute malicious code, spam, or illegal
                material.
              </li>
            </ul>
          </section>

          <section className="privacy-doc__section">
            <h2>Limited License &amp; Platform Usage Restrictions</h2>
            <p>
              By purchasing the Product, Customer is granted one limited, revocable, non-transferable,
              non-sublicensable, non-exclusive license to access and use the Futura Nota web platform to build,
              store, and export prompt workflows for Customer&rsquo;s use as permitted herein.
            </p>
            <h3>Prohibited actions</h3>
            <ul>
              <li>
                <strong>No Software Cloning or Resale:</strong> Customer agrees not to copy, duplicate, reverse
                engineer, decompile, extract source code, sell, or sublicense Futura Nota&rsquo;s core software
                architecture, web app interface, or hosting system to create a competing SaaS platform.
              </li>
              <li>
                <strong>Account Sharing:</strong> Access credentials are for the individual subscriber only. Sharing
                account logins with unauthorized third parties is strictly prohibited.
              </li>
            </ul>
            <p>
              Any violation of these restrictions may result in immediate termination of Customer&rsquo;s account
              with no refunds given, and Company reserves the right to seek legal remedies.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Payment &amp; Automatic Renewal</h2>
            <p>
              In consideration for the Subscription provided by Company to Customer, Customer agrees to pay Company
              a recurring subscription fee (&ldquo;Fee&rdquo;) based on the billing plan chosen by Customer (Monthly
              or Annual).
            </p>
            <p>
              <strong>Automatic Renewal:</strong> Customer grants Company permission to automatically charge
              Customer&rsquo;s payment method on file for all renewal fees at the time they are due without requiring
              additional manual authorization.
            </p>
            <p>
              <strong>Grace Period:</strong> If a payment fails, Company will notify Customer, who will have a 3-day
              grace period to update billing details. If payment remains unpaid after 3 days, access to the platform
              and live embedded pages may be suspended until resolved.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Refund &amp; Cancellation Policy</h2>
            <h3>A) Strict No-Refund Policy</h3>
            <p>
              Futura Nota provides immediate cloud storage allocation, prompt rendering software, and embed page
              generation upon subscription. Because of this immediate digital provision, Company does not offer
              refunds or partial refunds for any subscription payments made.
            </p>
            <h3>B) Cancel Anytime with 1-Click</h3>
            <p>Customer retains full control over their account subscription and may cancel at any time.</p>
            <ul>
              <li>
                <strong>1-Click Cancellation:</strong> Customer can cancel instantly at any time by logging into
                their Futura Nota account dashboard, navigating to Account Settings &gt; Billing, and clicking
                &ldquo;Cancel Subscription&rdquo;.
              </li>
              <li>
                <strong>Email Cancellation:</strong> Alternatively, Customer may send a cancellation request via
                email to{' '}
                <a href="mailto:support@futuranota.com" className="privacy-doc__link">support@futuranota.com</a>,
                and Company will process the request within two (2) business days.
              </li>
              <li>
                <strong>Access Upon Cancellation:</strong> Upon cancellation, Customer will retain access to their
                workspace and active embeds until the last day of their current paid billing cycle (end of the
                active month or year). No further recurring charges will occur.
              </li>
            </ul>
          </section>

          <section className="privacy-doc__section">
            <h2>Chargebacks</h2>
            <p>
              In the event a chargeback or payment dispute is initiated with Customer&rsquo;s bank or credit card
              processor without contacting Company first, Customer agrees to pay the full amount of the disputed
              payment plus any processing fees incurred by Company. Company reserves the right to present these
              agreed Terms of Service to financial institutions to resolve disputes.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Data Storage &amp; Expiration of Embeds</h2>
            <p>Upon cancellation or expiration of a Subscription:</p>
            <ul>
              <li>Customer&rsquo;s stored prompts and embedded pages will remain active until the end of the paid billing period.</li>
              <li>
                Following account termination, Company will hold stored prompts in an inactive state for a grace
                period (e.g., 30 days) before permanent deletion.
              </li>
              <li>
                Live embed links hosted on external sites may cease to function after account expiration. Customer
                is responsible for saving and backing up their prompt text prior to subscription end.
              </li>
            </ul>
          </section>

          <section className="privacy-doc__section">
            <h2>No Guarantees &amp; Limitation of Liability</h2>
            <h3>A) Software Provided &ldquo;As-Is&rdquo;</h3>
            <p>
              Futura Nota and its embed functions are provided on an &ldquo;AS IS&rdquo; and &ldquo;AS
              AVAILABLE&rdquo; basis without warranties of any kind, express or implied. Company does not guarantee
              uninterrupted uptime or that third-party embedded media (such as external video links or hosted PDFs)
              will remain online if the external host removes them.
            </p>
            <h3>B) Limitation of Liability</h3>
            <p>
              Under no circumstances shall Company be held liable for any direct, indirect, incidental, or
              consequential damages resulting from Customer&rsquo;s use of or inability to use the Platform,
              including loss of data, loss of revenue from commercial prompt embeds, or website downtime.
            </p>
            <p>
              Company&rsquo;s total cumulative liability under any circumstance shall not exceed the total
              subscription fees paid by Customer to Company during the three (3) months prior to the claim.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Governing Law &amp; Dispute Resolution</h2>
            <p>
              These Terms of Service shall be governed by and construed under the laws of the State of Florida,
              United States, without regard to its conflict of law principles.
            </p>
            <p>
              In the event of a dispute, Customer and Company agree to first attempt informal resolution. If
              unresolved, disputes shall be settled through binding arbitration in Orange County, Florida. The
              maximum remedy available through arbitration is a refund of subscription fees paid during the disputed
              period.
            </p>
          </section>

          <section className="privacy-doc__section">
            <h2>Entire Agreement &amp; Modifications</h2>
            <p>
              These Terms of Service constitute the entire agreement between Customer and Company regarding Futura
              Nota. Company reserves the right to modify these Terms at any time. Continued use of the Website and
              Subscription after updates are posted constitutes acceptance of the updated Terms.
            </p>
          </section>
        </div>
      </div>
    </article>
  );
}
