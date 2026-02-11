/**
 * Email Service Abstraction Layer
 * 
 * This provides a unified interface for sending emails.
 * Switch providers by changing the implementation without touching any business logic.
 */

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
}

export interface EmailProvider {
    sendEmail(options: EmailOptions): Promise<void>;
    sendPasswordReset(email: string, resetUrl: string, userName?: string): Promise<void>;
    sendEmailVerification(email: string, verificationUrl: string, userName?: string): Promise<void>;
    sendSubscriptionWelcome(email: string, plan: string, userName?: string): Promise<void>;
    sendPaymentFailed(email: string, userName?: string): Promise<void>;
}

/**
 * Base class for email providers
 * Provides common utility methods
 */
export abstract class BaseEmailProvider implements EmailProvider {
    protected defaultFrom: string;

    constructor() {
        this.defaultFrom = process.env.EMAIL_FROM || 'noreply@yourdomain.com';
    }

    abstract sendEmail(options: EmailOptions): Promise<void>;

    async sendPasswordReset(email: string, resetUrl: string, userName?: string): Promise<void> {
        const html = this.getPasswordResetTemplate(resetUrl, userName);
        await this.sendEmail({
            to: email,
            subject: 'Reset Your Password',
            html,
        });
    }

    async sendEmailVerification(email: string, verificationUrl: string, userName?: string): Promise<void> {
        const html = this.getEmailVerificationTemplate(verificationUrl, userName);
        await this.sendEmail({
            to: email,
            subject: 'Verify Your Email Address',
            html,
        });
    }

    async sendSubscriptionWelcome(email: string, plan: string, userName?: string): Promise<void> {
        const html = this.getSubscriptionWelcomeTemplate(plan, userName);
        await this.sendEmail({
            to: email,
            subject: `Welcome to ${plan} Plan!`,
            html,
        });
    }

    async sendPaymentFailed(email: string, userName?: string): Promise<void> {
        const html = this.getPaymentFailedTemplate(userName);
        await this.sendEmail({
            to: email,
            subject: 'Payment Failed - Action Required',
            html,
        });
    }

    // Email Templates
    private getPasswordResetTemplate(resetUrl: string, userName?: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Reset Your Password</h2>
        <p>Hi ${userName || 'there'},</p>
        <p>You requested to reset your password for your account. Click the button below to set a new password:</p>
        <a href="${resetUrl}" class="button">Reset Password</a>
        <p><small>Or copy and paste this link: ${resetUrl}</small></p>
        <p><strong>This link expires in 1 hour.</strong></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <div class="footer">
            <p>AI Transport Optimizer</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    private getEmailVerificationTemplate(verificationUrl: string, userName?: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Verify Your Email Address</h2>
        <p>Hi ${userName || 'there'},</p>
        <p>Welcome! Please verify your email address to get started:</p>
        <a href="${verificationUrl}" class="button">Verify Email</a>
        <p><small>Or copy and paste this link: ${verificationUrl}</small></p>
        <p><strong>This link expires in 24 hours.</strong></p>
        <div class="footer">
            <p>AI Transport Optimizer</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    private getSubscriptionWelcomeTemplate(plan: string, userName?: string): string {
        const features = plan === 'PRO'
            ? '10,000 API requests/month, Priority support, Advanced features'
            : plan === 'ENTERPRISE'
                ? 'Unlimited requests, Dedicated support, SLA guarantee, Custom integrations'
                : '100 API requests/month, Basic support';

        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .highlight { background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Welcome to ${plan} Plan!</h2>
        <p>Hi ${userName || 'there'},</p>
        <p>Thank you for subscribing to our <strong>${plan}</strong> plan!</p>
        <div class="highlight">
            <h3>Your Benefits:</h3>
            <p>${features}</p>
        </div>
        <p>Get started by creating your first API key in the portal.</p>
        <div class="footer">
            <p>AI Transport Optimizer</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    private getPaymentFailedTemplate(userName?: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .alert { background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Payment Failed</h2>
        <p>Hi ${userName || 'there'},</p>
        <div class="alert">
            <p><strong>We couldn't process your payment.</strong></p>
            <p>Please update your payment method to continue using our service.</p>
        </div>
        <p>If you don't update your payment within 3 days, your account will be downgraded to the free plan.</p>
        <div class="footer">
            <p>AI Transport Optimizer</p>
        </div>
    </div>
</body>
</html>
        `;
    }
}
