import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ShieldCheck, BarChart3, Users, Globe, Eye, Target } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-primary-50 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              Verified Impact You Can Trust
            </h1>
            <p className="mt-6 text-lg text-foreground/70 leading-relaxed">
              Offsettable is the bridge between organisations seeking meaningful ESG impact and communities that need it most. We don't just connect funders to projects — we verify every claim, track every rand, and report every outcome.
            </p>
          </div>
        </div>
      </section>

      {/* The Problem We Solve */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
              The Problem with ESG Today
            </h2>
            <div className="space-y-4 text-foreground/70 leading-relaxed">
              <p>
                Corporates want to make a difference. Communities need investment. But between them sits a trust gap — inflated claims, opaque reporting, and no way to verify that money translates into measurable impact.
              </p>
              <p>
                South African businesses face an additional challenge: B-BBEE compliance demands verifiable social spending and enterprise development contributions. But finding qualifying projects, ensuring they're legitimate, and generating audit-ready documentation is time-consuming and risky.
              </p>
              <p className="font-medium text-foreground">
                Offsettable eliminates that gap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 sm:py-20 bg-gray-50 border-y border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-12 text-center">
            How We Work
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Independent Verification</h3>
              <p className="text-sm text-foreground/60">
                Every project is audited by qualified, independent professionals using validated methodologies. No self-reporting. No guesswork.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Transparent Metrics</h3>
              <p className="text-sm text-foreground/60">
                Real-time IoT monitoring, verified carbon calculations, and measurable social outcomes — all tracked on-platform and available in your ESG reports.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Direct Community Impact</h3>
              <p className="text-sm text-foreground/60">
                Your funding goes directly to verified projects — solar installations, career guidance, education infrastructure — with named beneficiaries and tracked outcomes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Mission & Values */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Our Mission</h2>
              <p className="text-foreground/70 leading-relaxed mb-6">
                To make verified ESG impact accessible, transparent, and audit-ready — so that every corporate rand spent on social and environmental development creates real, measurable change in the communities that need it most.
              </p>
              <p className="text-foreground/70 leading-relaxed">
                We believe that when trust is built through verification, funding flows. When funding flows to verified projects, communities thrive. And when communities thrive, everyone benefits.
              </p>
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">Our Values</h2>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Eye className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Radical Transparency</h3>
                    <p className="text-sm text-foreground/60 mt-1">Every claim is verified. Every metric is tracked. Every report is auditable.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Target className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Impact First</h3>
                    <p className="text-sm text-foreground/60 mt-1">We measure success by lives changed, not just rands moved.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Globe className="w-5 h-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Local Solutions, Global Standards</h3>
                    <p className="text-sm text-foreground/60 mt-1">South African projects verified to international standards (ISO 14064, Gold Standard, B-BBEE Codes).</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verification Methodology */}
      <section className="py-16 sm:py-20 bg-gray-50 border-y border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">
              Our Verification Methodology
            </h2>
            <p className="text-foreground/60">
              Every project on Offsettable goes through a rigorous multi-stage verification process before it's available for funding.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-primary-600 text-white flex items-center justify-center font-bold mb-3">1</div>
              <h3 className="font-semibold text-foreground mb-2">Submission</h3>
              <p className="text-xs text-foreground/60">Project owner submits with full documentation, registration, and impact methodology</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-primary-600 text-white flex items-center justify-center font-bold mb-3">2</div>
              <h3 className="font-semibold text-foreground mb-2">Pre-screening</h3>
              <p className="text-xs text-foreground/60">Admin team reviews identity, documentation completeness, and basic viability</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-primary-600 text-white flex items-center justify-center font-bold mb-3">3</div>
              <h3 className="font-semibold text-foreground mb-2">Independent Audit</h3>
              <p className="text-xs text-foreground/60">Qualified auditor conducts site visits, data verification, and methodology review</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-primary-600 text-white flex items-center justify-center font-bold mb-3">4</div>
              <h3 className="font-semibold text-foreground mb-2">Verified & Live</h3>
              <p className="text-xs text-foreground/60">Project receives verification badge and becomes available for funding</p>
            </div>
          </div>
        </div>
      </section>

      {/* B-BBEE Section */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-6">
              B-BBEE & ESP Compliance
            </h2>
            <p className="text-foreground/70 leading-relaxed mb-6">
              Every project on our platform is pre-qualified for B-BBEE recognition. Whether you need Skills Development contributions, Enterprise Development spend, or Socio-Economic Development points, our projects come with audit-ready documentation from day one.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-lg bg-primary-50 border border-primary-200 p-4 text-center">
                <p className="text-sm font-semibold text-primary-700">Skills Development</p>
                <p className="text-xs text-primary-600/70 mt-1">Priority Element</p>
              </div>
              <div className="rounded-lg bg-primary-50 border border-primary-200 p-4 text-center">
                <p className="text-sm font-semibold text-primary-700">Enterprise Development</p>
                <p className="text-xs text-primary-600/70 mt-1">SME & Supplier Support</p>
              </div>
              <div className="rounded-lg bg-primary-50 border border-primary-200 p-4 text-center">
                <p className="text-sm font-semibold text-primary-700">Socio-Economic Development</p>
                <p className="text-xs text-primary-600/70 mt-1">Community Impact</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20 bg-primary-900 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">Ready to Fund Verified Impact?</h2>
          <p className="mt-4 text-white/70 max-w-lg mx-auto">
            Browse our independently verified projects and start building your ESG portfolio with confidence.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/projects"
              className="inline-flex items-center justify-center rounded-lg bg-white text-primary-800 px-6 py-3.5 text-base font-semibold hover:bg-primary-50 transition-colors"
            >
              Browse Projects
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center rounded-lg border-2 border-white/30 text-white px-6 py-3.5 text-base font-semibold hover:bg-white/10 transition-colors"
            >
              Speak to an Advisor
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
