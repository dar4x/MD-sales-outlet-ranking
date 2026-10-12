export interface PingResponse {
  message: 'pong';
}

export interface HealthResponse {
  status: 'ok';
  database: 'up';
}
