/**
 * Input Component
 * Form input with validation states
 */

import { forwardRef, InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, helper, className = '', ...props }, ref) => {
        const inputClasses = `input ${error ? 'input-error' : ''} ${className}`.trim();

        return (
            <div className="input-group">
                {label && (
                    <label className="input-label" htmlFor={props.id}>
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={inputClasses}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${props.id}-error` : undefined}
                    {...props}
                />
                {error && (
                    <p className="input-error-message" id={`${props.id}-error`}>
                        {error}
                    </p>
                )}
                {!error && helper && (
                    <p className="input-helper">{helper}</p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
