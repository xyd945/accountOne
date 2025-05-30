const request = require('supertest');

// Mock Supabase before importing the app
jest.mock('@supabase/supabase-js');

const { createClient } = require('@supabase/supabase-js');

// Create a mock Supabase client
const mockSupabaseClient = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOtp: jest.fn(),
    verifyOtp: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
      })),
    })),
    insert: jest.fn(),
  })),
};

createClient.mockReturnValue(mockSupabaseClient);

// Import app after mocking
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('../../src/routes/auth');

// Create test app without starting server
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes - User Sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should sync user to database after successful registration', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      // Mock successful registration
      mockSupabaseClient.auth.signUp.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Mock database operations
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' }, // No rows returned
          }),
        }),
      });

      const mockInsert = jest.fn().mockResolvedValue({
        data: mockUser,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toContain('registered successfully');
      expect(mockInsert).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        created_at: mockUser.created_at,
        updated_at: expect.any(String),
      });
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('should sync user to database after successful OTP verification', async () => {
      const mockUser = {
        id: 'test-user-id',
        email: 'test@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      };

      // Mock successful OTP verification
      mockSupabaseClient.auth.verifyOtp.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock database operations
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }),
      });

      const mockInsert = jest.fn().mockResolvedValue({
        data: mockUser,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      });

      const response = await request(app)
        .post('/api/auth/verify-otp')
        .send({
          email: 'test@example.com',
          token: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(mockInsert).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        created_at: mockUser.created_at,
        updated_at: expect.any(String),
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should sync existing user to database if not already synced', async () => {
      const mockUser = {
        id: 'existing-user-id',
        email: 'existing@example.com',
        created_at: '2024-01-01T00:00:00Z',
      };

      const mockSession = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
      };

      // Mock successful login
      mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      });

      // Mock database operations
      const mockSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }),
      });

      const mockInsert = jest.fn().mockResolvedValue({
        data: mockUser,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
        insert: mockInsert,
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'existing@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(mockInsert).toHaveBeenCalledWith({
        id: mockUser.id,
        email: mockUser.email,
        created_at: mockUser.created_at,
        updated_at: expect.any(String),
      });
    });
  });
}); 