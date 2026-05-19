import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-background py-12 mt-auto">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight gradient-text">
              Offsettable
            </span>
          </Link>
          <p className="text-sm text-foreground/60 max-w-xs">
            The lead-generation-first ESG impact platform connecting corporates, funders, and institutions to verified, audit-ready social and environmental projects.
          </p>
        </div>
        
        <div>
          <h3 className="font-semibold mb-4 text-foreground/90">Platform</h3>
          <ul className="space-y-2 text-sm text-foreground/60">
            <li><Link href="/projects" className="hover:text-primary-400 transition-colors">Browse Projects</Link></li>
            <li><Link href="/esg-guide" className="hover:text-primary-400 transition-colors">ESG Guide</Link></li>
            <li><Link href="/bbbee-social-spend" className="hover:text-primary-400 transition-colors">B-BBEE & Social Spend</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-4 text-foreground/90">Roles</h3>
          <ul className="space-y-2 text-sm text-foreground/60">
            <li><Link href="/for-funders" className="hover:text-primary-400 transition-colors">For Funders</Link></li>
            <li><Link href="/for-projects" className="hover:text-primary-400 transition-colors">For Project Owners</Link></li>
            <li><Link href="/auditors" className="hover:text-primary-400 transition-colors">For Auditors</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-4 text-foreground/90">Contact</h3>
          <ul className="space-y-2 text-sm text-foreground/60">
            <li><a href="mailto:contact@offsettable.co" className="hover:text-primary-400 transition-colors">contact@offsettable.co</a></li>
            <li><Link href="/speak-to-advisor" className="hover:text-primary-400 transition-colors">Speak to an Advisor</Link></li>
          </ul>
        </div>
      </div>
      
      <div className="container mx-auto px-4 mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs text-foreground/40">
        <p>&copy; {new Date().getFullYear()} Offsettable. All rights reserved.</p>
        <div className="flex gap-4 mt-4 md:mt-0">
          <Link href="/privacy" className="hover:text-foreground/80">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-foreground/80">Terms of Service</Link>
        </div>
      </div>
    </footer>
  );
}
