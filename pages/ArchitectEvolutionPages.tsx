import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/ui';
import { Compass, Clock, CheckCircle2, Download, Eye, Building2, Users, Hammer, Target, Wrench, Lightbulb, TrendingUp, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import { ProgressIndicator } from '../components/tools/ae-ladder/ProgressIndicator';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

// --- Landing Page ---

export const ArchitectEvolutionLanding: React.FC = () => {
   return (
      <div className="max-w-4xl mx-auto">
         <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
               <div className="p-3 bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-lg">
                  <Compass className="h-8 w-8 text-[var(--aos-brass)]" />
               </div>
               <div>
                  <h1 className="text-3xl font-bold text-[var(--fg-1)] tracking-tight">Architect Evolution</h1>
                  <p className="text-lg text-[var(--fg-3)]">Understand how you currently show up in your business</p>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
               <div className="prose max-w-none text-[var(--fg-2)]">
                  <p className="text-lg leading-relaxed">
                     This quick assessment helps identify your current founder role and operating style.
                     There are no right or wrong roles. Each role and style has a place. This is simply a
                     snapshot of how you tend to operate today.
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="p-6">
                     <h3 className="font-semibold text-[var(--fg-1)] mb-2">What This Is For</h3>
                     <p className="text-sm text-[var(--fg-3)]">
                        This assessment identifies how you currently operate within your business—both
                        your functional role and your natural operating style.
                     </p>
                  </Card>
                  <Card className="p-6">
                     <h3 className="font-semibold text-[var(--fg-1)] mb-2">What This Isn't</h3>
                     <p className="text-sm text-[var(--fg-3)]">
                        This isn't about right or wrong roles. Each role and style has a place.
                        This is simply a snapshot of how you tend to operate today.
                     </p>
                  </Card>
               </div>

               <Card className="p-6">
                  <h3 className="font-semibold text-[var(--fg-1)] mb-2">What Happens Next</h3>
                  <p className="text-sm text-[var(--fg-2)]">
                     You'll receive your <strong>Founder Identity</strong> (role stage) and your <strong>Founder Type</strong> (operating orientation).
                     When viewed alongside your agency stage and strategic direction, this creates the interpretive lens
                     for all downstream diagnostics, insights, and strategic planning in ArchitectOS.
                  </p>
               </Card>

               <div>
                  <Link to="/foundations/architect-evolution/assessment">
                     <Button className="w-full sm:w-auto px-8 py-3 text-base">Start Assessment</Button>
                  </Link>
               </div>
            </div>

            <div className="md:col-span-1">
               <Card className="p-6 sticky top-24">
                  <h3 className="font-semibold text-[var(--fg-1)] mb-4 flex items-center gap-2">
                     <Clock className="h-4 w-4 text-[var(--fg-4)]" />
                     Assessment Details
                  </h3>
                  <ul className="space-y-4 text-sm text-[var(--fg-2)]">
                     <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg-4)] mt-2 flex-shrink-0" />
                        <span>Takes about 3 minutes</span>
                     </li>
                     <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg-4)] mt-2 flex-shrink-0" />
                        <span>13 questions</span>
                     </li>
                     <li className="flex items-start gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-[var(--fg-4)] mt-2 flex-shrink-0" />
                        <span>Multiple choice</span>
                     </li>
                  </ul>
               </Card>
            </div>
         </div>
      </div>
   );
};

// --- Assessment Page ---

interface FEQuestion {
   question_key: string;
   question_text: string;
   section: 'role' | 'style';
   sort_order: number;
   options: { label: string; value: string; scores?: Record<string, number> }[];
}

// ── Local mirror of AE Ladder QuestionCard, adapted for string-value options from fe_questions.
// Cannot reuse the AE Ladder original — it hardcodes a 1–5 numeric Likert scale.
const FEQuestionCard: React.FC<{
   question: FEQuestion;
   selectedValue: string | undefined;
   onSelect: (value: string) => void;
   direction: 'left' | 'right' | 'none';
}> = ({ question, selectedValue, onSelect, direction }) => {
   const animClass =
      direction === 'left' ? 'fe-slide-in-right' :
      direction === 'right' ? 'fe-slide-in-left' : 'fe-fade-in';

   return (
      <>
         <style>{`
            @keyframes feSlideInRight { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
            @keyframes feSlideInLeft  { from { opacity:0; transform:translateX(-24px); } to { opacity:1; transform:translateX(0); } }
            @keyframes feFadeIn       { from { opacity:0; } to { opacity:1; } }
            .fe-slide-in-right { animation: feSlideInRight 0.35s ease-out forwards; }
            .fe-slide-in-left  { animation: feSlideInLeft 0.35s ease-out forwards; }
            .fe-fade-in        { animation: feFadeIn 0.35s ease-out forwards; }
         `}</style>
         <div className={`w-full max-w-2xl mx-auto rounded-2xl border border-[var(--aos-mist)] p-8 md:p-10 ${animClass}`}
              style={{ backgroundColor: 'var(--bg-surface)' }}>
            <h2 className="text-xl md:text-2xl font-medium leading-relaxed mb-8" style={{ color: 'var(--fg-1)' }}>
               {question.question_text}
            </h2>
            <div className="space-y-3">
               {question.options.map((opt) => {
                  const selected = selectedValue === opt.value;
                  return (
                     <button
                        key={opt.value}
                        onClick={() => onSelect(opt.value)}
                        className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all duration-150 outline-none focus:ring-2 focus:ring-[var(--aos-brass)] focus:ring-offset-1"
                        style={{
                           borderColor: selected ? 'var(--aos-brass)' : 'var(--aos-mist)',
                           backgroundColor: selected ? 'var(--aos-brass-tint, #fdf6e3)' : 'transparent',
                        }}
                     >
                        <span
                           className="flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-colors duration-150"
                           style={{
                              width: 22, height: 22,
                              borderColor: selected ? 'var(--aos-brass)' : 'var(--aos-mist)',
                              backgroundColor: selected ? 'var(--aos-brass)' : 'transparent',
                           }}
                        >
                           {selected && <span className="rounded-full bg-white" style={{ width: 8, height: 8, display: 'block' }} />}
                        </span>
                        <span className="text-base" style={{ color: 'var(--fg-1)', fontWeight: selected ? 500 : 400 }}>
                           {opt.label}
                        </span>
                     </button>
                  );
               })}
            </div>
         </div>
      </>
   );
};

// ── Local mirror of AE Ladder NavigationControls, without the "Save Progress" button
// (FE answers persist only in local state until submit — no incremental save needed).
const FENavigationControls: React.FC<{
   isFirst: boolean;
   isLast: boolean;
   canAdvance: boolean;
   submitting: boolean;
   onBack: () => void;
   onNext: () => void;
   onSubmit: () => void;
}> = ({ isFirst, isLast, canAdvance, submitting, onBack, onNext, onSubmit }) => (
   <div className="flex items-center justify-between w-full max-w-2xl mx-auto mt-8 px-2">
      <button
         onClick={onBack}
         disabled={isFirst}
         className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors"
         style={{ color: isFirst ? 'var(--fg-4)' : 'var(--fg-3)', cursor: isFirst ? 'not-allowed' : 'pointer' }}
      >
         <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {isLast ? (
         <button
            onClick={onSubmit}
            disabled={!canAdvance || submitting}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg shadow-sm transition-all"
            style={{
               backgroundColor: (!canAdvance || submitting) ? 'var(--bg-sunken)' : 'var(--bg-inverse)',
               color: (!canAdvance || submitting) ? 'var(--fg-4)' : 'var(--fg-on-dark)',
               cursor: (!canAdvance || submitting) ? 'not-allowed' : 'pointer',
            }}
         >
            {submitting ? 'Submitting…' : 'Complete Assessment'}
         </button>
      ) : (
         <button
            onClick={onNext}
            disabled={!canAdvance}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-colors"
            style={{
               backgroundColor: canAdvance ? 'var(--bg-inverse)' : 'var(--bg-sunken)',
               color: canAdvance ? 'var(--fg-on-dark)' : 'var(--fg-4)',
               cursor: canAdvance ? 'pointer' : 'not-allowed',
            }}
         >
            Next <ArrowRight className="w-4 h-4" />
         </button>
      )}
   </div>
);

export const ArchitectEvolutionAssessment: React.FC = () => {
   // ── Data wiring — identical to #26; only the presentation layer changed ──
   const [questions, setQuestions] = useState<FEQuestion[]>([]);
   const [answers, setAnswers] = useState<Record<string, string>>({});
   const [loadingQuestions, setLoadingQuestions] = useState(true);
   const [submitting, setSubmitting] = useState(false);
   const [submitError, setSubmitError] = useState<string | null>(null);
   // ── Wizard navigation state ──
   const [currentIndex, setCurrentIndex] = useState(0);
   const [animDirection, setAnimDirection] = useState<'left' | 'right' | 'none'>('none');
   const navigate = useNavigate();

   useEffect(() => {
      supabase
         .from('fe_questions')
         .select('question_key, question_text, section, sort_order, options')
         .eq('is_active', true)
         .order('sort_order')
         .then(({ data, error }) => {
            if (error) console.error('Failed to load questions:', error);
            else setQuestions((data as FEQuestion[]) ?? []);
            setLoadingQuestions(false);
         });
   }, []);

   const handleSubmit = async () => {
      setSubmitting(true);
      setSubmitError(null);
      const { error } = await supabase.rpc('fe_submit_assessment', { p_answers: answers });
      if (error) {
         console.error('fe_submit_assessment error:', error);
         setSubmitError('Something went wrong submitting your assessment. Please try again.');
         setSubmitting(false);
         return;
      }
      navigate('/foundations/architect-evolution/results');
   };

   // ── Wizard handlers ──
   const totalQuestions = questions.length;
   const currentQuestion = questions[currentIndex];
   const currentAnswer = currentQuestion ? answers[currentQuestion.question_key] : undefined;
   const isFirst = currentIndex === 0;
   const isLast = currentIndex === totalQuestions - 1;

   const handleSelect = (value: string) => {
      if (!currentQuestion) return;
      setAnswers(prev => ({ ...prev, [currentQuestion.question_key]: value }));
      // Auto-advance to next question after a brief visual-confirmation pause
      if (!isLast) {
         setTimeout(() => {
            setAnimDirection('left');
            setCurrentIndex(i => i + 1);
         }, 320);
      }
      // On the last question, selection just enables the Complete button — no auto-advance
   };

   const handleNext = () => {
      if (!isLast && currentAnswer !== undefined) {
         setAnimDirection('left');
         setCurrentIndex(i => i + 1);
      }
   };

   const handleBack = () => {
      if (!isFirst) {
         setAnimDirection('right');
         setCurrentIndex(i => i - 1);
      }
   };

   // Reset animation direction after each question transition
   useEffect(() => {
      if (animDirection !== 'none') {
         const t = setTimeout(() => setAnimDirection('none'), 400);
         return () => clearTimeout(t);
      }
   }, [currentIndex, animDirection]);

   if (loadingQuestions) {
      return (
         <div className="flex items-center justify-center py-24">
            <div
               className="h-8 w-8 rounded-full border-4 border-t-transparent animate-spin"
               style={{ borderColor: 'var(--aos-brass)', borderTopColor: 'transparent' }}
            />
         </div>
      );
   }

   if (!currentQuestion) {
      return (
         <div className="flex items-center justify-center py-24">
            <p className="text-sm" style={{ color: 'var(--fg-3)' }}>No questions found.</p>
         </div>
      );
   }

   return (
      <div className="w-full max-w-3xl mx-auto py-10 px-4 pb-24">
         {/* Progress indicator — reuses the AE Ladder ProgressIndicator (prop-driven, no data coupling) */}
         <ProgressIndicator currentStep={currentIndex} totalSteps={totalQuestions} />

         <div className="relative overflow-hidden min-h-[320px]">
            <FEQuestionCard
               key={currentQuestion.question_key}
               question={currentQuestion}
               selectedValue={currentAnswer}
               onSelect={handleSelect}
               direction={animDirection}
            />
         </div>

         {submitError && (
            <div className="mt-6 max-w-2xl mx-auto rounded-lg p-4 text-sm" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--aos-mist)', color: 'var(--fg-2)' }}>
               {submitError}
            </div>
         )}

         <FENavigationControls
            isFirst={isFirst}
            isLast={isLast}
            canAdvance={currentAnswer !== undefined}
            submitting={submitting}
            onBack={handleBack}
            onNext={handleNext}
            onSubmit={handleSubmit}
         />
      </div>
   );
};

// --- Results Page ---

// ── Types ─────────────────────────────────────────────────────────────────────

interface ArchitectEvolutionProfile {
  profileKey: string;
  archetypeName: string;
  founderIdentity: string;   // display label, e.g. "Manager"
  founderType: string;       // display label, e.g. "Strategist"
  tagline: string;
  profileSummary: string;
  howThisShowsUp: string[];      // exactly 4 items
  leverageStatements: string[];  // exactly 3 items
  tensionStatements: string[];   // exactly 3 items
  thoughtStarters: string[];     // exactly 4 items
}

// Maps TitleCase identity_primary / type_primary from fe_results → lowercase ids
// that CrossSectionMatrix / identityOptions / typeOptions use.
function toLowerId(label: string): string {
  return label.toLowerCase();
}

interface AxisOption {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

// ── Framework Axis Definitions ────────────────────────────────────────────────
// Y-axis: Identity — array order is Involvement→Ownership (Practitioner=bottom, Investor=top)
// X-axis: Type — array order is Direction→Execution (Visionary=right, Builder=left)

const identityOptions: AxisOption[] = [
  { id: 'practitioner', label: 'Practitioner', description: 'Deeply embedded in doing or directly shaping the work',          icon: Wrench     },
  { id: 'manager',      label: 'Manager',      description: 'Coordinates people, decisions, and outcomes to keep the business moving', icon: Users      },
  { id: 'ceo',          label: 'CEO',          description: 'Sets direction, priorities, and organizational decisions',         icon: Building2  },
  { id: 'advisor',      label: 'Advisor',      description: 'Guides through perspective and selective high-leverage involvement', icon: Lightbulb  },
  { id: 'investor',     label: 'Investor',     description: 'Relates to the business through ownership, performance, and outcomes', icon: TrendingUp },
];

const typeOptions: AxisOption[] = [
  { id: 'visionary',  label: 'Visionary',  description: 'Shapes the future and sets direction',  icon: Eye    },
  { id: 'strategist', label: 'Strategist', description: 'Plans, positions, and thinks ahead',    icon: Target },
  { id: 'builder',    label: 'Builder',    description: 'Creates and builds from the ground up', icon: Hammer },
];


// ── Section Label ─────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ number: number; text: string; light?: boolean }> = ({ number, text, light }) => (
  <p className={`text-xs font-semibold uppercase tracking-widest mb-4 ${light ? 'text-[var(--aos-brass)]' : 'text-[var(--aos-brass)]'}`}>
    {number} {text}
  </p>
);

// ── Section 1: The Reveal (left-aligned, no section label) ───────────────────

const ResultsReveal: React.FC<{ profile: ArchitectEvolutionProfile }> = ({ profile }) => (
  <div
    className="rounded-2xl p-8 mb-6"
    style={{ backgroundColor: 'var(--aos-cloud)', border: '1px solid var(--aos-mist)' }}
  >
    <h1 className="text-5xl font-bold mb-5 leading-tight" style={{ color: 'var(--fg-1)' }}>
      {profile.archetypeName}
    </h1>
    <div className="flex items-center gap-3 mb-5">
      <span
        className="rounded-full px-4 py-1.5 text-sm font-medium"
        style={{ backgroundColor: 'var(--aos-obsidian)', color: 'var(--fg-on-dark)' }}
      >
        {profile.founderIdentity}
      </span>
      <span
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: 'var(--aos-brass)' }}
      />
      <span
        className="rounded-full px-4 py-1.5 text-sm font-medium"
        style={{ backgroundColor: 'var(--aos-brass)', color: 'white' }}
      >
        {profile.founderType}
      </span>
    </div>
    <p className="italic text-base leading-relaxed max-w-xl" style={{ color: 'var(--fg-2)' }}>
      {profile.tagline}
    </p>
  </div>
);

// ── Section 2: Framework Orientation (no section label) ──────────────────────

const AxisList: React.FC<{
  label: string;
  description: string;
  items: AxisOption[];
  activeId: string;
}> = ({ label, description, items, activeId }) => (
  <div>
    <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--fg-3)' }}>{label}</p>
    <p className="text-sm leading-snug mb-5" style={{ color: 'var(--fg-2)' }}>{description}</p>
    <ul className="space-y-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === activeId;
        return (
          <li key={item.id} className="flex items-start gap-3">
            <Icon
              size={14}
              style={{ color: active ? 'var(--aos-brass)' : 'var(--fg-4)', flexShrink: 0, marginTop: 3 }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium leading-tight" style={{ color: active ? 'var(--fg-1)' : 'var(--fg-3)' }}>
                {item.label}
              </p>
              <p className="text-xs mt-0.5 leading-snug" style={{ color: active ? 'var(--fg-3)' : 'var(--fg-4)' }}>
                {item.description}
              </p>
            </div>
            {/* All items show a dot — active is filled brass, inactive is a muted outline */}
            <span
              className="rounded-full flex-shrink-0"
              style={{
                width: 8,
                height: 8,
                marginTop: 5,
                backgroundColor: active ? 'var(--aos-brass)' : 'transparent',
                border: active ? 'none' : '1.5px solid var(--aos-steel)',
              }}
            />
          </li>
        );
      })}
    </ul>
  </div>
);

const CrossSectionMatrix: React.FC<{ identityId: string; typeId: string }> = ({ identityId, typeId }) => {
  const identityIdx = identityOptions.findIndex(i => i.id === identityId);
  const typeIdx = typeOptions.findIndex(t => t.id === typeId);

  // X-axis: Visionary(0)=right/Direction, Builder(2)=left/Execution → invert index
  const xPct = typeOptions.length > 1
    ? Math.round(((typeOptions.length - 1 - typeIdx) / (typeOptions.length - 1)) * 100)
    : 50;
  // Y-axis: Practitioner(0)=bottom/Involvement, Investor(4)=top/Ownership → invert index
  const yPct = identityOptions.length > 1
    ? Math.round(((identityOptions.length - 1 - identityIdx) / (identityOptions.length - 1)) * 100)
    : 50;
  const clamp = (v: number) => Math.min(Math.max(v, 7), 93);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Identity</p>
      <p className="text-xs" style={{ color: 'var(--fg-4)' }}>Involvement → Ownership</p>
      <div
        className="relative rounded-lg"
        style={{
          width: 240,
          height: 240,
          border: '1px solid var(--aos-mist)',
          backgroundColor: 'var(--bg-surface)',
        }}
      >
        <div className="absolute top-1/2 left-0 right-0" style={{ borderTop: '1px dashed var(--aos-mist)' }} />
        <div className="absolute left-1/2 top-0 bottom-0" style={{ borderLeft: '1px dashed var(--aos-mist)' }} />
        <div
          className="absolute rounded-full shadow-sm"
          style={{
            width: 16,
            height: 16,
            backgroundColor: 'var(--aos-brass)',
            left: `${clamp(xPct)}%`,
            top: `${clamp(100 - yPct)}%`,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
      <p className="text-xs" style={{ color: 'var(--fg-4)' }}>Execution → Direction</p>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fg-3)' }}>Type</p>
    </div>
  );
};

const FrameworkOrientation: React.FC<{ identityId: string; typeId: string }> = ({ identityId, typeId }) => (
  <div
    className="rounded-2xl p-8 mb-6"
    style={{ backgroundColor: 'var(--aos-cloud)', border: '1px solid var(--aos-mist)' }}
  >
    <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--fg-1)' }}>
      What is the Architect Evolution?
    </h2>
    <p className="text-sm leading-relaxed mb-8 max-w-2xl" style={{ color: 'var(--fg-2)' }}>
      Most founder assessments collapse everything into a single score or type. This one separates two things that are often confused — the role you currently play inside the business and the way you naturally create momentum. Seeing these as distinct gives you a clearer picture of how you actually operate, and a more honest starting point for thinking about how that serves the business you are trying to build.
    </p>
    <div className="grid grid-cols-3 gap-10">
      <AxisList
        label="Founder Identity"
        description="Your primary lens of involvement in the business — where responsibility, decisions, and pressure currently sit."
        items={identityOptions}
        activeId={identityId}
      />
      <AxisList
        label="Founder Type"
        description="Your natural orientation for creating momentum — where your energy, attention, and leadership gravity tend to point."
        items={typeOptions}
        activeId={typeId}
      />
      <div className="flex justify-end">
        <CrossSectionMatrix identityId={identityId} typeId={typeId} />
      </div>
    </div>
  </div>
);

// ── Section 3: Your Profile ──────────────────────────────────────────────────

const ProfileSummary: React.FC<{ text: string }> = ({ text }) => (
  <div className="py-8">
    <p className="text-lg leading-relaxed" style={{ color: 'var(--fg-2)' }}>{text}</p>
  </div>
);

const ShowsUpGrid: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="py-6">
    <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--fg-3)' }}>How This Shows Up</p>
    <div className="grid grid-cols-2 gap-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-xl p-6" style={{ border: '1px solid var(--aos-mist)', backgroundColor: 'var(--aos-cloud)' }}>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-2)' }}>{item}</p>
        </div>
      ))}
    </div>
  </div>
);

const LeverageTensionSplit: React.FC<{ leverage: string[]; tension: string[] }> = ({ leverage, tension }) => (
  <div className="py-6">
    <div className="grid grid-cols-2 gap-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--fg-3)' }}>Where This Creates Leverage</p>
        <ul className="space-y-3">
          {leverage.map((item, i) => (
            <li key={i} className="pl-4 text-sm" style={{ borderLeft: '2px solid var(--aos-brass)', color: 'var(--fg-2)' }}>{item}</li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--fg-3)' }}>Where This Creates Tension</p>
        <ul className="space-y-3">
          {tension.map((item, i) => (
            <li key={i} className="pl-4 text-sm" style={{ borderLeft: '2px solid var(--aos-steel)', color: 'var(--fg-2)' }}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  </div>
);

const ThoughtStarters: React.FC<{ items: string[] }> = ({ items }) => (
  <div className="py-6">
    <p className="text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: 'var(--fg-3)' }}>Thought Starters</p>
    <ol className="space-y-6">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-4">
          <span className="text-2xl font-bold leading-none w-8 flex-shrink-0" style={{ color: 'var(--aos-brass)' }}>{i + 1}</span>
          <p className="text-base leading-relaxed pt-1" style={{ color: 'var(--fg-2)' }}>{item}</p>
        </li>
      ))}
    </ol>
  </div>
);

const ProfileSection: React.FC<{ profile: ArchitectEvolutionProfile }> = ({ profile }) => (
  <div className="py-12 px-8" style={{ borderBottom: '1px solid var(--aos-mist)' }}>
    <SectionLabel number={3} text="Your Profile" />
    <p className="text-sm mb-6" style={{ color: 'var(--fg-3)' }}>
      What your {profile.founderIdentity} × {profile.founderType} cross-section means for how you operate — and what it creates in the business.
    </p>
    <ProfileSummary text={profile.profileSummary} />
    <ShowsUpGrid items={profile.howThisShowsUp} />
    <LeverageTensionSplit leverage={profile.leverageStatements} tension={profile.tensionStatements} />
    <ThoughtStarters items={profile.thoughtStarters} />
  </div>
);

// ── Section 4: Fit-for-Purpose Frame ─────────────────────────────────────────

const FitForPurposeFrame: React.FC = () => (
  <div className="py-12 px-8" style={{ backgroundColor: 'var(--aos-obsidian)', color: 'var(--fg-on-dark)' }}>
    <p className="text-sm font-semibold uppercase tracking-widest mb-8" style={{ color: 'var(--aos-brass)' }}>
      The Fit-for-Purpose Frame
    </p>
    <div className="grid grid-cols-4 gap-0">
      {/* Statement column */}
      <div className="pr-8" style={{ borderRight: '1px solid var(--aos-slate)' }}>
        <p className="text-2xl font-semibold leading-snug" style={{ color: 'var(--fg-on-dark)' }}>
          The real question isn't what your profile is — it's whether it's working for where you're trying to go.
        </p>
      </div>
      {/* Signs It's Aligned */}
      <div className="px-8" style={{ borderRight: '1px solid var(--aos-slate)' }}>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 size={14} style={{ color: 'var(--aos-brass)', flexShrink: 0 }} />
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--aos-brass)' }}>Signs It's Aligned</p>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--aos-steel)' }}>
          When your role, your energy, and your actions are all pulling in the same direction, your profile becomes a superpower.
        </p>
      </div>
      {/* Signs It's Drifted */}
      <div className="px-8" style={{ borderRight: '1px solid var(--aos-slate)' }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} style={{ color: 'var(--aos-brass)', flexShrink: 0 }} />
          <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--aos-brass)' }}>Signs It's Drifted</p>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--aos-steel)' }}>
          When you're spending most of your time in activities your profile isn't built for, you'll feel friction, fatigue, or frustration.
        </p>
      </div>
      {/* The Real Transformation */}
      <div className="pl-8">
        <p className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--aos-brass)' }}>The Real Transformation</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--aos-steel)' }}>
          This profile is your starting point on the path from operator to architect. It's about understanding where you are so you can close the gap to where you want to go.
        </p>
      </div>
    </div>
  </div>
);

// ── Section 5: What's Next ────────────────────────────────────────────────────

const WhatsNextSection: React.FC = () => (
  <div className="py-12 px-8">
    <p className="text-sm font-semibold uppercase tracking-widest mb-6" style={{ color: 'var(--aos-brass)' }}>
      What's Next
    </p>
    <div className="grid grid-cols-2 gap-6">
      {/* Companion Guide card */}
      <div className="rounded-xl p-6 flex flex-col" style={{ border: '1px solid var(--aos-mist)', backgroundColor: 'var(--bg-surface)' }}>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--fg-1)' }}>Your ArchitectOS Companion Guide</h3>
        <p className="text-sm mb-6 flex-1" style={{ color: 'var(--fg-3)' }}>
          A PDF version of your full profile — take it into your discovery call.
        </p>
        {/* TODO (Go-Live gap): wire pdf_url from fe_profiles once companion-guide PDFs are uploaded to Storage */}
        <Button disabled className="self-start opacity-50 cursor-not-allowed">
          <Download className="h-4 w-4 mr-2" /> Download Guide
        </Button>
      </div>
      {/* Discovery Call card */}
      <div className="rounded-xl p-6 flex flex-col" style={{ border: '1px solid var(--aos-mist)', backgroundColor: 'var(--bg-surface)' }}>
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--fg-1)' }}>Your one-on-one call is where we'll go deeper.</h3>
        <p className="text-sm mb-6 flex-1" style={{ color: 'var(--fg-3)' }}>
          Your profile is the starting point. On your call, we'll map it to your agency stage and build the right path forward. Bring your questions and insights.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          {/* TODO (Go-Live gap): wire booking URL once the Discovery Call link is confirmed */}
          <Button disabled className="opacity-50 cursor-not-allowed">Book Your Discovery Call</Button>
          <p className="text-xs" style={{ color: 'var(--fg-4)' }}>Already scheduled? Your details will be sent to you.</p>
        </div>
      </div>
    </div>
  </div>
);

// ── Main Export ───────────────────────────────────────────────────────────────

export const ArchitectEvolutionResults: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<ArchitectEvolutionProfile | null>(null);
  const [identityId, setIdentityId] = useState<string>('');
  const [typeId, setTypeId] = useState<string>('');

  useEffect(() => {
    async function loadResults() {
      // 1. Latest fe_results row for this user (RLS ensures own-row only)
      interface FEResultRow { identity_primary: string; type_primary: string; cross_section_key: string; }
      const { data: resultRow, error: resultError } = await supabase
        .from('fe_results')
        .select('identity_primary, type_primary, cross_section_key')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: FEResultRow | null; error: unknown };

      if (resultError) {
        console.error('fe_results fetch error:', resultError);
        setIsLoading(false);
        return;
      }

      if (!resultRow) {
        // No result exists — empty state handled below
        setIsLoading(false);
        return;
      }

      // 2. Map TitleCase labels → lowercase ids for CrossSectionMatrix
      setIdentityId(toLowerId(resultRow.identity_primary));
      setTypeId(toLowerId(resultRow.type_primary));

      // 3. Fetch the matching fe_profiles row by cross_section_key (lowercase from scorer)
      interface FEProfileRow {
        cross_section_key: string;
        archetype_name: string;
        tagline: string | null;
        profile_summary: string | null;
        shows_up_1: string | null; shows_up_2: string | null; shows_up_3: string | null; shows_up_4: string | null;
        leverage_1: string | null; leverage_2: string | null; leverage_3: string | null;
        tension_1: string | null; tension_2: string | null; tension_3: string | null;
        thought_starter_1: string | null; thought_starter_2: string | null; thought_starter_3: string | null; thought_starter_4: string | null;
      }
      const { data: profileRow, error: profileError } = await supabase
        .from('fe_profiles')
        .select(
          'cross_section_key, archetype_name, tagline, ' +
          'profile_summary, shows_up_1, shows_up_2, shows_up_3, shows_up_4, ' +
          'leverage_1, leverage_2, leverage_3, tension_1, tension_2, tension_3, ' +
          'thought_starter_1, thought_starter_2, thought_starter_3, thought_starter_4'
        )
        .eq('cross_section_key', resultRow.cross_section_key)
        .maybeSingle() as { data: FEProfileRow | null; error: unknown };

      if (profileError) {
        console.error('fe_profiles fetch error:', profileError);
        setIsLoading(false);
        return;
      }

      if (profileRow) {
        setProfile({
          profileKey: profileRow.cross_section_key,
          archetypeName: profileRow.archetype_name,
          founderIdentity: resultRow.identity_primary,
          founderType: resultRow.type_primary,
          tagline: profileRow.tagline ?? '',
          profileSummary: profileRow.profile_summary ?? '',
          howThisShowsUp: [profileRow.shows_up_1, profileRow.shows_up_2, profileRow.shows_up_3, profileRow.shows_up_4].filter((s): s is string => Boolean(s)),
          leverageStatements: [profileRow.leverage_1, profileRow.leverage_2, profileRow.leverage_3].filter((s): s is string => Boolean(s)),
          tensionStatements: [profileRow.tension_1, profileRow.tension_2, profileRow.tension_3].filter((s): s is string => Boolean(s)),
          thoughtStarters: [profileRow.thought_starter_1, profileRow.thought_starter_2, profileRow.thought_starter_3, profileRow.thought_starter_4].filter((s): s is string => Boolean(s)),
        });
      }

      setIsLoading(false);
    }

    loadResults();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div
          className="h-8 w-8 rounded-full border-4 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--aos-brass)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  // Empty state — no fe_results row exists for this user yet
  if (!profile) {
    return (
      <div className="max-w-xl mx-auto py-24 text-center">
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--aos-mist)] rounded-full inline-flex mb-6">
          <Compass className="h-8 w-8 text-[var(--aos-brass)]" />
        </div>
        <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--fg-1)' }}>No results yet</h2>
        <p className="text-base mb-8 max-w-sm mx-auto" style={{ color: 'var(--fg-3)' }}>
          Complete the Architect Evolution assessment to see your Founder Identity, Founder Type, and full cross-section profile here.
        </p>
        <Link to="/foundations/architect-evolution/assessment">
          <Button>Start the Assessment</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-24">
      <ResultsReveal profile={profile} />
      <FrameworkOrientation identityId={identityId} typeId={typeId} />
      <ProfileSection profile={profile} />
      <FitForPurposeFrame />
      <WhatsNextSection />
    </div>
  );
};
