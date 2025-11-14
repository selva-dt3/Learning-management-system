import React from 'react';
import { Link } from 'react-router-dom';

// PUBLIC_INTERFACE
export default function QuizzesHome() {
  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>Quizzes</h2>
      <ul>
        <li><Link to="/quizzes/new">Create Quiz</Link></li>
        <li><Link to="/quizzes/bank">Question Bank</Link></li>
        <li><Link to="/quizzes/assignments">Assignments</Link></li>
        <li><Link to="/quizzes/take">Take Quiz</Link></li>
        <li><Link to="/quizzes/reviews">Admin Reviews</Link></li>
      </ul>
      <small>Use Assignments to assign quizzes to users, departments (groups), or lessons. RLS policies enforce visibility and attempts.</small>
    </div>
  );
}
