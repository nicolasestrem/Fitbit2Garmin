import React from "react";
import "./SiteFooter.css";

export const SiteFooter: React.FC = () => {
  return (
    <footer className="site-footer">
      <div className="footer-columns">
        <div className="footer-column">
          <h3>Product</h3>
          <ul>
            <li><a href="/product">Overview</a></li>
            <li><a href="/product/how-it-works">How it works</a></li>
            <li><a href="/pricing">Pricing</a></li>
          </ul>
        </div>
        <div className="footer-column">
          <h3>Converters</h3>
          <ul>
            <li><a href="/converters/weight">Weight</a></li>
            <li><a href="/converters/body-fat">Body fat</a></li>
            <li><a href="/converters/bmi">BMI</a></li>
            <li><a href="/converters/resting-heart-rate">Resting heart rate</a></li>
            <li><a href="/converters/sleep-score">Sleep score</a></li>
          </ul>
        </div>
        <div className="footer-column">
          <h3>Company</h3>
          <ul>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/docs">Docs</a></li>
            <li><a href="/contact">Contact</a></li>
          </ul>
        </div>
      </div>
      <div className="footer-smallprint">
        Fitbit and Garmin are trademarks of their owners. Trackersync is not affiliated with them.
      </div>
    </footer>
  );
};
