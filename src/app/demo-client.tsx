'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function DemoClient() {
    const [mapboxReady, setMapboxReady] = useState(false);
    const [markup, setMarkup] = useState('');

    useEffect(() => {
        let cancelled = false;

        fetch('/demo-next.fragment.html')
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load demo markup: ${response.status}`);
                }
                return response.text();
            })
            .then((html) => {
                if (!cancelled) setMarkup(html);
            })
            .catch((error) => {
                console.error(error);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!mapboxReady || !markup || typeof window === 'undefined') return;
        if ((window as any).__routeAiDemoInitialized) return;

        (window as any).__routeAiDemoInitialized = true;

        const script = document.createElement('script');
        script.src = '/demo-next.js';
        script.async = false;
        document.body.appendChild(script);
    }, [mapboxReady, markup]);

    return (
        <>
            <Script
                src="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js"
                strategy="afterInteractive"
                onLoad={() => setMapboxReady(true)}
            />
            <link href="https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css" rel="stylesheet" />
            <link href="/demo-next.css" rel="stylesheet" />
            <main className="route-ai-demo" dangerouslySetInnerHTML={{ __html: markup }} />
        </>
    );
}
