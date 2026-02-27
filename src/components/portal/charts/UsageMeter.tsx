/**
 * Usage Meter Component
 * Visual progress bar showing API usage vs limits
 */

'use client';

export interface UsageMeterProps {
    current: number;
    limit: number;
    resetDate: Date;
    plan: string;
}

export function UsageMeter({ current, limit, resetDate, plan }: UsageMeterProps) {
    const percentage = limit === Infinity ? 0 : Math.min((current / limit) * 100, 100);

    // Color based on usage percentage
    let barColor = '#10b981'; // green
    let bgColor = '#d1fae5';

    if (percentage >= 95) {
        barColor = '#ef4444'; // red
        bgColor = '#fee2e2';
    } else if (percentage >= 80) {
        barColor = '#f59e0b'; // yellow
        bgColor = '#fef3c7';
    }

    const isUnlimited = limit === Infinity;
    const remaining = isUnlimited ? Infinity : Math.max(0, limit - current);

    return (
        <div className="usage-meter">
            <div className="usage-header">
                <h3>API Usage This Month</h3>
                <span className="plan-badge">{plan}</span>
            </div>

            <div className="usage-stats">
                <div className="stat">
                    <span className="stat-value">{current.toLocaleString()}</span>
                    <span className="stat-label">Requests Used</span>
                </div>
                {!isUnlimited && (
                    <>
                        <div className="stat">
                            <span className="stat-value">{remaining.toLocaleString()}</span>
                            <span className="stat-label">Remaining</span>
                        </div>
                        <div className="stat">
                            <span className="stat-value">{limit.toLocaleString()}</span>
                            <span className="stat-label">Total Limit</span>
                        </div>
                    </>
                )}
            </div>

            {!isUnlimited && (
                <>
                    <div className="progress-bar" style={{ backgroundColor: bgColor }}>
                        <div
                            className="progress-fill"
                            style={{
                                width: `${percentage}%`,
                                backgroundColor: barColor,
                            }}
                        />
                    </div>

                    <div className="usage-footer">
                        <span>{percentage.toFixed(1)}% used</span>
                        <span>Resets {formatResetDate(resetDate)}</span>
                    </div>
                </>
            )}

            {isUnlimited && (
                <div className="unlimited-badge">
                    <svg className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Unlimited Requests</span>
                </div>
            )}

            <style jsx>{`
                .usage-meter {
                    border: 1px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 20px;
                    background: white;
                }
                
                .usage-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .usage-header h3 {
                    margin: 0;
                    font-size: 16px;
                    font-weight: 600;
                    color: #111827;
                }
                
                .plan-badge {
                    padding: 4px 12px;
                    background: #6366f1;
                    color: white;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                }
                
                .usage-stats {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
                    gap: 16px;
                    margin-bottom: 20px;
                }
                
                .stat {
                    display: flex;
                    flex-direction: column;
                }
                
                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #111827;
                }
                
                .stat-label {
                    font-size: 12px;
                    color: #6b7280;
                    margin-top: 4px;
                }
                
                .progress-bar {
                    height: 12px;
                    border-radius: 6px;
                    overflow: hidden;
                    margin-bottom: 12px;
                }
                
                .progress-fill {
                    height: 100%;
                    transition: width 0.3s ease, background-color 0.3s ease;
                }
                
                .usage-footer {
                    display: flex;
                    justify-content: space-between;
                    font-size: 12px;
                    color: #6b7280;
                }
                
                .unlimited-badge {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 16px;
                    background: #d1fae5;
                    border-radius: 6px;
                    color: #065f46;
                    font-weight: 500;
                }
                
                .unlimited-badge .icon {
                    width: 20px;
                    height: 20px;
                }
            `}</style>
        </div>
    );
}

function formatResetDate(date: Date): string {
    const now = new Date();
    const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays < 7) return `in ${diffDays} days`;

    return `on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
