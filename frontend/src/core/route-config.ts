import React, { lazy } from "react";

const Login = lazy(() => import("@/pages/login-page"));
const Register = lazy(() => import("@/pages/register-page"));
const OtpVerification = lazy(() => import("@/pages/otp-verification-page"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password-page"));
const ResetPassword = lazy(() => import("@/pages/reset-password-page"));
const Home = lazy(() => import("@/pages/home-page"));
const Profile = lazy(() => import("@/pages/profile-page"));
const UserList = lazy(() => import("@/pages/admin/user-list-page"));
const UserDetails = lazy(() => import("@/pages/admin/user-detail-page"));
const MasterData = lazy(() => import("@/pages/admin/master-data-page"));
const MyDocument = lazy(() => import("@/pages/document/my-document/my-document-page"));
const MyDocumentDetail = lazy(() => import("@/pages/document/my-document/my-document-detail-page"));
const DocumentDetail = lazy(() => import("@/pages/document/discover/document-detail-page"));
const DocumentPreference = lazy(() => import("@/pages/document/document-preferences-page"));
const DocumentUserHistory = lazy(() => import("@/pages/document/document-user-history-page"));
const ReportsManagement = lazy(() => import("@/pages/admin/reports-management-page"));

export interface Route {
  path: string;
  pageTitle: string;
  component: React.LazyExoticComponent<React.FC>;
  isSecure: boolean;
  permission?: string[];
  subPages?: Route[];
}

export const RoutePaths = {
  UNAUTHORIZED: "/unauthorized",
  HOME: "/home",
  LOGIN: "/login",
  REGISTER: "/register",
  FORGOT_PASSWORD: "/forgot-password",
  RESET_PASSWORD: "/reset-password",
  VERIFY_OTP: "/verify-otp",
  PROFILE: "/profile",
  MY_DOCUMENT: "/documents/me",
  MY_DOCUMENT_DETAIL: "/documents/me/:documentId",
  DOCUMENT_DETAIL: "/discover/:documentId",
  DOCUMENT_PREFERENCE: "/document-prefs",
  DOCUMENT_USER_HISTORY: "/document-history",
  ADMIN: {
    USERS: "/admin/users",
    USER_DETAILS: "/admin/users/:userId",
    MASTER_DATA: "/admin/master-data",
    REPORTS: "/admin/reports",
  },
} as const;

export const routes: Route[] = [
  {
    path: RoutePaths.LOGIN,
    pageTitle: "Login",
    component: Login,
    isSecure: false,
  },
  {
    path: RoutePaths.REGISTER,
    pageTitle: "Sign Up",
    component: Register,
    isSecure: false,
  },
  {
    path: RoutePaths.VERIFY_OTP,
    pageTitle: "pages.verify-otp",
    component: OtpVerification,
    isSecure: false,
  },
  {
    path: RoutePaths.FORGOT_PASSWORD,
    pageTitle: "Forgot Password",
    component: ForgotPassword,
    isSecure: false,
  },
  {
    path: RoutePaths.RESET_PASSWORD,
    pageTitle: "Reset Password",
    component: ResetPassword,
    isSecure: false,
  },
  {
    path: RoutePaths.HOME,
    pageTitle: "pages.home",
    component: Home,
    isSecure: true,
    permission: [],
  },
  {
    path: RoutePaths.PROFILE,
    pageTitle: "pages.profile",
    component: Profile,
    isSecure: true,
    permission: [],
  },
  {
    path: RoutePaths.MY_DOCUMENT,
    pageTitle: "pages.my-document",
    component: MyDocument,
    isSecure: true,
    permission: ["ROLE_MENTOR", "ROLE_USER"],
  },
  {
    path: RoutePaths.MY_DOCUMENT_DETAIL,
    pageTitle: "pages.my-document.detail",
    component: MyDocumentDetail,
    isSecure: true,
    permission: ["ROLE_MENTOR", "ROLE_USER"],
  },
  {
    path: RoutePaths.DOCUMENT_DETAIL,
    pageTitle: "pages.document-discover.detail",
    component: DocumentDetail,
    isSecure: true,
    permission: [],
  },
  {
    path: RoutePaths.DOCUMENT_PREFERENCE,
    pageTitle: "pages.document-preferences",
    component: DocumentPreference,
    isSecure: true,
    permission: [],
  },
  {
    path: RoutePaths.DOCUMENT_USER_HISTORY,
    pageTitle: "pages.document-user-history",
    component: DocumentUserHistory,
    isSecure: true,
    permission: [],
  },
  // Admin Routes
  {
    path: RoutePaths.ADMIN.USERS,
    pageTitle: "pages.admin.users",
    component: UserList,
    isSecure: true,
    permission: ["ROLE_ADMIN"],
  },
  {
    path: RoutePaths.ADMIN.USER_DETAILS,
    pageTitle: "pages.admin.userDetail",
    component: UserDetails,
    isSecure: true,
    permission: ["ROLE_ADMIN"],
  },
  {
    path: RoutePaths.ADMIN.MASTER_DATA,
    pageTitle: "pages.admin.masterData",
    component: MasterData,
    isSecure: true,
    permission: ["ROLE_ADMIN"],
  },
  {
    path: RoutePaths.ADMIN.REPORTS,
    pageTitle: "pages.admin.reports",
    component: ReportsManagement,
    isSecure: true,
    permission: ["ROLE_ADMIN"],
  },
];

export const getRoutes = (initRoutes = routes): Route[] => {
  const flattenRoutes = (routes: Route[]): Route[] => {
    return routes.reduce<Route[]>((acc, route) => {
      acc.push(route);
      if (route.subPages && route.subPages.length > 0) {
        acc.push(...flattenRoutes(route.subPages));
      }
      return acc;
    }, []);
  };

  return flattenRoutes(initRoutes);
};
