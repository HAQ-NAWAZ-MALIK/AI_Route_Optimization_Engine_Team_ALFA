/**
 * Card Component
 * Container with consistent styling
 */

import { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    hover?: boolean;
}

export function Card({ children, hover = true, className = '', ...props }: CardProps) {
    const classes = `card ${!hover ? 'no-hover' : ''} ${className}`.trim();

    return (
        <div className={classes} {...props}>
            {children}
        </div>
    );
}

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
}

export function CardHeader({ children, className = '', ...props }: CardHeaderProps) {
    return (
        <div className={`card-header ${className}`.trim()} {...props}>
            {children}
        </div>
    );
}

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
    children: ReactNode;
}

export function CardTitle({ children, className = '', ...props }: CardTitleProps) {
    return (
        <h3 className={`card-title ${className}`.trim()} {...props}>
            {children}
        </h3>
    );
}

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
    children: ReactNode;
}

export function CardDescription({ children, className = '', ...props }: CardDescriptionProps) {
    return (
        <p className={`card-description ${className}`.trim()} {...props}>
            {children}
        </p>
    );
}
