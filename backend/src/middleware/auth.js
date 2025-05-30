const { createClient } = require('@supabase/supabase-js');
const { AppError } = require('./errorHandler');
const logger = require('../utils/logger');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('No token provided', 401));
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next(new AppError('No token provided', 401));
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid token attempt', { error: error?.message });
      return next(new AppError('Invalid token', 401));
    }

    // Check if user exists in our database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (userError && userError.code !== 'PGRST116') { // PGRST116 = no rows returned
      logger.error('Database error during auth', { error: userError });
      return next(new AppError('Authentication failed', 401));
    }

    // If user doesn't exist in our database, create them
    if (!userData) {
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            id: user.id,
            email: user.email,
          },
        ])
        .select()
        .single();

      if (createError) {
        logger.error('Failed to create user', { error: createError });
        return next(new AppError('Authentication failed', 401));
      }

      req.user = newUser;
    } else {
      req.user = userData;
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    return next(new AppError('Authentication failed', 401));
  }
};

module.exports = authMiddleware;
