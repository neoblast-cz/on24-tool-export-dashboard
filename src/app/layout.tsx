import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';

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
      <body>
        <div className="min-h-screen bg-gray-50">
          <Header />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
