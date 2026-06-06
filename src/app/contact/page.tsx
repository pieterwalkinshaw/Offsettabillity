'use client';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ConsultationForm } from '@/components/forms/ConsultationForm';
import { MapPin, Mail, Phone, Clock } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-50 via-white to-primary-50 border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
              Speak to an ESG Advisor
            </h1>
            <p className="mt-4 text-lg text-foreground/70">
              Whether you're looking to fund verified impact projects, list your project for verification, or explore your ESG allocation — we're here to help.
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
            {/* Contact Form */}
            <div>
              <div className="rounded-2xl bg-white border border-gray-200 shadow-sm p-6 sm:p-8">
                <ConsultationForm
                  heading="Get in Touch"
                  description="Tell us about your ESG goals and we'll connect you with a specialist within 24 hours."
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-6">
                  Contact Information
                </h2>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Email</p>
                      <a href="mailto:hello@Offsettable.co.za" className="text-primary-600 hover:text-primary-700">
                        hello@Offsettable.co.za
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Phone</p>
                      <a href="tel:+27123456789" className="text-primary-600 hover:text-primary-700">
                        +27 12 345 6789
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Office</p>
                      <p className="text-foreground/70">
                        Johannesburg, South Africa
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Response Time</p>
                      <p className="text-foreground/70">
                        Within 24 hours on business days
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ */}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
                <h3 className="font-semibold text-foreground mb-4">Common Questions</h3>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="font-medium text-foreground">How do I fund a project?</p>
                    <p className="text-foreground/60 mt-1">
                      Browse our verified projects, select one that aligns with your ESG goals, and commit funding directly through the platform.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">How is verification done?</p>
                    <p className="text-foreground/60 mt-1">
                      Every project is independently audited by HPCSA-registered professionals using validated methodologies. Results are transparent and audit-ready.
                    </p>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Does this qualify for B-BBEE?</p>
                    <p className="text-foreground/60 mt-1">
                      Yes. All projects on our platform are pre-qualified for B-BBEE Skills Development, Enterprise Development, or Socio-Economic Development.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
