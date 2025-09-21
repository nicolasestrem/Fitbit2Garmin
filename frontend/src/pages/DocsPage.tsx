import React from "react";
import { Helmet } from "react-helmet-async";

const DocsPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <Helmet>
        <title>Trackersync Docs - Export, convert, import</title>
        <meta
          name="description"
          content="Learn how to export Fitbit data, convert it to .fit, and import to Garmin."
        />
        <link rel="canonical" href="https://trackersync.app/docs" />
      </Helmet>

      <header className="space-y-3">
        <h1 className="text-3xl font-bold text-slate-900">Docs</h1>
        <p className="text-lg text-slate-600">
          Guides to help you export, convert, and import your measurements.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Topics</h2>
        <ul className="grid gap-3 text-slate-600">
          <li>Exporting data with Google Takeout</li>
          <li>Understanding the Fitbit weight JSON format</li>
          <li>How we generate .fit files</li>
          <li>Troubleshooting a rejected import</li>
          <li>Privacy and local processing</li>
        </ul>
      </section>
    </div>
  );
};

export default DocsPage;
