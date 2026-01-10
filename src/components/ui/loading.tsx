/**
 * Loading Component
 * Loading spinner and skeleton states
 */

export interface LoadingProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
}

export function Loading({ size = 'md', text }: LoadingProps) {
    const sizes = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
    };

    return (
        <div className="flex flex-col items-center justify-center gap-3 p-8">
            <div className={`${sizes[size]} btn-spinner`} />
            {text && <p className="text-sm text-gray-400">{text}</p>}
        </div>
    );
}

export interface SkeletonProps {
    className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
    return (
        <div
            className={`animate-pulse bg-white/5 rounded ${className}`}
            style={{ animationDuration: '1.5s' }}
        />
    );
}
