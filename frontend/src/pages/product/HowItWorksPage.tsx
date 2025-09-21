import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const HowItWorksPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <Helmet>
        <title>How Trackersync Works</title>
        <meta
          name="description"
          content="See the full flow for exporting Fitbit data, converting it to .fit, and importing into Garmin Connect with Trackersync."
        />
        <link rel="canonical" href="https://trackersync.app/product/how-it-works" />
      </Helmet>

      <header className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600">Product</p>
        <h1 className="text-3xl font-bold text-slate-900">How it works</h1>
        <p className="text-lg text-slate-600">
          Trackersync focuses on a simple four-step flow. Export from Fitbit, convert locally, and import into Garmin with confidence.
        </p>
      </header>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <ol className="space-y-6 text-slate-600">
          <li>
            <h2 className="text-xl font-semibold text-slate-900">1. Export your Fitbit data</h2>
            <p className="mt-2">
              Use Google Takeout to request your Fitbit data. When the archive is ready, extract the <code className="rounded bg-slate-100 px-2 py-1">Global Export Data</code> folder to access your measurement files.
            </p>
          </li>
          <li>
            <h2 className="text-xl font-semibold text-slate-900">2. Pick the right JSON files</h2>
            <p className="mt-2">
              For weight, look for files named <code className="rounded bg-slate-100 px-2 py-1">weight-YYYY-MM-DD.json</code>. Each file contains a slice of your measurements.
            </p>
          </li>
          <li>
            <h2 className="text-xl font-semibold text-slate-900">3. Convert in your browser</h2>
            <p className="mt-2">
              Drag the files into Trackersync. They are parsed locally, validated, and converted to Garmin-compatible <strong>.fit</strong> files. No upload, no waiting on a queue.
            </p>
          </li>
          <li>
            <h2 className="text-xl font-semibold text-slate-900">4. Import into Garmin Connect</h2>
            <p className="mt-2">
              Download the generated .fit files and import them at <a href="https://connect.garmin.com/modern/import-data" className="text-blue-600 underline">connect.garmin.com</a>. Garmin adds new entries without touching existing history.
            </p>
          </li>
        </ol>
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Need a quick reference?</h2>
        <p className="text-slate-600">
          The docs cover exporting with Google Takeout, understanding Fitbit&apos;s JSON schema, and troubleshooting Garmin imports.
        </p>
        <Link
          to="/docs"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Read the docs
        </Link>
      </section>
    </div>
  );
};

export default HowItWorksPage;
