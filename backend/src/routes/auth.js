const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { body, validationResult } = require('express-validator');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
);

// Helper function to sync user to our PostgreSQL database
const syncUserToDatabase = async (user) => {
  try {
    // Check if user already exists in our database
    const { data: existingUser, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.warn('Error checking existing user', { userId: user.id, error: selectError.message });
      return;
    }

    // If user doesn't exist in our database, create them
    if (!existingUser) {
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        logger.error('Failed to sync user to database', { userId: user.id, error: insertError.message });
      } else {
        logger.info('User synced to database successfully', { userId: user.id, email: user.email });
      }
    }
  } catch (error) {
    logger.error('Error in syncUserToDatabase', { userId: user.id, error: error.message });
  }
};

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         email:
 *           type: string
 *           format: email
 *         created_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP to email for passwordless login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 email:
 *                   type: string
 *       400:
 *         description: Validation error
 */
router.post('/send-otp', [
  body('email').isEmail().normalizeEmail(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Please provide a valid email address', 400));
    }

    const { email } = req.body;

    logger.info('OTP request for email', { email });

    // Note: Whether this sends a magic link or OTP depends on your Supabase email template
    // To send OTP codes, modify the Magic Link email template to use {{ .Token }} instead of {{ .ConfirmationURL }}
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // This will create user if they don't exist
      },
    });

    if (error) {
      logger.warn('OTP send failed', { email, error: error.message });
      return next(new AppError(error.message, 400));
    }

    logger.info('OTP sent successfully', { email });

    res.json({
      message: 'Check your email for the login code',
      email,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and complete login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               token:
 *                 type: string
 *                 description: 6-digit OTP code
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 session:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *       401:
 *         description: Invalid OTP code
 */
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('token').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Please provide valid email and 6-digit OTP code', 400));
    }

    const { email, token } = req.body;

    logger.info('OTP verification attempt', { email });

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      logger.warn('OTP verification failed', { email, error: error.message });
      return next(new AppError('Invalid or expired OTP code', 401));
    }

    logger.info('User logged in successfully via OTP', { email, userId: data.user?.id });

    // Sync user to our PostgreSQL database
    if (data.user) {
      await syncUserToDatabase(data.user);
    }

    res.json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (password-based)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { email, password } = req.body;

    logger.info('User registration attempt', { email });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      logger.warn('Registration failed', { email, error: error.message });
      return next(new AppError(error.message, 400));
    }

    logger.info('User registered successfully', { email, userId: data.user?.id });

    // Sync user to our PostgreSQL database
    if (data.user) {
      await syncUserToDatabase(data.user);
    }

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification.',
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user (password-based)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 session:
 *                   type: object
 *                   properties:
 *                     access_token:
 *                       type: string
 *                     refresh_token:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    const { email, password } = req.body;

    logger.info('User login attempt', { email });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.warn('Login failed', { email, error: error.message });
      return next(new AppError('Invalid credentials', 401));
    }

    logger.info('User logged in successfully', { email, userId: data.user?.id });

    // Sync user to our PostgreSQL database (in case they're not synced yet)
    if (data.user) {
      await syncUserToDatabase(data.user);
    }

    res.json({
      message: 'Login successful',
      user: {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      const { error } = await supabase.auth.signOut(token);

      if (error) {
        logger.warn('Logout error', { error: error.message });
      }
    }

    res.json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', [
  // eslint-disable-next-line camelcase
  body('refresh_token').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new AppError('Validation failed', 400));
    }

    // eslint-disable-next-line camelcase
    const { refresh_token } = req.body;

    const { data, error } = await supabase.auth.refreshSession({
      // eslint-disable-next-line camelcase
      refresh_token,
    });

    if (error) {
      logger.warn('Token refresh failed', { error: error.message });
      return next(new AppError('Invalid refresh token', 401));
    }

    res.json({
      message: 'Token refreshed successfully',
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
