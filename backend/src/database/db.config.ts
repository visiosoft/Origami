// DB is enabled only when DB_HOST is set AND DB_SKIP is not 'true'
export const DB_ENABLED = !!process.env.DB_HOST && process.env.DB_SKIP !== 'true';
