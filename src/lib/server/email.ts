import { error } from '@sveltejs/kit';
import type { Config } from './config.ts';

export interface Mail {
	to: string;
	subject: string;
	text: string;
	html: string;
}

const esc = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
	);

function layout(title: string, body: string) {
	return `<!doctype html><html><body style="margin:0;background:#0B0C0E;padding:32px;font-family:Archivo,Helvetica,Arial,sans-serif;color:#F3F2ED">
<div style="max-width:480px;margin:0 auto;border:1px solid #24272D;padding:28px">
<div style="font-weight:900;font-style:italic;font-size:20px;letter-spacing:.02em">PACELINE</div>
<div style="height:4px;width:120px;background:#D4FF3A;margin:10px 0 24px"></div>
<h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1>
${body}
<p style="margin-top:28px;font-family:monospace;font-size:11px;letter-spacing:.12em;color:#8C929B">IF THIS WASN'T YOU, YOU CAN IGNORE THIS EMAIL.</p>
</div></body></html>`;
}

export function codeMail(to: string, code: string, purpose: 'verify' | 'mfa'): Mail {
	const subject =
		purpose === 'verify' ? 'Confirm your email for Paceline' : 'Your Paceline sign-in code';
	const lead =
		purpose === 'verify'
			? 'Enter this code to confirm your email.'
			: 'Someone is signing in from a new device. Enter this code to continue.';
	return {
		to,
		subject: `${code} · ${subject}`,
		text: `${lead}\n\n${code}\n\nIt expires in 10 minutes.`,
		html: layout(
			subject,
			`<p style="color:#B9BDC4;font-size:15px;line-height:1.5">${esc(lead)}</p>
<div style="font-family:monospace;font-size:34px;letter-spacing:.4em;background:#16181C;padding:16px 20px;margin:16px 0">${esc(code)}</div>
<p style="color:#8C929B;font-size:13px">It expires in 10 minutes.</p>`
		)
	};
}

export function resetMail(to: string, link: string): Mail {
	return {
		to,
		subject: 'Reset your Paceline password',
		text: `Use this link to choose a new password. It works once and expires in 30 minutes.\n\n${link}`,
		html: layout(
			'Reset your password',
			`<p style="color:#B9BDC4;font-size:15px;line-height:1.5">Use this link to choose a new password. It works once and expires in 30 minutes.</p>
<p><a href="${esc(link)}" style="display:inline-block;background:#D4FF3A;color:#0B0C0E;font-weight:800;padding:14px 20px;text-decoration:none">Choose a new password</a></p>`
		)
	};
}

export function existsMail(to: string, origin: string): Mail {
	return {
		to,
		subject: 'You already have a Paceline account',
		text: `Someone tried to create a Paceline account with this email. You already have one: sign in at ${origin}/login, or reset your password if you've forgotten it.`,
		html: layout(
			'You already have an account',
			`<p style="color:#B9BDC4;font-size:15px;line-height:1.5">Someone tried to create a Paceline account with this email. You already have one. <a style="color:#D4FF3A" href="${esc(origin)}/login">Sign in</a>, or reset your password if you've forgotten it.</p>`
		)
	};
}

/**
 * Send through Resend. In development without a key the message is logged and
 * the code handed back so the screen can show it.
 */
export async function send(cfg: Config, mail: Mail): Promise<void> {
	if (!cfg.resendKey) {
		if (cfg.dev) {
			console.info(`[paceline mail] to ${mail.to}: ${mail.subject}\n${mail.text}`);
			return;
		}
		error(503, 'Email is not configured yet.');
	}
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: { Authorization: `Bearer ${cfg.resendKey}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({
			from: cfg.emailFrom,
			to: [mail.to],
			subject: mail.subject,
			text: mail.text,
			html: mail.html
		})
	});
	if (!res.ok) {
		console.error('[paceline mail] Resend failed', res.status, await res.text().catch(() => ''));
		error(502, 'We couldn’t send the email. Try again in a minute.');
	}
}
