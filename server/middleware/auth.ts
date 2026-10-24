import { Request, Response, NextFunction } from 'express';
import { verifyJwt, JwtPayload } from '../utils/jwt.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'enatagar_secret_maternal_jwt_2025_secure';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required. Please log in.' });
    return;
  }

  try {
    const decoded = verifyJwt(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(403).json({ error: 'Invalid or expired token.' });
    return;
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ 
        error: `Access denied. Requires one of the following roles: ${roles.join(', ')}` 
      });
      return;
    }

    next();
  };
}
