import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export type SprintStatus =
    | 'NO_SPRINT'
    | 'PRE_LAUNCH'
    | 'ACTIVE'
    | 'WIND_DOWN'
    | 'CLOSED_RETRO_PENDING'
    | 'CLOSED_COMPLETE';

export interface SprintState {
    status: SprintStatus;
    daysElapsed: number | null;
    daysRemaining: number | null;
    windDownThreshold: boolean;
    sprintId?: string | null;
    sprintName?: string | null;
    sprintGoal?: string | null;
    isLoading?: boolean;
}

export function useSprintState(): SprintState {
    const { user } = useAuth();
    const [state, setState] = useState<SprintState>({
        status: 'NO_SPRINT',
        daysElapsed: null,
        daysRemaining: null,
        windDownThreshold: false,
        isLoading: true,
    });

    useEffect(() => {
        if (!user) {
            setState(s => ({ ...s, isLoading: false }));
            return;
        }

        const fetchSprintState = async () => {
            try {
                const { data: sprint, error } = await supabase
                    .from('sp_sprint_goals')
                    .select('*')
                    .eq('user_id', user.id)
                    .neq('status', 'draft')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();

                const DEV_MODE_MOCK_EMPTY_SPRINTS = true;

                if (error || !sprint) {
                    if (DEV_MODE_MOCK_EMPTY_SPRINTS) {
                        setState({
                            status: 'ACTIVE',
                            daysElapsed: 28,
                            daysRemaining: 56,
                            windDownThreshold: false,
                            sprintId: 'mock-sprint-123',
                            sprintName: 'Mock Sprint (No DB Data)',
                            sprintGoal: 'This is a mocked sprint goal because no active sprint was found in the database. Turn off DEV_MODE_MOCK_EMPTY_SPRINTS in useSprintState.ts to see the true NO_SPRINT state.',
                            isLoading: false,
                        });
                    } else {
                        setState({
                            status: 'NO_SPRINT',
                            daysElapsed: null,
                            daysRemaining: null,
                            windDownThreshold: false,
                            isLoading: false,
                        });
                    }
                    return;
                }

                const baseInfo = {
                    sprintId: sprint.id,
                    sprintName: sprint.name || `Sprint 1 — ${sprint.goal_text.substring(0, 30)}...`,
                    sprintGoal: sprint.goal_text,
                    isLoading: false,
                };

                // Closed - Complete
                if (sprint.retrospective_completed_at) {
                    setState({
                        ...baseInfo,
                        status: 'CLOSED_COMPLETE',
                        daysElapsed: 84,
                        daysRemaining: 0,
                        windDownThreshold: true,
                    });
                    return;
                }

                // Pre-Launch
                if (!sprint.kickoff_date || new Date(sprint.kickoff_date) > new Date()) {
                    setState({
                        ...baseInfo,
                        status: 'PRE_LAUNCH',
                        daysElapsed: null,
                        daysRemaining: null,
                        windDownThreshold: false,
                    });
                    return;
                }

                // Calculate days elapsed from kickoff
                const today = new Date();
                const kickoff = new Date(sprint.kickoff_date);

                // Align to start of day for accurate day counts
                const startOfKickoff = new Date(kickoff.getFullYear(), kickoff.getMonth(), kickoff.getDate());
                const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

                const diffTime = startOfToday.getTime() - startOfKickoff.getTime();
                const daysElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                const daysRemaining = Math.max(0, 84 - daysElapsed);
                const windDownThreshold = daysElapsed >= 63;

                // Closed - Retro Pending
                if (daysElapsed >= 84 || sprint.manually_closed_at) {
                    setState({
                        ...baseInfo,
                        status: 'CLOSED_RETRO_PENDING',
                        daysElapsed,
                        daysRemaining: 0,
                        windDownThreshold: true,
                    });
                    return;
                }

                // Wind-Down
                if (windDownThreshold) {
                    setState({
                        ...baseInfo,
                        status: 'WIND_DOWN',
                        daysElapsed,
                        daysRemaining,
                        windDownThreshold,
                    });
                    return;
                }

                // Active
                setState({
                    ...baseInfo,
                    status: 'ACTIVE',
                    daysElapsed,
                    daysRemaining,
                    windDownThreshold,
                });

            } catch (err) {
                console.error('Error fetching sprint state:', err);
                setState(s => ({ ...s, isLoading: false, status: 'NO_SPRINT' }));
            }
        };

        fetchSprintState();
    }, [user]);

    return state;
}
