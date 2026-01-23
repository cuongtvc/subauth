// Framework-agnostic request/response types

export interface AuthRequest {
  method: string;
  path: string;
  body: Record<string, unknown>;
  headers: Record<string, string | undefined>;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface AuthResponse {
  status: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

export type Handler = (request: AuthRequest) => Promise<AuthResponse>;
