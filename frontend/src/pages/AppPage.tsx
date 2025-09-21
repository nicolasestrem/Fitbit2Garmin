import React from "react";
import { Helmet } from "react-helmet-async";
import { WeightConverterApp } from "../components/converters/WeightConverterApp";

const AppPage: React.FC = () => {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Helmet>
        <title>Trackersync Converter - Upload Fitbit weight JSON and get .fit files</title>
        <meta
          name="description"
          content="Upload Fitbit Google Takeout weight JSON files and download Garmin-ready .fit files. Processing happens locally in your browser."
        />
        <link rel="canonical" href="https://trackersync.app/app" />
      </Helmet>

      <header className="space-y-3 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Convert your Fitbit weight files</h1>
        <p className="text-slate-600">
          Drag in up to three weight-YYYY-MM-DD.json files. Trackersync converts them to Garmin-compatible .fit files on your device.
        </p>
      </header>

      <WeightConverterApp />
    </div>
  );
};

export default AppPage;
