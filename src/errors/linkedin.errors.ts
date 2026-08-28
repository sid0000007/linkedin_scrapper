export class LinkedInError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Our own session (li_at/JSESSIONID) is missing, malformed, or LinkedIn rejected it. */
export class LinkedInAuthError extends LinkedInError {}

/** LinkedIn returned 429, or a checkpoint/challenge response indicating we're throttled. */
export class LinkedInRateLimitError extends LinkedInError {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** The requested profile does not exist, or is not visible to the authenticated account. */
export class LinkedInProfileNotFoundError extends LinkedInError {}

/** LinkedIn responded with an unexpected status/shape we can't otherwise classify. */
export class LinkedInUpstreamError extends LinkedInError {
  constructor(
    message: string,
    public readonly statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** The provided input wasn't a usable LinkedIn member-profile URL. */
export class InvalidLinkedInUrlError extends LinkedInError {}
