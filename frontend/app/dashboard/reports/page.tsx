'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon, ChartBarIcon, CurrencyDollarIcon, DocumentTextIcon, CalendarIcon } from '@heroicons/react/24/outline'
import { supabase } from '../../../lib/supabase'
import { apiClient } from '../../../lib/api'

interface BalanceSheetItem {
  account: string
  balance: number
  currency: string
}

interface BalanceSheet {
  asOfDate: string
  assets: BalanceSheetItem[]
  liabilities: BalanceSheetItem[]
  equity: BalanceSheetItem[]
  totals: {
    totalAssets: number
    totalLiabilities: number
    totalEquity: number
  }
}

interface CryptoHolding {
  symbol: string
  name: string
  balance: number
  account: string
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null)
  const [cryptoHoldings, setCryptoHoldings] = useState<CryptoHolding[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState<'portfolio' | 'balance-sheet' | 'cash-flow'>('portfolio')
  const router = useRouter()

  useEffect(() => {
    checkAuth()
    if (selectedDate) {
      fetchReports()
    }
  }, [selectedDate])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/otp-login')
      return
    }
  }

  const fetchReports = async () => {
    try {
      setLoading(true)
      
      // Fetch balance sheet
      const balanceSheetData = await apiClient.getBalanceSheet(selectedDate)
      setBalanceSheet(balanceSheetData)

      // Extract crypto holdings from digital assets
      const cryptoAssets = balanceSheetData.assets.filter((asset: BalanceSheetItem) => 
        asset.account.includes('Digital Assets') && asset.balance > 0
      )

      const holdings: CryptoHolding[] = cryptoAssets.map((asset: BalanceSheetItem) => {
        const accountName = asset.account
        let symbol = asset.currency
        let name = accountName.replace('Digital Assets - ', '')
        
        // Map common currencies to proper symbols
        if (accountName.includes('Bitcoin')) {
          symbol = 'BTC'
          name = 'Bitcoin'
        } else if (accountName.includes('Ethereum')) {
          symbol = 'ETH'
          name = 'Ethereum'
        } else if (accountName.includes('USDT')) {
          symbol = 'USDT'
          name = 'Tether USD'
        } else if (accountName.includes('USDC')) {
          symbol = 'USDC'
          name = 'USD Coin'
        }

        return {
          symbol,
          name,
          balance: asset.balance,
          account: accountName
        }
      })

      setCryptoHoldings(holdings)
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    if (currency === 'BTC') {
      return `${amount.toFixed(8)} ${currency}`
    } else if (currency === 'ETH') {
      return `${amount.toFixed(6)} ${currency}`
    } else if (['USDT', 'USDC', 'DAI'].includes(currency)) {
      return `${amount.toFixed(2)} ${currency}`
    } else {
      return `${amount.toLocaleString()} ${currency}`
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 p-2 rounded-md text-gray-400 hover:text-gray-600"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold text-gray-900">Financial Reports</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'portfolio'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CurrencyDollarIcon className="h-5 w-5 inline mr-2" />
              Portfolio Holdings
            </button>
            <button
              onClick={() => setActiveTab('balance-sheet')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'balance-sheet'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <ChartBarIcon className="h-5 w-5 inline mr-2" />
              Balance Sheet
            </button>
            <button
              onClick={() => setActiveTab('cash-flow')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'cash-flow'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <DocumentTextIcon className="h-5 w-5 inline mr-2" />
              Cash Flow
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'portfolio' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Cryptocurrency Portfolio</h2>
              <p className="text-gray-600">Your current crypto asset holdings as of {selectedDate}</p>
            </div>

            {cryptoHoldings.length === 0 ? (
              <div className="text-center py-12">
                <CurrencyDollarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No cryptocurrency holdings found</p>
                <p className="text-sm text-gray-400">
                  Add some transactions to see your portfolio here
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {cryptoHoldings.map((holding, index) => (
                  <div key={index} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          {holding.symbol.substring(0, 2)}
                        </div>
                        <div className="ml-3">
                          <h3 className="font-semibold text-gray-900">{holding.name}</h3>
                          <p className="text-sm text-gray-500">{holding.symbol}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Balance</span>
                        <span className="font-mono font-semibold">{formatCurrency(holding.balance, holding.symbol)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Account</span>
                        <span className="text-sm text-gray-500 truncate max-w-xs">{holding.account}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'balance-sheet' && balanceSheet && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Balance Sheet</h2>
              <p className="text-gray-600">Financial position as of {balanceSheet.asOfDate}</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {/* Assets */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Assets
                </h3>
                <div className="space-y-3">
                  {balanceSheet.assets.map((asset, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-sm text-gray-600 truncate mr-2">{asset.account}</span>
                      <span className="font-mono text-sm">{formatCurrency(asset.balance, asset.currency)}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 mt-4">
                    <div className="flex justify-between font-semibold">
                      <span>Total Assets</span>
                      <span>${balanceSheet.totals.totalAssets.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Liabilities */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                  Liabilities
                </h3>
                <div className="space-y-3">
                  {balanceSheet.liabilities.length === 0 ? (
                    <p className="text-sm text-gray-500">No liabilities</p>
                  ) : (
                    balanceSheet.liabilities.map((liability, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-sm text-gray-600 truncate mr-2">{liability.account}</span>
                        <span className="font-mono text-sm">{formatCurrency(liability.balance, liability.currency)}</span>
                      </div>
                    ))
                  )}
                  <div className="border-t pt-2 mt-4">
                    <div className="flex justify-between font-semibold">
                      <span>Total Liabilities</span>
                      <span>${balanceSheet.totals.totalLiabilities.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Equity */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  Equity
                </h3>
                <div className="space-y-3">
                  {balanceSheet.equity.length === 0 ? (
                    <p className="text-sm text-gray-500">No equity accounts</p>
                  ) : (
                    balanceSheet.equity.map((equity, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-sm text-gray-600 truncate mr-2">{equity.account}</span>
                        <span className="font-mono text-sm">{formatCurrency(equity.balance, equity.currency)}</span>
                      </div>
                    ))
                  )}
                  <div className="border-t pt-2 mt-4">
                    <div className="flex justify-between font-semibold">
                      <span>Total Equity</span>
                      <span>${balanceSheet.totals.totalEquity.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cash-flow' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Cash Flow Statement</h2>
              <p className="text-gray-600">Coming soon - Cash flow analysis and reporting</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
              <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Cash flow reporting will be available soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 