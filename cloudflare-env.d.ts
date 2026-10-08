declare namespace Cloudflare {
interface Env {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  GOOGLE_PLACES_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
}
}
