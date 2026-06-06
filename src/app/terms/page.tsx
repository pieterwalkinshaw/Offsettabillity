import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />
      <main className="flex-grow mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-3xl font-bold text-foreground mb-8">Website Terms and Conditions</h1>

        <div className="prose prose-gray max-w-none space-y-6 text-foreground/80">
          <h2 className="text-xl font-semibold text-foreground">1. Introduction and Acceptance of Terms</h2>
          <p>Welcome to Offsettable Limited. These Terms and Conditions (&quot;Terms&quot;) govern your access to and use of our website, platform, and services, including the purchase of carbon credits. By accessing our site, registering an account, or making a purchase, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you must not use our website or services.</p>

          <h2 className="text-xl font-semibold text-foreground">2. Definitions</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>&quot;We,&quot; &quot;Us,&quot; &quot;Our&quot;:</strong> Refers to Offsettable Limited, a company registered in England under company number 16222378.</li>
            <li><strong>&quot;You,&quot; &quot;Your&quot;:</strong> Refers to the user or customer of our services, whether an individual consumer or a business entity.</li>
            <li><strong>&quot;Carbon Credit&quot;:</strong> Refers to a voluntary carbon credit representing a certified reduction or removal of one tonne of carbon dioxide equivalent (CO₂e) from the atmosphere. These are not financial instruments and are sold on the Voluntary Carbon Market (VCM).</li>
            <li><strong>&quot;Services&quot;:</strong> The services we provide, including the display, sale, and transfer of Carbon Credits.</li>
            <li><strong>&quot;Account&quot;:</strong> Your registered user account on our platform.</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground">3. Legal Nature of Carbon Credits and Limitation of Liability</h2>
          <p><strong>3.1.</strong> Carbon Credits are not Financial Instruments. You acknowledge and agree that the Carbon Credits we sell are not regulated financial instruments under UK law. They are not investments, securities, or derivatives, and their value may fluctuate.</p>
          <p><strong>3.2.</strong> While we will make reasonable efforts to verify the credits we offer on a science base, we do not guarantee their environmental, social, or financial integrity, quality, or permanence.</p>
          <p><strong>3.3.</strong> To the maximum extent permitted by UK law, we exclude all liability for any loss, damage, or expense, whether direct, indirect, or consequential, arising from your purchase or use of Carbon Credits.</p>

          <h2 className="text-xl font-semibold text-foreground">4. B2B and B2C Sales</h2>
          <p><strong>4.1. B2C Sales:</strong> If you are a consumer, your rights are protected by the Consumer Rights Act 2015. You have a 14-day cooling-off period to cancel your order and receive a refund, minus transaction fees.</p>
          <p><strong>4.2. B2B Sales:</strong> If you are a business, these Terms constitute the entire agreement between you and us. Consumer protections do not apply.</p>

          <h2 className="text-xl font-semibold text-foreground">5. Account and User Obligations</h2>
          <p>To purchase Carbon Credits, you must create an Account and provide accurate and complete information. You are responsible for maintaining the confidentiality of your account details.</p>

          <h2 className="text-xl font-semibold text-foreground">6. Payment and Delivery</h2>
          <p>Payment for all Carbon Credits must be made in full at the time of purchase. Upon successful payment, we will deliver the Carbon Credits to you by facilitating their transfer to a recognized registry account or issuing a certificate of ownership.</p>

          <h2 className="text-xl font-semibold text-foreground">7. Intellectual Property</h2>
          <p>All content on our website is our exclusive property or the property of our licensors and is protected by UK and international intellectual property laws.</p>

          <h2 className="text-xl font-semibold text-foreground">8. Data Protection</h2>
          <p>We process your personal data in accordance with the UK GDPR and the Data Protection Act 2018. See our <a href="/privacy" className="text-primary-600 underline">Privacy Policy</a> for details.</p>

          <h2 className="text-xl font-semibold text-foreground">9. Governing Law and Jurisdiction</h2>
          <p>These Terms are governed by the laws of England and Wales. Any dispute will be subject to the exclusive jurisdiction of the courts of England.</p>

          <h2 className="text-xl font-semibold text-foreground">10. Severability and Amendments</h2>
          <p>We reserve the right to amend these Terms at any time. Your continued use of our services following any changes constitutes your acceptance of the revised Terms.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
