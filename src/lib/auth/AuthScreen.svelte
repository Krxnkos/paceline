<script lang="ts">
	import { goto } from '$app/navigation';
	import Mark from '../ui/Mark.svelte';
	import Icon from '../ui/Icon.svelte';
	import Checkbox from '../ui/Checkbox.svelte';
	import { auth, PW_RULES, validEmail } from '../stores/auth.svelte.ts';
	import { workspace } from '../stores/workspace.svelte.ts';
	import { clock } from '../stores/clock.svelte.ts';
	import { fmtShort } from '../domain/dates.ts';
	import { inputLg } from '../ui/styles.ts';

	type Screen = 'signin' | 'signup' | 'code' | 'reset' | 'resetSent' | 'newPassword' | 'done';

	let {
		initial = 'signin',
		token = ''
	}: { initial?: 'signin' | 'signup' | 'reset'; token?: string } = $props();

	// A reset link (/reset?token=…) opens straight on the new-password form.
	// svelte-ignore state_referenced_locally
	let screen = $state<Screen>(token ? 'newPassword' : initial);
	let codeFor = $state<'verify' | 'mfa'>('mfa');
	let via = $state<'email' | 'new'>('email');
	let email = $state('');
	let password = $state('');
	let name = $state('');
	let code = $state('');
	let showPw = $state(false);
	let remember = $state(true);
	let terms = $state(false);
	let busy = $state(false);
	let resent = $state(false);
	let note = $state('');
	let errors = $state<Record<string, string | null>>({});

	const rules = $derived(PW_RULES.map((r) => r.test(password)));
	const score = $derived(rules.filter(Boolean).length);
	const segColor = $derived(
		score <= 1 ? 'bg-flare' : score === 2 ? 'bg-amber' : score === 3 ? 'bg-ink' : 'bg-accent'
	);

	function go(next: Screen, path?: string) {
		if (next === 'done' && auth.user) void workspace.load(auth.user.id);
		screen = next;
		errors = {};
		code = '';
		resent = false;
		note = '';
		if (path) history.replaceState(history.state, '', path);
	}

	async function submitSignin(e: SubmitEvent) {
		e.preventDefault();
		const er: Record<string, string> = {};
		if (!validEmail(email)) er.email = 'Enter a valid email address, like you@company.com.';
		if (password.length < 8) er.pw = 'Your password is at least 8 characters.';
		if (er.email || er.pw) return (errors = er);
		busy = true;
		const res = await auth.signIn(email, password, remember);
		busy = false;
		if (!res.ok) return (errors = { pw: res.error ?? 'Could not sign in.' });
		if (res.needCode) {
			codeFor = res.purpose ?? 'mfa';
			go('code');
		} else {
			via = 'email';
			go('done');
		}
	}

	async function submitSignup(e: SubmitEvent) {
		e.preventDefault();
		const er: Record<string, string> = {};
		if (name.trim().length < 2) er.name = 'Tell us your name.';
		if (!validEmail(email)) er.email = 'Enter a valid email address.';
		if (score < 4) er.pw = 'Meet all four rules to keep your plans safe.';
		if (!terms) er.terms = 'Accept the terms to continue.';
		if (Object.keys(er).length) return (errors = er);
		busy = true;
		const res = await auth.signUp(name, email, password);
		busy = false;
		if (!res.ok)
			return (errors =
				res.status === 400 && /password|rules/i.test(res.error ?? '')
					? { pw: res.error! }
					: { email: res.error ?? 'Could not create the account.' });
		codeFor = 'verify';
		go('code');
	}

	async function submitCode(e: SubmitEvent) {
		e.preventDefault();
		if (!/^\d{6}$/.test(code)) return (errors = { code: 'Enter all 6 digits.' });
		busy = true;
		const res = await auth.verifyCode(code);
		busy = false;
		if (!res.ok) return (errors = { code: res.error ?? 'That code isn’t right.' });
		via = codeFor === 'verify' ? 'new' : 'email';
		go('done');
	}

	async function submitReset(e: SubmitEvent) {
		e.preventDefault();
		if (!validEmail(email)) return (errors = { email: 'Enter the email you sign in with.' });
		busy = true;
		const res = await auth.requestReset(email);
		busy = false;
		if (!res.ok) return (errors = { email: res.error ?? 'Could not send the link.' });
		go('resetSent');
	}

	async function submitNewPassword(e: SubmitEvent) {
		e.preventDefault();
		if (score < 4) return (errors = { pw: 'Meet all four rules to keep your plans safe.' });
		busy = true;
		const res = await auth.resetPassword(token, password);
		busy = false;
		if (!res.ok) return (errors = { pw: res.error ?? 'Could not reset the password.' });
		password = '';
		go('signin', '/login');
		note = 'Password updated. Sign in with the new one.';
	}

	async function openToday() {
		if (auth.user) await workspace.load(auth.user.id);
		goto(workspace.data ? '/today' : '/onboarding');
	}

	const doneTitle = $derived(
		via === 'new'
			? `Welcome to the line, ${name.trim().split(' ')[0] || 'friend'}.`
			: 'Good to see you. You’re on pace.'
	);
	const preview = $derived.by(() => {
		const t =
			workspace.data?.tasks.filter((x) => x.status !== 'done' && !x.inbox && !x.quick).length ?? 0;
		const m = workspace.data?.meetings.filter((x) => x.date === clock.today).length ?? 0;
		return t
			? `${t} open task${t === 1 ? '' : 's'} and ${m} meeting${m === 1 ? '' : 's'} today. Your plan picks up where you left it.`
			: 'Start with an example plan or a blank one. You can change your mind later.';
	});
</script>

{#snippet pwField(
	autocomplete: 'current-password' | 'new-password',
	placeholder: string,
	meter: boolean
)}
	<label class="flex flex-col gap-2">
		<span class="font-mono text-[11px] tracking-[0.14em] text-muted">PASSWORD</span>
		<span
			class="flex border focus-within:border-accent {errors.pw ? 'border-flare' : 'border-line-3'}"
		>
			<input
				type={showPw ? 'text' : 'password'}
				{autocomplete}
				{placeholder}
				bind:value={password}
				oninput={() => (errors.pw = null)}
				aria-invalid={!!errors.pw}
				class="h-[46px] min-w-0 flex-1 bg-canvas px-3.5 text-base text-ink placeholder:text-faint focus:outline-none focus-visible:outline-none"
			/>
			<button
				type="button"
				onclick={() => (showPw = !showPw)}
				aria-label={showPw ? 'Hide password' : 'Show password'}
				class="w-[52px] border-l border-line font-mono text-[11px] text-ink-3 hover:text-ink"
				>{showPw ? 'HIDE' : 'SHOW'}</button
			>
		</span>
		{#if meter}
			<span class="mt-0.5 grid grid-cols-4 gap-1">
				{#each [1, 2, 3, 4] as n (n)}<span
						class="h-1 {password && score >= n ? segColor : 'bg-line'}"
					></span>{/each}
			</span>
			<span class="flex flex-wrap gap-x-3.5 gap-y-1.5 font-mono text-[11px] uppercase">
				{#each PW_RULES as r, i (r.label)}
					<span class={rules[i] ? 'text-accent-text' : 'text-faint'}
						>{rules[i] ? '■' : '□'} {r.label}</span
					>
				{/each}
			</span>
		{/if}
		{#if errors.pw}<span class="text-[13px] text-flare">{errors.pw}</span>{/if}
	</label>
{/snippet}

{#snippet emailField()}
	<label class="flex flex-col gap-2">
		<span class="font-mono text-[11px] tracking-[0.14em] text-muted">EMAIL</span>
		<input
			type="email"
			autocomplete="email"
			placeholder="you@company.com"
			bind:value={email}
			oninput={() => (errors.email = null)}
			aria-invalid={!!errors.email}
			class={inputLg}
		/>
		{#if errors.email}<span class="text-[13px] text-flare">{errors.email}</span>{/if}
	</label>
{/snippet}

{#snippet localCode()}
	{#if auth.devCode}
		<div
			class="border border-dashed border-line-3 px-3.5 py-3 font-mono text-[11px] leading-relaxed tracking-[0.08em] text-muted uppercase"
		>
			Development · no email provider is set.<br />Your code is
			<span class="text-[14px] tracking-[0.3em] text-accent-text">{auth.devCode}</span>
		</div>
	{/if}
{/snippet}

<div class="flex min-h-dvh flex-wrap bg-canvas text-ink">
	<aside
		class="relative flex min-w-0 flex-[1_1_520px] flex-col justify-between gap-10 overflow-hidden border-line px-6 py-8 sm:px-14 sm:py-10 lg:border-r"
	>
		<div class="flex items-center gap-3.5">
			<Mark width={54} label="Paceline" />
			<span class="text-2xl display">PACELINE</span>
		</div>

		<div class="flex flex-col gap-[22px]">
			<div class="flex items-center gap-3 font-mono text-[11px] tracking-[0.16em] text-muted">
				<span class="text-accent-text">05</span><span class="inline-block h-px w-9 bg-line-3"
				></span>SIGN IN
			</div>
			<h1 class="m-0 text-[40px] heavy sm:text-[58px]">
				Every hour,<br /><span class="text-accent-text">in formation.</span>
			</h1>
			<p class="m-0 max-w-[460px] text-[17px] leading-relaxed text-ink-3">
				Your priorities, schedule and forecast pick up where you left them, on any device.
			</p>

			<div class="mt-2.5 hidden max-w-[460px] border border-line sm:block">
				<div
					class="flex justify-between border-b border-line px-4 py-3 font-mono text-[10px] tracking-[0.14em] text-muted"
				>
					<span>WAITING FOR YOU</span><span>{fmtShort(clock.today).toUpperCase()}</span>
				</div>
				<div
					class="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2.5 border-b border-line px-4 py-3"
				>
					<span class="font-mono text-xs text-muted">09:00</span><span class="text-sm text-ink-2"
						>Team stand-up</span
					>
				</div>
				<div
					class="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2.5 border-b border-line bg-surface px-4 py-3"
				>
					<span class="font-mono text-xs text-accent-text">09:30</span><span
						class="text-sm font-bold">Your lead block</span
					>
				</div>
				<div class="grid grid-cols-[58px_minmax(0,1fr)] items-center gap-2.5 px-4 py-3">
					<span class="font-mono text-xs text-muted">11:00</span><span
						class="text-sm text-ink-2 italic">Whatever’s next in line</span
					>
				</div>
			</div>
		</div>

		<div class="flex flex-col gap-3.5">
			<svg
				width="100%"
				height="34"
				viewBox="0 0 600 34"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<g transform="skewX(-14)">
					<rect x="10" y="0" width="150" height="6" fill="var(--line)"></rect>
					<rect x="12" y="13" width="260" height="6" fill="var(--line-3)"></rect>
					<rect x="14" y="26" width="420" height="6" fill="var(--accent)"></rect>
				</g>
			</svg>
			<div class="font-mono text-[10px] tracking-[0.14em] text-faint">
				DOC. PL-0005 · ACCESS · YOUR DATA STAYS YOURS — EXPORT OR DELETE IT ANY TIME
			</div>
		</div>
	</aside>

	<main
		class="flex min-w-0 flex-[1_1_460px] flex-col items-center justify-center px-6 py-10 sm:px-8"
	>
		<div class="flex w-full max-w-[420px] flex-col gap-[26px]">
			{#if screen === 'signin'}
				<form onsubmit={submitSignin} novalidate class="flex flex-col gap-[18px]">
					<div class="flex flex-col gap-2">
						<h2 class="m-0 text-[30px] font-extrabold wide">Sign in</h2>
						<p class="m-0 text-[15px] text-ink-3">
							New here? <button
								type="button"
								class="pl-link"
								onclick={() => go('signup', '/signup')}>Create an account</button
							>
						</p>
					</div>
					{#if note}<div
							role="status"
							class="border-l-2 border-accent bg-surface px-3.5 py-2.5 text-sm"
						>
							{note}
						</div>{/if}
					<div class="grid grid-cols-2 gap-2.5">
						<button
							type="button"
							onclick={() =>
								(note = 'Passkeys aren’t available yet. Sign in with your email and password.')}
							class="inline-flex h-12 items-center justify-center gap-2.5 bg-ink text-sm font-bold text-canvas hover:opacity-90"
							><Icon name="key" />Use a passkey</button
						>
						<button
							type="button"
							onclick={() =>
								(note = 'Work SSO isn’t available yet. Sign in with your email and password.')}
							class="inline-flex h-12 items-center justify-center gap-2.5 border border-line-3 text-sm font-bold text-ink hover:bg-hover"
							><Icon name="sso" />Work SSO</button
						>
					</div>
					<div class="flex items-center gap-3 font-mono text-[11px] tracking-[0.14em] text-faint">
						<span class="h-px flex-1 bg-line"></span>OR WITH EMAIL<span class="h-px flex-1 bg-line"
						></span>
					</div>
					{@render emailField()}
					{@render pwField('current-password', 'At least 8 characters', false)}
					<div class="flex items-center justify-between">
						<span class="inline-flex min-h-11 items-center gap-2.5 text-sm text-ink-2">
							<Checkbox
								checked={remember}
								label="Trust this device for 30 days"
								size={18}
								onchange={() => (remember = !remember)}
							/>
							<button type="button" onclick={() => (remember = !remember)}
								>Trust this device for 30 days</button
							>
						</span>
						<button type="button" class="pl-link" onclick={() => go('reset', '/reset')}
							>Forgot password?</button
						>
					</div>
					<button type="submit" disabled={busy} class="pl-primary"
						>Continue <Icon name="arrowRight" size={15} stroke={2.4} /></button
					>
				</form>
			{:else if screen === 'signup'}
				<form onsubmit={submitSignup} novalidate class="flex flex-col gap-[18px]">
					<div class="flex flex-col gap-2">
						<h2 class="m-0 text-[30px] font-extrabold wide">Create your account</h2>
						<p class="m-0 text-[15px] text-ink-3">
							Already have one? <button
								type="button"
								class="pl-link"
								onclick={() => go('signin', '/login')}>Sign in</button
							>
						</p>
					</div>
					<label class="flex flex-col gap-2">
						<span class="font-mono text-[11px] tracking-[0.14em] text-muted">YOUR NAME</span>
						<input
							autocomplete="name"
							placeholder="First and last name"
							bind:value={name}
							oninput={() => (errors.name = null)}
							aria-invalid={!!errors.name}
							class={inputLg}
						/>
						{#if errors.name}<span class="text-[13px] text-flare">{errors.name}</span>{/if}
					</label>
					{@render emailField()}
					{@render pwField('new-password', '12+ characters', true)}
					<div class="flex flex-col gap-1.5">
						<span
							class="inline-flex min-h-11 items-start gap-2.5 text-left text-sm leading-snug text-ink-2"
						>
							<span class="mt-0.5"
								><Checkbox
									checked={terms}
									size={18}
									label="Agree to the terms"
									onchange={() => ((terms = !terms), (errors.terms = null))}
								/></span
							>
							<button
								type="button"
								class="text-left"
								onclick={() => ((terms = !terms), (errors.terms = null))}
								>I agree to the Terms and the Privacy notice. Paceline never sells or shares your
								plans.</button
							>
						</span>
						{#if errors.terms}<span class="text-[13px] text-flare">{errors.terms}</span>{/if}
					</div>
					<button type="submit" disabled={busy} class="pl-primary">Create account</button>
				</form>
			{:else if screen === 'code'}
				<form onsubmit={submitCode} novalidate class="flex flex-col gap-[18px]">
					<div class="font-mono text-[11px] tracking-[0.16em] text-accent-text">
						{codeFor === 'verify' ? 'STEP 2 OF 2 · VERIFY EMAIL' : 'STEP 2 OF 2 · NEW DEVICE'}
					</div>
					<div class="flex flex-col gap-2">
						<h2 class="m-0 text-[30px] font-extrabold wide">
							{codeFor === 'verify' ? 'Confirm your email' : 'Check it’s you'}
						</h2>
						<p class="m-0 text-[15px] leading-normal text-ink-3">
							We sent a 6-digit code to {email || 'your email'}. It expires in 10 minutes.
						</p>
					</div>
					<label class="flex flex-col gap-2">
						<span class="font-mono text-[11px] tracking-[0.14em] text-muted">6-DIGIT CODE</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							autofocus
							inputmode="numeric"
							autocomplete="one-time-code"
							maxlength="6"
							placeholder="000000"
							value={code}
							oninput={(e) => {
								code = e.currentTarget.value.replace(/\D/g, '').slice(0, 6);
								e.currentTarget.value = code;
								errors.code = null;
							}}
							aria-invalid={!!errors.code}
							class="h-[60px] border bg-canvas px-4 font-mono text-[28px] tracking-[0.5em] text-ink placeholder:text-faint focus:border-accent focus:outline-none {errors.code
								? 'border-flare'
								: 'border-line-3'}"
						/>
						{#if errors.code}<span class="text-[13px] text-flare">{errors.code}</span>{/if}
					</label>
					{@render localCode()}
					<button type="submit" class="pl-primary">Verify</button>
					<div class="flex items-center justify-between text-sm">
						<button
							type="button"
							class="pl-link"
							onclick={() => (auth.cancelPending(), go('signin', '/login'))}>Back</button
						>
						<button type="button" class="pl-link" onclick={() => (auth.resend(), (resent = true))}
							>{resent ? 'Code sent again' : 'Resend code'}</button
						>
					</div>
				</form>
			{:else if screen === 'reset'}
				<form onsubmit={submitReset} novalidate class="flex flex-col gap-[18px]">
					<div class="flex flex-col gap-2">
						<h2 class="m-0 text-[30px] font-extrabold wide">Reset your password</h2>
						<p class="m-0 text-[15px] leading-normal text-ink-3">
							We’ll email a link that works once and expires in 30 minutes.
						</p>
					</div>
					{@render emailField()}
					<button type="submit" class="pl-primary">Send reset link</button>
					<button type="button" class="pl-link self-start" onclick={() => go('signin', '/login')}
						>Back to sign in</button
					>
				</form>
			{:else if screen === 'resetSent'}
				<div role="status" class="flex flex-col gap-[18px]">
					<div
						class="flex size-[52px] items-center justify-center border border-accent text-accent-text"
					>
						<Icon name="mail" size={24} />
					</div>
					<h2 class="m-0 text-[30px] font-extrabold wide">Check your inbox</h2>
					<p class="m-0 text-[15px] leading-relaxed text-ink-3">
						If an account exists for <strong class="text-ink">{email}</strong>, a reset link is on
						its way. For your security we don’t confirm whether an address is registered.
					</p>
					<button
						type="button"
						class="h-12 border border-line-3 text-sm font-bold text-ink hover:bg-hover"
						onclick={() => go('signin', '/login')}>Back to sign in</button
					>
				</div>
			{:else if screen === 'newPassword'}
				<form onsubmit={submitNewPassword} novalidate class="flex flex-col gap-[18px]">
					<div class="flex flex-col gap-2">
						<h2 class="m-0 text-[30px] font-extrabold wide">Choose a new password</h2>
						<p class="m-0 text-[15px] leading-normal text-ink-3">
							The link works once. Every other device is signed out.
						</p>
					</div>
					{@render pwField('new-password', '12+ characters', true)}
					<button type="submit" disabled={busy} class="pl-primary">Save password</button>
				</form>
			{:else if screen === 'done'}
				<div role="status" class="flex flex-col gap-[18px]">
					<div
						class="flex items-center gap-2.5 font-mono text-[11px] tracking-[0.16em] text-accent-text"
					>
						<span class="inline-block size-[7px] bg-accent"></span>{via === 'new'
							? 'ACCOUNT CREATED'
							: 'SIGNED IN'}
					</div>
					<h2 class="m-0 text-[38px] heavy leading-none">{doneTitle}</h2>
					<p class="m-0 text-[15px] leading-relaxed text-ink-3">{preview}</p>
					<button type="button" class="pl-primary" onclick={openToday}>
						{workspace.data ? 'Open today' : 'Set up your plan'}
						<Icon name="arrowRight" size={15} stroke={2.4} />
					</button>
					<button
						type="button"
						class="pl-link self-start"
						onclick={async () => {
							await auth.signOut();
							workspace.unload();
							password = '';
							go('signin', '/login');
						}}>Sign out</button
					>
				</div>
			{/if}

			<div
				class="grid grid-cols-3 gap-3 border-t border-line pt-4 font-mono text-[10px] leading-normal tracking-[0.08em] text-muted"
			>
				<span>2-STEP CHECK ON NEW DEVICES</span>
				<span>5 WRONG TRIES = 15 MIN LOCK</span>
				<span>SESSIONS END AFTER 30 DAYS</span>
			</div>
		</div>
	</main>
</div>

<style>
	.pl-link {
		background: none;
		border: 0;
		padding: 0;
		color: var(--accent-text);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.pl-primary {
		display: inline-flex;
		height: 52px;
		align-items: center;
		justify-content: center;
		gap: 10px;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 15px;
		font-weight: 800;
		transition: background 150ms;
	}
	.pl-primary:hover {
		background: var(--accent-hi);
	}
	.pl-primary:disabled {
		opacity: 0.6;
	}
</style>
