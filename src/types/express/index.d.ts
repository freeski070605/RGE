declare namespace Express {
  interface Request {
    operator?: {
      email: string;
      name: string;
    };
    isInternalRequest?: boolean;
  }
}
