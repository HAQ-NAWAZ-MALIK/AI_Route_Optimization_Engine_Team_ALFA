/**
 * Badge Component
 * Status indicators with different variants
 */

import { HTMLAttributes, ReactNode } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    children: ReactNode;
}

export function Badge({
    variant = 'neutral',
    children,
    className = '',
    ...props
}: BadgeProps) {
    const classes = `badge badge-${variant} ${className}`.trim();

    return (
        <span className={classes} {...props}>
            {children}
        </span>
    );
}
