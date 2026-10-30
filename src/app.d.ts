// See https://svelte.dev/docs/kit/types#app.d.ts
import type { UserDoc } from '#lib/server/auth.ts';

declare global {
	// Worker bindings and vars, read with `import { env } from 'cloudflare:workers'`.
	namespace Cloudflare {
		interface Env {
			DB: DurableObjectNamespace;
		}
	}

	namespace App {
		interface Error {
			message: string;
		}
		interface Locals {
			user: UserDoc | null;
		}
	}
}

export {};
