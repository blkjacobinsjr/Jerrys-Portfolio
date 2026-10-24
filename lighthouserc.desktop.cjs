const base = require('./lighthouserc.json');

// Desktop keeps every gate at 1.0; only mobile home performance is 0.99 (Jerry, 2026-10-24).
const assertions = base.ci.assert.assertMatrix[1].assertions;

module.exports = {
  ci: {
    ...base.ci,
    collect: {
      ...base.ci.collect,
      settings: { ...base.ci.collect.settings, preset: 'desktop' },
    },
    assert: { assertions },
    upload: { ...base.ci.upload, outputDir: 'reports/lighthouse-desktop' },
  },
};
