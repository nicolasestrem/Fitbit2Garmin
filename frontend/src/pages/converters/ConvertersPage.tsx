import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const ConvertersPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <Helmet>
        <title>Trackersync Converters - Move your health data to Garmin</title>
        <meta
          name="description"
          content="Weight converter live, plus body fat, BMI, resting heart rate, and sleep score pages."
        />
        <link rel="canonical" href="https://trackersync.app/converters" />
      </Helmet>

      <header className="space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Converters</h1>
        <p className="text-lg text-slate-600">
          Pick a converter. Weight is live today. More series will arrive next.
        </p>
      </header>

      <div className="grid gap-6">
        <article className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          <h2 className="text-xl font-semibold text-blue-900">Weight (.json → .fit)</h2>
          <p className="mt-3 text-sm text-blue-900">
            Turn Fitbit weight JSON into Garmin-ready .fit files. Keep body fat when available.
          </p>
          <Link
            to="/converters/weight"
            className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Convert now
          </Link>
        </article>

        {[{
          slug: "body-fat",
          title: "Body fat (coming soon)",
          description: "Prepare body fat as a clean .fit series. Add it to Garmin with a simple import.",
        }, {
          slug: "bmi",
          title: "BMI (coming soon)",
          description: "Build a .fit series from your Fitbit export.",
        }, {
          slug: "resting-heart-rate",
          title: "Resting heart rate (coming soon)",
          description: "Create a .fit series you can import.",
        }, {
          slug: "sleep-score",
          title: "Sleep score (coming soon)",
          description: "Get your historical scores into Garmin.",
        }].map(card => (
          <article key={card.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">{card.title}</h2>
            <p className="mt-3 text-sm text-slate-600">{card.description}</p>
            <Link
              to={`/converters/${card.slug}`}
              className="mt-4 inline-flex items-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
            >
              Learn more
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
};

export default ConvertersPage;
