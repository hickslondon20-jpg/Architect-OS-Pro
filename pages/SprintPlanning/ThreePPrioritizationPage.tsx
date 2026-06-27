import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ThreePExercise } from '../../components/pro-suite/quarter-map/ThreePExercise';

export const ThreePPrioritizationPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <ThreePExercise
      headingLabel="3P Prioritization"
      onPostLock={() => navigate('/pro/planning/sprint-planning/board')}
    />
  );
};
