/**
 * Modal Component
 * Reusable modal/dialog overlay
 */

'use client';

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: ReactNode;
    showClose?: boolean;
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    showClose = true
}: ModalProps) {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="modal-overlay"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="modal"
                onClick={(e) => e.stopPropagation()}
            >
                {showClose && (
                    <button
                        className="modal-close"
                        onClick={onClose}
                        aria-label="Close modal"
                    >
                        ✕
                    </button>
                )}
                {title && (
                    <div className="modal-header">
                        <h2 className="modal-title">{title}</h2>
                    </div>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}
