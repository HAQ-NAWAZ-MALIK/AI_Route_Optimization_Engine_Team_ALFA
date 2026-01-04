/**
 * Button Component
 * Reusable button with multiple variants and sizes
 */

import { forwardRef, ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gradient';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            variant = 'primary',
            size = 'md',
            isLoading = false,
            children,
            className = '',
            disabled,
            ...props
        },
        ref
    ) => {
        const classes = `btn btn-${variant} btn-${size} ${className}`.trim();

        return (
            <button
                ref={ref}
                className={classes}
                disabled={isLoading || disabled}
                {...props}
            >
                {isLoading && <span className="btn-spinner" />}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
