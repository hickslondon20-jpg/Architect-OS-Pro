import { StageContent, BandContent } from '../components/tools/ae-ladder/types';

export const STAGE_CONTENT: Record<string, StageContent> = {
    'Striving': {
        label: 'Striving',
        heroTagline: 'Stabilizing Traction into Sustainable Momentum',
        heroDescription: 'Proven demand meets operational complexity. The business model works, but the cost of delivering revenue has increased.',
        overview: {
            title: 'What it Means to be Striving',
            summary: 'The Striving Stage represents the point where proven demand meets operational complexity. Agencies have moved beyond early proving ground and established consistent revenue, but growth creates strain across all systems. This is where motion continues but weight increases - not from doing things wrong, but from doing more things simultaneously.',
            keyThemes: [
                'Revenue is predictable but margins are under pressure',
                'Systems exist but require manual coordination',
                'Team has specialized but relies on founder oversight',
                'Growth feels heavier than it did in the Rising stage'
            ]
        },
        journey: {
            summary: 'Striving is the bridge between the hustle of Rising and the leverage of Thriving. It determines if you will scale with force or with form.',
            nextStageHint: 'To reach Thriving, you must shift from heroic effort to designed systems.'
        }
    },
    // Add other stages as needed for full implementation
    'Rising': {
        label: 'Rising',
        heroTagline: 'Proving The Model',
        heroDescription: 'Early validation and the hustle to find product-market fit.',
        overview: {
            title: 'What it Means to be Rising',
            summary: 'The Rising stage is about survival and validation. You are figuring out who you serve, what you sell, and how to deliver it repeatedly.',
            keyThemes: ['Hustle is the primary engine', 'Generalist team wearing many hats', 'Focus on cash flow over efficiency'],
        },
        journey: {
            summary: 'Rising is the foundation. It is about proving you have a viable business.',
            nextStageHint: 'To reach Striving, you must stabilize your revenue and begin to specialize.'
        }
    }
};

export const BAND_CONTENT: Record<string, BandContent> = {
    'striving_early': {
        id: 'striving_early',
        positionLabel: 'Early Striving',
        introLine: 'You have just crossed the threshold from Rising into Striving.',
        narrative: 'The complexity is just starting to bite. You feel the weight of delivery increasing, but rely heavily on your personal effort to bridge gaps.',
        whatGoodLooksLike: [
            'Recognizing that "how we used to do it" is breaking',
            'Beginning to document core processes',
            'Hiring for specific roles rather than general help'
        ]
    },
    'striving_mid': {
        id: 'striving_mid',
        positionLabel: 'Mid Striving',
        introLine: 'You are deep in the operational friction of Striving.',
        narrative: 'You have team members and clients, but coordination is the biggest tax. You spend more time managing than doing.',
        whatGoodLooksLike: [
            'Systems are being built, even if imperfect',
            'Leadership layer is starting to emerge informally',
            'Revenue is stable, even if profit is tight'
        ]
    }
};
