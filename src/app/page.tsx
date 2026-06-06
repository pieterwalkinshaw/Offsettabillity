'use client';

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { ESGCalculator } from '@/components/marketing/ESGCalculator';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import type { Project } from '@shared/types';
import Link from 'next/link';

export default function HomePage() {
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeaturedProjects() {
      try {
        const projectsRef = collection(db, 'projects');
        const q = query(
          projectsRef,
          where('verificationStatus', 'in', ['verified', 'live', 'funded']),
          orderBy('createdAt', 'desc'),
          limit(6)
        );
        const snapshot = await getDocs(q);
        const projects = snapshot.docs.map((doc) => ({
          projectId: doc.id,
          ...doc.data(),
        })) as Project[];
        setFeaturedProjects(projects);
      } catch (error) {
        console.error('Failed to fetch featured projects:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchFeaturedProjects();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-900 via-primary-800 to-primary-950 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-400 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-accent-500 rounded-full blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
          <div className="max-w-3xl">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
              Fund Verified Impact. Stay Audit-Ready.
            </h1>
            <p className="mt-4 sm:mt-6 text-base sm:text-lg lg:text-xl text-white/80 max-w-2xl">
              Connect with independently verified ESG projects that qualify for B-BBEE social spending and enterprise development. Every project is audited, every rand is tracked.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4">
              <a
                href="#calculator"
                className="inline-flex items-center justify-center rounded-lg bg-white text-primary-800 px-6 py-3.5 text-base font-semibold hover:bg-primary-50 transition-colors"
              >
                Calculate Your Impact
              </a>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center rounded-lg border-2 border-white/30 text-white px-6 py-3.5 text-base font-semibold hover:bg-white/10 transition-colors"
              >
                Browse Projects
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-primary-700">250+</p>
              <p className="mt-1 text-xs sm:text-sm text-foreground/60">Projects Verified</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-primary-700">R50M+</p>
              <p className="mt-1 text-xs sm:text-sm text-foreground/60">Funded</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-primary-700">98%</p>
              <p className="mt-1 text-xs sm:text-sm text-foreground/60">Audit Accuracy</p>
            </div>
            <div className="text-center">
              <p className="text-2xl sm:text-3xl font-bold text-primary-700">120+</p>
              <p className="mt-1 text-xs sm:text-sm text-foreground/60">Certified Auditors</p>
            </div>
          </div>
        </div>
      </section>

      {/* ESG Calculator Section */}
      <section id="calculator" className="bg-gray-50 py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
              Discover Your ESG Allocation
            </h2>
            <p className="mt-3 text-foreground/60 max-w-xl mx-auto text-sm sm:text-base">
              Enter your industry and budget to get a personalized breakdown of how to allocate your ESG spend across verified impact categories.
            </p>
          </div>
          <ESGCalculator />
        </div>
      </section>

      {/* Featured Projects Section */}
      <section className="py-12 sm:py-16 lg:py-20 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8 sm:mb-12">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                Featured Verified Projects
              </h2>
              <p className="mt-2 text-foreground/60 text-sm sm:text-base">
                Independently audited projects ready for your ESG investment.
              </p>
            </div>
            <Link
              href="/projects"
              className="text-primary-600 hover:text-primary-700 font-semibold text-sm sm:text-base whitespace-nowrap"
            >
              View all projects →
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 animate-pulse">
                  <div className="h-4 w-3/4 bg-gray-200 rounded mb-3" />
                  <div className="h-3 w-1/2 bg-gray-100 rounded mb-4" />
                  <div className="h-2 w-full bg-gray-100 rounded mb-2" />
                  <div className="h-8 w-full bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : featuredProjects.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProjects.map((project) => (
                <ProjectCard key={project.projectId} project={project} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-foreground/60 mb-4">
                Featured projects are being verified. Browse all available projects.
              </p>
              <Link
                href="/projects"
                className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-6 py-3 text-white font-semibold hover:bg-primary-700 transition-colors"
              >
                Browse Projects
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-900 text-white py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Ready to Make Verified Impact?
          </h2>
          <p className="mt-3 text-white/70 max-w-lg mx-auto text-sm sm:text-base">
            Join hundreds of organizations funding audit-ready ESG projects across South Africa.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-lg bg-white text-primary-800 px-6 py-3.5 text-base font-semibold hover:bg-primary-50 transition-colors"
            >
              Get Your ESG Report
            </Link>
            <a
              href="#calculator"
              className="inline-flex items-center justify-center rounded-lg border-2 border-white/30 text-white px-6 py-3.5 text-base font-semibold hover:bg-white/10 transition-colors"
            >
              Try the Calculator
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
