import { Routes, Route } from 'react-router-dom';
import { PublicLayout } from '../components/layout/PublicLayout.jsx';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { AdminLayout } from '../components/layout/AdminLayout.jsx';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { ProtectedRoute, AdminRoute, GuestRoute } from '../components/RouteGuards.jsx';

import Home from '../pages/public/Home.jsx';
import NotFound from '../pages/public/NotFound.jsx';

import Login from '../pages/auth/Login.jsx';
import Register from '../pages/auth/Register.jsx';
import ForgotPassword from '../pages/auth/ForgotPassword.jsx';
import ResetPassword from '../pages/auth/ResetPassword.jsx';

import Dashboard from '../pages/app/Dashboard.jsx';
import Categories from '../pages/app/Categories.jsx';
import PracticeSetup from '../pages/app/PracticeSetup.jsx';
import MockExam from '../pages/app/MockExam.jsx';
import Progress from '../pages/app/Progress.jsx';
import Bookmarks from '../pages/app/Bookmarks.jsx';
import Mistakes from '../pages/app/Mistakes.jsx';
import Notifications from '../pages/app/Notifications.jsx';
import Profile from '../pages/app/Profile.jsx';
import Settings from '../pages/app/Settings.jsx';
import QuizRunner from '../pages/quiz/QuizRunner.jsx';

import AdminDashboard from '../pages/admin/AdminDashboard.jsx';
import AdminQuestions from '../pages/admin/AdminQuestions.jsx';
import AdminQuestionEditor from '../pages/admin/AdminQuestionEditor.jsx';
import AdminReviewQueue from '../pages/admin/AdminReviewQueue.jsx';
import AdminCategories from '../pages/admin/AdminCategories.jsx';
import AdminUsers from '../pages/admin/AdminUsers.jsx';
import AdminReports from '../pages/admin/AdminReports.jsx';
import AdminImports from '../pages/admin/AdminImports.jsx';
import AdminAnalytics from '../pages/admin/AdminAnalytics.jsx';
import AdminAudit from '../pages/admin/AdminAudit.jsx';
import AdminSettings from '../pages/admin/AdminSettings.jsx';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} />
        <Route path="practice" element={<PracticeSetup />} />
        <Route path="mock" element={<MockExam />} />
      </Route>

      {/* Auth */}
      <Route element={<GuestRoute />}>
        <Route element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="reset-password" element={<ResetPassword />} />
        </Route>
      </Route>

      {/* Quiz (full screen, authenticated) */}
      <Route element={<ProtectedRoute />}>
        <Route path="quiz/:id" element={<QuizRunner />} />
      </Route>

      {/* Student app */}
      <Route element={<ProtectedRoute />}>
        <Route path="app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="categories" element={<Categories />} />
          <Route path="practice" element={<PracticeSetup />} />
          <Route path="mock" element={<MockExam />} />
          <Route path="progress" element={<Progress />} />
          <Route path="bookmarks" element={<Bookmarks />} />
          <Route path="mistakes" element={<Mistakes />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      {/* Admin */}
      <Route element={<AdminRoute />}>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="questions" element={<AdminQuestions />} />
          <Route path="questions/new" element={<AdminQuestionEditor />} />
          <Route path="questions/:id" element={<AdminQuestionEditor />} />
          <Route path="review" element={<AdminReviewQueue />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="imports" element={<AdminImports />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="audit" element={<AdminAudit />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
