import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-8">Privacy Policy</h1>
        <p className="text-sm text-foreground/60 mb-8">Effective Date: 1 August 2025</p>

        <div className="prose prose-gray max-w-none space-y-6 text-foreground/80">
          <p>This Privacy Policy explains how Offsettable Limited, a company registered in England under company number 16222378 (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), collects, uses, and protects your personal data when you use our website and services.</p>
          <p>We are committed to protecting your privacy and complying with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.</p>

          <h2 className="text-xl font-semibold text-foreground">1. What Personal Data We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Identity Data:</strong> Name, title, date of birth.</li>
            <li><strong>Contact Data:</strong> Billing address, email address, and telephone numbers.</li>
            <li><strong>Financial Data:</strong> Payment card details (processed by a third-party provider — we do not store these).</li>
            <li><strong>Transaction Data:</strong> Details about payments and products/services purchased.</li>
            <li><strong>Technical Data:</strong> IP address, browser type, time zone, operating system.</li>
            <li><strong>Profile Data:</strong> Username, purchases, preferences, and feedback.</li>
            <li><strong>Usage Data:</strong> Information about how you use our website and services.</li>
            <li><strong>Marketing and Communications Data:</strong> Your preferences in receiving marketing from us.</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground">2. How We Collect Your Data</h2>
          <p>We collect data through direct interactions (forms, correspondence), automated technologies (cookies, server logs), and third parties (analytics providers, payment services).</p>

          <h2 className="text-xl font-semibold text-foreground">3. How We Use Your Personal Data</h2>
          <p>We use your personal data to fulfil contracts, for legitimate interests, to comply with legal obligations, and with your consent where required.</p>

          <h2 className="text-xl font-semibold text-foreground">4. Who We Share Your Personal Data With</h2>
          <p>We may share your data with service providers, professional advisers, regulators, payment processors, and delivery companies — all required to treat your data in accordance with the law.</p>

          <h2 className="text-xl font-semibold text-foreground">5. International Transfers</h2>
          <p>We store your personal data within the UK and EEA. If transferred outside, we ensure appropriate safeguards are in place.</p>

          <h2 className="text-xl font-semibold text-foreground">6. Data Security</h2>
          <p>We have appropriate security measures to prevent your personal data from being accidentally lost, accessed in an unauthorised way, altered, or disclosed.</p>

          <h2 className="text-xl font-semibold text-foreground">7. Data Retention</h2>
          <p>We retain your personal data only as long as necessary to fulfil the purposes we collected it for, including legal, accounting, or reporting requirements.</p>

          <h2 className="text-xl font-semibold text-foreground">8. Your Legal Rights</h2>
          <p>Under the UK GDPR, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Be informed about how we use your data</li>
            <li>Access your personal data</li>
            <li>Rectification of inaccurate data</li>
            <li>Erasure (&quot;right to be forgotten&quot;)</li>
            <li>Restrict processing</li>
            <li>Data portability</li>
            <li>Object to processing</li>
            <li>Not be subject to automated decision-making</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground">9. Contact Us</h2>
          <p>If you have any questions about this privacy policy, please contact us at:</p>
          <ul className="list-none space-y-1">
            <li><strong>Entity:</strong> Offsettable Limited</li>
            <li><strong>Email:</strong> <a href="mailto:privacy@offsettable.co" className="text-primary-600 underline">privacy@offsettable.co</a></li>
          </ul>
          <p className="text-sm text-foreground/60">You have the right to make a complaint to the Information Commissioner&apos;s Office (ICO), the UK supervisory authority for data protection issues.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
