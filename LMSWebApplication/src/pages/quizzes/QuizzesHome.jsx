import React from 'react';
import { Link } from 'react-router-dom';

// PUBLIC_INTERFACE
export default function QuizzesHome() {
  return (
    <div className="container" style={{ padding: 24 }}>
      <h2>Quizzes</h2>
      <ul>
        <li><Link to="/quizzes/new">Create Quiz</Link></li>
        <li><Link to="/quizzes/take">Take Quiz</Link></li>
      </ul>
      <small>Note: Implement detailed quiz builder and taker flows incrementally.</small>
    </div>
  );
}
