<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from './Icon.svelte';
	import Kbd from './Kbd.svelte';
	import type { IconName } from './icons.ts';

	type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark' | 'onVolt';
	type Size = 'lg' | 'md' | 'sm' | 'xs';

	let {
		variant = 'secondary',
		size = 'md',
		icon,
		iconRight,
		kbd,
		href,
		iconOnly = false,
		class: cls = '',
		children,
		...rest
	}: HTMLButtonAttributes & {
		variant?: Variant;
		size?: Size;
		icon?: IconName;
		iconRight?: IconName;
		kbd?: string;
		href?: string;
		iconOnly?: boolean;
		class?: string;
		children?: Snippet;
	} = $props();

	const variants: Record<Variant, string> = {
		primary:
			'bg-accent border-accent text-accent-ink hover:bg-accent-hi hover:border-accent-hi font-extrabold',
		secondary: 'border-line-3 text-ink hover:bg-hover hover:border-ink-3 font-bold',
		ghost: 'border-transparent text-ink-3 hover:bg-hover hover:text-ink font-semibold',
		danger: 'border-flare/60 text-flare hover:bg-flare/12 font-bold',
		dark: 'bg-canvas border-canvas text-accent-text hover:bg-panel font-extrabold',
		onVolt: 'border-accent-ink/40 text-accent-ink hover:bg-accent-ink/10 font-bold'
	};
	const sizes: Record<Size, string> = {
		lg: 'h-11 px-4 text-sm gap-2.5',
		md: 'h-10 px-3.5 text-[13.5px] gap-2',
		sm: 'h-8 px-2.5 text-xs gap-1.5',
		xs: 'h-7 px-2 text-[11.5px] gap-1.5'
	};
	const iconSizes: Record<Size, string> = { lg: 'w-11', md: 'w-10', sm: 'w-8', xs: 'w-7' };

	const classes = $derived(
		[
			'inline-flex items-center justify-center rounded-xs border whitespace-nowrap transition-colors duration-150 select-none',
			'disabled:opacity-45 disabled:pointer-events-none',
			variants[variant],
			sizes[size],
			iconOnly ? `${iconSizes[size]} px-0` : '',
			cls
		].join(' ')
	);
</script>

{#if href}
	<a {href} class={classes} aria-label={rest['aria-label']}>
		{#if icon}<Icon name={icon} size={size === 'xs' ? 13 : 15} />{/if}
		{@render children?.()}
		{#if iconRight}<Icon name={iconRight} size={14} />{/if}
		{#if kbd}<Kbd>{kbd}</Kbd>{/if}
	</a>
{:else}
	<button type="button" class={classes} {...rest}>
		{#if icon}<Icon name={icon} size={size === 'xs' ? 13 : 15} />{/if}
		{@render children?.()}
		{#if iconRight}<Icon name={iconRight} size={14} />{/if}
		{#if kbd}<Kbd>{kbd}</Kbd>{/if}
	</button>
{/if}
