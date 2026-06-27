import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuditNavigation } from './AuditNavigation';
import { CapabilityCard } from './shared/CapabilityCard';
import { DimensionTransition } from './shared/DimensionTransition';
import { useAuth } from '../../../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { ProgressBar } from '../../ui';
import {
    getUserGMStage,
    getGMAuditScreens,
    buildTransitionScreens,
    createOrResumeGMAssessment,
    loadSavedResponses,
    saveResponses,
    submitAssessment,
    GMCapabilityScreen,
    GMTransitionScreen,
} from '../../../lib/gm-audit';

// ─────────────────────────────────────────────────────────────────────────────
// Loading Overlay
// ─────────────────────────────────────────────────────────────────────────────

const GMAuditLoadingOverlay: React.FC<{
    isVisible: boolean;
    isReady: boolean;
    onComplete: () => void;
}> = ({ isVisible, isReady, onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [messageIndex, setMessageIndex] = useState(0);
    const onCompleteRef = useRef(onComplete);

    const messages = [
        'Saving your responses...',
        'Scoring all 125 checkpoints...',
        'Calculating capability scores...',
        'Computing dimension & pillar results...',
        'Finalising your Growth Mastery report...',
    ];

    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    useEffect(() => {
        if (!isVisible) { setProgress(0); setMessageIndex(0); return; }

        let current = 0;
        let done = false;

        const progressTimer = setInterval(() => {
            if (done) return;
            if (isReady) {
                current += 8; // fast-finish once scoring is complete
            } else {
                if (current < 88) current += 1.2;
                else if (current < 95) current += 0.08; // hold while waiting
            }
            setProgress(Math.min(current, 100));
            if (current >= 100) {
                clearInterval(progressTimer);
                done = true;
                setTimeout(() => onCompleteRef.current?.(), 500);
            }
        }, 50);

        const msgTimer = setInterval(() => {
            if (!isReady) setMessageIndex(p => Math.min(p + 1, messages.length - 1));
        }, 1400);

        return () => { clearInterval(progressTimer); clearInterval(msgTimer); done = true; };
    }, [isVisible, isReady, messages.length]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-300" style={{ backgroundColor: 'rgba(25, 48, 82, 0.5)' }}>
            <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--aos-mist)] p-8 max-w-md w-full mx-4 text-center">
                {/* Icon */}
                <div className="bg-[var(--aos-brass-tint)] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="h-8 w-8 text-[var(--aos-brass)] animate-spin" />
                </div>

                <h3 className="text-xl font-bold text-[var(--fg-1)] mb-2">Analysing Your Results</h3>

                {/* Rotating message */}
                <div className="h-12 flex items-center justify-center mb-6">
                    <p
                        key={messageIndex}
                        className="text-[var(--fg-2)] text-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                        {messages[messageIndex]}
                    </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-[var(--fg-3)]">
                        <span>Progress</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <ProgressBar value={progress} max={100} className="h-2.5" />
                </div>

                <p className="text-xs text-[var(--fg-3)] mt-4">
                    Your Growth Mastery profile is being generated.
                </p>
            </div>
        </div>
    );
};


interface StageInfo {
    aeStageId: string;
    gmStageId: string;
    stageName: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const AssessmentWizard: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // ── Loading states ──────────────────────────────────────────────────────
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitReady, setSubmitReady] = useState(false); // true = overlay fast-finishes

    // ── Session data from Supabase ──────────────────────────────────────────
    const [stageInfo, setStageInfo] = useState<StageInfo | null>(null);
    const [assessmentId, setAssessmentId] = useState<string | null>(null);
    const [capabilityScreens, setCapabilityScreens] = useState<GMCapabilityScreen[]>([]);
    const [transitionScreens, setTransitionScreens] = useState<GMTransitionScreen[]>([]);

    // ── Wizard navigation state ─────────────────────────────────────────────
    // currentStep: 1-indexed absolute position across all screens
    // Steps are interleaved: 5 cap screens per dim, then 1 transition, repeat
    // Pattern: screens 1-5 (D1 caps), 6 (transition), 7-11 (D2 caps), 12 (transition), ...
    const [currentStep, setCurrentStep] = useState(1);
    const [furthestStep, setFurthestStep] = useState(1);
    const [completedDimensions, setCompletedDimensions] = useState<number[]>([]);

    // ── Response state ──────────────────────────────────────────────────────
    // Key: question ID (gm_audit_question_id), Value: 'Y' | 'S' | 'N'
    const [responses, setResponses] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);

    // ── Derived: question → checkpoint lookup used by saveResponses() ──────
    // Built inline from loaded screens: { [gm_audit_question_id]: gm_checkpoint_id }
    const questionCheckpointMap: Record<string, string> = {};
    capabilityScreens.forEach(screen => {
        screen.checkpoints.forEach(cp => { questionCheckpointMap[cp.id] = cp.checkpointId; });
    });

    // ── Derived constants ───────────────────────────────────────────────────
    const TOTAL_CAPABILITIES = 25;
    const TOTAL_TRANSITIONS = 4; // After D1, D2, D3, D4
    const TOTAL_STEPS = TOTAL_CAPABILITIES + TOTAL_TRANSITIONS; // 29

    // ─────────────────────────────────────────────────────────────────────────
    // Step helpers (same logic as original wizard)
    // ─────────────────────────────────────────────────────────────────────────

    const isTransitionStep = useCallback((step: number) => step % 6 === 0, []);

    const getCapabilityIndex = useCallback((step: number) => {
        const transitionsPassed = Math.floor((step - 1) / 6);
        return (step - 1) - transitionsPassed;
    }, []);

    const getTransitionIndex = useCallback((step: number) => (step / 6) - 1, []);

    const isTransition = isTransitionStep(currentStep);
    const capabilityIndex = getCapabilityIndex(currentStep);
    const transitionIndex = getTransitionIndex(currentStep);

    const currentCapabilityData = capabilityScreens[capabilityIndex];
    const currentTransitionData = transitionScreens[transitionIndex];

    // Current dimension 1-5 (for navigation highlighting)
    const currentDimensionOrder = isTransition
        ? currentTransitionData?.completedDimension
        : currentCapabilityData?.dimensionOrder ?? 1;

    // Which checkpoint within the current dimension (1-5)
    const progressInDimension = currentCapabilityData ? (capabilityIndex % 5) + 1 : 0;

    // ─────────────────────────────────────────────────────────────────────────
    // Initial data load
    // ─────────────────────────────────────────────────────────────────────────

    useEffect(() => {
        const init = async () => {
            if (!user) return;

            try {
                setIsLoading(true);
                setLoadError(null);

                // 1. Resolve the user's AE/GM stage
                const stage = await getUserGMStage(user.id);
                if (!stage) {
                    setLoadError('Your AE Ladder stage has not been set yet. Please complete the AE Ladder Assessment first.');
                    return;
                }
                setStageInfo(stage);

                // 2. Load all 125 questions for this stage, grouped into screens
                const screens = await getGMAuditScreens(stage.aeStageId);
                if (screens.length === 0) {
                    setLoadError('No assessment questions could be loaded. Please contact support.');
                    return;
                }
                setCapabilityScreens(screens);
                setTransitionScreens(buildTransitionScreens(screens));

                // 3. Create or resume a gm_assessments record
                const assessment = await createOrResumeGMAssessment(user.id, stage.gmStageId);
                if (!assessment) {
                    setLoadError('Could not initialise your assessment session. Please refresh and try again.');
                    return;
                }
                setAssessmentId(assessment.assessmentId);

                // 4. Load any previously saved responses
                const saved = await loadSavedResponses(assessment.assessmentId);
                setResponses(saved);

                // 5. Resume position: find the first capability screen with any unanswered questions
                if (Object.keys(saved).length > 0) {
                    // Scan screens to find the first one not fully answered
                    let resumeCapIndex = 0;
                    for (let i = 0; i < screens.length; i++) {
                        const allAnswered = screens[i].checkpoints.every(cp => saved[cp.id]);
                        if (!allAnswered) { resumeCapIndex = i; break; }
                        resumeCapIndex = i; // keep updating so we end at last screen if all done
                    }
                    // Convert cap index to absolute step
                    const dimTransitionsBefore = Math.floor(resumeCapIndex / 5);
                    const resumeStep = resumeCapIndex + dimTransitionsBefore + 1;
                    setCurrentStep(resumeStep);
                    setFurthestStep(resumeStep);

                    // Mark completed dimensions
                    const completed: number[] = [];
                    for (const screen of screens) {
                        const allDone = screen.checkpoints.every(cp => saved[cp.id]);
                        if (allDone && !completed.includes(screen.dimensionOrder)) {
                            // Check all 5 screens for this dimension
                            const dimScreens = screens.filter(s => s.dimensionOrder === screen.dimensionOrder);
                            if (dimScreens.every(ds => ds.checkpoints.every(cp => saved[cp.id]))) {
                                if (!completed.includes(screen.dimensionOrder)) {
                                    completed.push(screen.dimensionOrder);
                                }
                            }
                        }
                    }
                    setCompletedDimensions(completed);
                }

            } catch (err: any) {
                console.error('[AssessmentWizard] Init error:', err);
                setLoadError('An unexpected error occurred. Please refresh and try again.');
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [user]);

    // ─────────────────────────────────────────────────────────────────────────
    // Validation
    // ─────────────────────────────────────────────────────────────────────────

    const isDimensionComplete = (dimOrder: number) => {
        const dimScreens = capabilityScreens.filter(s => s.dimensionOrder === dimOrder);
        return dimScreens.every(screen =>
            screen.checkpoints.every(cp => responses[cp.id])
        );
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Handlers
    // ─────────────────────────────────────────────────────────────────────────

    const handleResponseChange = (questionId: string, value: string) => {
        setResponses(prev => ({ ...prev, [questionId]: value }));
    };

    const handleSave = async () => {
        if (!assessmentId) return;
        setIsSaving(true);
        await saveResponses(assessmentId, responses, questionCheckpointMap);
        setIsSaving(false);
        // Keep localStorage as a fast local fallback
        localStorage.setItem('gm_audit_step', currentStep.toString());
    };

    const handleNext = async () => {
        await handleSave();

        if (!isTransition) {
            // At the last capability in a dimension
            if (progressInDimension === 5) {
                if (!isDimensionComplete(currentDimensionOrder)) {
                    alert(`Please answer all questions in Dimension ${currentDimensionOrder} to continue.`);
                    return;
                }
                if (!completedDimensions.includes(currentDimensionOrder)) {
                    setCompletedDimensions(prev => [...prev, currentDimensionOrder]);
                }
            }
        }

        // Final submit
        if (capabilityIndex === TOTAL_CAPABILITIES - 1) {
            if (!isDimensionComplete(5)) {
                alert('Please complete all questions in the final dimension before submitting.');
                return;
            }
            if (!assessmentId) return;
            // Show overlay immediately, then fire submission in background
            setIsSubmitting(true);
            setSubmitReady(false);
            setIsSaving(true);
            const result = await submitAssessment(assessmentId);
            setIsSaving(false);
            if (!result.success) {
                setIsSubmitting(false);
                alert('Submission failed. Please try again.');
                return;
            }
            // Let the overlay fast-finish before navigating
            setSubmitReady(true);
            return;
        }

        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
        if (nextStep > furthestStep) setFurthestStep(nextStep);
        window.scrollTo(0, 0);
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
            window.scrollTo(0, 0);
        }
    };

    const handleJumpToStep = (step: number) => {
        setCurrentStep(step);
        window.scrollTo(0, 0);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Loading
    // ─────────────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-[var(--aos-brass)] animate-spin" />
                <p className="text-[var(--fg-2)] font-medium">Loading your assessment...</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
                <AlertCircle className="w-10 h-10 text-[var(--aos-warning)]" />
                <p className="text-[var(--fg-1)] font-semibold text-center max-w-sm">{loadError}</p>
            </div>
        );
    }

    if (capabilityScreens.length === 0) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <p className="text-[var(--fg-3)]">No questions loaded.</p>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render: Wizard
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar */}
                <div className="w-full lg:w-80 shrink-0">
                    <AuditNavigation
                        currentScreen={currentStep}
                        totalScreens={TOTAL_STEPS}
                        currentDimension={currentDimensionOrder}
                        completedDimensions={completedDimensions}
                        responses={responses}
                        capabilityScreens={capabilityScreens}
                        onJumpToStep={handleJumpToStep}
                    />
                </div>

                {/* Main content */}
                <div className="flex-1">
                    {stageInfo && (
                        <div className="mb-4 text-xs text-[var(--fg-3)] font-medium uppercase tracking-widest">
                            {stageInfo.stageName} Stage Assessment
                        </div>
                    )}

                    {isTransition && currentTransitionData ? (
                        <DimensionTransition
                            data={currentTransitionData}
                            onContinue={handleNext}
                        />
                    ) : currentCapabilityData ? (
                        <CapabilityCard
                            data={currentCapabilityData}
                            responses={responses}
                            onResponseChange={handleResponseChange}
                            onNext={handleNext}
                            onBack={handleBack}
                            onSave={handleSave}
                            isFirstScreen={currentStep === 1}
                            isLastScreen={capabilityIndex === TOTAL_CAPABILITIES - 1}
                            isEndOfDimension={!isTransition && progressInDimension === 5}
                            isSaving={isSaving || isSubmitting}
                        />
                    ) : null}
                </div>
            </div>

            {/* Submit Loading Overlay — shown during final submission + scoring */}
            <GMAuditLoadingOverlay
                isVisible={isSubmitting}
                isReady={submitReady}
                onComplete={() => navigate('/diagnostics/mr-audit/results')}
            />
        </div>
    );
};
