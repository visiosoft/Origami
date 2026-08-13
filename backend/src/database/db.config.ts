// DB requires explicit opt-in via DB_ENABLED=true env var
export const DB_ENABLED = process.env.DB_ENABLED === 'true';
