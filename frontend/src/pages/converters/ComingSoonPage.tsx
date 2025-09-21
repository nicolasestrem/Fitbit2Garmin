import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const converterMeta: Record<string, { title: string; metric: string; description: string }> = {
  "body-fat": {
    title: "Body fat converter - coming soon",
    metric: "Body fat",
    description: "We are building a clean path to move your body fat data from Fitbit Google Takeout into Garmin.",
  },
  "bmi": {
    title: "BMI converter - coming soon",
    metric: "BMI",
    description: "We are building a clean path to move your BMI data from Fitbit Google Takeout into Garmin.",
  },
  "resting-heart-rate": {
    title: "Resting heart rate converter - coming soon",
    metric: "Resting heart rate",
    description: "We are building a clean path to move your resting heart rate data from Fitbit Google Takeout into Garmin.",
  },
  "sleep-score": {
    title: "Sleep score converter - coming soon",
    metric: "Sleep score",
    description: "We are building a clean path to move your sleep score data from Fitbit Google Takeout into Garmin.",
  },
};

const ComingSoonPage: React.FC = () => {
  const location = useLocation();
  const slug = location.pathname.split("/").filter(Boolean).pop() ?? "body-fat";
  const meta = converterMeta[slug] ?? converterMeta["body-fat"];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Helmet>
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={`https://trackersync.app/converters/${slug}`} />
      </Helmet>

      <header className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">{meta.metric} converter - coming soon</h1>
        <p className="text-lg text-slate-600">
          {meta.description} Add your email to get a ping when it is live.
        </p>
      </header>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">What you will get</h2>
        <ul className="grid gap-2 text-slate-600">
          <li>Correct dates and times</li>
          <li>Clean .fit series ready for import</li>
          <li>Local processing in your browser</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-xl font-semibold text-slate-900">Early access list</h2>
        <p className="text-sm text-slate-600">Leave your email and we&apos;ll notify you when the converter ships.</p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            name="email"
            placeholder="you@example.com"
            className="w-full rounded-md border border-slate-300 px-4 py-2 text-base text-slate-900 focus:border-blue-500 focus:outline-none"
            disabled
         />
          <button
            type="button"
            className="rounded-md bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-500"
            disabled
          >
            Notify me
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-500">We&apos;ll email you when {meta.metric.toLowerCase()} import is available.</p>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-xl font-semibold text-slate-900">Related guides</h2>
        <ul className="grid gap-2 text-slate-600">
          <li>How to export Fitbit data with Google Takeout</li>
          <li>How to import a .fit file into Garmin Connect</li>
        </ul>
      </section>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-xl font-semibold text-slate-900">What&apos;s live today</h2>
        <Link
          to="/converters/weight"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Try the weight converter
        </Link>
      </section>
    </div>
  );
};

export default ComingSoonPage;

