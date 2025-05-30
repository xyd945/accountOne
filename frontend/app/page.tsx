import Link from 'next/link'
import { ArrowRightIcon, ChartBarIcon, CurrencyDollarIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              AI-Powered Cryptocurrency Bookkeeping
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-blue-100">
              Automate your crypto accounting with IFRS-compliant journal entries
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                href="/auth/otp-login"
                className="rounded-md bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Sign in with email
              </Link>
              <Link href="/auth/login" className="text-sm font-semibold leading-6 text-gray-900">
                Use password <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Streamline Your Crypto Accounting
            </h2>
            <p className="text-xl text-gray-600">
              Leverage AI to automatically generate accurate, compliant financial records
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <CurrencyDollarIcon className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Automated Transaction Analysis</h3>
              <p className="text-gray-600">
                Connect your blockchain addresses and let AI analyze transactions automatically
              </p>
            </div>

            <div className="card text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <DocumentTextIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">IFRS-Compliant Entries</h3>
              <p className="text-gray-600">
                Generate journal entries that comply with international financial reporting standards
              </p>
            </div>

            <div className="card text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <ChartBarIcon className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Financial Reports</h3>
              <p className="text-gray-600">
                Generate balance sheets, cash flow statements, and detailed audit trails
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Automate Your Crypto Accounting?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of businesses using AI for accurate financial reporting
          </p>
          <Link href="/auth/register" className="btn-primary">
            Start Free Trial
          </Link>
        </div>
      </div>
    </div>
  )
} 