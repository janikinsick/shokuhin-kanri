import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Header } from '@/components/Header'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '社食管理システム',
  description: '社員食堂の在庫・納品管理',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${geist.className} min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors`}>
        <ThemeProvider>
          <Header />
          <main className="pt-4 pb-12">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
