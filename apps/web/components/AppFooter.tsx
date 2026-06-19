import Link from 'next/link';

// Minimal app-wide footer. Mostly here to surface required legal links
// (Privacy / Terms) and a tiny disclaimer banner.
export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border-subtle">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between flex-wrap gap-3 text-xs text-text-muted">
        <p>© {year} Health Saviors · AI guidance, not medical advice.</p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-text-primary transition">Privacy</Link>
          <Link href="/terms" className="hover:text-text-primary transition">Terms</Link>
          <Link href="/notifications" className="hover:text-text-primary transition">Settings</Link>
        </div>
      </div>
    </footer>
  );
}
