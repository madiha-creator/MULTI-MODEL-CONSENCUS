/**
 * Structured error mapping for provider calls — the constitution's
 * "handle errors with structured responses" rule at the AI boundary.
 * A failed agent must degrade to a visible ABSTAIN with a reason, never
 * crash the round (Promise.allSettled in agentBroker relies on that shape).
 */
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError,
  BadRequestError,
  APIError,
} from 'groq-sdk';

export interface ProviderError {
  /** Stable machine code the UI can switch on. */
  code:
    | 'not_configured'
    | 'auth'
    | 'rate_limited'
    | 'bad_request'
    | 'provider_unavailable'
    | 'timeout'
    | 'parse_failed'
    | 'unknown';
  message: string;
  retryable: boolean;
}

/**
 * Maps an unknown thrown value (SDK error or otherwise) to ProviderError.
 * Uses typed SDK classes — never string-matching error messages (skill rule).
 */
export function toProviderError(error: unknown): ProviderError {
  if (error instanceof AuthenticationError) {
    return { code: 'auth', message: 'Invalid or missing GROQ_API_KEY', retryable: false };
  }
  if (error instanceof RateLimitError) {
    return { code: 'rate_limited', message: 'Provider rate limit hit — retry next round', retryable: true };
  }
  if (error instanceof APIConnectionTimeoutError) {
    return { code: 'timeout', message: 'Provider call timed out', retryable: true };
  }
  if (error instanceof APIConnectionError) {
    return { code: 'provider_unavailable', message: 'Cannot reach the Groq API', retryable: true };
  }
  if (error instanceof BadRequestError) {
    return { code: 'bad_request', message: `Provider rejected the request: ${error.message}`, retryable: false };
  }
  if (error instanceof APIError) {
    return {
      code: error.status >= 500 ? 'provider_unavailable' : 'unknown',
      message: `Provider error (HTTP ${error.status}): ${error.message}`,
      retryable: error.status >= 500,
    };
  }
  return {
    code: 'unknown',
    message: error instanceof Error ? error.message : 'Unknown provider failure',
    retryable: false,
  };
}
