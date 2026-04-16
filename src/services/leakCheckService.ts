export interface BreachResult {
  name: string;
  domain: string;
  breachDate: string;
  dataClasses: string[];
  description: string;
  pwnCount: number;
}

export async function checkEmailBreaches(
  email: string,
): Promise<{ breaches: BreachResult[]; error?: string }> {
  try {
    // HIBP v3 requires a paid API key for breachedaccount lookups.
    // For demo purposes we return realistic mock data so the UI can be
    // exercised without a key.  Replace with a real fetch when a key is
    // available.

    const mockBreaches: BreachResult[] = [
      {
        name: 'LinkedIn',
        domain: 'linkedin.com',
        breachDate: '2012-05-05',
        dataClasses: ['Email addresses', 'Passwords'],
        description:
          'In May 2012, LinkedIn had 164 million email addresses and passwords exposed.',
        pwnCount: 164_611_595,
      },
      {
        name: 'Adobe',
        domain: 'adobe.com',
        breachDate: '2013-10-04',
        dataClasses: ['Email addresses', 'Password hints', 'Passwords', 'Usernames'],
        description:
          'In October 2013, 153 million Adobe accounts were breached with each containing email, encrypted password and a password hint in plain text.',
        pwnCount: 152_445_165,
      },
      {
        name: 'Dropbox',
        domain: 'dropbox.com',
        breachDate: '2012-07-01',
        dataClasses: ['Email addresses', 'Passwords'],
        description:
          'In mid-2012, Dropbox suffered a data breach which exposed 68 million unique email addresses and bcrypt hashes of passwords.',
        pwnCount: 68_648_009,
      },
    ];

    // Deterministic subset based on email length so different emails show
    // different results for a more convincing demo.
    const count = (email.length % 3) + 1;
    const subset = mockBreaches.slice(0, count);

    // Simulated network delay
    await new Promise((r) => setTimeout(r, 1500));

    return { breaches: subset };
  } catch (err) {
    return { breaches: [], error: String(err) };
  }
}

export async function checkPasswordHash(
  password: string,
): Promise<{ found: boolean; count: number }> {
  // Uses the k-Anonymity model from HIBP Passwords API.
  // Only the first 5 characters of the SHA-1 hash are sent over the wire,
  // so the full password is never exposed.  This endpoint is free and
  // requires no API key.
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
    const text = await res.text();

    const lines = text.split('\n');
    for (const line of lines) {
      const [hash, count] = line.split(':');
      if (hash.trim() === suffix) {
        return { found: true, count: parseInt(count.trim(), 10) };
      }
    }
    return { found: false, count: 0 };
  } catch {
    return { found: false, count: 0 };
  }
}
