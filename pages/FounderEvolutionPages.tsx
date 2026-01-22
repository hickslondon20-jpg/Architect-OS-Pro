import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Button, ProgressBar, RadioGroup, PageHeader } from '../components/ui';
import { Compass, Clock, CheckCircle2, ArrowRight, Download } from 'lucide-react';

// --- Landing Page ---

export const FounderEvolutionLanding: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
           <div className="p-3 bg-slate-100 rounded-lg">
              <Compass className="h-8 w-8 text-brand-600" />
           </div>
           <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Founder Evolution</h1>
              <p className="text-lg text-slate-600">Understand how you currently show up in your business</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
         <div className="md:col-span-2 space-y-8">
            <div className="prose text-slate-600 max-w-none">
               <p className="text-lg leading-relaxed">
                  This quick assessment helps identify your current founder role and operating style. 
                  There are no right or wrong roles. Each role and style has a place. This is simply a 
                  snapshot of how you tend to operate today.
               </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="p-6">
                  <h3 className="font-semibold text-slate-900 mb-2">What This Is For</h3>
                  <p className="text-sm text-slate-500">
                    This assessment identifies how you currently operate within your business—both 
                    your functional role and your natural operating style.
                  </p>
               </Card>
               <Card className="p-6">
                  <h3 className="font-semibold text-slate-900 mb-2">What This Isn't</h3>
                  <p className="text-sm text-slate-500">
                     This isn't about right or wrong roles. Each role and style has a place. 
                     This is simply a snapshot of how you tend to operate today.
                  </p>
               </Card>
            </div>

            <Card className="p-6 bg-slate-50 border-slate-200">
               <h3 className="font-semibold text-slate-900 mb-2">What Happens Next</h3>
               <p className="text-sm text-slate-600">
                  You'll receive your <strong>Founder Identity</strong> (role stage) and your <strong>Founder Type</strong> (operating orientation). 
                  When viewed alongside your agency stage and strategic direction, this creates the interpretive lens 
                  for all downstream diagnostics, insights, and strategic planning in ArchitectOS.
               </p>
            </Card>

            <div>
               <Link to="/tools/founder-evolution/assessment">
                  <Button className="w-full sm:w-auto px-8 py-3 text-base">Start Assessment</Button>
               </Link>
            </div>
         </div>

         <div className="md:col-span-1">
            <Card className="p-6 sticky top-24">
               <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Assessment Details
               </h3>
               <ul className="space-y-4 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                     <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                     <span>Takes about 3 minutes</span>
                  </li>
                  <li className="flex items-start gap-2">
                     <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                     <span>13 questions</span>
                  </li>
                  <li className="flex items-start gap-2">
                     <div className="h-1.5 w-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
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

interface Question {
  id: string;
  text: string;
  section: 'role' | 'style';
  options: { label: string; value: string }[];
}

const questions: Question[] = [
  // Section 1: Your Founder Role
  {
    id: 'q1',
    text: "When work quality or client outcomes are at risk, I personally step in to do or directly address the work.",
    section: 'role',
    options: [
      { label: "Often", value: "often" },
      { label: "Sometimes", value: "sometimes" },
      { label: "Rarely", value: "rarely" }
    ]
  },
  {
    id: 'q2',
    text: "A meaningful portion of the value clients receive comes directly from my personal expertise or contribution.",
    section: 'role',
    options: [
      { label: "Yes", value: "yes" },
      { label: "In some cases", value: "some" },
      { label: "No", value: "no" }
    ]
  },
  {
    id: 'q3',
    text: "Most days, my attention is focused on coordinating people, resolving issues, and keeping work moving forward.",
    section: 'role',
    options: [
      { label: "Yes", value: "yes" },
      { label: "Some days", value: "some" },
      { label: "Rarely", value: "rarely" }
    ]
  },
  {
    id: 'q4',
    text: "Operational decisions frequently come to me for review or approval before moving forward.",
    section: 'role',
    options: [
      { label: "Most of the time", value: "most" },
      { label: "Occasionally", value: "occasionally" },
      { label: "Rarely", value: "rarely" }
    ]
  },
  {
    id: 'q5',
    text: "My primary contribution to the business is setting direction, priorities, and making high-level decisions.",
    section: 'role',
    options: [
      { label: "Yes", value: "yes" },
      { label: "Sometimes", value: "sometimes" },
      { label: "No", value: "no" }
    ]
  },
  // Section 2: Your Operating Style
  {
    id: 'q6',
    text: "I influence outcomes mainly through guidance and perspective rather than by owning decisions or execution.",
    section: 'style',
    options: [
      { label: "Yes", value: "yes" },
      { label: "Occasionally", value: "occasionally" },
      { label: "Rarely", value: "rarely" }
    ]
  },
  {
    id: 'q7',
    text: "I relate to the business primarily through its results and outcomes rather than through day-to-day leadership or operations.",
    section: 'style',
    options: [
      { label: "Yes", value: "yes" },
      { label: "In part", value: "part" },
      { label: "No", value: "no" }
    ]
  },
  {
    id: 'q8',
    text: "I naturally talk with the team about where we're going, what we're building toward, and what's possible next.",
    section: 'style',
    options: [
      { label: "Often", value: "often" },
      { label: "Sometimes", value: "sometimes" },
      { label: "Rarely", value: "rarely" }
    ]
  },
  {
    id: 'q9',
    text: "I'm most energized when I'm helping people see the bigger picture and how their work fits into it.",
    section: 'style',
    options: [
      { label: "Yes", value: "yes" },
      { label: "In some cases", value: "some" },
      { label: "No", value: "no" }
    ]
  },
  {
    id: 'q10',
    text: "I prefer to be close to the work—seeing it happen, jumping in when needed, and working through issues alongside the team.",
    section: 'style',
    options: [
      { label: "Yes", value: "yes" },
      { label: "Sometimes", value: "sometimes" },
      { label: "No", value: "no" }
    ]
  },
  {
    id: 'q11',
    text: "I feel most useful when I'm actively involved in solving day-to-day problems as they come up.",
    section: 'style',
    options: [
      { label: "Often", value: "often" },
      { label: "Sometimes", value: "sometimes" },
      { label: "Rarely", value: "rarely" }
    ]
  },
  {
    id: 'q12',
    text: "I tend to create momentum by coordinating people, priorities, and resources so things move in the right order.",
    section: 'style',
    options: [
      { label: "Yes", value: "yes" },
      { label: "In some cases", value: "some" },
      { label: "No", value: "no" }
    ]
  },
  {
    id: 'q13',
    text: "When things get complex, I naturally step into a role of sorting through options and helping decide what should happen next.",
    section: 'style',
    options: [
      { label: "Often", value: "often" },
      { label: "Sometimes", value: "sometimes" },
      { label: "Rarely", value: "rarely" }
    ]
  },
];

export const FounderEvolutionAssessment: React.FC = () => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length;
  const isComplete = answeredCount === totalQuestions;

  const roleQuestions = questions.filter(q => q.section === 'role');
  const styleQuestions = questions.filter(q => q.section === 'style');

  return (
    <div className="max-w-3xl mx-auto pb-24">
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur border-b border-slate-200 py-4 mb-8 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
         <div className="max-w-3xl mx-auto flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">
               Question {Math.min(answeredCount + 1, totalQuestions)} of {totalQuestions}
            </span>
            <span className="text-xs text-slate-400 font-medium">
               {Math.round((answeredCount / totalQuestions) * 100)}% Complete
            </span>
         </div>
         <div className="max-w-3xl mx-auto">
            <ProgressBar value={answeredCount} max={totalQuestions} className="h-1.5" />
         </div>
      </div>

      <div className="space-y-12">
        {/* Section 1: Role */}
        <div>
           <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Your Founder Role</h2>
              <p className="text-slate-600">These questions explore where you spend time and how responsibility flows.</p>
           </div>
           <div className="space-y-8">
              {roleQuestions.map((q) => (
                 <Card key={q.id} className="p-6">
                    <h3 className="text-base font-medium text-slate-900 mb-4">{q.text}</h3>
                    <RadioGroup 
                       name={q.id}
                       options={q.options}
                       value={answers[q.id]}
                       onChange={(val) => handleAnswer(q.id, val)}
                    />
                 </Card>
              ))}
           </div>
        </div>

        {/* Section 2: Style */}
        <div>
           <div className="mb-6">
              <h2 className="text-2xl font-bold text-slate-900">Your Operating Style</h2>
              <p className="text-slate-600">These questions explore how you naturally show up and where you prefer to engage.</p>
           </div>
           <div className="space-y-8">
              {styleQuestions.map((q) => (
                 <Card key={q.id} className="p-6">
                    <h3 className="text-base font-medium text-slate-900 mb-4">{q.text}</h3>
                    <RadioGroup 
                       name={q.id}
                       options={q.options}
                       value={answers[q.id]}
                       onChange={(val) => handleAnswer(q.id, val)}
                    />
                 </Card>
              ))}
           </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 lg:pl-64 z-20">
         <div className="max-w-3xl mx-auto flex justify-between items-center">
            <Link to="/tools/founder-evolution">
               <Button variant="ghost">Back</Button>
            </Link>
            <Button 
               disabled={!isComplete} 
               onClick={() => navigate('/tools/founder-evolution/results')}
            >
               Complete Assessment
            </Button>
         </div>
      </div>
    </div>
  );
};

// --- Results Page ---

export const FounderEvolutionResults: React.FC = () => {
  return (
    <div className="pb-12">
      <div className="mb-8">
         <h1 className="text-2xl font-bold text-slate-900">Your Founder Evolution Results</h1>
         <p className="text-slate-600 mt-1">Your results appear below.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Left Column: Context */}
         <div className="space-y-6">
            <Card className="p-6 bg-slate-50 border-slate-200">
               <h3 className="font-semibold text-slate-900 mb-2">About This Assessment</h3>
               <p className="text-sm text-slate-600 mb-4">
                  This assessment identifies how you currently operate within your business—both your functional role and your natural operating style.
               </p>
               
               <h3 className="font-semibold text-slate-900 mb-2 mt-6">What This Is For</h3>
               <p className="text-sm text-slate-600 mb-4">
                  Identifying your current operating baseline to inform strategic planning.
               </p>
               
               <h3 className="font-semibold text-slate-900 mb-2 mt-6">What Happens Next</h3>
               <p className="text-sm text-slate-600">
                  Use these results alongside your agency stage to identify where your role creates bottlenecks or leverage.
               </p>
            </Card>
         </div>

         {/* Right Column: Results */}
         <div className="lg:col-span-2 space-y-6">
            <Card className="p-8 border-l-4 border-l-brand-600">
               <div className="flex items-start justify-between mb-6">
                  <div>
                     <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Your Founder Identity</h2>
                     <h3 className="text-2xl font-bold text-slate-900">Practitioner (Placeholder)</h3>
                  </div>
                  <div className="p-2 bg-slate-100 rounded-full">
                     <Compass className="h-6 w-6 text-slate-600" />
                  </div>
               </div>
               
               <div className="prose prose-sm text-slate-600 max-w-none">
                  <p>
                     Based on your responses, you currently operate as a <strong>Practitioner</strong> founder.
                  </p>
                  <p>
                     This means you are heavily involved in the actual delivery of work. Your personal expertise 
                     is a core value driver for the business. While this ensures quality, it can become a 
                     scalability bottleneck if not evolved.
                  </p>
                  <p className="text-slate-500 italic mt-4">
                     This is where you naturally show up in the business today.
                  </p>
               </div>
            </Card>

            <Card className="p-8 border-l-4 border-l-indigo-600">
               <div className="flex items-start justify-between mb-6">
                  <div>
                     <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Your Operating Orientation</h2>
                     <h3 className="text-2xl font-bold text-slate-900">Executor (Placeholder)</h3>
                  </div>
                  <div className="p-2 bg-slate-100 rounded-full">
                     <CheckCircle2 className="h-6 w-6 text-slate-600" />
                  </div>
               </div>
               
               <div className="prose prose-sm text-slate-600 max-w-none">
                  <p>
                     Your natural operating style is <strong>Executor</strong>.
                  </p>
                  <p>
                     You are energized by doing the work and being close to the action. You likely 
                     lead by example and have high standards for execution.
                  </p>
               </div>
            </Card>

            <div className="pt-6 flex flex-col sm:flex-row gap-4">
               <Link to="/clarity-compass/synthesis">
                  <Button className="w-full sm:w-auto">View in Strategic Synthesis</Button>
               </Link>
               <Link to="/tools/founder-evolution">
                  <Button variant="ghost">Retake Assessment</Button>
               </Link>
               <Button variant="outline" className="sm:ml-auto gap-2">
                  <Download className="h-4 w-4" /> Download Results PDF
               </Button>
            </div>
         </div>
      </div>
    </div>
  );
};
