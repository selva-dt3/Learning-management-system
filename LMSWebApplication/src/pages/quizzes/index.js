import React from 'react';
import { Routes, Route } from 'react-router-dom';
import QuizzesHome from './QuizzesHome';
import TakeQuiz from './TakeQuiz';
import QuizBuilder from './QuizBuilder';

export default function QuizzesRoutes() {
  return (
    <Routes>
      <Route index element={<QuizzesHome />} />
      <Route path="take" element={<TakeQuiz />} />
      <Route path="new" element={<QuizBuilder />} />
    </Routes>
  );
}
