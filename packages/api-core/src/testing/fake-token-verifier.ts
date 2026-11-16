import { IdTokenVerifier, type VerifiedToken } from '../firebase/firebase-admin.module';

/**
 * Accepts tokens registered with `issue()`. In tests the bearer is just a label:
 * `verifier.issue('ada', { uid: 'u1', email: 'ada@example.com', email_verified: true })`.
 */
export class FakeTokenVerifier extends IdTokenVerifier {
    private readonly tokens = new Map<string, VerifiedToken>();

    issue(token: string, claims: VerifiedToken): this {
        this.tokens.set(token, claims);
        return this;
    }

    verifyIdToken(token: string): Promise<VerifiedToken> {
        const claims = this.tokens.get(token);
        return claims
            ? Promise.resolve(claims)
            : Promise.reject(
                  Object.assign(new Error('invalid token'), { code: 'auth/argument-error' }),
              );
    }
}
