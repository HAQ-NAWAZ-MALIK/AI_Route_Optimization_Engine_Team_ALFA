/**
 * Email Service Factory
 * 
 * Central place to configure which email provider to use.
 * Change EMAIL_PROVIDER env variable to switch providers.
 */

import type { EmailProvider } from './email-provider';
import { ResendEmailProvider } from './providers/resend-provider';

// Add more providers here as needed:
// import { SendGridProvider } from './providers/sendgrid-provider';
// import { NodemailerProvider } from './providers/nodemailer-provider';

let emailServiceInstance: EmailProvider | null = null;

/**
 * Get the configured email service
 * Singleton pattern - one instance for the whole app
 */
export function getEmailService(): EmailProvider {
    if (!emailServiceInstance) {
        const provider = process.env.EMAIL_PROVIDER || 'resend';

        switch (provider.toLowerCase()) {
            case 'resend':
                emailServiceInstance = new ResendEmailProvider();
                break;

            // Add more providers here:
            // case 'sendgrid':
            //     emailServiceInstance = new SendGridProvider();
            //     break;
            // case 'nodemailer':
            //     emailServiceInstance = new NodemailerProvider();
            //     break;

            default:
                console.warn(`[Email] Unknown provider: ${provider}, defaulting to Resend`);
                emailServiceInstance = new ResendEmailProvider();
        }

        console.log(`[Email] Initialized with provider: ${provider}`);
    }

    return emailServiceInstance;
}

/**
 * Convenience exports for common email operations
 */
export const emailService = {
    sendPasswordReset: async (email: string, resetUrl: string, userName?: string) => {
        return getEmailService().sendPasswordReset(email, resetUrl, userName);
    },

    sendEmailVerification: async (email: string, verificationUrl: string, userName?: string) => {
        return getEmailService().sendEmailVerification(email, verificationUrl, userName);
    },

    sendSubscriptionWelcome: async (email: string, plan: string, userName?: string) => {
        return getEmailService().sendSubscriptionWelcome(email, plan, userName);
    },

    sendPaymentFailed: async (email: string, userName?: string) => {
        return getEmailService().sendPaymentFailed(email, userName);
    },

    sendCustomEmail: async (options: Parameters<EmailProvider['sendEmail']>[0]) => {
        return getEmailService().sendEmail(options);
    },
};
