import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const NotFoundPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-3xl space-y-6 text-center">
      <Helmet>
        <title>Page not found - Trackersync</title>
      </Helmet>
      <h1 className="text-4xl font-bold text-slate-900">404</h1>
      <p className="text-lg text-slate-600">
        This page is not ready yet. Head back to the converters or home.
      </p>
      <div className="flex justify-center gap-3">
        <Link to="/" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Go home</Link>
        <Link to="/converters" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900">Converters</Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
