import type { Metadata } from 'next';
import { Asap } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/layout/header';

const asap = Asap({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'On24 Analytics Dashboard',
  description: 'Analyze and export On24 webinar data',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={asap.className}>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
