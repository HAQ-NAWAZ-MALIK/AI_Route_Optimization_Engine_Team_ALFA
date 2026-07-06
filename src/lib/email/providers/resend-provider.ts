/**
 * Resend Email Provider Implementation
 * 
 * To switch to another provider (SendGrid, Nodemailer, etc.):
 * 1. Create a new class extending BaseEmailProvider
 * 2. Implement the sendEmail method
 * 3. Update the factory in email-service.ts
 */

import { Resend } from 'resend';
import { BaseEmailProvider, EmailOptions } from '../email-provider';

export class ResendEmailProvider extends BaseEmailProvider {
    private resend: Resend;

    constructor() {
        super();

        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            console.warn('[Email] RESEND_API_KEY not set - emails will not be sent');
        }

        this.resend = new Resend(apiKey || 'dummy-key');
    }

    async sendEmail(options: EmailOptions): Promise<void> {
        try {
            if (!process.env.RESEND_API_KEY) {
                console.log('[Email] Simulated email:', {
                    to: options.to,
                    subject: options.subject,
                    from: options.from || this.defaultFrom,
                });
                return;
            }

            await this.resend.emails.send({
                from: options.from || this.defaultFrom,
                to: Array.isArray(options.to) ? options.to : [options.to],
                subject: options.subject,
                html: options.html,
                text: options.text,
            });

            console.log(`[Email] Sent: ${options.subject} to ${options.to}`);
        } catch (error) {
            console.error('[Email] Failed to send:', error);
            throw new Error('Failed to send email');
        }
    }
}
