import React from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

export const HomePage: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl space-y-16">
      <Helmet>
        <title>Trackersync - Convert Fitbit Google Takeout to Garmin .fit (weight)</title>
        <meta
          name="description"
          content="Turn Fitbit weight JSON into Garmin-ready .fit files. Keep dates, times, and body fat. Free tier with 2 files per day."
        />
        <link rel="canonical" href="https://trackersync.app/" />
      </Helmet>

      <section className="space-y-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Move your health data where you need it
        </h1>
        <p className="text-lg text-slate-600 sm:text-xl">
          Trackersync turns Fitbit Google Takeout files into Garmin-ready <strong className="font-semibold">.fit</strong> files. Keep your weight history in Garmin Connect.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/app"
            className="rounded-md bg-blue-600 px-5 py-3 text-base font-semibold text-white shadow hover:bg-blue-700"
          >
            Convert your files
          </Link>
          <Link
            to="/product/how-it-works"
            className="rounded-md border border-slate-300 px-5 py-3 text-base font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900"
          >
            See how it works
          </Link>
        </div>
      </section>

      <section className="grid gap-8 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-slate-900">Why Trackersync</h2>
          <p className="text-slate-600">
            Garmin does not let third-party apps write data straight into Garmin Connect. Trackersync solves this by creating clean .fit files you can import in a few clicks. Your history stays intact.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[
            {
              title: "Google Takeout support",
              body: "Works with the current Fitbit export format for weight.",
            },
            {
              title: "Correct timestamps",
              body: "Your dates and times are kept.",
            },
            {
              title: "Body fat preserved",
              body: "When present in your export.",
            },
            {
              title: "Browser-only",
              body: "Files are processed on your device.",
            },
            {
              title: "Free tier",
              body: "Convert up to 2 files per day.",
            },
          ].map(feature => (
            <div key={feature.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">How it works</h2>
        <ol className="space-y-4 text-left text-slate-600">
          <li className="flex gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">1</span>
            <div>
              Export your data from Fitbit with Google Takeout.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">2</span>
            <div>Upload up to two <code className="rounded bg-slate-100 px-2 py-1">weight-YYYY-MM-DD.json</code> files.</div>
          </li>
          <li className="flex gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">3</span>
            <div>Download the generated <strong>.fit</strong> files.</div>
          </li>
          <li className="flex gap-3">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">4</span>
            <div>Import them in Garmin Connect.</div>
          </li>
        </ol>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">What you can convert today</h2>
          <p className="mt-2 text-slate-600">Weight</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-slate-700">
          <h3 className="text-lg font-semibold text-blue-900">Weight (.json → .fit)</h3>
          <ul className="mt-4 grid gap-2 text-sm">
            <li>Unit: kg or lb</li>
            <li>Extras: body fat % when present</li>
          </ul>
          <Link to="/converters/weight" className="mt-5 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Learn about the weight converter
          </Link>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Coming soon</h2>
        <ul className="grid gap-2 text-slate-600">
          <li>Body fat as a standalone series</li>
          <li>BMI</li>
          <li>Resting heart rate</li>
          <li>Sleep score</li>
        </ul>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Privacy</h2>
        <p className="text-slate-600">
          Your files never leave your computer. The conversion runs in your browser. No account needed.
        </p>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">Pricing</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Free</h3>
            <p className="mt-2 text-slate-600">2 files per day</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-semibold text-slate-900">Pro</h3>
            <p className="mt-2 text-slate-600">Higher limits and batch conversion (coming soon)</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-white/70 p-8">
        <h2 className="text-2xl font-semibold text-slate-900">FAQ</h2>
        <div className="space-y-6 text-left">
          {[{
            question: "Where do I find the right JSON file?",
            answer: "In your Google Takeout archive from Fitbit. Look for Global Export Data/weight-YYYY-MM-DD.json.",
          }, {
            question: "Can Garmin read .fit files for weight?",
            answer: "Yes. Import the file in Garmin Connect and the values appear in your timeline.",
          }, {
            question: "Will this overwrite anything?",
            answer: "No. It adds entries for the dates in your export.",
          }, {
            question: "Is there a size limit?",
            answer: "Large exports work, but start with a few files to check the result.",
          }, {
            question: "Do you store my data?",
            answer: "No. Processing is local.",
          }].map(item => (
            <div key={item.question}>
              <h3 className="text-lg font-semibold text-slate-900">{item.question}</h3>
              <p className="mt-2 text-slate-600">{item.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white/70 p-8 text-sm text-slate-600">
        Fitbit and Garmin are trademarks of their owners. Trackersync is an independent tool.
      </section>
    </div>
  );
};

export default HomePage;
