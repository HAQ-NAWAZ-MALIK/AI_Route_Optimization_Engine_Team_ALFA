import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
    title: 'AI Transport Optimizer',
    description: 'Multi-algorithm route optimization with real road routing',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body className="antialiased">{children}</body>
        </html>
    );
}
