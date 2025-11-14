import React from 'react';
import { Routes, Route } from 'react-router-dom';
import QuizzesHome from './QuizzesHome';
import TakeQuiz from './TakeQuiz';
import QuizBuilder from './QuizBuilder';
import QuestionBank from './QuestionBank';
import AdminReviews from './AdminReviews';

export default function QuizzesRoutes() {
  return (
    <Routes>
      <Route index element={<QuizzesHome />} />
      <Route path="take" element={<TakeQuiz />} />
      <Route path="new" element={<QuizBuilder />} />
      <Route path="bank" element={<QuestionBank />} />
      <Route path="reviews" element={<AdminReviews />} />
    </Routes>
  );
}
