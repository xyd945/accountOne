'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiClient } from '@/lib/api'

interface SendOTPResponse {
  message: string
  email: string
}

interface VerifyOTPResponse {
  message: string
  user: {
    id: string
    email: string
    created_at: string
  }
  session: {
    access_token: string
    refresh_token: string
  }
}

export default function OTPLoginPage() {
  const [step, setStep] = useState<'email' | 'verify'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await apiClient.request({
        method: 'POST',
        url: '/api/auth/send-otp',
        data: { email }
      }) as SendOTPResponse

      setMessage(response.message)
      setStep('verify')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await apiClient.request({
        method: 'POST',
        url: '/api/auth/verify-otp',
        data: { email, token: otp }
      }) as VerifyOTPResponse

      // Store the session data
      localStorage.setItem('session', JSON.stringify(response.session))
      
      setMessage('Login successful! Redirecting...')
      setTimeout(() => {
        router.push('/dashboard')
      }, 1000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid OTP code')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToEmail = () => {
    setStep('email')
    setOtp('')
    setError('')
    setMessage('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {step === 'email' ? 'Sign in with email' : 'Enter verification code'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {step === 'email' ? (
              <>
                Or{' '}
                <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
                  use password instead
                </Link>
              </>
            ) : (
              <>
                We sent a 6-digit code to{' '}
                <span className="font-medium">{email}</span>
              </>
            )}
          </p>
        </div>

        {step === 'email' ? (
          <form className="mt-8 space-y-6" onSubmit={handleSendOTP}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {message}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="input-field mt-1"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending code...' : 'Send login code'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyOTP}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                {message}
              </div>
            )}

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700">
                Verification code
              </label>
              <input
                id="otp"
                name="otp"
                type="text"
                maxLength={6}
                pattern="[0-9]{6}"
                required
                className="input-field mt-1 text-center text-2xl tracking-widest"
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoComplete="one-time-code"
              />
              <p className="mt-1 text-sm text-gray-500">
                Enter the 6-digit code from your email
              </p>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleBackToEmail}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Verify & Sign in'}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={loading}
                className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
              >
                Didn't receive the code? Send again
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
} 