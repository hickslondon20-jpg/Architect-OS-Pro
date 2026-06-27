import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProgressIndicator } from './ProgressIndicator';
import { QuestionCard, Question } from './QuestionCard';
import { NavigationControls } from './NavigationControls';
import { Loader2, Lock, ArrowRight, ShieldCheck, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { ProgressBar, Card, Button, Badge } from '../../ui';
import { useAuth } from '../../../context/AuthContext';

const LoadingOverlay: React.FC<{ isVisible: boolean; isReady?: boolean; onComplete: () => void }> = ({ isVisible, isReady = false, onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [messageIndex, setMessageIndex] = useState(0);

    const messages = [
        "Analyzing your responses...",
        "Mapping dimensions to the Architect Evolution Ladder...",
        "Calculating capacity and risk scores...",
        "Synthesizing your Executive Summary...",
        "Finalizing your results..."
    ];

    const onCompleteRef = React.useRef(onComplete);

    useEffect(() => {
        onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
        if (!isVisible) {
            setProgress(0);
            setMessageIndex(0);
            return;
        }

        let currentProgress = 0;
        let isDone = false;

        const progressTimer = setInterval(() => {
            if (isDone) return;

            if (isReady) {
                currentProgress += 8; // Fast finish when ready
            } else {
                if (currentProgress < 90) {
                    currentProgress += 1.5; // Normal pace
                } else if (currentProgress < 95) {
                    currentProgress += 0.1; // Slow down while waiting
                }
            }

            setProgress(Math.min(currentProgress, 100));

            if (currentProgress >= 100) {
                clearInterval(progressTimer);
                isDone = true;
                setTimeout(() => {
                    if (onCompleteRef.current) onCompleteRef.current();
                }, 500);
            }
        }, 50);

        const messageTimer = setInterval(() => {
            if (!isReady) {
                setMessageIndex(prev => Math.min(prev + 1, messages.length - 1));
            }
        }, 1200);

        return () => {
            clearInterval(progressTimer);
            clearInterval(messageTimer);
            isDone = true;
        };
    }, [isVisible, isReady, messages.length]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300" style={{ backgroundColor: 'rgba(25, 48, 82, 0.4)' }}>
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-xl border border-[var(--aos-mist)] p-8 max-w-md w-full mx-4 text-center">
                <div className="bg-[var(--aos-brass-tint)] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="h-8 w-8 text-[var(--aos-brass)] animate-spin" />
                </div>

                <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">Generating Report</h3>

                <div className="h-14 flex items-center justify-center mb-6">
                    <p className="text-[var(--fg-2)] animate-in fade-in slide-in-from-bottom-2 duration-300" key={messageIndex}>
                        {messages[messageIndex]}
                    </p>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-[var(--fg-3)]">
                        <span>Progress</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <ProgressBar value={progress} max={100} className="h-2.5" />
                </div>
            </div>
        </div>
    );
};

export const AssessmentWizard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCompleted, setIsCompleted] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [responses, setResponses] = useState<number[]>([]);
    const [isSaved, setIsSaved] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tempValue, setTempValue] = useState<number | null>(null);
    const [animDirection, setAnimDirection] = useState<'left' | 'right' | 'none'>('none');

    // Fetch questions from Supabase on mount
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!user) return;
            try {
                setIsLoading(true);
                // 1. Fetch questions first so the UI can render
                // We do this outside the user check so that the layout doesn't crash if the user hasn't initialized their profile
                const { data: questionsData, error: questionsError } = await supabase
                    .from('ae_questions')
                    .select('*')
                    .order('display_order', { ascending: true });

                if (questionsError) throw questionsError;

                let mappedQuestions: Question[] = [];
                if (questionsData && questionsData.length > 0) {
                    mappedQuestions = questionsData.map((q: any) => ({
                        id: q.ae_question_id,
                        category: q.dimension_label,
                        text: q.prompt,
                        responseValue: null
                    }));
                    setQuestions(mappedQuestions);
                }

                // 2. Check completion status
                const { data: statusData, error: statusError } = await supabase
                    .from('ae_assessments')
                    .select('assessment_complete_flag, ae_assessment_id')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (statusError && statusError.code !== 'PGRST116') throw statusError;

                const userCompleted = statusData ? !!statusData.assessment_complete_flag : false;
                setIsCompleted(userCompleted);

                // 4. Check for existing active assessment to resume if not completed
                if (!userCompleted) {
                    // 5. Build response array matching questions
                    let currentResponses = Array(mappedQuestions.length).fill(null);
                    let activeId = null;

                    if (statusData && !statusData.assessment_complete_flag) {
                        // Found an incomplete assessment row, use it
                        activeId = statusData.ae_assessment_id;
                        setActiveAssessmentId(activeId);

                        // Fetch existing responses for this assessment
                        const { data: responsesData, error: responsesError } = await supabase
                            .from('ae_responses')
                            .select('ae_question_id, score')
                            .eq('ae_assessment_id', activeId);

                        if (!responsesError && responsesData) {
                            // Map existing responses back to the questions array index
                            mappedQuestions.forEach((q, index) => {
                                const savedResponse = responsesData.find(r => r.ae_question_id === q.id);
                                if (savedResponse) {
                                    currentResponses[index] = savedResponse.score;
                                }
                            });
                        }
                    }

                    setResponses(currentResponses);

                    // Auto-advance to the first unanswered question if resuming
                    const firstUnanswered = currentResponses.findIndex(r => r === null);
                    if (firstUnanswered > 0 && activeId) {
                        setCurrentQuestionIndex(firstUnanswered);
                        setHasStarted(true); // Skip welcome screen if resuming
                    }
                }
            } catch (err: any) {
                console.error("Error fetching AE Assessment data:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInitialData();
    }, [user]);

    useEffect(() => {
        // Prevent accessing out of bounds if questions aren't loaded yet
        if (questions.length > 0 && responses.length > 0) {
            const saved = responses[currentQuestionIndex];
            setTempValue(saved);
        }
        setAnimDirection('none');
    }, [currentQuestionIndex, responses, questions.length]);

    // Default early exit if empty or still loading initial data
    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-[var(--aos-brass)] animate-spin mb-4" />
                <h2 className="text-xl font-medium text-[var(--fg-1)]">Loading Assessment...</h2>
            </div>
        );
    }

    if (isCompleted) {
        return (
            <div className="w-full max-w-4xl mx-auto py-10 px-4 flex flex-col items-center justify-center min-h-[60vh]">
                <Card className="max-w-md w-full p-8 text-center flex flex-col items-center border border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)]">
                    <div className="w-16 h-16 bg-[var(--bg-sunken)] rounded-full flex items-center justify-center mb-6">
                        <Lock className="w-8 h-8 text-[var(--fg-4)]" />
                    </div>
                    <h3 className="text-2xl font-bold text-[var(--fg-1)] mb-3 tracking-tight">Assessment Complete</h3>
                    <p className="text-[var(--fg-2)] mb-8 leading-relaxed">
                        You've already completed your AE Ladder Assessment. Your results are ready to explore.
                    </p>
                    <div className="flex flex-col w-full gap-4">
                        <Button size="lg" onClick={() => navigate('/diagnostics/ae-ladder/results-dashboard')} className="w-full">
                            View Results
                        </Button>
                        <button
                            onClick={() => navigate('/diagnostics/mr-audit/overview')}
                            className="text-sm font-medium text-[var(--aos-brass)] hover:text-[var(--aos-brass-soft)] hover:underline flex items-center justify-center gap-1 group"
                        >
                            Ready to go deeper? Access the Maturity & Readiness Audit <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </Card>
            </div>
        );
    }

    if (!hasStarted) {
        return (
            <div className="w-full max-w-4xl mx-auto py-10 px-4 flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-500">
                <Card className="max-w-xl w-full p-10 text-center flex flex-col items-center border border-[var(--aos-mist)] shadow-[var(--shadow-soft-1)] rounded-2xl">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-[var(--fg-1)] mb-4 tracking-tight">AE Ladder Assessment</h2>
                        <p className="text-[var(--fg-2)] text-lg leading-relaxed">19 questions across 5 dimensions. Set aside 15–20 minutes.</p>
                    </div>

                    <div className="bg-[var(--bg-sunken)] border border-[var(--aos-mist)] rounded-xl px-5 py-3 mb-10 flex items-center justify-center gap-3 w-full">
                        <span className="text-[var(--fg-1)] font-medium">Assessment Credit:</span>
                        <Badge color="green">1 available</Badge>
                    </div>

                    <Button size="lg" className="w-full sm:w-auto px-12 h-14 text-lg" onClick={async () => {
                        setHasStarted(true);
                        try {
                            // Task 1: Initialize Assessment Context

                            const { data, error } = await supabase
                                .from('ae_assessments')
                                .insert({
                                    user_id: user.id,
                                    agency_id: user.user_metadata?.agency_id || null, // Best effort agency_id
                                    source: 'Assessment Tab',
                                    assessment_complete_flag: false
                                })
                                .select('ae_assessment_id')
                                .maybeSingle();

                            if (error) throw error;
                            if (data) setActiveAssessmentId(data.ae_assessment_id);
                        } catch (err: any) {
                            console.error("Error creating new assessment:", err.message || err);
                        }
                    }}>
                        Start Assessment
                    </Button>
                </Card>
            </div >
        );
    }

    if (!questions || questions.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center">
                <h2 className="text-xl font-medium text-[var(--fg-1)]">No questions found.</h2>
                <p className="text-[var(--fg-3)] mt-2">Database returned empty result.</p>
            </div>
        );
    }

    const currentQuestion = questions[currentQuestionIndex];
    const currentResponseValue = existingResponse(currentQuestionIndex) ?? tempValue;

    function existingResponse(index: number) {
        return responses[index] === null ? null : responses[index];
    }

    const handleSelect = (value: number) => {
        setTempValue(value);
        setIsSaved(false);
    };

    const handleSave = async () => {
        if (tempValue !== null) {
            const newResponses = [...responses];
            newResponses[currentQuestionIndex] = tempValue;
            setResponses(newResponses);

            // Task 2: Incremental Save
            if (activeAssessmentId && currentQuestion.id) {
                try {
                    // Using standard insert since upsert might require more complex unique constraints
                    // Let's first try to find if it exists, or just use upsert if ae_assessment_id + ae_question_id is unique
                    // Since schema unique constraints aren't explicitly known to be perfect for this, we'll delete and re-insert for safety or use a direct upsert if supported.
                    // Assuming standard behavior, we'll upsert (assuming unique constraint exists or we fallback)
                    const { error } = await supabase
                        .from('ae_responses')
                        .upsert({
                            ae_assessment_id: activeAssessmentId,
                            ae_question_id: currentQuestion.id,
                            score: tempValue
                        }, { onConflict: 'ae_assessment_id, ae_question_id' }); // Hint conflict column if it exists, otherwise might fail if not properly constrained. Let's try without conflict hint first, Supabase often infers it.

                    if (error) {
                        // Fallback manual update if upsert fails due to missing constraint
                        const { data: existingRecords } = await supabase
                            .from('ae_responses')
                            .select('ae_response_id')
                            .eq('ae_assessment_id', activeAssessmentId)
                            .eq('ae_question_id', currentQuestion.id)
                            .limit(1);

                        const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

                        if (existing) {
                            await supabase
                                .from('ae_responses')
                                .update({ score: tempValue })
                                .eq('ae_response_id', existing.ae_response_id);
                        } else {
                            await supabase
                                .from('ae_responses')
                                .insert({
                                    ae_assessment_id: activeAssessmentId,
                                    ae_question_id: currentQuestion.id,
                                    score: tempValue
                                });
                        }
                    }
                } catch (err) {
                    console.error("Error saving progress:", err);
                }
            }

            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        }
    };

    const handleNext = async () => {
        if (tempValue !== null) {
            const newResponses = [...responses];
            newResponses[currentQuestionIndex] = tempValue;
            setResponses(newResponses);

            // Auto-save on next
            if (activeAssessmentId && currentQuestion.id) {
                try {
                    const { data: existingRecords } = await supabase
                        .from('ae_responses')
                        .select('ae_response_id')
                        .eq('ae_assessment_id', activeAssessmentId)
                        .eq('ae_question_id', currentQuestion.id)
                        .limit(1);

                    const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

                    if (existing) {
                        await supabase
                            .from('ae_responses')
                            .update({ score: tempValue })
                            .eq('ae_response_id', existing.ae_response_id);
                    } else {
                        await supabase
                            .from('ae_responses')
                            .insert({
                                ae_assessment_id: activeAssessmentId,
                                ae_question_id: currentQuestion.id,
                                score: tempValue
                            });
                    }
                } catch (err) {
                    console.error("Error auto-saving progress:", err);
                }
            }
        }

        if (currentQuestionIndex < questions.length - 1) {
            setAnimDirection('left');
            setCurrentQuestionIndex(prev => prev + 1);
            setTempValue(null);
            setIsSaved(false);
        }
    };

    const handleBack = () => {
        if (currentQuestionIndex > 0) {
            setAnimDirection('right');
            setCurrentQuestionIndex(prev => prev - 1);
        }
    };

    const handleSubmit = async () => {
        if (tempValue !== null) {
            const newResponses = [...responses];
            newResponses[currentQuestionIndex] = tempValue;
            setResponses(newResponses);

            // Auto-save final question
            if (activeAssessmentId && currentQuestion.id) {
                try {
                    const { data: existingRecords } = await supabase
                        .from('ae_responses')
                        .select('ae_response_id')
                        .eq('ae_assessment_id', activeAssessmentId)
                        .eq('ae_question_id', currentQuestion.id)
                        .limit(1);

                    const existing = existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;

                    if (existing) {
                        await supabase
                            .from('ae_responses')
                            .update({ score: tempValue })
                            .eq('ae_response_id', existing.ae_response_id);
                    } else {
                        await supabase
                            .from('ae_responses')
                            .insert({
                                ae_assessment_id: activeAssessmentId,
                                ae_question_id: currentQuestion.id,
                                score: tempValue
                            });
                    }
                } catch (e) { console.error('Error saving final question', e) }
            }
        }

        setIsSubmitting(true);

        if (user && activeAssessmentId) {
            // Task 4: Submission Fixes
            await supabase.from('ae_assessments').update({
                assessment_complete_flag: true,
                submitted_at: new Date().toISOString()
            }).eq('ae_assessment_id', activeAssessmentId);
        }
    };

    // We handle submitting via the overlay now, so we remove the `if (isSubmitting)` return block


    return (
        <div className="w-full max-w-4xl mx-auto py-10 px-4">
            <LoadingOverlay
                isVisible={isSubmitting}
                onComplete={() => {
                    navigate('/diagnostics/ae-ladder/results-dashboard');
                    window.location.reload();
                }}
            />

            <ProgressIndicator
                currentStep={currentQuestionIndex}
                totalSteps={questions.length}
            />

            <div className="relative overflow-hidden min-h-[400px]">
                <QuestionCard
                    key={currentQuestion.id}
                    question={currentQuestion}
                    selectedValue={currentResponseValue}
                    onSelect={handleSelect}
                    direction={animDirection}
                />
            </div>

            <NavigationControls
                isFirst={currentQuestionIndex === 0}
                isLast={currentQuestionIndex === questions.length - 1}
                canNext={currentResponseValue !== null}
                canSave={currentResponseValue !== null}
                isSaved={isSaved}
                onBack={handleBack}
                onSave={handleSave}
                onNext={handleNext}
                onSubmit={handleSubmit}
            />
        </div>
    );
};

