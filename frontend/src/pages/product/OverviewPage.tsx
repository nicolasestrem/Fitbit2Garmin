import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const OverviewPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <Helmet>
        <title>Trackersync Product Overview</title>
        <meta
          name="description"
          content="See how Trackersync converts Fitbit Google Takeout files into Garmin-ready .fit files with local processing and clean timestamps."
        />
        <link rel="canonical" href="https://trackersync.app/product" />
      </Helmet>

      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Product</p>
        <h1 className="text-3xl font-bold text-slate-900">Overview</h1>
        <p className="text-lg text-slate-600">
          Trackersync gives you a reliable path to move Fitbit Google Takeout exports into Garmin Connect. Import clean .fit files with the correct timestamps, units, and optional body fat data intact.
        </p>
      </header>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Key capabilities</h2>
        <ul className="grid gap-4 text-slate-600">
          <li><strong className="text-slate-900">Fitbit Google Takeout ready.</strong> Upload the exported weight-YYYY-MM-DD.json files without any pre-processing.</li>
          <li><strong className="text-slate-900">Garmin-compatible .fit output.</strong> Each file is generated using Garmin&apos;s weight profile specification, so you can import without editing.</li>
          <li><strong className="text-slate-900">Exact timestamps preserved.</strong> The converter respects the original measurement date, time, and timezone offset.</li>
          <li><strong className="text-slate-900">Local-only processing.</strong> Files are read in the browser. Nothing is sent to a server.</li>
        </ul>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Why it matters</h2>
        <p className="text-slate-600">
          Garmin Connect does not let third-party apps write weight data directly. Trackersync bridges the two ecosystems with a safe offline workflow. Your history stays under your control and your Garmin trends remain accurate.
        </p>
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Next up</h2>
        <p className="text-slate-600">
          Additional converters are in progress: body fat, BMI, resting heart rate, and sleep score. They will follow the same local-processing playbook with clean Garmin imports.
        </p>
        <Link
          to="/converters"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Explore converters
        </Link>
      </section>
    </div>
  );
};

export default OverviewPage;


