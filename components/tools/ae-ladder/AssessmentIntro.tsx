import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from '../../ui';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { Loader2, ArrowRight, ShieldCheck, Clock, CheckCircle2 } from 'lucide-react';

export const AssessmentIntro: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [isCompleted, setIsCompleted] = useState(false);
    const [completedDate, setCompletedDate] = useState<string | null>(null);

    useEffect(() => {
        const fetchStatus = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('ae_assessments')
                    .select('assessment_complete_flag, submitted_at')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (data) {
                    setIsCompleted(!!data.assessment_complete_flag);
                    if (data.submitted_at) {
                        setCompletedDate(new Date(data.submitted_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        }));
                    }
                }
            } catch (err) {
                console.error("Error fetching assessment status:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStatus();
    }, [user]);

    if (isLoading) {
        return (
            <Card className="p-8 min-h-[400px] flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-[var(--aos-brass)] animate-spin mb-4" />
                <h2 className="text-xl font-medium text-[var(--fg-1)]">Loading Assessment Status...</h2>
            </Card>
        );
    }

    return (
        <Card className="p-8 min-h-[500px] max-w-4xl mx-auto shadow-[var(--shadow-soft-1)] border border-[var(--aos-mist)]">
            {/* Header Block */}
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold text-[var(--fg-1)] mb-3 tracking-tight">AE Ladder Assessment</h1>
                <p className="text-lg text-[var(--fg-2)] max-w-2xl mx-auto leading-relaxed">
                    A diagnostic framework for identifying your agency's current stage of maturity across five core dimensions.
                </p>
            </div>

            {!isCompleted ? (
                // Pre-Completion State
                <div className="space-y-10 animate-in fade-in duration-500">
                    <div className="bg-[var(--bg-sunken)] border border-[var(--aos-mist)] rounded-xl p-6">
                        <h3 className="text-lg font-semibold text-[var(--fg-1)] mb-4 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-[var(--aos-brass)]" />
                            What This Assessment Measures
                        </h3>
                        <p className="text-[var(--fg-2)] mb-4 leading-relaxed">
                            Evaluate your operating reality across: <span className="font-medium text-[var(--fg-1)]">Financial & Business Health, Client Base & Market Positioning, Operational Efficiency & Scalability, Team Structure & Leadership, Strategic Stewardship.</span>
                        </p>
                        <ul className="space-y-2 text-[var(--fg-2)] bg-[var(--bg-surface)] p-4 rounded-lg border border-[var(--aos-mist)]">
                            <li className="flex items-start gap-2">
                                <ArrowRight className="w-4 h-4 text-[var(--aos-brass)] mt-1 shrink-0" />
                                <span>Produces a definitive <strong>stage assignment</strong>, <strong>dimension scores</strong>, <strong>signal identity</strong>, and tailored <strong>strategic focus priorities</strong>.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl p-6 shadow-[var(--shadow-soft-1)]">
                            <div className="flex items-center gap-3 mb-3 text-[var(--aos-brass)]">
                                <Clock className="w-5 h-5" />
                                <h4 className="font-semibold">Preparation</h4>
                            </div>
                            <p className="text-[var(--fg-2)] text-sm mb-3">
                                Set aside 15–20 minutes to complete this in one focused sitting.
                            </p>
                            <p className="text-[var(--fg-2)] text-sm">
                                Answer based on your agency's <em>current operational reality</em> — not where you're headed or what you're working toward. The accuracy of your results depends on honest self-assessment.
                            </p>
                        </div>

                        <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl p-6 shadow-[var(--shadow-soft-1)]">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <h4 className="font-semibold text-[var(--fg-1)]">Assessment Credit</h4>
                                <Badge color="green">1 available</Badge>
                            </div>
                            <p className="text-[var(--fg-2)] text-sm mb-3">
                                This assessment is designed to be taken once every 9–12 months. Your results establish a baseline that compounds in value over time.
                            </p>
                            <p className="text-[var(--fg-3)] text-xs italic border-t border-[var(--aos-mist)] pt-3">
                                Architect OS Pro members receive automatic stage updates and are prompted when a retake is recommended.
                            </p>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-[var(--aos-mist)] flex flex-col items-center">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto px-10 h-14 text-lg"
                            onClick={() => navigate('/diagnostics/ae-ladder/assessment')}
                        >
                            Start Assessment
                        </Button>
                    </div>
                </div>
            ) : (
                // Post-Completion State
                <div className="space-y-10 animate-in fade-in duration-500 max-w-2xl mx-auto text-center">

                    <div className="flex flex-col items-center justify-center p-8 bg-[var(--aos-success-tint)] border border-[var(--aos-success)] rounded-2xl">
                        <CheckCircle2 className="w-16 h-16 text-[var(--aos-success)] mb-4" />
                        <Badge color="green" className="text-sm px-3 py-1 mb-3">Assessment Completed</Badge>
                        <p className="text-[var(--fg-1)] font-medium">
                            {completedDate ? `Assessed on ${completedDate}` : 'Assessment processing complete.'}
                        </p>
                    </div>

                    <div className="bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-xl p-6 shadow-[var(--shadow-soft-1)] text-left">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-semibold text-[var(--fg-1)]">Assessment Credit: Used</h4>
                            <span className="text-xs font-medium text-[var(--fg-3)] bg-[var(--bg-sunken)] px-2 py-1 rounded">Next credit in 9 mo</span>
                        </div>
                        <p className="text-[var(--fg-2)] text-sm mb-3">
                            Your next assessment is recommended in 9–12 months. Results compound when retaken at the right interval.
                        </p>
                        <p className="text-[var(--fg-3)] text-xs italic border-t border-[var(--aos-mist)] pt-3">
                            Architect OS Pro members receive automatic stage updates and are prompted when a retake is recommended.
                        </p>
                    </div>

                    <div className="pt-4 flex flex-col items-center">
                        <Button
                            size="lg"
                            className="w-full sm:w-auto px-10 h-14 text-lg"
                            onClick={() => navigate('/diagnostics/ae-ladder/results-dashboard')}
                        >
                            View Results
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
};
