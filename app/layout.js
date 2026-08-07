import { cookies } from 'next/headers';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata = {
  title: 'Silmari',
  description: 'CRM dirigido por metadata',
};

export default async function RootLayout({ children }) {
  const theme = (await cookies()).get('theme')?.value === 'dark' ? 'dark' : '';
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${theme}`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
