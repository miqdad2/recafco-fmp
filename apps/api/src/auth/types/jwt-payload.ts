export interface JwtPayload {
  sub: string;              // userId
  sessionId: string;        // UserSession.id — checked against DB on every request
  mustChangePassword: boolean; // for proxy navigation only; NestJS reads from live DB
  iat?: number;
  exp?: number;
}
