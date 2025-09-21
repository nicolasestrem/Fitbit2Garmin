import React, { Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import App from "./App";

const HomePage = React.lazy(() => import("./pages/HomePage"));
const ProductOverviewPage = React.lazy(() => import("./pages/product/OverviewPage"));
const ProductHowItWorksPage = React.lazy(() => import("./pages/product/HowItWorksPage"));
const ConvertersPage = React.lazy(() => import("./pages/converters/ConvertersPage"));
const WeightConverterPage = React.lazy(() => import("./pages/converters/WeightConverterPage"));
const DocsPage = React.lazy(() => import("./pages/DocsPage"));
const BlogPage = React.lazy(() => import("./pages/BlogPage"));
const PricingPage = React.lazy(() => import("./pages/PricingPage"));
const ContactPage = React.lazy(() => import("./pages/ContactPage"));
const PrivacyPage = React.lazy(() => import("./pages/PrivacyPage"));
const NotFoundPage = React.lazy(() => import("./pages/NotFoundPage"));

// Coming soon converter routes will share one template (added later)
const ComingSoonPage = React.lazy(() => import("./pages/converters/ComingSoonPage"));

const AppPage = React.lazy(() => import("./pages/AppPage"));

const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense
    fallback={
      <div className="flex min-h-[320px] items-center justify-center text-slate-500">
        Loading...
      </div>
    }
  >
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: withSuspense(HomePage),
      },
      {
        path: "product",
        element: withSuspense(ProductOverviewPage),
      },
      {
        path: "product/how-it-works",
        element: withSuspense(ProductHowItWorksPage),
      },
      {
        path: "converters",
        element: withSuspense(ConvertersPage),
      },
      {
        path: "converters/weight",
        element: withSuspense(WeightConverterPage),
      },
      {
        path: "converters/body-fat",
        element: withSuspense(ComingSoonPage),
      },
      {
        path: "converters/bmi",
        element: withSuspense(ComingSoonPage),
      },
      {
        path: "converters/resting-heart-rate",
        element: withSuspense(ComingSoonPage),
      },
      {
        path: "converters/sleep-score",
        element: withSuspense(ComingSoonPage),
      },
      {
        path: "docs",
        element: withSuspense(DocsPage),
      },
      {
        path: "blog",
        element: withSuspense(BlogPage),
      },
      {
        path: "pricing",
        element: withSuspense(PricingPage),
      },
      {
        path: "contact",
        element: withSuspense(ContactPage),
      },
      {
        path: "privacy",
        element: withSuspense(PrivacyPage),
      },
      {
        path: "app",
        element: withSuspense(AppPage),
      },
      {
        path: "*",
        element: withSuspense(NotFoundPage),
      },
    ],
  },
]);
