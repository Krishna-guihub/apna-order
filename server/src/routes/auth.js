import { Router } from 'express';
import { login, me, logout } from '../controllers/authController.js';
import { loginLimiter } from '../middleware/rateLimiters.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validation/schemas.js';
import { optionalAuthenticate } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', loginLimiter, validate(loginSchema), login);
authRouter.get('/me', optionalAuthenticate, me);
authRouter.post('/logout', logout);
