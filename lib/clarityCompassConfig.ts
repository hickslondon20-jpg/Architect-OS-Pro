export type FieldType = 'single' | 'multi' | 'text';

export interface HorizonField {
    id: string;
    label: string;
    helperText?: string;
    type: FieldType;
    options?: string[];
    maxSelections?: number;
    required: boolean;
    maxLength?: number;
    placeholder?: string;
}

export interface HorizonDimension {
    id: string;
    title: string;
    description: string;
    fields: HorizonField[];
}

export interface HorizonConfig {
    id: string;
    title: string;
    subtitle: string;
    contextLine?: string;
    dimensions: HorizonDimension[];
}

export const clarityCompassConfig: Record<string, HorizonConfig> = {
    '12-month': {
        id: '12-month',
        title: '12-Month Future Reality',
        subtitle: 'Describe the business you intend to build over the next 12 months — not where you are today, but where you want to be.',
        dimensions: [
            {
                id: '12m-financial',
                title: 'Financial Reality',
                description: 'What do you want the economic shape of the business to become by this point?',
                fields: [
                    {
                        id: '12m_financial_primary_objective',
                        label: 'Primary Financial Objective',
                        helperText: 'What do you want the business to be optimizing for financially — not the target, but the intent driving your decisions.',
                        type: 'single',
                        required: true,
                        options: [
                            'Improve profitability at current scale',
                            'Reinvest aggressively to fund growth',
                            'Transition to a higher-value revenue model',
                            'Build toward a specific financial milestone',
                            'Stabilize and reduce financial volatility'
                        ]
                    },
                    {
                        id: '12m_financial_revenue_model',
                        label: 'Revenue Model Direction',
                        helperText: 'Where do you want your pricing, packaging, or service structure to be by this point — regardless of who you\'re serving.',
                        type: 'single',
                        required: true,
                        options: [
                            'Continuing to scale a model that\'s already proven',
                            'Moving upmarket — higher fees, more selective engagements',
                            'Introducing new offer structures or revenue streams',
                            'Simplifying — fewer services, sharper focus',
                            'Shifting from project-based to retainer or recurring model'
                        ]
                    },
                    {
                        id: '12m_financial_success_markers',
                        label: 'What Financial Success Looks Like at This Stage',
                        helperText: 'Choose the markers that best describe what financial health feels like when this horizon is realized.',
                        type: 'multi',
                        maxSelections: 2,
                        required: true,
                        options: [
                            'Decisions are no longer made from scarcity or cash pressure',
                            'Revenue is consistent enough that growth feels planned, not reactive',
                            'Margin has improved to the point where the business funds its own evolution',
                            'No single client represents an existential revenue risk',
                            'The financial foundation exists to build the team proactively'
                        ]
                    }
                ]
            },
            {
                id: '12m-market',
                title: 'Clients & Market Reality',
                description: 'Who do you want this business to be for, and what position do you want it to claim in the market?',
                fields: [
                    {
                        id: '12m_market_client_quality',
                        label: 'Client Quality Direction',
                        helperText: 'Where do you want the caliber, fit, and relationship dynamic of your client base to be by this point — not who you\'re targeting, but the quality standard you\'re moving toward.',
                        type: 'single',
                        required: true,
                        options: [
                            'I want to raise the bar — fewer, higher-value, better-fit clients',
                            'I want to expand the base — more clients at a consistent quality level',
                            'I want to tighten criteria — being more deliberate about who we take on',
                            'I want to deepen existing relationships — growing with current clients rather than acquiring new',
                            'I want to transition out of misaligned client relationships toward a clearer ideal'
                        ]
                    },
                    {
                        id: '12m_market_position',
                        label: 'Market Position Direction',
                        helperText: 'Where do you want the agency\'s differentiation and perceived position in the market to be — how you want to be known and why clients choose you.',
                        type: 'single',
                        required: true,
                        options: [
                            'Sharpening specialization — becoming more distinctly known for a specific outcome or vertical',
                            'Broadening capability — expanding what the agency is known for delivering',
                            'Moving toward more sophisticated buyers — larger or more complex client relationships',
                            'Building category authority — becoming a recognizable voice in a defined space',
                            'Clarifying differentiation — making what makes us different more explicit and consistent',
                            'Holding and executing on an established position — the work is in consistency, not redefinition'
                        ]
                    },
                    {
                        id: '12m_market_relationship_evolution',
                        label: 'What the Client Relationship Looks Like at This Stage',
                        helperText: 'Choose the statements that best describe how your relationship with clients has evolved when this horizon is realized.',
                        type: 'multi',
                        maxSelections: 2,
                        required: true,
                        options: [
                            'Clients treat us as a strategic partner, not a vendor or executor',
                            'We are selective enough that we rarely take on work outside our zone of excellence',
                            'Our retention is strong enough that growth comes primarily from existing relationships',
                            'We have a clear and consistent reason why clients choose us over alternatives',
                            'The clients we serve reflect the market position we are intentionally building toward'
                        ]
                    }
                ]
            },
            {
                id: '12m-operations',
                title: 'Operations & Systems Reality',
                description: 'How do you want the business to deliver and operate by this point — systematically and efficiently?',
                fields: [
                    {
                        id: '12m_operations_delivery_consistency',
                        label: 'Delivery Consistency Direction',
                        helperText: 'Where do you want the agency\'s ability to deliver quality outcomes — systematically, not just occasionally — to be by this point.',
                        type: 'single',
                        required: true,
                        options: [
                            'Moving from founder-dependent delivery toward team-led consistency',
                            'Standardizing processes so quality is repeatable regardless of who executes',
                            'Documenting and systematizing what has historically lived in people\'s heads',
                            'Evolving from team-led consistency toward systematized, scalable delivery infrastructure',
                            'Maintaining and deepening a delivery model that will be well established by this point',
                            'Scaling a proven delivery system into new service lines or client types'
                        ]
                    },
                    {
                        id: '12m_operations_leverage',
                        label: 'Operational Leverage Direction',
                        helperText: 'Where do you want the relationship between your operational capacity and revenue potential to be — is growth becoming more structurally efficient.',
                        type: 'single',
                        required: true,
                        options: [
                            'Building infrastructure ahead of growth to create capacity before it\'s needed',
                            'Streamlining existing operations to reduce overhead relative to output',
                            'Introducing technology or tooling to increase team output without proportional headcount growth',
                            'Holding current operational structure while proving the model at this scale',
                            'Restructuring how work gets resourced and delivered to improve margin per engagement'
                        ]
                    },
                    {
                        id: '12m_operations_progress',
                        label: 'What Operational Progress Looks Like at This Stage',
                        helperText: 'Choose the statements that best describe what the business feels like operationally when this horizon is realized.',
                        type: 'multi',
                        maxSelections: 2,
                        required: true,
                        options: [
                            'The business runs consistently without requiring my direct involvement in delivery',
                            'Growth no longer creates proportional stress on the team or operational capacity',
                            'We have documented systems that a new team member could follow without tribal knowledge',
                            'Our delivery model is efficient enough that margin improves as revenue grows',
                            'The operational foundation exists to take on more without rebuilding how we work'
                        ]
                    }
                ]
            },
            {
                id: '12m-team',
                title: 'Team & Leadership Reality',
                description: 'How do you want the human architecture of the business to evolve over the next 12 months?',
                fields: [
                    {
                        id: '12m_team_leadership_location',
                        label: 'Where Do You Want Leadership to Live by This Point',
                        helperText: 'Not who holds what title — how you want decision-making authority and strategic ownership to be distributed across the business.',
                        type: 'single',
                        required: true,
                        options: [
                            'I want to remain the primary strategic driver with stronger execution capacity built around me',
                            'I want a defined leadership layer owning specific functions with meaningful autonomy',
                            'I want at least one other person capable of carrying the business strategically if I step back',
                            'I want day-to-day decisions largely handled without my involvement across most functions',
                            'I want a leadership team that can represent the vision externally as well as execute internally'
                        ]
                    },
                    {
                        id: '12m_team_kind',
                        label: 'What Kind of Team Are You Intentionally Building Toward',
                        helperText: 'The nature and capability of the people you want around you by this point — not headcount or roles, but what the team becomes.',
                        type: 'single',
                        required: true,
                        options: [
                            'A team of specialists who own defined functions with deep expertise in their lane',
                            'A team capable of client-facing leadership without my direct involvement',
                            'A team that executes consistently without needing my oversight on quality',
                            'A team with enough leadership depth that growth doesn\'t create a hiring crisis',
                            'A team whose capability reflects the market position we are building toward'
                        ]
                    }
                ]
            },
            {
                id: '12m-founder',
                title: 'Founder Role & Stewardship Reality',
                description: 'Where do you want to personally sit within the business by this point?',
                fields: [
                    {
                        id: '12m_founder_role_evolution',
                        label: 'How Do You Want Your Role to Evolve by This Point',
                        helperText: 'What you want to move toward — and away from — in how you show up in the business.',
                        type: 'single',
                        required: true,
                        options: [
                            'Less delivery, more strategy and vision',
                            'Less client management, more team and leadership development',
                            'Less operational oversight, more business development and growth',
                            'Stepping back from day-to-day decisions while staying close to strategy',
                            'Deepening focus on the areas where I create the most leverage'
                        ]
                    },
                    {
                        id: '12m_founder_attention',
                        label: 'Where Do You Want Your Highest-Leverage Attention by This Point',
                        helperText: 'The one area where you want your time and energy concentrated at this horizon.',
                        type: 'single',
                        required: true,
                        options: [
                            'Business growth and market positioning',
                            'Team building and leadership development',
                            'Systems, operations, and delivery infrastructure',
                            'Product or service evolution',
                            'Vision, strategy, and long-term direction'
                        ]
                    }
                ]
            }
        ]
    },
    '24-month': {
        id: '24-month',
        title: '24-Month Future Reality',
        subtitle: 'Building on your 12-month foundation — describe what this business has become at the two-year mark.',
        contextLine: 'At this horizon the question shifts from what the business is building to what it has become. Your selections should reflect the business you want to exist as a result of your 12-month foundation being realized.',
        dimensions: [
            {
                id: '24m-identity',
                title: 'Business Identity',
                description: 'What has this business become in the market — and what does its commercial model reflect about the identity it has built?',
                fields: [
                    {
                        id: '24m_identity_stand_for',
                        label: 'What Does This Business Stand For by This Point',
                        helperText: 'Not your positioning statement — what you want the agency to be genuinely known for and called upon to deliver.',
                        type: 'single',
                        required: true,
                        options: [
                            'A specialist agency with a clear and defensible reputation in a defined space',
                            'A strategic partner that clients bring in when the stakes are high',
                            'A growth-oriented agency known for measurable commercial outcomes',
                            'A premium agency associated with sophisticated, complex engagements',
                            'An authority in our category — known beyond our immediate client base',
                            'A trusted, stable partner that clients stay with and grow with over time'
                        ]
                    },
                    {
                        id: '24m_identity_business_model',
                        label: 'What Does the Business Model Reflect About What You\'ve Built by This Point',
                        helperText: 'How the agency generates and sustains revenue as an expression of the identity it has established — not the numbers, but the nature of the model.',
                        type: 'single',
                        required: true,
                        options: [
                            'Revenue built on deep, long-term client relationships with high retention',
                            'Revenue built on a premium positioning that commands higher fees from fewer clients',
                            'Revenue diversified across multiple streams or offer types that reduce concentration risk',
                            'Revenue that is predictable and recurring enough to plan and invest with confidence',
                            'Revenue that reflects a clear market position — the clients we attract mirror who we\'ve chosen to become'
                        ]
                    },
                    {
                        id: '24m_identity_truth',
                        label: 'What Feels True About This Business at This Stage',
                        helperText: 'Choose the statements that best capture what the business has become when this horizon is realized.',
                        type: 'multi',
                        maxSelections: 2,
                        required: true,
                        options: [
                            'The agency has a reputation that precedes it — we get called because of who we are, not just what we do',
                            'There is a clear and consistent story about what we do, who we do it for, and why we\'re the right choice',
                            'The clients we serve and the work we do are a direct reflection of the business we set out to build',
                            'We have moved from being one of many options to being a preferred or differentiated choice in our space',
                            'The business has an identity that exists independently of my personal brand or relationships'
                        ]
                    }
                ]
            },
            {
                id: '24m-maturity',
                title: 'Organizational Maturity',
                description: 'How has the organization matured as a whole — and what has that made possible for you?',
                fields: [
                    {
                        id: '24m_maturity_capability',
                        label: 'What Has the Organization Become Capable of by This Point',
                        helperText: 'Not who is on the team — the nature of how the organization operates and what it can handle as a whole.',
                        type: 'single',
                        required: true,
                        options: [
                            'A specialist team with deep functional expertise that handles complex work without my involvement',
                            'A leadership-driven organization where a core team carries the vision and makes consequential decisions independently',
                            'A systems-driven operation where consistency and quality come from how we\'re built, not who\'s in the room',
                            'A culture-led organization where shared values and ways of working scale without needing more structure',
                            'A team that has grown in sophistication alongside the clients and complexity we now serve'
                        ]
                    },
                    {
                        id: '24m_maturity_focus',
                        label: 'Given What the Organization Can Now Handle — Where Is Your Focus by This Point',
                        helperText: 'Not your role title or involvement level — what you are primarily building or driving at this stage of the business.',
                        type: 'single',
                        required: true,
                        options: [
                            'Building the next chapter — new markets, new capabilities, or new revenue opportunities',
                            'Building the brand and external presence — becoming a visible authority in our space',
                            'Building the leadership pipeline — developing the people who will carry the business forward',
                            'Building deeper client relationships — becoming more strategically embedded with the clients we serve',
                            'Building the long-term foundation — the infrastructure, culture, and model that makes the business durable'
                        ]
                    },
                    {
                        id: '24m_maturity_run_truth',
                        label: 'What Feels True About How This Business Runs at This Stage',
                        helperText: 'Choose the statements that best describe the organizational reality when this horizon is realized.',
                        type: 'multi',
                        maxSelections: 2,
                        required: true,
                        options: [
                            'The business has a leadership and operational structure that doesn\'t depend on me to hold it together',
                            'The team we\'ve built reflects the business we\'ve become — not the business we were two years ago',
                            'Growth is no longer constrained by my personal capacity or bandwidth',
                            'The organization handles complexity, ambiguity, and client demands without it escalating to me',
                            'There is a culture and way of operating that exists independently of any single person including me'
                        ]
                    }
                ]
            }
        ]
    },
    '36-month': {
        id: '36-month',
        title: '36-Month Future Reality',
        subtitle: 'Building on your 12 and 24-month foundations — what three years of intentional building has produced, unlocked, and made possible.',
        contextLine: 'At this horizon the question is no longer what you are building — it is what the building has produced. Your selections should reflect the trajectory, optionality, and new territory that your 36-month vision represents.',
        dimensions: [
            {
                id: '36m-produced',
                title: 'What the Path Has Produced',
                description: 'Not your metrics or milestones — what is fundamentally different about the business and your relationship to it.',
                fields: [
                    {
                        id: '36m_produced_realized',
                        label: 'What Has Three Years of Intentional Building Made Real',
                        helperText: 'Not your metrics or milestones — what is fundamentally true about the business and your relationship to it that simply wasn\'t possible at the starting point.',
                        type: 'single',
                        required: true,
                        options: [
                            'The business operates with a clarity of identity and direction that makes every decision easier to make',
                            'We have built something that stands on its own — it has momentum, reputation, and capability that exist independently of any one person',
                            'The gap between the business I was running and the business I always wanted to run has closed meaningfully',
                            'I have moved from reacting to what the business demands to choosing what the business becomes',
                            'The foundation we\'ve built has made the next chapter genuinely possible in a way it never was before'
                        ]
                    }
                ]
            },
            {
                id: '36m-optionality',
                title: 'What Optionality Now Exists',
                description: 'Not where you\'re going — what directions are now genuinely open to you as a result of what you\'ve built.',
                fields: [
                    {
                        id: '36m_optionality_available',
                        label: 'What Has This Foundation Made Available to You',
                        helperText: 'Not where you\'re going — what directions are now genuinely open to you as a result of what you\'ve built. The range of what has become possible.',
                        type: 'single',
                        required: true,
                        options: [
                            'Scale — the business has the foundation, model, and team to grow significantly if we choose to push',
                            'Depth — we can go deeper into our niche, become more premium, more specialized, more definitive in our space',
                            'Transition — the business is transferable, scalable under different leadership, or positioned for a future exit',
                            'Reinvention — the foundation exists to evolve the model, the market, or the nature of what we do in a meaningful way',
                            'Sustainability — the business runs well enough and profitably enough that I can choose pace, involvement, and lifestyle intentionally'
                        ]
                    }
                ]
            },
            {
                id: '36m-frontier',
                title: 'The New Frontier',
                description: 'The next territory that required this foundation to even become a real possibility — not your ultimate destination, but the door that\'s now open.',
                fields: [
                    {
                        id: '36m_frontier_reach',
                        label: 'What Has Three Years of Building Put Within Reach for the First Time',
                        helperText: 'The next territory that required this foundation to even become a real possibility — not your ultimate destination, but the door that\'s now open.',
                        type: 'single',
                        required: true,
                        options: [
                            'Entering a new market or serving a meaningfully different or more sophisticated client',
                            'Launching a new offer, capability, or revenue model that the current foundation can now support',
                            'Building or acquiring something adjacent that the business\'s reputation and infrastructure makes possible',
                            'Stepping into a new personal or professional role that the business\'s maturity now allows',
                            'Taking the business to a scale or level of impact that previously felt out of reach'
                        ]
                    },
                    {
                        id: '36m_frontier_specific',
                        label: 'Is There Something Specific About Your New Frontier the Options Above Don\'t Fully Capture',
                        helperText: 'Add any context that brings your particular vision of what\'s now possible into sharper focus.',
                        type: 'text',
                        required: false,
                        maxLength: 280
                    }
                ]
            }
        ]
    },
    'ultimate': {
        id: 'ultimate',
        title: 'Ultimate Vision',
        subtitle: 'Beyond the three horizons — what you are ultimately building, what it is meant to mean, and who you are becoming through the act of building it.',
        contextLine: 'This section has no time anchor. It is not asking about a state the business will reach by a certain point. It is asking what this business is ultimately for — and what building it means beyond the metrics and the milestones.',
        dimensions: [
            {
                id: 'ultimate-nature',
                title: 'The Nature of the Endgame',
                description: 'What are you ultimately building toward — the underlying drive and the ultimate shape of what this business becomes.',
                fields: [
                    {
                        id: 'ult_nature_drive',
                        label: 'What Is the Underlying Drive Behind Everything You Are Building',
                        helperText: 'Not a goal or a milestone — the fundamental thing this entire journey is in service of.',
                        type: 'single',
                        required: true,
                        options: [
                            'Mastery — becoming the definitive version of what this agency can be in our space',
                            'Impact — building something whose influence and outcomes extend beyond our revenue',
                            'Freedom — creating a business that funds and enables a life built entirely on my terms',
                            'Legacy — building something that outlasts my direct involvement and stands on its own',
                            'Wealth creation — building significant financial value that creates long-term security and opportunity',
                            'Influence — becoming a recognized voice, leader, or authority in the industry we serve'
                        ]
                    },
                    {
                        id: 'ult_nature_become',
                        label: 'What Does This Business Ultimately Become',
                        helperText: 'Not its revenue or headcount — the nature and character of what this agency is at its fullest expression.',
                        type: 'single',
                        required: true,
                        options: [
                            'A highly specialized boutique — the definitive choice in a defined and valuable niche',
                            'A full-service growth agency with broad capability and a strong market presence',
                            'A premium advisory firm where we are brought in for the highest-stakes strategic work',
                            'A platform or brand that extends beyond client services into education, content, or community',
                            'A scalable agency model built for growth beyond my direct involvement',
                            'A lifestyle-optimized agency — highly profitable, intentionally bounded, built around how I want to work'
                        ]
                    }
                ]
            },
            {
                id: 'ultimate-represent',
                title: 'What the Business Is Meant to Represent',
                description: 'Not what it delivers or how it performs — what it means. What you want to be true about it in ten or fifteen years.',
                fields: [
                    {
                        id: 'ult_represent_stand_for',
                        label: 'What Do You Want This Business to Ultimately Stand For',
                        helperText: 'Not what it delivers or how it performs — what it means. What you want to be true about it in ten or fifteen years.',
                        type: 'single',
                        required: true,
                        options: [
                            'It is my finest professional achievement — the clearest expression of what I am capable of building',
                            'It is a known and respected name in our industry — a business with a reputation that speaks for itself',
                            'It created meaningful careers and opportunities for the people who built it alongside me',
                            'It proved that there is a better way to build and run an agency — and became the example of that',
                            'It gave me the life I always wanted — and the business was the vehicle that made that possible',
                            'It became something bigger than me — an organization with its own identity, culture, and direction'
                        ]
                    }
                ]
            },
            {
                id: 'ultimate-founder',
                title: 'The Founder\'s Long-Term Arc',
                description: 'Not your role or title — who you are becoming through the act of building this, and how you want to relate to what you\'ve created.',
                fields: [
                    {
                        id: 'ult_founder_make_you',
                        label: 'What Does Building This Business Ultimately Make You',
                        helperText: 'Not your role or title — who you are becoming through the act of building this over the long term.',
                        type: 'single',
                        required: true,
                        options: [
                            'A builder — someone who creates things, and this business is one of several chapters in that story',
                            'A master — someone whose life\'s work is concentrated in this business and what it becomes',
                            'A leader — someone whose primary contribution is developing people and building organizational capability',
                            'A visionary — someone who sets direction and creates culture while others execute and operate',
                            'An entrepreneur — someone for whom this business is a proving ground that opens doors to what comes next'
                        ]
                    },
                    {
                        id: 'ult_founder_relate',
                        label: 'How Do You Want to Relate to This Business at the Point of Ultimate Realization',
                        helperText: 'Not the mechanics of exit or succession — the nature of your ongoing connection to what you\'ve created.',
                        type: 'single',
                        required: true,
                        options: [
                            'I want to remain the visionary and cultural anchor while the business runs fully without my daily involvement',
                            'I want to hand it to someone I\'ve developed — a leader who carries the vision forward with genuine ownership',
                            'I want to reach a point where I can walk away fully and let it stand entirely on its own',
                            'I want to be involved indefinitely — this is the work I want to do and I never want to fully step away',
                            'I want to transition it in a way that creates significant value — whether through sale, merger, or partnership',
                            'I want it to evolve into something I haven\'t fully defined yet — and I want the freedom to decide when I get there'
                        ]
                    }
                ]
            }
        ]
    }
};
