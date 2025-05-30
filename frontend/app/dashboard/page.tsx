'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { apiClient, type ChatResponse } from '@/lib/api'
import type { User } from '@supabase/supabase-js'
import { 
  PaperAirplaneIcon,
  UserIcon,
  CpuChipIcon,
  DocumentTextIcon,
  PlusIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'

interface SessionData {
  access_token: string
  refresh_token: string
}

interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  thinking?: string
  suggestions?: string[]
  timestamp: Date
  error?: boolean
}

interface JournalEntry {
  id: string
  transaction_id: string
  account_debit: string
  account_credit: string
  amount: number
  currency: string
  entry_date: string
  narrative: string | null
  ai_confidence: number | null
  is_reviewed: boolean
  created_at: string
  updated_at: string
  transactions?: {
    user_id: string
    txid: string
    description: string | null
  }
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: 'Hello! I\'m your AI bookkeeping assistant powered by advanced AI models. I can help you analyze transactions, create journal entries, and answer accounting questions. How can I assist you today?',
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [aiHealth, setAiHealth] = useState<{ gemini: boolean; deepseek: boolean; overall: boolean } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      try {
        // First, try to get user from Supabase (for password-based auth)
        const { data: { user: supabaseUser } } = await supabase.auth.getUser()
        
        if (supabaseUser) {
          setUser(supabaseUser)
          setLoading(false)
          return
        }

        // If no Supabase user, check localStorage for OTP session
        const sessionData = localStorage.getItem('session')
        if (sessionData) {
          try {
            const session: SessionData = JSON.parse(sessionData)
            
            // Set the session in Supabase client
            const { data, error } = await supabase.auth.setSession({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            })

            if (error) {
              console.error('Session error:', error)
              localStorage.removeItem('session')
              router.push('/auth/otp-login')
            } else if (data.user) {
              setUser(data.user)
            }
          } catch (err) {
            console.error('Session parse error:', err)
            localStorage.removeItem('session')
            router.push('/auth/otp-login')
          }
        } else {
          // No authentication found, redirect to login
          router.push('/auth/otp-login')
        }
      } catch (error) {
        console.error('Auth check error:', error)
        router.push('/auth/otp-login')
      } finally {
        setLoading(false)
      }
    }

    getUser()
  }, [router])

  useEffect(() => {
    if (user) {
      fetchJournalEntries()
      checkAIHealth()
    }
  }, [user])

  const checkAIHealth = async () => {
    try {
      const health = await apiClient.getAIHealth()
      setAiHealth(health)
    } catch (error) {
      console.error('Error checking AI health:', error)
      setAiHealth({ gemini: false, deepseek: false, overall: false })
    }
  }

  const fetchJournalEntries = async () => {
    setLoadingEntries(true)
    try {
      // Fetch real journal entries from the API
      const response = await apiClient.getJournalEntries({
        limit: 20, // Get the latest 20 entries
      })
      
      setJournalEntries(response.entries || [])
    } catch (error) {
      console.error('Error fetching journal entries:', error)
      // Set empty array on error
      setJournalEntries([])
    } finally {
      setLoadingEntries(false)
    }
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    const currentMessage = inputMessage
    setInputMessage('')
    setIsTyping(true)

    try {
      // Call the real AI API
      const response: ChatResponse = await apiClient.sendChatMessage(currentMessage, {
        recentMessages: messages.slice(-5), // Send last 5 messages for context
      })

      // Handle the nested response structure from backend
      const responseData = response.data;

      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: responseData.response,
        thinking: responseData.thinking,
        suggestions: responseData.suggestions || [],
        timestamp: new Date()
      }

      setMessages(prev => [...prev, aiResponse])
      
      // Check if the AI response indicates journal entries were created
      if (responseData.response.toLowerCase().includes('journal entries') && 
          (responseData.response.toLowerCase().includes('created') || 
           responseData.response.toLowerCase().includes('saved'))) {
        // Refresh journal entries after a short delay
        setTimeout(() => {
          fetchJournalEntries()
        }, 1000)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'I apologize, but I\'m having trouble processing your request right now. Please try again in a moment.',
        timestamp: new Date(),
        error: true
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleLogout = async () => {
    try {
      localStorage.removeItem('session')
      await supabase.auth.signOut()
      router.push('/')
    } catch (error) {
      console.error('Logout error:', error)
      router.push('/')
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">AI Bookkeeping</h1>
              {aiHealth && (
                <div className="ml-4 flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${aiHealth.overall ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs text-gray-600">
                    AI: {aiHealth.gemini ? 'Gemini ✓' : 'Gemini ✗'}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard/reports')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 flex items-center"
              >
                <ChartBarIcon className="h-4 w-4 mr-2" />
                Reports
              </button>
              <span className="text-sm text-gray-700">Welcome, {user?.email}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Side - Chat Interface */}
        <div className="w-1/2 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <CpuChipIcon className="h-5 w-5 mr-2 text-blue-600" />
              AI Assistant
            </h2>
            <p className="text-sm text-gray-600">Powered by Gemini AI • Ask about transactions, journal entries, or accounting</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-xs lg:max-w-md ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`flex-shrink-0 ${message.type === 'user' ? 'ml-2' : 'mr-2'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user' ? 'bg-blue-600' : message.error ? 'bg-red-600' : 'bg-gray-600'
                      }`}>
                        {message.type === 'user' ? (
                          <UserIcon className="h-4 w-4 text-white" />
                        ) : message.error ? (
                          <ExclamationTriangleIcon className="h-4 w-4 text-white" />
                        ) : (
                          <CpuChipIcon className="h-4 w-4 text-white" />
                        )}
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : message.error
                        ? 'bg-red-50 text-red-900 border border-red-200'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-blue-100' : message.error ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Thinking Process */}
                {message.type === 'ai' && message.thinking && (
                  <div className="flex justify-start">
                    <div className="flex max-w-xs lg:max-w-md">
                      <div className="flex-shrink-0 mr-2">
                        <div className="w-8 h-8 rounded-full bg-yellow-500 flex items-center justify-center">
                          <LightBulbIcon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-lg">
                        <p className="text-xs font-medium text-yellow-800 mb-1">💭 AI Thinking Process:</p>
                        <p className="text-sm text-yellow-900">{message.thinking}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Suggestions */}
                {message.type === 'ai' && message.suggestions && message.suggestions.length > 0 && (
                  <div className="flex justify-start">
                    <div className="flex max-w-xs lg:max-md">
                      <div className="flex-shrink-0 mr-2">
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <LightBulbIcon className="h-4 w-4 text-white" />
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 px-4 py-2 rounded-lg">
                        <p className="text-xs font-medium text-green-800 mb-1">💡 Suggestions:</p>
                        <ul className="text-sm text-green-900 space-y-1">
                          {message.suggestions.map((suggestion, index) => (
                            <li key={index} className="flex items-start">
                              <span className="text-green-600 mr-1">•</span>
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="flex">
                  <div className="flex-shrink-0 mr-2">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                      <CpuChipIcon className="h-4 w-4 text-white" />
                    </div>
                  </div>
                  <div className="bg-gray-100 px-4 py-2 rounded-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex space-x-2">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about transactions, journal entries, or accounting..."
                className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping || !aiHealth?.overall}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            {!aiHealth?.overall && (
              <p className="text-xs text-red-600 mt-1">AI services are currently unavailable</p>
            )}
          </div>
        </div>

        {/* Right Side - Journal Entries */}
        <div className="w-1/2 bg-gray-50 flex flex-col">
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <DocumentTextIcon className="h-5 w-5 mr-2 text-green-600" />
                Journal Entries
              </h2>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={fetchJournalEntries}
                  disabled={loadingEntries}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded"
                  title="Refresh"
                >
                  <svg className={`h-4 w-4 ${loadingEntries ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <button className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm hover:bg-green-700 flex items-center">
                  <PlusIcon className="h-4 w-4 mr-1" />
                  Add Entry
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {loadingEntries ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
              </div>
            ) : journalEntries.length === 0 ? (
              <div className="text-center py-12">
                <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No journal entries yet</p>
                <p className="text-sm text-gray-400 mb-6">
                  Create your first journal entry by asking the AI assistant on the left
                </p>
                <div className="space-y-2 text-sm text-gray-600 mb-6">
                  <p>💬 Try asking:</p>
                  <div className="bg-gray-50 rounded-lg p-3 text-left max-w-md mx-auto">
                    <p className="mb-1">"Create journal entry for [transaction_hash]"</p>
                    <p>"Create a journal entry for buying 1 ETH"</p>
                  </div>
                </div>
                <button 
                  onClick={() => setInputMessage('Create a journal entry for buying 1 ETH for $3000')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Try Example
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {journalEntries.map((entry) => (
                  <div key={entry.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900">
                        {entry.narrative || entry.transactions?.description || 'Journal Entry'}
                      </h3>
                      <span className="text-sm text-gray-500">{entry.entry_date}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Debit</p>
                        <p className="font-medium text-red-600">{entry.account_debit}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Credit</p>
                        <p className="font-medium text-green-600">{entry.account_credit}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">Amount</span>
                          {entry.ai_confidence && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              AI: {Math.round(entry.ai_confidence * 100)}%
                            </span>
                          )}
                          {!entry.is_reviewed && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              Needs Review
                            </span>
                          )}
                        </div>
                        <span className="font-semibold text-lg">
                          {entry.amount.toLocaleString()} {entry.currency}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 