import React, { useEffect, useState } from 'react';
import { SectionLayout } from '../../Layouts';
import { supabase } from '../../../lib/supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { Outlet } from 'react-router-dom';

export const AELadderLayout: React.FC = () => {
    const { user } = useAuth();
    const [isCompleted, setIsCompleted] = useState(false);

    useEffect(() => {
        const fetchStatus = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from('ae_assessments')
                    .select('assessment_complete_flag')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (data) {
                    setIsCompleted(!!data.assessment_complete_flag);
                }
            } catch (err) {
                console.error("Error fetching assessment status:", err);
            }
        };
        fetchStatus();
    }, [user]);

    const tabs = [
        { label: 'Assessment Intro', href: '/diagnostics/ae-ladder/intro' },
        { label: 'Assessment Wizard', href: '/diagnostics/ae-ladder/assessment', isLocked: isCompleted },
        { label: 'Results Dashboard', href: '/diagnostics/ae-ladder/results-dashboard' },
    ];

    return <SectionLayout eyebrow="Diagnostics" title="AE Ladder Assessment" tabs={tabs} />;
};
