// When DB_HOST isn't configured, the app runs in-memory (no TypeORM) so it
// never crash-loops on a host without database settings. Set the DB_* env vars
// (App Service application settings) to switch to the real Azure SQL backend.
export const DB_ENABLED = !!process.env.DB_HOST;
