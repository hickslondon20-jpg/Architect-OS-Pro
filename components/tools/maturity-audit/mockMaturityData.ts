
export interface Checkpoint {
    id: string;
    title: string;
    statement: string;
}

export interface CapabilityCard {
    screen: number; // 1-25
    dimensionId: string; // D1, D2, D3, D4, D5
    dimensionName: string;
    capabilityId: string; // e.g., "1.1"
    capabilityName: string;
    capabilityDescription: string;
    checkpoints: Checkpoint[];
}

export interface TransitionCard {
    completedDimension: number;
    completedName: string;
    completedSummary: string;
    nextDimension: number;
    nextName: string;
    nextPreview: string;
}

export const mockCapabilityCards: CapabilityCard[] = [
    // DIMENSION 1: Financial & Business Health
    {
        screen: 1,
        dimensionId: "D1",
        dimensionName: "Financial & Business Health",
        capabilityId: "1.1",
        capabilityName: "Forecasting & Visibility",
        capabilityDescription: "This capability measures your agency's ability to see and plan financial performance with clarity. Strong forecasting enables confident decisions about investment, hiring, and growth pacing.",
        checkpoints: [
            { id: "1.1.1", title: "Data Integrity & Reporting Cadence", statement: "Financial data is current, accurate, and updated on a defined cadence. Reports reconcile revenue, expenses, and project metrics into a consistent baseline." },
            { id: "1.1.2", title: "Visibility Across Core Drivers", statement: "Leaders have unified visibility into cash flow, pipeline, delivery, and margin performance. The numbers show not just totals but drivers." },
            { id: "1.1.3", title: "Forward-Looking Forecast Mechanisms", statement: "Forecasts extend beyond historical data, modeling short- and mid-term performance scenarios. Projections update dynamically as new information arrives." },
            { id: "1.1.4", title: "Integrated Decision Dashboards", statement: "Financial, sales, and operational systems feed an integrated dashboard where leaders can monitor real-time metrics and anticipate outcomes." },
            { id: "1.1.5", title: "Predictive Insight & Confidence", statement: "Data systems reveal trends and risks automatically. Leadership trusts the numbers to guide proactive decisions on investment, hiring, or pacing." }
        ]
    },
    {
        screen: 2,
        dimensionId: "D1",
        dimensionName: "Financial & Business Health",
        capabilityId: "1.2",
        capabilityName: "Margin Discipline",
        capabilityDescription: "This capability evaluates how consistently your agency generates predictable profit and maintains financial performance across delivery cycles.",
        checkpoints: [
            { id: "1.2.1", title: "Defined Margin Targets & Pricing Logic", statement: "Profitability expectations are clearly established for each service or project type. Pricing and scoping are grounded in real delivery costs and target margins." },
            { id: "1.2.2", title: "Project-Level Margin Tracking", statement: "Profitability is monitored at the project and client level throughout delivery. Leaders can see how actuals align to projected margins in real time." },
            { id: "1.2.3", title: "Scope & Efficiency Controls", statement: "Systems exist to manage scope creep, resource utilization, and delivery efficiency—ensuring work stays within cost parameters." },
            { id: "1.2.4", title: "Margin Review & Optimization Cadence", statement: "The leadership team reviews margin performance regularly by client, service, and team to identify trends and structural inefficiencies." },
            { id: "1.2.5", title: "Profitability Culture & Accountability", statement: "Margin discipline is embedded into the agency's culture—project leads and department heads share responsibility for protecting profit." }
        ]
    },
    {
        screen: 3,
        dimensionId: "D1",
        dimensionName: "Financial & Business Health",
        capabilityId: "1.3",
        capabilityName: "Cash Flow Management",
        capabilityDescription: "Assesses how effectively the business manages cash rhythm, reserves, and liquidity stability to stay operationally confident and agile.",
        checkpoints: [
            { id: "1.3.1", title: "Cash Flow Visibility", statement: "Leadership has clear visibility into current cash position and short-term cash flow projections." },
            { id: "1.3.2", title: "Invoicing & Collections Rhythm", statement: "Invoicing is timely and accurate. Collections processes are proactive, ensuring receivables are managed effectively." },
            { id: "1.3.3", title: "Expense Management", statement: "Expenses are tracked and categorized. Spending approval processes are in place to control outflow." },
            { id: "1.3.4", title: "Reserve Building", statement: "The agency actively maintains cash reserves to buffer against market volatility or operational disruptions." },
            { id: "1.3.5", title: "Strategic Cash Deployment", statement: "Cash is managed not just for survival but as a strategic asset for planned investments and growth." }
        ]
    },
    {
        screen: 4,
        dimensionId: "D1",
        dimensionName: "Financial & Business Health",
        capabilityId: "1.4",
        capabilityName: "Financial Resilience",
        capabilityDescription: "Gauges the agency's ability to anticipate, absorb, and adapt to financial shocks through diversification, contingency systems, and foresight.",
        checkpoints: [
            { id: "1.4.1", title: "Risk Identification", statement: "Potential financial risks (client concentration, market shifts) are identified and monitored." },
            { id: "1.4.2", title: "Revenue Diversification", statement: "Revenue streams are diversified across clients or sectors to minimize dependency on any single source." },
            { id: "1.4.3", title: "Contingency Planning", statement: "Actionable contingency plans exist for various financial scenarios (e.g., revenue dip, client loss)." },
            { id: "1.4.4", title: "Debt & Liability Management", statement: "Debt levels are managed responsibly. Liabilities do not threaten operation stability." },
            { id: "1.4.5", title: "Adaptive Financial Modeling", statement: "Financial models allow for quick scenario testing to adapt strategy to changing conditions." }
        ]
    },
    {
        screen: 5,
        dimensionId: "D1",
        dimensionName: "Financial & Business Health",
        capabilityId: "1.5",
        capabilityName: "Reinvestment & Growth Readiness",
        capabilityDescription: "Examines how intentionally the agency reinvests profits and resources into high-leverage opportunities that expand capability and scalability.",
        checkpoints: [
            { id: "1.5.1", title: "Profit Allocation Strategy", statement: "A clear strategy defines how profits are allocated between owner distribution, reserves, and reinvestment." },
            { id: "1.5.2", title: "Investment Evaluation", statement: "Potential investments (hires, tech, marketing) are evaluated based on expected ROI and strategic alignment." },
            { id: "1.5.3", title: "Funding for Innovation", statement: "Resources are specifically allocated for testing new services, markets, or operational improvements." },
            { id: "1.5.4", title: "Growth Capacity Planning", statement: "Financial planning accounts for the increased costs and resource needs associated with scaling." },
            { id: "1.5.5", title: "Capital Access", statement: "The agency has access to necessary capital (lines of credit, reserves) to fund larger growth initiatives if needed." }
        ]
    },
    // DIMENSION 2: Client Base & Market Positioning
    {
        screen: 6,
        dimensionId: "D2",
        dimensionName: "Client Base & Market Positioning",
        capabilityId: "2.1",
        capabilityName: "Positioning Clarity & Differentiation",
        capabilityDescription: "Assesses how clearly the agency defines, articulates, and demonstrates its unique value in a competitive market landscape.",
        checkpoints: [
            { id: "2.1.1", title: "Target Audience Definition", statement: "The ideal client profile is clearly defined based on demographics, psychographics, and business needs." },
            { id: "2.1.2", title: "Unique Value Proposition", statement: "The agency's value proposition is distinct, compelling, and consistently communicated across all channels." },
            { id: "2.1.3", title: "Market Authority", statement: "The agency demonstrates expertise and thought leadership that builds trust with the target audience." },
            { id: "2.1.4", title: "Competitive Awareness", statement: "Leadership understands the competitive landscape and how the agency differentiates itself." },
            { id: "2.1.5", title: "Brand Consistency", statement: "Visual identity and messaging are consistent across website, proposals, and marketing materials." }
        ]
    },
    {
        screen: 7,
        dimensionId: "D2",
        dimensionName: "Client Base & Market Positioning",
        capabilityId: "2.2",
        capabilityName: "Offer & Service Alignment",
        capabilityDescription: "Measures how well the agency's service model and pricing structure align with client value, profitability, and strategic positioning.",
        checkpoints: [
            { id: "2.2.1", title: "Service Portfolio Structure", statement: "Services are organized into clear offers or packages that are easy for clients to understand and buy." },
            { id: "2.2.2", title: "Pricing Model Fit", statement: "Pricing models (hourly, flat rate, value-based) align with the value delivered and client preferences." },
            { id: "2.2.3", title: "Scalability of Offers", statement: "Service offers are designed to be delivered efficiently and can scale without linear headcount growth." },
            { id: "2.2.4", title: "Up-Sell & Cross-Sell Pathways", statement: "Clear pathways exist to move clients from initial engagement to higher-value or recurring services." },
            { id: "2.2.5", title: "Offer Evolution", statement: "Services are regularly reviewed and updated based on client feedback and market demand." }
        ]
    },
    {
        screen: 8,
        dimensionId: "D2",
        dimensionName: "Client Base & Market Positioning",
        capabilityId: "2.3",
        capabilityName: "Pipeline Health",
        capabilityDescription: "This capability evaluates your agency's ability to generate, qualify, and nurture opportunities. A healthy pipeline ensures predictable revenue momentum.",
        checkpoints: [
            { id: "2.3.1", title: "Defined Pipeline Structure", statement: "The sales pipeline has defined stages, qualification criteria, and clear conversion metrics." },
            { id: "2.3.2", title: "Marketing & Sales Workflows", statement: "Marketing and sales processes are documented, covering campaign rhythm, lead handoffs, and follow-up cadence." },
            { id: "2.3.3", title: "Ownership Clarity", statement: "Roles and responsibilities for marketing and sales activities are clearly assigned." },
            { id: "2.3.4", title: "Performance Reporting", statement: "Regular reporting tracks lead sources, conversion rates, and ROI by channel." },
            { id: "2.3.5", title: "Scalable Infrastructure", statement: "The acquisition system relies on processes and technology, not just individual heroic effort." }
        ]
    },
    {
        screen: 9,
        dimensionId: "D2",
        dimensionName: "Client Base & Market Positioning",
        capabilityId: "2.4",
        capabilityName: "Portfolio Optimization",
        capabilityDescription: "Evaluates whether the agency attracts and maintains a strategically balanced mix of ideal clients and revenue streams.",
        checkpoints: [
            { id: "2.4.1", title: "Client Concentration Risk", statement: "No single client represents a dangerous percentage of total revenue (e.g., >20%)." },
            { id: "2.4.2", title: "Ideal Client Mix", statement: "The active client roster aligns well with the defined Ideal Client Profile." },
            { id: "2.4.3", title: "Revenue Stream Balance", statement: "Revenue is balanced across project work, recurring retainers, and other streams to ensure stability." },
            { id: "2.4.4", title: "Portfolio Profitability", statement: "The profitability of different client segments is analyzed to inform acquisition strategy." },
            { id: "2.4.5", title: "Strategic Account Planning", statement: "Plans exist to grow and retain key accounts that are critical to the portfolio." }
        ]
    },
    {
        screen: 10,
        dimensionId: "D2",
        dimensionName: "Client Base & Market Positioning",
        capabilityId: "2.5",
        capabilityName: "Retention & Relationship Maturity",
        capabilityDescription: "Gauges the agency's ability to maintain durable client relationships that drive lifetime value and predictable renewals.",
        checkpoints: [
            { id: "2.5.1", title: "Onboarding Experience", statement: "A structured onboarding process sets clear expectations and builds confidence from day one." },
            { id: "2.5.2", title: "Client Satisfaction Tracking", statement: "Mechanisms (NPS, feedback calls) are in place to regularly gauge client satisfaction." },
            { id: "2.5.3", title: "Communication Rhythm", statement: "Regular status updates and strategic check-ins act as a heartbeat for the relationship." },
            { id: "2.5.4", title: "Renewal Process", statement: "A proactive renewal process begins well before contracts expire." },
            { id: "2.5.5", title: "Lifetime Value Focus", statement: "Strategies focus on maximizing client lifetime value through long-term partnership." }
        ]
    },
    // DIMENSION 3: Operational Systems & Scalability
    {
        screen: 11,
        dimensionId: "D3",
        dimensionName: "Operational Systems & Scalability",
        capabilityId: "3.1",
        capabilityName: "SOPs & Knowledge Transfer",
        capabilityDescription: "Evaluates how well the agency codifies key processes and institutional knowledge to support consistency, delegation, and scaling.",
        checkpoints: [
            { id: "3.1.1", title: "Core Process Documentation", statement: "Key delivery and operational processes are documented in SOPs." },
            { id: "3.1.2", title: "Accessibility & Adoption", statement: "SOPs are easily accessible to the team and are actively used in daily work." },
            { id: "3.1.3", title: "Knowledge Base Maintenance", statement: "A system exists to review and update documentation as processes evolve." },
            { id: "3.1.4", title: "Onboarding Training", statement: "New hires are trained using documented processes to ensure consistency." },
            { id: "3.1.5", title: "Process Ownership", statement: "Specific team members are responsible for maintaining and improving specific SOPs." }
        ]
    },
    {
        screen: 12,
        dimensionId: "D3",
        dimensionName: "Operational Systems & Scalability",
        capabilityId: "3.2",
        capabilityName: "Workflow Efficiency",
        capabilityDescription: "Gauges how effectively core workflows are streamlined to reduce waste, improve quality, and increase throughput capacity.",
        checkpoints: [
            { id: "3.2.1", title: "Workflow Mapping", statement: "Core workflows are mapped to identify steps, handoffs, and potential bottlenecks." },
            { id: "3.2.2", title: "Standardized Tools", statement: "The team uses a standardized set of tools for project management and communication." },
            { id: "3.2.3", title: "Resource Allocation", statement: "Workload is managed to prevent burnout and ensure capacity for incoming work." },
            { id: "3.2.4", title: "Quality Control", statement: "QA steps are integrated into workflows to minimize errors and rework." },
            { id: "3.2.5", title: "Continuous Improvement", statement: "Teams regularly review workflows (e.g., retrospectives) to identify areas for improvement." }
        ]
    },
    {
        screen: 13,
        dimensionId: "D3",
        dimensionName: "Operational Systems & Scalability",
        capabilityId: "3.3",
        capabilityName: "Automation & Intelligence Systems",
        capabilityDescription: "Evaluates how effectively technology and automation enhance efficiency, accuracy, and scalability.",
        checkpoints: [
            { id: "3.3.1", title: "Task Automation", statement: "Repetitive, low-value tasks are automated where possible." },
            { id: "3.3.2", title: "Integration Between Tools", statement: "Data flows automatically between key systems (e.g., CRM to Project Mgmt) to reduce manual entry." },
            { id: "3.3.3", title: "AI Adoption", statement: "The agency is exploring or using AI tools to enhance productivity or creativity." },
            { id: "3.3.4", title: "Tech Stack Review", statement: "The technology stack is regularly reviewed for relevance, cost, and efficiency." },
            { id: "3.3.5", title: "Data Security", statement: "Automation and systems adhere to security best practices to protect agency and client data." }
        ]
    },
    {
        screen: 14,
        dimensionId: "D3",
        dimensionName: "Operational Systems & Scalability",
        capabilityId: "3.4",
        capabilityName: "Data & Performance Visibility",
        capabilityDescription: "Assesses how well operational data translates into actionable insight that drives alignment and decision confidence.",
        checkpoints: [
            { id: "3.4.1", title: "KPI Definition", statement: "Key Performance Indicators (KPIs) are defined for each department/function." },
            { id: "3.4.2", title: "Dashboard Accessibility", statement: "Real-time or near real-time dashboards allow teams to track their own performance." },
            { id: "3.4.3", title: "Data Literacy", statement: "Team members understand the metrics they are measured on and how they impact the business." },
            { id: "3.4.4", title: "Review Cadence", statement: "Performance data is reviewed in regular management meetings." },
            { id: "3.4.5", title: "Leading Indicators", statement: "The agency tracks leading indicators (predictive) in addition to lagging indicators (results)." }
        ]
    },
    {
        screen: 15,
        dimensionId: "D3",
        dimensionName: "Operational Systems & Scalability",
        capabilityId: "3.5",
        capabilityName: "Role Clarity & Ownership Design",
        capabilityDescription: "Measures whether responsibilities and decision authority are clearly defined, enabling accountability and operational flow.",
        checkpoints: [
            { id: "3.5.1", title: "Job Descriptions", statement: "Current, accurate job descriptions exist for all roles." },
            { id: "3.5.2", title: "Decision Rights", statement: "It is clear who has the authority to make specific types of decisions." },
            { id: "3.5.3", title: "Accountability Structure", statement: "Reporting lines are clear, and everyone knows who they report to." },
            { id: "3.5.4", title: "Cross-Functional Handoffs", statement: "Responsibilities at the intersection of different teams are clearly defined." },
            { id: "3.5.5", title: "Role Evolution", statement: "Roles are reviewed and updated as the organization grows and needs change." }
        ]
    },
    // DIMENSION 4: Team Structure & Leadership
    {
        screen: 16,
        dimensionId: "D4",
        dimensionName: "Team Structure & Leadership",
        capabilityId: "4.1",
        capabilityName: "Org Structure & Team Scalability",
        capabilityDescription: "Examines how well the agency's structure supports growth—ensuring alignment between roles, hierarchy, and operating rhythm.",
        checkpoints: [
            { id: "4.1.1", title: "Scalable Org Chart", statement: "The organizational structure is designed to support future growth, not just current needs." },
            { id: "4.1.2", title: "Functional Departments", statement: "Clear departments or functional areas exist (Sales, Delivery, Ops) with specialized focus." },
            { id: "4.1.3", title: "Span of Control", statement: "Management ratios allow for effective supervision and support of team members." },
            { id: "4.1.4", title: "Resource Planning", statement: "Hiring plans are aligned with financial forecasts and sales pipelines." },
            { id: "4.1.5", title: "Flexibility", statement: "The structure allows for agility—teams can scale up or reorganize as priorities shift." }
        ]
    },
    {
        screen: 17,
        dimensionId: "D4",
        dimensionName: "Team Structure & Leadership",
        capabilityId: "4.2",
        capabilityName: "Talent Development",
        capabilityDescription: "Evaluates how strategically the agency attracts, develops, and retains talent aligned with its growth objectives.",
        checkpoints: [
            { id: "4.2.1", title: "Recruiting Strategy", statement: "A proactive recruiting strategy attracts high-quality candidates aligned with culture." },
            { id: "4.2.2", title: "Onboarding Process", statement: "New hires go through a structured onboarding that covers culture, tools, and job expectations." },
            { id: "4.2.3", title: "Skill Development", statement: "Opportunities and budget exist for professional development and training." },
            { id: "4.2.4", title: "Career Pathways", statement: "Potential career paths and advancement criteria are visible to employees." },
            { id: "4.2.5", title: "Retention Focus", statement: "The agency actively monitors employee engagement and addresses retention risks." }
        ]
    },
    {
        screen: 18,
        dimensionId: "D4",
        dimensionName: "Team Structure & Leadership",
        capabilityId: "4.3",
        capabilityName: "Leadership Effectiveness & Leverage",
        capabilityDescription: "Gauges how well leaders delegate, make timely decisions, and lead through influence rather than dependency.",
        checkpoints: [
            { id: "4.3.1", title: "Delegation & Trust", statement: "Founders and senior leaders effectively delegate tasks and authority to capable team members." },
            { id: "4.3.2", title: "Communication Skills", statement: "Leaders communicate vision, strategy, and feedback clearly and consistently." },
            { id: "4.3.3", title: "Coaching Mindset", statement: "Leaders prioritize coaching and developing their teams over simply directing work." },
            { id: "4.3.4", title: "Decision Speed", statement: "Leadership makes timely decisions to keep the organization moving forward." },
            { id: "4.3.5", title: "Modeling Values", statement: "Leaders consistently embody the agency's core values and culture." }
        ]
    },
    {
        screen: 19,
        dimensionId: "D4",
        dimensionName: "Team Structure & Leadership",
        capabilityId: "4.4",
        capabilityName: "Performance Management & Accountability Systems",
        capabilityDescription: "Assesses how consistently goals, feedback, and performance metrics are used to drive accountability and progress.",
        checkpoints: [
            { id: "4.4.1", title: "Goal Setting", statement: "Clear, measurable goals are set for individuals and teams on a regular cadence." },
            { id: "4.4.2", title: "Feedback Loops", statement: "Regular 1:1s and performance reviews provide continuous feedback." },
            { id: "4.4.3", title: "Performance Metrics", statement: "Performance is evaluated based on data and objective criteria where possible." },
            { id: "4.4.4", title: "Recognition", statement: "Achievements and high performance are regularly recognized and rewarded." },
            { id: "4.4.5", title: "Managing Underperformance", statement: "A process exists for addressing underperformance constructively and directly." }
        ]
    },
    {
        screen: 20,
        dimensionId: "D4",
        dimensionName: "Team Structure & Leadership",
        capabilityId: "4.5",
        capabilityName: "Culture, Communication & Team Cohesion",
        capabilityDescription: "Evaluates how the organization cultivates trust, clarity, and collaboration.",
        checkpoints: [
            { id: "4.5.1", title: "Core Values", statement: "Core values are defined, communicated, and used to guide hiring and decisions." },
            { id: "4.5.2", title: "Internal Communication", statement: "Channels and rituals (All-Hands, Slack) facilitate transparent communication." },
            { id: "4.5.3", title: "Psychological Safety", statement: "Team members feel safe to speak up, share ideas, and admit mistakes." },
            { id: "4.5.4", title: "Collaboration", statement: "Cross-functional collaboration is encouraged and supported by tools/processes." },
            { id: "4.5.5", title: "Remote/Hybrid Culture", statement: "Culture building is intentional, especially if the team is remote or hybrid." }
        ]
    },
    // DIMENSION 5: Strategic Stewardship
    {
        screen: 21,
        dimensionId: "D5",
        dimensionName: "Strategic Stewardship",
        capabilityId: "5.1",
        capabilityName: "Vision & Strategic Clarity",
        capabilityDescription: "Measures the leadership's ability to define a clear, inspiring vision and align the organization toward that future.",
        checkpoints: [
            { id: "5.1.1", title: "Long-Term Vision", statement: "A compelling 3-5 year vision describes the agency's future state." },
            { id: "5.1.2", title: "Strategic Positioning", statement: "The strategy clearly articulates where the agency plays and how it wins." },
            { id: "5.1.3", title: "Alignment", statement: "The entire team understands the vision and how their work contributes to it." },
            { id: "5.1.4", title: "Focus", statement: "The agency says 'no' to opportunities that do not align with the strategy." },
            { id: "5.1.5", title: "Communication", statement: "Vision and strategy are reiterated frequently to keep them top of mind." }
        ]
    },
    {
        screen: 22,
        dimensionId: "D5",
        dimensionName: "Strategic Stewardship",
        capabilityId: "5.2",
        capabilityName: "Strategic Planning & Decision Governance",
        capabilityDescription: "Evaluates how consistently the organization plans, aligns, and governs strategic decisions.",
        checkpoints: [
            { id: "5.2.1", title: "Planning Rhythm", statement: "An annual and quarterly planning process is in place and adhered to." },
            { id: "5.2.2", title: "Data-Driven Decisions", statement: "Strategic decisions are informed by data, not just intuition." },
            { id: "5.2.3", title: "Prioritization", statement: "Resources are allocated to a limited number of key strategic initiatives." },
            { id: "5.2.4", title: "Execution Tracking", statement: "Progress on strategic initiatives is tracked and reviewed regularly." },
            { id: "5.2.5", title: "Adaptability", statement: "The strategy is reviewed and adjusted based on market changes and performance." }
        ]
    },
    {
        screen: 23,
        dimensionId: "D5",
        dimensionName: "Strategic Stewardship",
        capabilityId: "5.3",
        capabilityName: "Financial & Capital Stewardship",
        capabilityDescription: "Assesses how leadership manages financial resources and capital allocation to balance growth, risk, and sustainability.",
        checkpoints: [
            { id: "5.3.1", title: "Capital Efficiency", statement: "Capital is deployed efficiently to maximize return on investment." },
            { id: "5.3.2", title: "Risk Management", statement: "Financial risks are actively managed to protect the agency's longevity." },
            { id: "5.3.3", title: "Owner Compensation", statement: "Owner compensation is market-based and separated from profit distributions." },
            { id: "5.3.4", title: "Asset Building", statement: "The agency is building value as an asset, separate from the owners' daily labor." },
            { id: "5.3.5", title: "Investment Horizon", statement: "Financial decisions balance short-term cash needs with long-term value creation." }
        ]
    },
    {
        screen: 24,
        dimensionId: "D5",
        dimensionName: "Strategic Stewardship",
        capabilityId: "5.4",
        capabilityName: "Performance Governance & Org Intelligence",
        capabilityDescription: "Gauges how the leadership team reviews performance, learns from outcomes, and adapts organizational strategy.",
        checkpoints: [
            { id: "5.4.1", title: "Scorecards/Dashboards", statement: "A balanced scorecard or dashboard tracks health across all dimensions." },
            { id: "5.4.2", title: "Learning Culture", statement: "Failures are viewed as learning opportunities; retrospectives are standard practice." },
            { id: "5.4.3", title: "Market Intelligence", statement: "The agency actively monitors client industries and broader market trends." },
            { id: "5.4.4", title: "Advisory/Mentorship", statement: "Leadership seeks outside perspective (advisors, coaches, peer groups)." },
            { id: "5.4.5", title: "Intellectual Property", statement: "The agency captures its methodologies and data as proprietary IP." }
        ]
    },
    {
        screen: 25,
        dimensionId: "D5",
        dimensionName: "Strategic Stewardship",
        capabilityId: "5.5",
        capabilityName: "Transferability & Continuity Design",
        capabilityDescription: "Measures how well the agency is built for independence, adaptability, and continuity—sustaining success beyond its founder.",
        checkpoints: [
            { id: "5.5.1", title: "Owner Dependency", statement: "The agency can operate effectively for significant periods without the owner(s)." },
            { id: "5.5.2", title: "Succession Planning", statement: "Plans exist for leadership succession in key roles." },
            { id: "5.5.3", title: "Key Person Risk", statement: "Knowledge and relationships are distributed to minimize key person risk." },
            { id: "5.5.4", title: "Legal & Compliance", statement: "Legal structures, contracts, and IP protections are robust and up to date." },
            { id: "5.5.5", title: "Exit Readiness", statement: "The business considers factors that would maximize value in a potential sale." }
        ]
    }
];

export const mockTransitionCards: TransitionCard[] = [
    {
        completedDimension: 1,
        completedName: "Financial & Business Health",
        completedSummary: "You've evaluated your agency's financial visibility, margin discipline, cash flow management, resilience, and reinvestment readiness.",
        nextDimension: 2,
        nextName: "Client Base & Market Positioning",
        nextPreview: "In this section, you'll assess your positioning clarity, offer alignment, pipeline health, portfolio optimization, and client retention strategies."
    },
    {
        completedDimension: 2,
        completedName: "Client Base & Market Positioning",
        completedSummary: "You've assessed your positioning, offer structure, pipeline systems, portfolio balance, and client relationship maturity.",
        nextDimension: 3,
        nextName: "Operational Efficiency & Scalability",
        nextPreview: "Next, you'll evaluate your operational processes, workflow efficiency, automation systems, performance visibility, and role clarity."
    },
    {
        completedDimension: 3,
        completedName: "Operational Systems & Scalability",
        completedSummary: "You've reviewed your documentation, workflows, automation, data usage, and role clarity.",
        nextDimension: 4,
        nextName: "Team Structure & Leadership",
        nextPreview: "Now, let's look at your org structure, talent development, leadership effectiveness, and team culture."
    },
    {
        completedDimension: 4,
        completedName: "Team Structure & Leadership",
        completedSummary: "You've evaluated your team structure, talent strategies, leadership habits, and cultural cohesion.",
        nextDimension: 5,
        nextName: "Strategic Stewardship",
        nextPreview: "Finally, we'll assess your long-term vision, strategic planning, capital stewardship, and exit readiness."
    }
];
