import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react'
import '../admin-brand.css'

type Variant = 'default' | 'primary' | 'ghost'

type Shared = {
  variant?: Variant
  size?: 'sm'
  className?: string
  children: ReactNode
}

type LinkProps = Shared & { href: string } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'className' | 'children'
  >
type ButtonProps = Shared & { href?: undefined } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'className' | 'children'
  >

function classes(variant: Variant, size: 'sm' | undefined, className: string): string {
  return [
    'nb-btn',
    variant !== 'default' ? `nb-btn--${variant}` : '',
    size ? `nb-btn--${size}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

/**
 * Brand action. Renders an anchor when `href` is given (navigation, works in
 * server components) or a native button otherwise (interactive, client only).
 * Same visual grammar either way.
 */
export function Button(props: LinkProps | ButtonProps) {
  const { variant = 'default', size, className = '', children } = props
  const cls = classes(variant, size, className)

  if (props.href !== undefined) {
    const { variant: _v, size: _s, className: _c, children: _ch, href, ...rest } = props
    return (
      <a className={cls} href={href} {...rest}>
        {children}
      </a>
    )
  }

  const { variant: _v, size: _s, className: _c, children: _ch, href: _h, ...rest } = props
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}
